// 文字編輯器轉圖的「對話框」樣式:把標了左/右的段落畫成聊天室的泡泡。
//
// 引用(> 開頭)或段落裡的每一行各變一顆泡泡;引用裡空一行就是泡泡之間多空一點。
// 沒有標記的段落照原本的樣子排,所以敘述、旁白不用另外處理。

export type ChatSide = "left" | "right";

/** 泡泡怎麼切:每一行一顆,或一段(空一行之間)一顆、段裡照原本換行 */
export type ChatSplit = "line" | "paragraph";

/** 開視窗時先猜一次:引用當成對方傳來的訊息(左邊),其他不標 */
export function defaultChatSides(blocks: string[]): Map<number, ChatSide> {
  const sides = new Map<number, ChatSide>();
  blocks.forEach((block, index) => {
    if (/^\s*<blockquote[\s>]/i.test(block)) sides.set(index, "left");
  });
  return sides;
}

/** 標記循環:不標 → 左 → 右 → 不標 */
export function nextChatSide(side: ChatSide | undefined): ChatSide | undefined {
  if (side === undefined) return "left";
  if (side === "left") return "right";
  return undefined;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** 一個段落元素 → 一行一行的 HTML(依 <br> 切開,空行丟掉) */
function linesOf(element: Element): string[] {
  return element.innerHTML
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter((line) => line.replace(/<[^>]*>/g, "").trim() !== "" || /<img/i.test(line));
}

/**
 * 一個區塊 → 泡泡們。每一組是一段(引用裡空一行就分組),組內每個字串是一顆泡泡。
 * 清單、表格這類不好拆的元素整個當一顆。
 */
export function chatBubbles(blockHtml: string): string[][] {
  const doc = new DOMParser().parseFromString(blockHtml, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const parts = root.tagName === "BLOCKQUOTE" ? Array.from(root.children) : [root];
  const groups: string[][] = [];
  for (const part of parts) {
    if (part.tagName === "P" || /^H[1-6]$/.test(part.tagName)) {
      const lines = linesOf(part);
      if (lines.length > 0) groups.push(lines);
    } else if (part.tagName === "BLOCKQUOTE") {
      groups.push(...chatBubbles(part.outerHTML));
    } else {
      groups.push([part.outerHTML]);
    }
  }
  return groups;
}

/**
 * 標了邊的區塊 → 對話框的 HTML。
 * name 給了而且不是接著同一邊的上一段(continued)才顯示名字。
 */
export function chatBlockHtml(
  blockHtml: string,
  side: ChatSide,
  name: string,
  continued: boolean,
  split: ChatSplit = "line"
): string {
  const lines = chatBubbles(blockHtml);
  // 一段一顆:同一段的每一行用換行接起來,放進同一顆泡泡
  const groups = split === "paragraph" ? lines.map((group) => [group.join("<br>")]) : lines;
  if (groups.length === 0) return "";
  const label = name.trim() && !continued ? `<div class="chat-name">${escapeHtml(name.trim())}</div>` : "";
  const body = groups
    .map((group) => `<div class="chat-run">${group.map((line) => `<div class="chat-bubble">${line}</div>`).join("")}</div>`)
    .join("");
  return `<div class="chat-group chat-${side}${continued ? " chat-continued" : ""}">${label}${body}</div>`;
}

/**
 * 選取的區塊照順序組成匯出用的 HTML:有標邊的變對話框,其他照原樣。
 * 連續兩段標在同一邊時,第二段不再重複名字、間距也收緊。
 */
export function composeChatHtml(
  items: { html: string; side?: ChatSide }[],
  names: Record<ChatSide, string>,
  split: ChatSplit = "line"
): string[] {
  let previous: ChatSide | undefined;
  return items.map(({ html, side }) => {
    const out = side ? chatBlockHtml(html, side, names[side], previous === side, split) : html;
    previous = side;
    return out;
  });
}
