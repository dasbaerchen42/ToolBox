// 聊天室的版面:每一則訊息要畫在哪、換成幾行。
// 量字寬的函式由外面傳進來(畫面上用 canvas 量,測試裡用假的),所以這裡是純函式。
// 預覽與輸出都走這一份版面,看到的就是轉出來的。

import { typingLabel, type ChatMessage, type ChatSettings, type ChatSide } from "./model";

/** 量一段字在某個字型下有多寬 */
export type Measure = (text: string, font: string) => number;

export type Fonts = { body: string; small: string; name: string; title: string; subtitle: string; avatar: string };

/** 字級都以 CSS px 計;寬版字稍微大一點 */
export function chatMetrics(settings: ChatSettings) {
  const wide = settings.width >= 600;
  const body = wide ? 17 : 15;
  return {
    width: settings.width,
    body,
    lineHeight: Math.round(body * 1.45),
    small: wide ? 13 : 12,
    padX: wide ? 16 : 12,
    bubblePadX: Math.round(body * 0.85),
    bubblePadY: Math.round(body * 0.55),
    avatar: wide ? 36 : 32,
    header: wide ? 72 : 64,
    inputBar: wide ? 64 : 58,
    groupGap: 14,
    runGap: 4,
  };
}

export type ChatMetrics = ReturnType<typeof chatMetrics>;

export function chatFonts(family: string, settings: ChatSettings): Fonts {
  const m = chatMetrics(settings);
  return {
    body: `400 ${m.body}px ${family}`,
    small: `400 ${m.small}px ${family}`,
    name: `500 ${m.small}px ${family}`,
    title: `700 ${m.body + 1}px ${family}`,
    subtitle: `400 ${m.small}px ${family}`,
    avatar: `600 ${Math.round(m.avatar * 0.42)}px ${family}`,
  };
}

/** 句讀、長音不放在行首(避頭) */
const NO_LINE_START = /^[、。，．,.!?！？）」』】〉》ーっゃゅょァィゥェォッャュョ…・:;：；~～]$/u;

/** 英數字連在一起的一段不從中間斷;其他(中日文、emoji)一個字一個字斷 */
function tokens(text: string): string[] {
  const out: string[] = [];
  const pattern = /[A-Za-z0-9À-ɏ'’\-_.@#%&/+=]+|\s+/gu;
  let last = 0;
  const pushGraphemes = (part: string) => {
    if (!part) return;
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
      for (const { segment } of segmenter.segment(part)) out.push(segment);
    } else out.push(...Array.from(part));
  };
  for (const match of text.matchAll(pattern)) {
    pushGraphemes(text.slice(last, match.index));
    out.push(match[0]);
    last = (match.index ?? 0) + match[0].length;
  }
  pushGraphemes(text.slice(last));
  return out;
}

