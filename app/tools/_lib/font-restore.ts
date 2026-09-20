// 把花式字體還原成一般文字。
//
// 為什麼需要:套過字體的文字已經不是 ASCII,而 fancy-fonts 只認 ASCII,
// 所以再套第二種樣式會完全沒有反應。想換樣式就得先變回原樣。
//
// 反查表不是手寫的,是拿探針字串去跑正向轉換再配對出來的——
// fancy-fonts 增減樣式時這裡自動跟上,不會有兩份清單走鐘。

import { getFontResults } from "./fancy-fonts";

const PROBE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * 顛倒類的樣式把字序也反過來了,單靠字元反查只會得到倒著的文字,
 * 而且它們用的字元跟其他樣式大量撞號。排除掉。
 */
const SKIP_STYLES = new Set(["upsideDown", "reverseUpsideDown"]);

// 組合用附加符號:刪除線、閃光、底線裝飾那幾種是疊在原字上的,直接剝掉。
// test() 另外用不帶 g 的版本——帶 g 的正規表達式會記住 lastIndex,
// 連續呼叫同一個實例結果會跳動。
const COMBINING_SOURCE = "[\\u0300-\\u036F\\u035F\\u0483-\\u0489\\u20D0-\\u20FF]";
const COMBINING_ALL = new RegExp(COMBINING_SOURCE, "g");
const COMBINING_ONE = new RegExp(COMBINING_SOURCE);

let reverse: Map<string, string> | null = null;

function build(): Map<string, string> {
  const map = new Map<string, string>();
  const source = [...PROBE];

  for (const style of getFontResults(PROBE)) {
    if (SKIP_STYLES.has(style.key)) continue;

    const mapped = [...style.value];
    // 長度對不上代表它是疊附加符號的樣式,那種靠剝除處理,不進反查表
    if (mapped.length !== source.length) continue;

    mapped.forEach((char, index) => {
      if (char === source[index]) return;
      // ASCII 不能進反查表:有些樣式碰到沒有對應字的字母會退回 ASCII
      // (小型大寫的 X 就是小寫 x),收進來的話連一般文字都會被「還原」成別的字
      if ((char.codePointAt(0) ?? 0) < 128) return;
      // 先建的樣式優先,後面撞號的不覆蓋
      if (!map.has(char)) map.set(char, source[index]);
    });
  }

  return map;
}

/** 還原成一般英數字;認不得的字元原樣保留(中文、標點、表情符號都不會被動到) */
export function toPlainText(input: string): string {
  reverse ??= build();
  const table = reverse;

  return [...input.replace(COMBINING_ALL, "")]
    .map((char) => table.get(char) ?? char)
    .join("");
}

/** 這段文字裡有沒有可以還原的花式字元 */
export function hasStyledText(input: string): boolean {
  reverse ??= build();
  const table = reverse;

  if (COMBINING_ONE.test(input)) return true;
  return [...input].some((char) => table.has(char));
}
