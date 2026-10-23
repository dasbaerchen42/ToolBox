// 轉圖的文字遮罩:指定的字(人名、地名……)在圖上蓋成一塊主題色,看不到原字。
//
// 只改文字、不碰標籤:HTML 切成「標籤」與「文字」兩種片段,只在文字片段裡找。
// 遮罩是一個 span,字還在、只是透明,佔的寬度一模一樣,換行與分頁都不會變。
// 同一個詞被粗體之類的標籤切成兩半時找不到(很少見),就不遮。

/** 使用者輸入的遮罩字:逗號、頓號或換行隔開;去頭尾空白、去重,長的先比對 */
export function parseMaskTerms(input: string): string[] {
  const terms = input
    .split(/[,，、\n]+/)
    .map((term) => term.trim())
    .filter(Boolean);
  return [...new Set(terms)].sort((a, b) => b.length - a.length);
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 遮罩的樣子:主題色的底、字透明;用行內樣式,轉圖的複製文件也吃得到。
 * inline-block + nowrap:一個詞不會被折成兩行。折行的話,轉圖工具會把跨兩行的底色
 * 畫成一整塊、把整段蓋掉;預覽用同一份樣式,看到的換行跟圖一樣。
 * line-height 1.2:色塊只蓋住字本身的高度,不會撐滿整個行高,上下兩行的遮罩之間留得出空隙。
 */
export const MASK_STYLE =
  "display: inline-block; white-space: nowrap; line-height: 1.2; background: var(--accent); color: transparent; border-radius: 0.15em; text-decoration: none;";

/** 不能放在行尾的標點 */
const LEADING_PUNCTUATION = "[「『（《〈(]";
/** 不能放在行首的標點 */
const TRAILING_PUNCTUATION = "[，。、！？；：」』）》〉…,.!?;:)]";

/** 把 html 文字裡出現的遮罩字包成遮罩;英文不分大小寫 */
export function maskHtml(html: string, terms: string[]): string {
  if (terms.length === 0 || !html) return html;
  // 緊貼前後的標點一起包進不換行的範圍:遮罩是 inline-block,不包的話
  // 「，」會被擠到下一行開頭、「「」會落單在上一行結尾
  const pattern = new RegExp(
    `(${LEADING_PUNCTUATION}*)(${terms.map((term) => escapeRegExp(escapeHtml(term))).join("|")})(${TRAILING_PUNCTUATION}*)`,
    "gi"
  );
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(pattern, (_, before: string, word: string, after: string) => {
            const mask = `<span data-mask="" style="${MASK_STYLE}">${word}</span>`;
            return before || after ? `<span style="white-space: nowrap">${before}${mask}${after}</span>` : mask;
          })
    )
    .join("");
}
