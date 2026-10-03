// 聊天室產生器的資料:一個聊天室的設定,加上一則一則的訊息。
// 全部是純資料與純函式,畫面與畫圖都從這裡讀。

import type { FontFamilyName } from "@/lib/preferences";

/** left、right:兩個人的泡泡;center:置中的小字(時間、系統訊息、旁白) */
export type ChatSide = "left" | "right" | "center";

export type ChatMessage = { id: string; side: ChatSide; text: string };

export type ChatTheme = "paper" | "light" | "dark";

export type ChatSettings = {
  /** 最上面的聊天室名稱 */
  title: string;
  /** 名稱下面的小字,例如「上線中」;空的就不顯示 */
  subtitle: string;
  leftName: string;
  rightName: string;
  /** 左邊每一串訊息上面顯示名字 */
  showNames: boolean;
  /** 左邊每一串訊息旁邊顯示頭像(名字的第一個字) */
  showAvatars: boolean;
  /** 最下面「XXX 正在輸入…」 */
  typing: boolean;
  typingSide: "left" | "right";
  /** 正在輸入的字;空的就用「名字 正在輸入…」 */
  typingText: string;
  /** 最底下畫一條假的輸入列 */
  inputBar: boolean;
  theme: ChatTheme;
  /** 右邊泡泡的顏色 */
  accent: string;
  font: FontFamilyName;
  /** 畫面寬度(CSS px);輸出時再乘 2 */
  width: 390 | 600;
  /** long:一張長圖(太長才分);screen:照手機一個畫面的高度分成好幾張,像連續截圖 */
  pages: "long" | "screen";
  /** 貼上送出時怎麼分泡泡 */
  pasteSplit: PasteSplit;
};

export type ChatRoom = { settings: ChatSettings; messages: ChatMessage[] };

export const CHAT_WIDTHS: { value: ChatSettings["width"]; label: string }[] = [
  { value: 390, label: "手機直式" },
  { value: 600, label: "寬版" },
];

export function defaultChatSettings(): ChatSettings {
  return {
    title: "程歌",
    subtitle: "上線中",
    leftName: "菅原仁",
    rightName: "程歌",
    showNames: false,
    showAvatars: true,
    typing: true,
    typingSide: "left",
    typingText: "",
    inputBar: true,
    theme: "paper",
    accent: "#c0573e",
    font: "sans",
    width: 390,
    pages: "long",
    pasteSplit: "blank",
  };
}

let counter = 0;
export function newMessageId(): string {
  counter += 1;
  return `m-${Date.now().toString(36)}-${counter}`;
}

/** 範例對話:第一次打開就看得到聊天室長什麼樣子 */
export function sampleMessages(): ChatMessage[] {
  return [
    { id: newMessageId(), side: "center", text: "下午 3:24" },
    { id: newMessageId(), side: "right", text: "強制微波熱炒" },
    { id: newMessageId(), side: "left", text: "強制微波熱炒是什麼啦😂\n妳是想把我放進微波爐裡轉嗎" },
    { id: newMessageId(), side: "left", text: "那我會爆炸喔 橘子是圓的才能滾 熊不能微波" },
  ];
}

/** 貼上時怎麼分泡泡:空一行換一顆、每一行一顆、整段一顆 */
export type PasteSplit = "blank" | "line" | "whole";

export const PASTE_SPLITS: { value: PasteSplit; label: string }[] = [
  { value: "blank", label: "空一行換一顆" },
  { value: "line", label: "每行一顆" },
  { value: "whole", label: "整段一顆" },
];

/**
 * 各種換行統一成 \n。手機從 App 或網頁複製時,換行常常是 U+2028(行分隔)
 * 或 U+2029(段落分隔),不轉的話整段會黏成一行。段落分隔當成空一行。
 */
export function normalizeNewlines(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u2029/g, "\n\n")
    .replace(/[\u2028\u0085\v\f]/g, "\n");
}

/** 看不見的字(零寬空白、BOM) */
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff]/g;

/**
 * 貼上的文字 → 一顆一顆泡泡的內容。
 * 拿掉 Markdown 引用的「>」(全形「＞」也算)與前後空白;
 * blank:空一行就是下一顆,同一段裡的換行照留;line:每一行一顆;whole:整段一顆。
 */
export function splitPasted(text: string, mode: PasteSplit = "blank"): string[] {
  const lines = normalizeNewlines(text)
    .split("\n")
    .map((line) =>
      line
        .replace(INVISIBLE, "")
        .replace(/^[\s\u3000]*([>＞][\s\u3000]?)+/, "")
        .replace(/[\s\u3000]+$/, "")
        .replace(/^[\s\u3000]+/, "")
    );
  if (mode === "line") return lines.filter((line) => line !== "");
  if (mode === "whole") {
    const joined = lines.join("\n").replace(/^\n+|\n+$/g, "").replace(/\n{3,}/g, "\n\n");
    return joined ? [joined] : [];
  }
  const bubbles: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line === "") {
      if (current.length > 0) bubbles.push(current.join("\n"));
      current = [];
    } else current.push(line);
  }
  if (current.length > 0) bubbles.push(current.join("\n"));
  return bubbles;
}

/** 名字的第一個字(英文取第一個字母大寫),頭像用 */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0] ?? "?";
  return first.toUpperCase();
}

/** 正在輸入的那一行字 */
export function typingLabel(settings: ChatSettings): string {
  if (settings.typingText.trim()) return settings.typingText.trim();
  const name = settings.typingSide === "left" ? settings.leftName : settings.rightName;
  return name.trim() ? `${name.trim()} 正在輸入…` : "正在輸入…";
}

/** 換邊:左 → 右 → 置中 → 左 */
export function nextSide(side: ChatSide): ChatSide {
  return side === "left" ? "right" : side === "right" ? "center" : "left";
}

export function moveMessage(messages: ChatMessage[], id: string, delta: -1 | 1): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= messages.length) return messages;
  const next = [...messages];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** 讀回存檔:型別不對的欄位用預設值,壞掉的訊息略過 */
export function readChatRoom(raw: unknown): ChatRoom | null {
  if (!isRecord(raw)) return null;
  const base = defaultChatSettings();
  const settings = { ...base } as Record<string, unknown>;
  if (isRecord(raw.settings)) {
    for (const [key, value] of Object.entries(base)) {
      const incoming = raw.settings[key];
      if (incoming !== undefined && typeof incoming === typeof value) settings[key] = incoming;
    }
  }
  if (settings.width !== 390 && settings.width !== 600) settings.width = base.width;
  if (!["paper", "light", "dark"].includes(settings.theme as string)) settings.theme = base.theme;
  if (settings.pages !== "long" && settings.pages !== "screen") settings.pages = base.pages;
  if (!["blank", "line", "whole"].includes(settings.pasteSplit as string)) settings.pasteSplit = base.pasteSplit;
  if (settings.typingSide !== "left" && settings.typingSide !== "right") settings.typingSide = base.typingSide;
  const messages = Array.isArray(raw.messages)
    ? raw.messages.filter(
        (item): item is ChatMessage =>
          isRecord(item) &&
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          (item.side === "left" || item.side === "right" || item.side === "center")
      )
    : [];
  return { settings: settings as ChatSettings, messages };
}
