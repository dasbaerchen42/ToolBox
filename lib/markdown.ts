import { type WritingMode } from "@/lib/storage";

/** 目前只有這兩種模式有渲染結果可看 */
export type RenderableMode = "markdown" | "html";

export function isRenderableMode(mode: WritingMode): mode is RenderableMode {
  return mode === "markdown" || mode === "html";
}

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
