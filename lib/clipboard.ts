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
