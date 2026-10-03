// 把一張聊天室畫到 canvas 上:標題列、泡泡、正在輸入、輸入列。
// 預覽與輸出都呼叫這裡,只差在 ctx 的縮放倍率。

import { chatMetrics, type ChatPage, type Fonts, type LayoutItem } from "./layout";
import { initialOf, type ChatSettings, type ChatTheme } from "./model";

type Colors = {
  bg: string;
  header: string;
  ink: string;
  muted: string;
  line: string;
  left: string;
  leftInk: string;
  rightInk: string;
};

const PALETTE: Record<ChatTheme, Colors> = {
  // 米白紙感:暖灰字、淡卡其的左泡泡
  paper: {
    bg: "#f3eee4",
    header: "#fbf8f2",
    ink: "#3b352d",
    muted: "#958b7b",
    line: "#e0d7c7",
    left: "#fbf8f2",
    leftInk: "#3b352d",
    rightInk: "#ffffff",
  },
  light: {
    bg: "#f4f4f6",
    header: "#ffffff",
    ink: "#1c1c1f",
    muted: "#7a7a80",
    line: "#e4e4e8",
    left: "#ffffff",
    leftInk: "#1c1c1f",
    rightInk: "#ffffff",
  },
  dark: {
    bg: "#111114",
    header: "#1b1b1f",
    ink: "#f2f2f3",
    muted: "#9a9aa2",
    line: "#2b2b30",
    left: "#26262b",
    leftInk: "#f2f2f3",
    rightInk: "#ffffff",
  },
};

/** 右邊泡泡的字:底色太亮就用深字 */
function inkOn(hex: string, fallback: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return fallback;
  const n = parseInt(match[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.68 ? "#2b2620" : "#ffffff";
}

/** 頭像的底色:照名字算一個固定的柔和色 */
function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return `hsl(${hash % 360}, 32%, 62%)`;
}

export function pageHeight(page: ChatPage, settings: ChatSettings): number {
  const m = chatMetrics(settings);
  return m.header + page.bodyHeight + (page.last && settings.inputBar ? m.inputBar : 0);
}

function bubblePath(ctx: CanvasRenderingContext2D, item: LayoutItem & { kind: "bubble" | "typing" }, r: number, tail: boolean) {
  const { x, y, w, h } = item;
  const radius = Math.min(r, h / 2);
  // 一串的最後一顆在靠自己那一側的下角收成小圓角,看起來像從那一邊冒出來
  const small = Math.min(5, radius);
  const corners =
    item.side === "left"
      ? [radius, radius, radius, tail ? small : radius]
      : [radius, radius, tail ? small : radius, radius];
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, corners);
}

/** 上傳的頭像圖(已經載入好的);沒有就畫名字的第一個字 */
export type ChatAvatars = { left: CanvasImageSource | null; right: CanvasImageSource | null };

