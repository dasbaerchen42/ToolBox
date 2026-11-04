// 「文件」的所見即所得編輯:畫面上是排好的樣子,存起來還是 Markdown。
// 字色、底色、底線這些 Markdown 沒有的,存成很短的 HTML 標籤(用 class,不寫死顏色):
//   <span class="tc-azuki">彩色字</span>、<mark class="hl-azuki">底色</mark>、<u>底線</u>
// 置中、置右的段落存成 <p style="text-align: center">……</p>。
// 渲染(預覽、轉圖)走 lib/markdown 的 renderToSafeHtml,class 與 text-align 都會留著。

import TurndownService from "turndown";

/** 日本傳統色系的 12 色；名稱僅供無障礙標籤使用，選單只顯示色票。 */
export const TEXT_COLORS = [
  { key: "azuki", label: "小豆色", color: "var(--tc-azuki)" },
  { key: "kuriume", label: "栗梅", color: "var(--tc-kuriume)" },
  { key: "kigaracha", label: "黄唐茶", color: "var(--tc-kigaracha)" },
  { key: "uguisu", label: "鶯色", color: "var(--tc-uguisu)" },
  { key: "chitose", label: "千歳緑", color: "var(--tc-chitose)" },
  { key: "sabiasagi", label: "錆浅葱", color: "var(--tc-sabiasagi)" },
  { key: "omeshicha", label: "御召茶", color: "var(--tc-omeshicha)" },
  { key: "kon", label: "紺色", color: "var(--tc-kon)" },
  { key: "fujinando", label: "藤納戸", color: "var(--tc-fujinando)" },
  { key: "kodaimurasaki", label: "古代紫", color: "var(--tc-kodaimurasaki)" },
  { key: "ebizome", label: "蒲葡", color: "var(--tc-ebizome)" },
  { key: "sumi", label: "墨", color: "var(--tc-sumi)" },
] as const;

/** 底色與字色同為 12 色；CSS 會按頁面深淺選用不同明度。 */
export const HIGHLIGHTS = [
  { key: "azuki", label: "小豆色", color: "var(--hl-azuki)" },
  { key: "kuriume", label: "栗梅", color: "var(--hl-kuriume)" },
  { key: "kigaracha", label: "黄唐茶", color: "var(--hl-kigaracha)" },
  { key: "uguisu", label: "鶯色", color: "var(--hl-uguisu)" },
  { key: "chitose", label: "千歳緑", color: "var(--hl-chitose)" },
  { key: "sabiasagi", label: "錆浅葱", color: "var(--hl-sabiasagi)" },
  { key: "omeshicha", label: "御召茶", color: "var(--hl-omeshicha)" },
  { key: "kon", label: "紺色", color: "var(--hl-kon)" },
  { key: "fujinando", label: "藤納戸", color: "var(--hl-fujinando)" },
  { key: "kodaimurasaki", label: "古代紫", color: "var(--hl-kodaimurasaki)" },
  { key: "ebizome", label: "蒲葡", color: "var(--hl-ebizome)" },
  { key: "sumi", label: "墨", color: "var(--hl-sumi)" },
] as const;

export type TextColorKey = (typeof TEXT_COLORS)[number]["key"];
export type HighlightKey = (typeof HIGHLIGHTS)[number]["key"];

const COLOR_CLASS = /\btc-([a-z]+)\b/;
const HIGHLIGHT_CLASS = /\bhl-([a-z]+)\b/;

export function colorFromClass(className: string | null | undefined): string | null {
  return COLOR_CLASS.exec(className ?? "")?.[1] ?? null;
}

export function highlightFromClass(className: string | null | undefined): string | null {
  return HIGHLIGHT_CLASS.exec(className ?? "")?.[1] ?? null;
}

function alignOf(node: HTMLElement): string | null {
  const align = /text-align\s*:\s*(center|right)/i.exec(node.getAttribute("style") ?? "")?.[1];
  return align ? align.toLowerCase() : null;
}

let service: TurndownService | null = null;

function turndown(): TurndownService {
  if (service) return service;
  const td = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    codeBlockStyle: "fenced",
    // 段落裡的換行:渲染時開著 breaks,單一個換行就會斷行,不需要行尾兩個空白
    br: "",
  });

  // 編輯器的清單項目裡多包了一層 <p>,照預設會變成項目之間空一行的「鬆散清單」
  td.addRule("listParagraph", {
    filter: (node) => node.nodeName === "P" && node.parentNode?.nodeName === "LI",
    replacement: (content, node) => (node.nextSibling ? `${content}\n` : content),
  });
  td.addRule("listItem", {
    filter: "li",
    replacement: (content, node, options) => {
      const body = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n(?!$)/g, "\n   ");
      const parent = node.parentNode as HTMLElement | null;
      let prefix = `${options.bulletListMarker} `;
      if (parent?.nodeName === "OL") {
        const start = Number(parent.getAttribute("start") ?? 1);
        prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
      }
      return prefix + body + (node.nextSibling && !body.endsWith("\n") ? "\n" : "");
    },
  });
  td.addRule("textColor", {
    filter: (node) => node.nodeName === "SPAN" && !!colorFromClass((node as HTMLElement).className),
    replacement: (content, node) => (content ? `<span class="tc-${colorFromClass((node as HTMLElement).className)}">${content}</span>` : ""),
  });
  td.addRule("highlight", {
    filter: (node) => node.nodeName === "MARK",
    replacement: (content, node) => {
      const key = highlightFromClass((node as HTMLElement).className) ?? "kigaracha";
      return content ? `<mark class="hl-${key}">${content}</mark>` : "";
    },
  });
  td.addRule("underline", {
    filter: ["u"],
    replacement: (content) => (content ? `<u>${content}</u>` : ""),
  });
  td.addRule("strike", {
    filter: ["s", "del", "strike"] as (keyof HTMLElementTagNameMap)[],
    replacement: (content) => (content ? `~~${content}~~` : ""),
  });
  // 置中、置右的段落與標題:整段存成 HTML(Markdown 沒有對齊),裡面的粗體斜體也照 HTML 留著
  td.addRule("aligned", {
    filter: (node) => /^(P|H[1-6])$/.test(node.nodeName) && !!alignOf(node as HTMLElement),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const tag = el.nodeName.toLowerCase();
      // 區塊 HTML 裡不能有空行,不然 Markdown 會把它切斷
      const inner = el.innerHTML.replace(/\n+/g, " ");
      return `\n\n<${tag} style="text-align: ${alignOf(el)}">${inner}</${tag}>\n\n`;
    },
  });
  service = td;
  return td;
}

/** 編輯器的 HTML → 存檔用的 Markdown */
export function htmlToMarkdown(html: string): string {
  return turndown()
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 拿掉文件裡的字色、底色、底線、對齊標籤,只留下純文字 */
export function stripRichTags(markdown: string): string {
  return markdown
    .replace(/<\/?(?:span|mark|u)\b[^>]*>/g, "")
    .replace(/<(p|h[1-6]) style="text-align: (?:center|right)">([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) =>
      tag === "p" ? inner : `${"#".repeat(Number(tag[1]))} ${inner}`
    );
}
