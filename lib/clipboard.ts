export type PastePayload = {
  text: string;
  /** 來源同時提供的 HTML 版本(從網頁複製時通常都有);沒有就是 null */
  html: string | null;
};

const RICH_TAG =
  /<(strong|b|em|i|u|h[1-6]|ul|ol|li|table|blockquote|a\s|img|code|pre|hr|del|s)\b/i;

/**
 * 剪貼簿裡幾乎所有來源都會附一份 text/html,但很多只是把純文字包在
 * <div>/<span> 裡,保留格式沒有意義。真的有排版標籤才值得問使用者。
 */
export function hasRichFormatting(html: string | null): boolean {
  return !!html && RICH_TAG.test(html);
}

/** 從 paste 事件取內容(不需要任何權限) */
export function readPasteEvent(event: ClipboardEvent): PastePayload | null {
  const data = event.clipboardData;
  if (!data) return null;

  const text = data.getData("text/plain") ?? "";
  const html = data.getData("text/html") || null;
  if (!text.trim() && !html) return null;

  return { text, html };
}

/**
 * 主動讀剪貼簿(手機沒有 Ctrl+V 時用)。
 * 多數瀏覽器會先問一次「要允許貼上嗎」,被拒絕或不支援就回 null,
 * 由呼叫端提示改用鍵盤貼上。
 */
export async function readClipboard(): Promise<PastePayload | null> {
  const clipboard = navigator.clipboard;
  if (!clipboard) return null;

  if (clipboard.read) {
    try {
      for (const item of await clipboard.read()) {
        const html = item.types.includes("text/html")
          ? await (await item.getType("text/html")).text()
          : null;
        const text = item.types.includes("text/plain")
          ? await (await item.getType("text/plain")).text()
          : "";
        if (text.trim() || html) return { text, html };
      }
      return null;
    } catch {
      // 不支援 read() 或使用者拒絕:退回只讀純文字
    }
  }

  try {
    const text = await clipboard.readText();
    return text.trim() ? { text, html: null } : null;
  } catch {
    return null;
  }
}

/** 用內容的第一行當文件標題 */
export function titleFromContent(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return "未命名文件";

  return (
    line
      // 去掉 Markdown 的標題井字號、引言箭頭、清單符號
      .replace(/^#{1,6}\s*/, "")
      .replace(/^>\s*/, "")
      .replace(/^[-*+]\s*/, "")
      .slice(0, 20) || "未命名文件"
  );
}

const IMAGE_MIME = /^image\//;

/**
 * 從 paste 事件取圖片(不需要任何權限)。
 *
 * 有些瀏覽器只填 clipboardData.items、有些只填 files,兩邊都撈才不會漏。
 * 同一張圖可能兩邊都有,所以用檔名 + 大小去重。
 */
export function readPasteImages(event: ClipboardEvent): File[] {
  const data = event.clipboardData;
  if (!data) return [];

  const found: File[] = [];
  const seen = new Set<string>();

  const push = (file: File | null) => {
    if (!file || !IMAGE_MIME.test(file.type)) return;
    const key = `${file.name}:${file.size}:${file.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(file);
  };

  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file") push(item.getAsFile());
  }
  for (const file of Array.from(data.files ?? [])) push(file);

  return found;
}

/** 主動讀剪貼簿裡的圖(手機沒有 Ctrl+V 時用);沒權限或沒圖就回空陣列 */
export async function readClipboardImages(): Promise<File[]> {
  const clipboard = navigator.clipboard;
  if (!clipboard?.read) return [];

  try {
    const found: File[] = [];

    for (const item of await clipboard.read()) {
      const type = item.types.find((value) => IMAGE_MIME.test(value));
      if (!type) continue;

      const blob = await item.getType(type);
      const extension = type.split("/")[1] ?? "png";
      found.push(new File([blob], `剪貼簿圖片.${extension}`, { type }));
    }

    return found;
  } catch {
    // 不支援 read() 或使用者拒絕:由呼叫端提示改用鍵盤貼上
    return [];
  }
}

const ITALIC_TAGS = new Set(["EM", "I"]);

const BLOCK_TAGS = new Set([
  "P", "DIV", "LI", "TR", "BLOCKQUOTE", "SECTION", "ARTICLE", "PRE",
  "H1", "H2", "H3", "H4", "H5", "H6",
]);

function isItalicElement(element: Element): boolean {
  if (ITALIC_TAGS.has(element.tagName)) return true;
  // Google Docs 之類的來源不用 <em>,而是 <span style="font-style:italic">
  return /font-style\s*:\s*italic/i.test(element.getAttribute("style") ?? "");
}

/** 剪貼簿的 HTML 裡有沒有斜體?沒有的話用純文字版就夠了 */
export function hasItalicMarkup(html: string | null): boolean {
  if (!html) return false;
  return /<(em|i)\b/i.test(html) || /font-style\s*:\s*italic/i.test(html);
}

function collectText(node: Node, italic: boolean, out: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      // HTML 會把連續空白壓成一個空格,換行只認 <br> 與區塊邊界
      out.push((child.nodeValue ?? "").replace(/\s+/g, " "));
      continue;
    }
    if (child.nodeType !== 1) continue;

    const element = child as Element;
    if (element.tagName === "SCRIPT" || element.tagName === "STYLE") continue;
    if (element.tagName === "BR") {
      out.push("\n");
      continue;
    }

    // 巢狀的斜體不要再包一層星號
    const opening = isItalicElement(element) && !italic;
    if (opening) out.push("*");
    collectText(element, italic || opening, out);
    if (opening) out.push("*");

    if (BLOCK_TAGS.has(element.tagName)) out.push("\n");
  }
}

/**
 * 把剪貼簿的 HTML 轉回純文字,但把斜體還原成 *…*。
 *
 * 從已經排版好的網頁複製時,斜體是真的排版樣式,text/plain 裡面一個星號都沒有
 * ——「修正變成斜體的對話」那條規則因此完全沒東西可修。這裡把標記接回來,
 * 規則才有得判斷。
 *
 * 只是讀 DOM 取文字,不會把任何東西插回頁面,所以 HTML 內容不會被執行。
 */
export function htmlToItalicText(html: string): string {
  if (typeof DOMParser === "undefined") return "";

  const doc = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];
  collectText(doc.body, false, parts);

  return (
    parts
      .join("")
      // 只框到空白的斜體是空殼,拆掉
      .replace(/\*(\s*)\*/g, "$1")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}