const NO_AVATARS: ChatAvatars = { left: null, right: null };

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  r: number,
  font: string,
  image: CanvasImageSource | null = null
) {
  ctx.save();
  if (image) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = avatarColor(name || "?");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialOf(name || "?"), cx, cy + 1);
  ctx.restore();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  settings: ChatSettings,
  fonts: Fonts,
  colors: Colors,
  image: CanvasImageSource | null
) {
  const m = chatMetrics(settings);
  const W = m.width;
  const H = m.header;
  ctx.fillStyle = colors.header;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = colors.line;
  ctx.fillRect(0, H - 1, W, 1);

  // 返回箭頭
  ctx.save();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(m.padX + 9, H / 2 - 8);
  ctx.lineTo(m.padX + 1, H / 2);
  ctx.lineTo(m.padX + 9, H / 2 + 8);
  ctx.stroke();
  ctx.restore();

  const r = m.avatar / 2 + 2;
  const avatarX = m.padX + 22 + r;
  drawAvatar(ctx, settings.title, avatarX, H / 2, r, fonts.avatar, image);

  const textX = avatarX + r + 10;
  ctx.fillStyle = colors.ink;
  ctx.font = fonts.title;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const hasSub = settings.subtitle.trim() !== "";
  ctx.fillText(settings.title.trim() || " ", textX, hasSub ? H / 2 - 9 : H / 2, W - textX - 48);
  if (hasSub) {
    ctx.fillStyle = colors.muted;
    ctx.font = fonts.subtitle;
    ctx.fillText(settings.subtitle.trim(), textX, H / 2 + 11, W - textX - 48);
  }

  // 右上角的「⋯」
  ctx.fillStyle = colors.muted;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.arc(W - m.padX - 10 + i * 6, H / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawInputBar(ctx: CanvasRenderingContext2D, settings: ChatSettings, fonts: Fonts, colors: Colors, top: number) {
  const m = chatMetrics(settings);
  const W = m.width;
  ctx.fillStyle = colors.header;
  ctx.fillRect(0, top, W, m.inputBar);
  ctx.fillStyle = colors.line;
  ctx.fillRect(0, top, W, 1);
  const fieldH = m.inputBar - 20;
  const sendR = fieldH / 2;
  ctx.beginPath();
  ctx.roundRect(m.padX, top + 10, W - m.padX * 3 - sendR * 2, fieldH, fieldH / 2);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = colors.muted;
  ctx.font = fonts.small;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("輸入訊息…", m.padX + 14, top + 10 + fieldH / 2);
  // 傳送鍵:圓圈裡一個往上的箭頭
  const cx = W - m.padX - sendR;
  const cy = top + 10 + fieldH / 2;
  ctx.fillStyle = settings.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, sendR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = inkOn(settings.accent, "#ffffff");
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy + sendR * 0.4);
  ctx.lineTo(cx, cy - sendR * 0.4);
  ctx.moveTo(cx - sendR * 0.35, cy - sendR * 0.05);
  ctx.lineTo(cx, cy - sendR * 0.4);
  ctx.lineTo(cx + sendR * 0.35, cy - sendR * 0.05);
  ctx.stroke();
}

/** 畫一張(標題列 + 訊息 + 最後一張的輸入列);ctx 已經縮放好,單位是 CSS px */
export function drawChatPage(
  ctx: CanvasRenderingContext2D,
  page: ChatPage,
  settings: ChatSettings,
  fonts: Fonts,
  selected: string | null = null,
  avatars: ChatAvatars = NO_AVATARS
): void {
  const m = chatMetrics(settings);
  const colors = PALETTE[settings.theme];
  const W = m.width;
  const total = pageHeight(page, settings);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, total);

  ctx.save();
  ctx.translate(0, m.header);
  const radius = Math.round(m.body * 1.2);
  const drawSideAvatar = (side: "left" | "right", top: number) => {
    const r = m.avatar / 2;
    const cx = side === "left" ? m.padX + r : W - m.padX - r;
    const name = side === "left" ? settings.leftName : settings.rightName;
    drawAvatar(ctx, name, cx, top + r, r, fonts.avatar, avatars[side]);
  };
  for (const item of page.items) {
    if (item.kind === "center") {
      if (item.id === selected) {
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.w, item.h, 8);
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = colors.muted;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = colors.muted;
      ctx.font = fonts.small;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lh = Math.round(m.small * 1.5);
      item.lines.forEach((line, i) => ctx.fillText(line, W / 2, item.y + 4 + lh * (i + 0.5)));
    } else if (item.kind === "bubble") {
      const right = item.side === "right";
      if (item.name) {
        ctx.fillStyle = colors.muted;
        ctx.font = fonts.name;
        ctx.textAlign = right ? "right" : "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(item.name, right ? item.x + item.w - 4 : item.x + 4, item.y - 6);
      }
      if (item.avatar) drawSideAvatar(item.side, item.y);
      ctx.save();
      if (!right && settings.theme !== "dark") {
        ctx.shadowColor = "rgba(60, 45, 30, 0.08)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
      }
      bubblePath(ctx, item, radius, item.last);
      ctx.fillStyle = right ? settings.accent : colors.left;
      ctx.fill();
      ctx.restore();
      if (item.id === selected) {
        bubblePath(ctx, item, radius, item.last);
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.muted;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = right ? inkOn(settings.accent, colors.rightInk) : colors.leftInk;
      ctx.font = fonts.body;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      item.lines.forEach((line, i) =>
        ctx.fillText(line, item.x + m.bubblePadX, item.y + m.bubblePadY + m.lineHeight * (i + 0.5))
      );
    } else {
      // 正在輸入:一顆泡泡裡三個點,下面一行小字
      if (item.avatar) drawSideAvatar(item.side, item.y);
      const right = item.side === "right";
      bubblePath(ctx, item, radius, true);
      ctx.fillStyle = right ? settings.accent : colors.left;
      ctx.fill();
      const dot = right ? inkOn(settings.accent, "#ffffff") : colors.muted;
      for (let i = 0; i < 3; i += 1) {
        ctx.globalAlpha = 0.45 + i * 0.25;
        ctx.fillStyle = dot;
        ctx.beginPath();
        ctx.arc(item.x + item.w / 2 + (i - 1) * m.body * 0.6, item.y + item.h / 2, m.body * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.muted;
      ctx.font = fonts.small;
      ctx.textBaseline = "top";
      ctx.textAlign = right ? "right" : "left";
      ctx.fillText(item.label, right ? item.x + item.w - 2 : item.x + 2, item.y + item.h + 6);
    }
  }
  ctx.restore();

  if (settings.showHeader) drawHeader(ctx, settings, fonts, colors, avatars.left);
  if (page.last && settings.inputBar) drawInputBar(ctx, settings, fonts, colors, m.header + page.bodyHeight);
}
