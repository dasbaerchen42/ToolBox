// 「文件」的所見即所得編輯:畫面上是排好的樣子,存起來還是 Markdown。
// 字色、底色、底線這些 Markdown 沒有的,存成很短的 HTML 標籤(用 class,不寫死顏色):
//   <span class="tc-red">紅字</span>、<mark class="hl-yellow">黃底</mark>、<u>底線</u>
// 置中、置右的段落存成 <p style="text-align: center">……</p>。
// 渲染(預覽、轉圖)走 lib/markdown 的 renderToSafeHtml,class 與 text-align 都會留著。

import TurndownService from "turndown";

/** 字色:深淺主題上都看得清楚的中間色 */
export const TEXT_COLORS = [
  { key: "red", label: "紅", color: "#e0574f" },
  { key: "orange", label: "橘", color: "#e8893a" },
  { key: "gold", label: "金", color: "#c99a1e" },
  { key: "green", label: "綠", color: "#3fa36f" },
  { key: "teal", label: "青", color: "#2f9fa6" },
  { key: "blue", label: "藍", color: "#4a8fe0" },
  { key: "purple", label: "紫", color: "#9372d8" },
  { key: "pink", label: "粉", color: "#e0679f" },
  { key: "gray", label: "灰", color: "var(--ink-tertiary)" },
] as const;

/** 底色:半透明,淺色、深色主題上字都還看得清楚 */
export const HIGHLIGHTS = [
  { key: "yellow", label: "黃", color: "rgba(255, 200, 60, 0.32)" },
  { key: "pink", label: "粉", color: "rgba(255, 120, 160, 0.28)" },
  { key: "blue", label: "藍", color: "rgba(90, 160, 255, 0.28)" },
  { key: "green", label: "綠", color: "rgba(100, 200, 130, 0.28)" },
  { key: "purple", label: "紫", color: "rgba(160, 120, 230, 0.28)" },
  { key: "gray", label: "灰", color: "rgba(140, 140, 140, 0.25)" },
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
      const key = highlightFromClass((node as HTMLElement).className) ?? "yellow";
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

/** 拿掉文件裡的字色、底色、底線、對齊標籤,只留文字(匯出成純文字時用,例如 Google Docs) */
export function stripRichTags(markdown: string): string {
  return markdown
    .replace(/<\/?(?:span|mark|u)\b[^>]*>/g, "")
    .replace(/<(p|h[1-6]) style="text-align: (?:center|right)">([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) =>
      tag === "p" ? inner : `${"#".repeat(Number(tag[1]))} ${inner}`
    );
}
