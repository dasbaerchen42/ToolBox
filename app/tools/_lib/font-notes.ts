// 哪些樣式會把字留在原地。
//
// Mathematical Alphanumeric Symbols 並沒有每種樣式都配一組數字,
// 所以哥德字、手寫字、斜體那幾種碰到數字會原樣輸出,變成「字母變了、數字沒變」。
// 這件事在按下去之前看不出來,所以面板要先講。
//
// 判斷方式是拿探針字串去跑真正的轉換,不另外維護一份清單——
// fancy-fonts 改了這裡會自動跟上。

import { getFontResults } from "./fancy-fonts";

const DIGIT_PROBE = "0123456789";
const LETTER_PROBE = "abcxyzABCXYZ";

export type FontGaps = {
  /** 數字不會被轉換 */
  digits: boolean;
  /** 連字母都沒轉(理論上不該發生,留著當防呆) */
  letters: boolean;
};

let cache: Map<string, FontGaps> | null = null;

function build(): Map<string, FontGaps> {
  const digits = new Map(
    getFontResults(DIGIT_PROBE).map((item) => [item.key, item.value])
  );
  const letters = new Map(
    getFontResults(LETTER_PROBE).map((item) => [item.key, item.value])
  );

  const result = new Map<string, FontGaps>();
  for (const key of digits.keys()) {
    result.set(key, {
      digits: digits.get(key) === DIGIT_PROBE,
      letters: letters.get(key) === LETTER_PROBE,
    });
  }
  return result;
}

export function gapsFor(styleKey: string): FontGaps {
  cache ??= build();
  return cache.get(styleKey) ?? { digits: false, letters: false };
}

/** 有 CJK 或其他非 ASCII 的字,那些一律原樣保留(這是設計,不是壞掉) */
export function hasNonAscii(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

/** 這段文字套這個樣式會有哪些地方沒變;沒有就回 null */
export function describeGaps(styleKey: string, sample: string): string | null {
  const gaps = gapsFor(styleKey);
  const notes: string[] = [];

  if (gaps.digits && /[0-9]/.test(sample)) notes.push("數字");
  if (hasNonAscii(sample)) notes.push("中文與其他非英數字元");

  return notes.length > 0 ? `${notes.join("、")}會維持原樣` : null;
}
