// 社群排版的分析層:convertSocialText 會插入哪些隱形字元、插在哪裡。
//
// 轉換本身在 social.ts,這裡只負責「看穿」它——因為插進去的東西
// (U+2800 空白盲文、U+200B 零寬空格)在畫面上完全看不出來,
// 輸出結果跟原文長得一模一樣,所以要另外把位置標示出來才有得檢查。

export type MarkedLine =
  /** length 是原本那行的長度:只有空白的行會被整行換成一個字元,所以會少掉這些 */
  | { kind: "blank"; length: number }
  /** 行首有空白,每一格都會被墊上零寬空格 */
  | { kind: "indent"; spaces: number; text: string }
  | { kind: "plain"; text: string };

export type SocialCount = {
  blankLines: number;
  indentSpaces: number;
  /** 會被插入的隱形字元數(這是要給使用者看的數字) */
  chars: number;
  /** 空行原本的空白會被整行取代掉,這是被吃掉的字元數 */
  trimmed: number;
};

/**
 * 逐行判斷 convertSocialText 會怎麼處理。
 *
 * 判斷條件跟 social.ts 一模一樣,所以已經轉換過的文字不會被重複計算:
 * 「⠀」trim 後不是空字串、行首的零寬空格也不符合 /^ +/。
 */
export function analyzeSocial(text: string): MarkedLine[] {
  // convertSocialText 對空字串是直接提前返回、什麼都不插,
  // 這裡要跟著一樣,否則空白文件會回報「會插入 1 個空行」
  if (!text) return [];

  return text.split("\n").map((line): MarkedLine => {
    if (line.trim() === "") return { kind: "blank", length: line.length };

    const leading = line.match(/^ +/);
    if (leading) {
      return {
        kind: "indent",
        spaces: leading[0].length,
        text: line.slice(leading[0].length),
      };
    }

    return { kind: "plain", text: line };
  });
}

/** 空行各補 1 個字元,行首每一格空白各補 1 個零寬空格 */
export function countSocial(lines: MarkedLine[]): SocialCount {
  let blankLines = 0;
  let indentSpaces = 0;
  let trimmed = 0;

  for (const line of lines) {
    if (line.kind === "blank") {
      blankLines += 1;
      trimmed += line.length;
    }
    if (line.kind === "indent") indentSpaces += line.spaces;
  }

  return { blankLines, indentSpaces, chars: blankLines + indentSpaces, trimmed };
}

/** 給人看的一句話;沒東西可插就說沒有 */
export function describeSocial(count: SocialCount): string {
  if (count.chars === 0) return "沒有需要保護的空行或縮排";

  const parts: string[] = [];
  if (count.blankLines > 0) parts.push(`${count.blankLines} 個空行`);
  if (count.indentSpaces > 0) parts.push(`${count.indentSpaces} 格縮排`);

  return `複製時會插入 ${count.chars} 個隱形字元（${parts.join("、")}）`;
}
