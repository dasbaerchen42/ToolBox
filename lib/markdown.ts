import { type WritingMode } from "@/lib/storage";

/** 目前只有這兩種模式有渲染結果可看 */
export type RenderableMode = "markdown" | "html";

export function isRenderableMode(mode: WritingMode): mode is RenderableMode {
  return mode === "markdown" || mode === "html";
}

/** 貼進來的 HTML 裡,行內樣式只留這些「有意義的強調」 */
const KEPT_STYLES = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "text-align",
  "vertical-align",
]);

/**
 * 行內樣式只留粗體、斜體、底線刪除線、對齊;顏色、底色、字體、字級都拿掉。
 * 從網頁、文件、聊天 App 複製的內容常帶著「黑字白底」,
 * 換成深色主題(像蝶豆花)就變成深底黑字整段看不見;字體字級也該跟著設定走。
 */
export function cleanInlineStyle(style: string): string {
  return style
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const name = part.split(":")[0]?.trim().toLowerCase();
      return !!name && KEPT_STYLES.has(name);
    })
    .join("; ");
}

let styleHookInstalled = false;

/**
 * 產生可以安全塞進 innerHTML 的 HTML。
 *
 * Markdown 與 HTML 兩種模式走同一條管線:marked 會把 Markdown 裡混寫的
 * HTML 原樣吐出,最後統一交給 DOMPurify 清洗,所以「MD 裡面夾 HTML」
 * 是天然支援的,不必另外開一個模式。
 *
 * marked 與 DOMPurify 都用動態 import 載入(DOMPurify 需要 window,
 * 而且這兩包沒必要進首屏 bundle)。
 */
export async function renderToSafeHtml(
  mode: RenderableMode,
  content: string
): Promise<string> {
  const [{ marked }, { default: DOMPurify }] = await Promise.all([
    import("marked"),
    import("dompurify"),
  ]);

  const raw =
    mode === "markdown"
      ? await marked.parse(content, {
          gfm: true,
          // 寫作用途:單一換行就斷行,比較符合直覺
          breaks: true,
        })
      : content;

  if (!styleHookInstalled) {
    styleHookInstalled = true;
    DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
      if (data.attrName !== "style") return;
      const cleaned = cleanInlineStyle(data.attrValue);
      if (cleaned) data.attrValue = cleaned;
      else data.keepAttr = false;
    });
    // 舊式的 <font color> 也一樣交給主題
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.nodeName === "FONT") {
        node.removeAttribute("color");
        node.removeAttribute("face");
        node.removeAttribute("size");
      }
      node.removeAttribute("bgcolor");
    });
  }

  return DOMPurify.sanitize(raw, {
    // 只留 HTML,不開 SVG / MathML,縮小可被利用的面積
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });
}