/** 文字換行:照原本的換行,太長再自動折;英文單字太長才從中間斷 */
export function wrapLines(text: string, maxWidth: number, font: string, measure: Measure): string[] {
  const lines: string[] = [];
  // 舊的訊息裡可能還留著 U+2028 這類換行,畫的時候一樣當換行
  for (const paragraph of text.split(/\r\n|[\n\r\u2028\u2029\u0085]/)) {
    let line = "";
    for (const token of tokens(paragraph)) {
      const candidate = line + token;
      if (measure(candidate, font) <= maxWidth || line === "") {
        if (measure(candidate, font) > maxWidth && line === "" && token.length > 1 && !/^\s+$/.test(token)) {
          // 一個英文字比一整行還長:只好一個字母一個字母塞
          for (const char of Array.from(token)) {
            if (line && measure(line + char, font) > maxWidth) {
              lines.push(line);
              line = char;
            } else line += char;
          }
          continue;
        }
        line = candidate;
        continue;
      }
      if (NO_LINE_START.test(token)) {
        // 標點寧可讓這一行稍微超出一點
        line = candidate;
        continue;
      }
      lines.push(line.replace(/\s+$/, ""));
      line = /^\s+$/.test(token) ? "" : token;
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines;
}

type Box = { x: number; y: number; w: number; h: number };

export type LayoutItem =
  | ({ kind: "center"; id: string; lines: string[] } & Box)
  | ({
      kind: "bubble";
      id: string;
      side: "left" | "right";
      lines: string[];
      /** 這一串的第一顆:上面放名字;最後一顆:留尖角 */
      first: boolean;
      last: boolean;
      name: string | null;
      /** 頭像畫在這一串第一顆旁邊 */
      avatar: boolean;
    } & Box)
  | ({ kind: "typing"; side: "left" | "right"; label: string; avatar: boolean } & Box);

/**
 * 訊息 → 版面(只排訊息區,y 從 0 開始;標題列與輸入列另外加)。
 * 同一邊連續的訊息算一串:只有第一顆上面有名字、旁邊有頭像。
 */
export function layoutMessages(
  messages: ChatMessage[],
  settings: ChatSettings,
  fonts: Fonts,
  measure: Measure
): { items: LayoutItem[]; height: number } {
  const m = chatMetrics(settings);
  const avatarSpace = settings.showAvatars ? m.avatar + 8 : 0;
  const maxBubble = Math.round((m.width - m.padX * 2 - avatarSpace) * 0.78);
  const textMax = maxBubble - m.bubblePadX * 2;
  const items: LayoutItem[] = [];
  let y = m.groupGap;
  let previous: ChatSide | null = null;

  messages.forEach((message, index) => {
    const side = message.side;
    const nextSide = messages[index + 1]?.side ?? null;
    const startsRun = side !== previous;
    if (index > 0) y += startsRun ? m.groupGap : m.runGap;

    if (side === "center") {
      const lines = wrapLines(message.text, m.width * 0.72, fonts.small, measure);
      const w = Math.min(m.width * 0.8, Math.max(...lines.map((line) => measure(line, fonts.small))) + 20);
      const h = lines.length * Math.round(m.small * 1.5) + 8;
      items.push({ kind: "center", id: message.id, lines, x: (m.width - w) / 2, y, w, h });
      y += h;
      previous = side;
      return;
    }

    const name = side === "left" ? settings.leftName : settings.rightName;
    const showName = startsRun && side === "left" && settings.showNames && name.trim() !== "";
    if (showName) y += m.small + 6;
    const lines = wrapLines(message.text, textMax, fonts.body, measure);
    const textWidth = Math.max(m.body, ...lines.map((line) => measure(line, fonts.body)));
    const w = Math.ceil(textWidth + m.bubblePadX * 2);
    const h = lines.length * m.lineHeight + m.bubblePadY * 2;
    const x = side === "left" ? m.padX + (settings.showAvatars ? avatarSpace : 0) : m.width - m.padX - w;
    items.push({
      kind: "bubble",
      id: message.id,
      side,
      lines,
      first: startsRun,
      last: nextSide !== side,
      name: showName ? name.trim() : null,
      avatar: startsRun && side === "left" && settings.showAvatars,
      x,
      y,
      w,
      h,
    });
    y += h;
    previous = side;
  });

  if (settings.typing) {
    const side = settings.typingSide;
    y += previous === side ? m.runGap : m.groupGap;
    const w = Math.round(m.body * 3.6);
    const h = m.lineHeight + m.bubblePadY * 2;
    const avatar = side === "left" && settings.showAvatars;
    const x = side === "left" ? m.padX + (settings.showAvatars ? avatarSpace : 0) : m.width - m.padX - w;
    items.push({ kind: "typing", side, label: typingLabel(settings), avatar: avatar && previous !== side, x, y, w, h });
    y += h + m.small + 8;
  }

  return { items, height: y + m.groupGap };
}

export type ChatPage = { items: LayoutItem[]; bodyHeight: number; first: boolean; last: boolean };

/** 一個項目上緣(名字在泡泡上面,算進去)與下緣(正在輸入下面還有一行小字) */
function itemTop(item: LayoutItem): number {
  return item.kind === "bubble" && item.name ? item.y - 22 : item.y;
}
function itemBottom(item: LayoutItem): number {
  return item.y + item.h + (item.kind === "typing" ? 26 : 0);
}

/**
 * 太長時分成好幾張:只在訊息之間切,每張都有標題列,輸入列只在最後一張。
 * maxBody 是一張圖訊息區最多多高。
 */
export function paginate(layout: { items: LayoutItem[]; height: number }, maxBody: number, gap = 14): ChatPage[] {
  const groups: LayoutItem[][] = [];
  let current: LayoutItem[] = [];
  let start = 0;
  for (const item of layout.items) {
    if (current.length > 0 && itemBottom(item) + gap - start > maxBody) {
      groups.push(current);
      current = [];
      start = itemTop(item) - gap;
    }
    current.push(item);
  }
  groups.push(current);

  return groups.map((items, index) => {
    const last = index === groups.length - 1;
    const top = index === 0 ? 0 : itemTop(items[0]) - gap;
    const bottom = last ? layout.height : Math.max(...items.map(itemBottom)) + gap;
    return {
      items: items.map((item) => ({ ...item, y: item.y - top })),
      bodyHeight: bottom - top,
      first: index === 0,
      last,
    };
  });
}

/** 輸出倍率:390 寬的聊天室輸出成 780 寬的圖 */
export const CHAT_EXPORT_SCALE = 2;

/**
 * 一張圖的訊息區最多多高。
 * long:瀏覽器畫得出來的最長一張(iOS 上限 8192 像素、總面積 1600 萬);
 * screen:手機一個畫面(9:16)扣掉標題列與輸入列,像一張一張的截圖。
 */
export function maxBodyHeight(settings: ChatSettings): number {
  const m = chatMetrics(settings);
  const chrome = m.header + (settings.inputBar ? m.inputBar : 0);
  if (settings.pages === "screen") return Math.round((m.width * 16) / 9) - chrome;
  const maxPx = Math.min(8192, 16_000_000 / (m.width * CHAT_EXPORT_SCALE));
  return Math.floor(maxPx / CHAT_EXPORT_SCALE) - chrome - 4;
}