/** 非 Markdown/HTML 模式要轉圖時,把原文轉義後包成 <pre>,保留換行與空白 */
export function toPlainHtml(content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre class="md-preview-plain">${escaped}</pre>`;
}

/**
 * 把渲染後的 HTML 拆成一個個頂層區塊(段落、清單、表格……),
 * 讓使用者可以只挑其中幾段轉圖。裸露的文字節點會被包成 <p>。
 */
export function splitBlocks(html: string): string[] {
  if (typeof window === "undefined") return html ? [html] : [];

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];

  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push((node as Element).outerHTML);
      continue;
    }
    const text = node.textContent ?? "";
    if (text.trim()) blocks.push(`<p>${text}</p>`);
  }

  return blocks;
}

// ---- 舊版:轉圖視窗裡設定的段落樣式(現在改在編輯器裡做,只剩轉換舊資料用) ----

export type BlockAlign = "left" | "center" | "right";
export type BlockFill = "none" | "yellow" | "pink" | "blue" | "green";
export type BlockStyle = { align: BlockAlign; fill: BlockFill; underline: boolean };

export const PLAIN_BLOCK: BlockStyle = { align: "left", fill: "none", underline: false };

export function isPlainBlock(style: BlockStyle | undefined): boolean {
  return !style || (style.align === "left" && style.fill === "none" && !style.underline);
}

// ---- 段落樣式存進文件 ----
// 用段落內容的雜湊對回是哪一段;內容改過(雜湊對不到)就退而求其次用原本的位置,
// 改個錯字樣式不會不見,前面插了新段落也不會套錯段。

/** i:原本第幾段;h:那一段內容的雜湊;p、n:前一段、後一段的雜湊(沒有就是空字串) */
export type StoredBlockStyle = { i: number; h: string; p?: string; n?: string; s: BlockStyle };

/** FNV-1a,32 位元就夠分辨同一份文件裡的段落 */
export function hashBlock(html: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < html.length; i += 1) {
    hash ^= html.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** 存起來的樣式 → 每一段的樣式(沒有就是 undefined) */
export function resolveBlockStyles(blocks: string[], stored: StoredBlockStyle[] | undefined): (BlockStyle | undefined)[] {
  const out: (BlockStyle | undefined)[] = new Array(blocks.length).fill(undefined);
  if (!stored?.length) return out;
  const hashes = blocks.map(hashBlock);
  const used = new Set<number>();
  const taken = new Set<number>();
  // 先照內容對:同樣內容出現好幾次時,離原本位置近的先配
  const pairs: { k: number; index: number; distance: number }[] = [];
  stored.forEach((entry, k) => {
    hashes.forEach((hash, index) => {
      if (hash === entry.h) pairs.push({ k, index, distance: Math.abs(entry.i - index) });
    });
  });
  pairs.sort((a, b) => a.distance - b.distance);
  for (const { k, index } of pairs) {
    if (used.has(k) || taken.has(index)) continue;
    used.add(k);
    taken.add(index);
    out[index] = stored[k].s;
  }
  // 對不到的(那一段改過字):原本位置上的段落還沒配到,而且前後段都跟當初一樣,才算是同一段
  stored.forEach((entry, k) => {
    const index = entry.i;
    if (used.has(k) || index >= blocks.length || taken.has(index)) return;
    if ((hashes[index - 1] ?? "") !== (entry.p ?? "") || (hashes[index + 1] ?? "") !== (entry.n ?? "")) return;
    taken.add(index);
    out[index] = entry.s;
  });
  return out;
}

/** 每一段的樣式 → 要存的樣子(沒樣式的段落不存) */
export function storeBlockStyles(blocks: string[], styles: (BlockStyle | undefined)[]): StoredBlockStyle[] {
  const hashes = blocks.map(hashBlock);
  return blocks.flatMap((_, index) => {
    const style = styles[index];
    return style && !isPlainBlock(style)
      ? [{ i: index, h: hashes[index], p: hashes[index - 1] ?? "", n: hashes[index + 1] ?? "", s: style }]
      : [];
  });
}
/**
 * 舊版在轉圖視窗設定的段落樣式 → 寫進內容裡的格式(編輯器現在自己就能上色、對齊)。
 * 對齊變成段落的 text-align,底色變成 <mark class="hl-…">,底線變成 <u>。
 * 輸入輸出都是 HTML(已清洗過的渲染結果)。
 */
export function blockStylesToMarkup(html: string, stored: StoredBlockStyle[] | undefined): string {
  const blocks = splitBlocks(html);
  const styles = resolveBlockStyles(blocks, stored);
  return blocks
    .map((block, index) => {
      const style = styles[index];
      if (!style || isPlainBlock(style)) return block;
      const el = new DOMParser().parseFromString(block, "text/html").body.firstElementChild as HTMLElement | null;
      if (!el || el.tagName === "PRE") return block;
      // 段落、標題直接改;引用、清單改裡面的每一段
      const targets = /^(P|H[1-6])$/.test(el.tagName)
        ? [el]
        : (Array.from(el.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")).filter((node) => !node.querySelector("p, li")) as HTMLElement[]);
      for (const target of targets) {
        let inner = target.innerHTML;
        if (style.underline) inner = `<u>${inner}</u>`;
        if (style.fill !== "none") inner = `<mark class="hl-${style.fill}">${inner}</mark>`;
        target.innerHTML = inner;
        if (style.align !== "left" && target.tagName !== "LI") target.style.textAlign = style.align;
      }
      return el.outerHTML;
    })
    .join("");
}
