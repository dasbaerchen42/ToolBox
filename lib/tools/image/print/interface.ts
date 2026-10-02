// 沖印所的「介面」:把照片放進播放器、社群貼文這類常見的畫面裡。
// 刻意做成通用的樣子——圖示用最基本的幾何畫,版面也不照任何一家的規格,
// 看得出是「播放器」「貼文」就好,不指向哪個網站或軟體。
//
// 尺寸都以畫布寬度的 1% 為單位(下面的 k),照片多大輸出就跟著多大。

import type { Size } from "./settings";

const FONT = `system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;

export type InterfaceKind = "player" | "video" | "social" | "story";
export type UiTheme = "light" | "dark";

export type PlayerSettings = {
  title: string;
  artist: string;
  current: string;
  total: string;
  playing: boolean;
  liked: boolean;
  /** blur:用照片顏色暈開當底 */
  theme: "blur" | UiTheme;
};

export type VideoSettings = {
  title: string;
  meta: string;
  current: string;
  total: string;
  paused: boolean;
  accent: string;
  /** 下面要不要接標題資訊區 */
  info: boolean;
  theme: UiTheme;
};

export type SocialSettings = {
  name: string;
  place: string;
  likes: string;
  caption: string;
  time: string;
  liked: boolean;
  ratio: "1:1" | "4:5";
  theme: UiTheme;
};

export type StorySettings = {
  name: string;
  time: string;
  segments: number;
  current: number;
  reply: string;
};

export type InterfaceSettings = {
  player: PlayerSettings;
  video: VideoSettings;
  social: SocialSettings;
  story: StorySettings;
};

export function defaultInterfaceSettings(): InterfaceSettings {
  return {
    player: {
      title: "今天也好好過",
      artist: "TOOLBOX",
      current: "1:24",
      total: "3:45",
      playing: true,
      liked: true,
      theme: "blur",
    },
    video: {
      title: "週末的散步紀錄",
      meta: "1.2 萬次觀看・3 天前",
      current: "2:08",
      total: "8:30",
      paused: false,
      accent: "#4f8cff",
      info: true,
      theme: "dark",
    },
    social: {
      name: "toolbox.daily",
      place: "",
      likes: "128 個讚",
      caption: "今天的天氣很好",
      time: "3 小時前",
      liked: true,
      ratio: "1:1",
      theme: "light",
    },
    story: { name: "toolbox", time: "5 小時", segments: 4, current: 2, reply: "傳送訊息" },
  };
}

/** "3:45" / "1:02:03" → 秒;看不懂的回 null */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((sum, p) => sum * 60 + Number(p), 0);
}

/** 進度條要走到哪:目前 ÷ 全長,看不懂或超出時夾在 0–1 */
export function clockProgress(current: string, total: string): number {
  const c = parseClock(current);
  const t = parseClock(total);
  if (c === null || t === null || t <= 0) return 0.35;
  return Math.min(1, Math.max(0, c / t));
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * 介面的版面:畫布多大、照片放在哪。
 * 以照片的短邊當基準寬度,播放器、貼文、限時動態都是直式;影片照長邊、16:9。
 */
export function interfaceLayout(size: Size, kind: InterfaceKind, s: InterfaceSettings): { canvas: Size; photo: Box } {
  const base = Math.round(Math.min(size.width, size.height));
  switch (kind) {
    case "player": {
      const side = Math.round(base * 0.84);
      return {
        canvas: { width: base, height: Math.round(base * 1.8) },
        photo: { x: Math.round(base * 0.08), y: Math.round(base * 0.2), width: side, height: side },
      };
    }
    case "video": {
      const width = Math.round(Math.max(size.width, size.height));
      const height = Math.round((width * 9) / 16);
      const info = s.video.info ? Math.round(width * 0.17) : 0;
      return { canvas: { width, height: height + info }, photo: { x: 0, y: 0, width, height } };
    }
    case "social": {
      const header = Math.round(base * 0.15);
      const photoHeight = s.social.ratio === "4:5" ? Math.round(base * 1.25) : base;
      return {
        canvas: { width: base, height: header + photoHeight + Math.round(base * 0.38) },
        photo: { x: 0, y: header, width: base, height: photoHeight },
      };
    }
    case "story": {
      const height = Math.round((base * 16) / 9);
      return { canvas: { width: base, height }, photo: { x: 0, y: 0, width: base, height } };
    }
  }
}

// ---- 圖示:全部用基本形狀畫,中心在 (0,0),大小 = s ----

type Ctx = CanvasRenderingContext2D;

function icon(ctx: Ctx, x: number, y: number, s: number, color: string, draw: (ctx: Ctx, s: number) => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx, s);
  ctx.restore();
}

function heartPath(ctx: Ctx, s: number) {
  const r = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.85);
  ctx.bezierCurveTo(-r * 1.3, -r * 0.05, -r * 0.75, -r * 1.05, 0, -r * 0.42);
  ctx.bezierCurveTo(r * 0.75, -r * 1.05, r * 1.3, -r * 0.05, 0, r * 0.85);
  ctx.closePath();
}

const Icons = {
  heart(ctx: Ctx, s: number, filled = false) {
    heartPath(ctx, s);
    if (filled) ctx.fill();
    else ctx.stroke();
  },
  bubble(ctx: Ctx, s: number) {
    const r = s * 0.42;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.72, Math.PI * 0.62 + Math.PI * 2);
    ctx.lineTo(-r * 1.05, r * 1.05);
    ctx.closePath();
    ctx.stroke();
  },
  plane(ctx: Ctx, s: number) {
    const r = s * 0.48;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.2);
    ctx.lineTo(r, -r * 0.9);
    ctx.lineTo(r * 0.25, r * 0.95);
    ctx.lineTo(-r * 0.1, r * 0.1);
    ctx.closePath();
    ctx.moveTo(-r * 0.1, r * 0.1);
    ctx.lineTo(r, -r * 0.9);
    ctx.stroke();
  },
  bookmark(ctx: Ctx, s: number) {
    const w = s * 0.34;
    const h = s * 0.46;
    ctx.beginPath();
    ctx.moveTo(-w, -h);
    ctx.lineTo(w, -h);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h * 0.45);
    ctx.lineTo(-w, h);
    ctx.closePath();
    ctx.stroke();
  },
  play(ctx: Ctx, s: number) {
    const r = s * 0.48;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(-r * 0.6, r);
    ctx.closePath();
    ctx.fill();
  },
  pause(ctx: Ctx, s: number) {
    const w = s * 0.16;
    const h = s * 0.45;
    ctx.beginPath();
    ctx.roundRect(-w * 2, -h, w * 1.3, h * 2, w * 0.3);
    ctx.roundRect(w * 0.7, -h, w * 1.3, h * 2, w * 0.3);
    ctx.fill();
  },
  skip(ctx: Ctx, s: number, back = false) {
    const r = s * 0.42;
    ctx.save();
    if (back) ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r * 0.55, 0);
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(r * 0.62, -r, r * 0.3, r * 2, r * 0.1);
    ctx.fill();
    ctx.restore();
  },
  shuffle(ctx: Ctx, s: number) {
    const r = s * 0.45;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.6);
    ctx.bezierCurveTo(0, -r * 0.6, 0, r * 0.6, r, r * 0.6);
    ctx.moveTo(-r, r * 0.6);
    ctx.bezierCurveTo(0, r * 0.6, 0, -r * 0.6, r, -r * 0.6);
    ctx.moveTo(r * 0.65, -r * 0.95);
    ctx.lineTo(r, -r * 0.6);
    ctx.lineTo(r * 0.65, -r * 0.25);
    ctx.moveTo(r * 0.65, r * 0.25);
    ctx.lineTo(r, r * 0.6);
    ctx.lineTo(r * 0.65, r * 0.95);
    ctx.stroke();
  },
  repeat(ctx: Ctx, s: number) {
    const r = s * 0.45;
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.1);
    ctx.lineTo(-r, -r * 0.45);
    ctx.lineTo(r * 0.85, -r * 0.45);
    ctx.moveTo(r * 0.55, -r * 0.8);
    ctx.lineTo(r * 0.9, -r * 0.45);
    ctx.lineTo(r * 0.55, -r * 0.1);
    ctx.moveTo(r, -r * 0.1);
    ctx.lineTo(r, r * 0.45);
    ctx.lineTo(-r * 0.85, r * 0.45);
    ctx.moveTo(-r * 0.55, r * 0.1);
    ctx.lineTo(-r * 0.9, r * 0.45);
    ctx.lineTo(-r * 0.55, r * 0.8);
    ctx.stroke();
  },
  chevronDown(ctx: Ctx, s: number) {
    const r = s * 0.36;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.4);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(r, -r * 0.4);
    ctx.stroke();
  },
  dots(ctx: Ctx, s: number, vertical = false) {
    const r = s * 0.08;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(vertical ? 0 : i * s * 0.3, vertical ? i * s * 0.3 : 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  volume(ctx: Ctx, s: number) {
    const r = s * 0.45;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.35);
    ctx.lineTo(-r * 0.45, -r * 0.35);
    ctx.lineTo(r * 0.05, -r * 0.85);
    ctx.lineTo(r * 0.05, r * 0.85);
    ctx.lineTo(-r * 0.45, r * 0.35);
    ctx.lineTo(-r, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.1, 0, r * 0.5, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.1, 0, r * 0.9, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
  },
  gear(ctx: Ctx, s: number) {
    const r = s * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.78;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.stroke();
  },
  fullscreen(ctx: Ctx, s: number) {
    const r = s * 0.42;
    const c = r * 0.45;
    ctx.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      ctx.moveTo(sx * r, sy * (r - c));
      ctx.lineTo(sx * r, sy * r);
      ctx.lineTo(sx * (r - c), sy * r);
    }
    ctx.stroke();
  },
  close(ctx: Ctx, s: number) {
    const r = s * 0.36;
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, r);
    ctx.moveTo(r, -r);
    ctx.lineTo(-r, r);
    ctx.stroke();
  },
  list(ctx: Ctx, s: number) {
    const r = s * 0.42;
    ctx.beginPath();
    for (const y of [-r * 0.6, 0, r * 0.6]) {
      ctx.moveTo(-r, y);
      ctx.lineTo(r, y);
    }
    ctx.stroke();
  },
  share(ctx: Ctx, s: number) {
    const r = s * 0.42;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.3);
    ctx.lineTo(0, -r);
    ctx.moveTo(-r * 0.45, -r * 0.55);
    ctx.lineTo(0, -r);
    ctx.lineTo(r * 0.45, -r * 0.55);
    ctx.moveTo(-r * 0.55, -r * 0.15);
    ctx.lineTo(-r * 0.85, -r * 0.15);
    ctx.lineTo(-r * 0.85, r);
    ctx.lineTo(r * 0.85, r);
    ctx.lineTo(r * 0.85, -r * 0.15);
    ctx.lineTo(r * 0.55, -r * 0.15);
    ctx.stroke();
  },
  thumb(ctx: Ctx, s: number) {
    const r = s * 0.42;
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.1, r * 0.45, r * 1.05, r * 0.1);
    ctx.moveTo(-r * 0.4, -r * 0.05);
    ctx.lineTo(-r * 0.05, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.25, -r * 0.95, r * 0.15, -r * 0.35);
    ctx.lineTo(r * 0.85, -r * 0.35);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.3, r * 0.95, -r * 0.05);
    ctx.lineTo(r * 0.75, r * 0.85);
    ctx.lineTo(-r * 0.4, r * 0.95);
    ctx.closePath();
    ctx.stroke();
  },
};

// ---- 共用的小零件 ----

function cover(ctx: Ctx, source: CanvasImageSource, from: Size, box: Box, radius = 0) {
  const scale = Math.max(box.width / from.width, box.height / from.height);
  const dw = from.width * scale;
  const dh = from.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, radius);
  ctx.clip();
  ctx.drawImage(source, box.x + (box.width - dw) / 2, box.y + (box.height - dh) / 2, dw, dh);
  ctx.restore();
}

/** 用照片暈開的顏色當底:縮到很小再放大,瀏覽器的平滑插值就是現成的模糊 */
function blurredBackdrop(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size) {
  const tiny = document.createElement("canvas");
  tiny.width = 12;
  tiny.height = Math.max(4, Math.round((12 * canvas.height) / canvas.width));
  const t = tiny.getContext("2d");
  if (t) cover(t, source, from, { x: 0, y: 0, width: tiny.width, height: tiny.height });
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/** 一行文字,超過寬度就截斷加「…」 */
function fitText(ctx: Ctx, text: string, x: number, y: number, maxWidth: number) {
  let shown = text;
  if (ctx.measureText(shown).width > maxWidth) {
    const chars = [...text];
    while (chars.length > 0 && ctx.measureText(`${chars.join("")}…`).width > maxWidth) chars.pop();
    shown = `${chars.join("")}…`;
  }
  ctx.fillText(shown, x, y);
}

/**
 * 文字換行(一個字一個字斷),最多 maxLines 行;第一行可以比較短(前面接了名字)。
 * 超過的話最後一行尾巴換成「…」
 */
function wrapText(ctx: Ctx, text: string, firstWidth: number, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of [...text]) {
    if (char === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const limit = lines.length === 0 ? firstWidth : maxWidth;
    if (ctx.measureText(line + char).width > limit && line) {
      lines.push(line);
      line = char;
    } else line += char;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, -1)}…`;
    return kept;
  }
  return lines;
}

function progressBar(ctx: Ctx, x: number, y: number, width: number, t: number, k: number, track: string, fill: string, knob: number) {
  const h = Math.max(1, k * 0.7);
  ctx.save();
  ctx.fillStyle = track;
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, width, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, Math.max(h, width * t), h, h / 2);
  ctx.fill();
  if (knob > 0) {
    ctx.beginPath();
    ctx.arc(x + width * t, y, knob, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 頭像:照片中間裁一個圓,外面一圈細環 */
function avatar(ctx: Ctx, source: CanvasImageSource, from: Size, cx: number, cy: number, r: number, ring: string | null) {
  if (ring) {
    ctx.save();
    ctx.strokeStyle = ring;
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // 取中間偏上的一塊,人像通常臉在上半
  const side = Math.min(from.width, from.height) * 0.6;
  const sx = (from.width - side) / 2;
  const sy = Math.max(0, (from.height - side) * 0.35);
  ctx.drawImage(source, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

const PALETTE = {
  light: { bg: "#ffffff", ink: "#16161a", muted: "#71717a", line: "#e4e4e7" },
  dark: { bg: "#121214", ink: "#f4f4f5", muted: "#a1a1aa", line: "#2a2a2e" },
};

// ---- 四種介面 ----

function drawPlayer(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size, photo: Box, s: PlayerSettings) {
  const W = canvas.width;
  const k = W / 100;
  const colors =
    s.theme === "blur"
      ? { bg: "", ink: "#ffffff", muted: "rgba(255, 255, 255, 0.68)", line: "rgba(255, 255, 255, 0.28)" }
      : PALETTE[s.theme];
  if (s.theme === "blur") blurredBackdrop(ctx, source, from, canvas);
  else {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, canvas.height);
  }

  // 上方列
  const top = 9 * k;
  icon(ctx, 10 * k, top, 6 * k, colors.ink, Icons.chevronDown);
  icon(ctx, W - 10 * k, top, 6 * k, colors.ink, (c, sz) => Icons.dots(c, sz));
  ctx.fillStyle = colors.muted;
  ctx.font = `600 ${3.4 * k}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("正在播放", W / 2, top);

  // 封面
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 5 * k;
  ctx.shadowOffsetY = 2 * k;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(photo.x, photo.y, photo.width, photo.height, 3 * k);
  ctx.fill();
  ctx.restore();
  cover(ctx, source, from, photo, 3 * k);

  // 歌名、歌手、愛心
  let y = photo.y + photo.height + 11 * k;
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink;
  ctx.font = `700 ${6 * k}px ${FONT}`;
  fitText(ctx, s.title, 8 * k, y, W - 26 * k);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${4.2 * k}px ${FONT}`;
  fitText(ctx, s.artist, 8 * k, y + 7 * k, W - 26 * k);
  icon(ctx, W - 11 * k, y + 3 * k, 7 * k, s.liked ? "#ff4d6d" : colors.ink, (c, sz) => Icons.heart(c, sz, s.liked));

  // 進度
  y += 19 * k;
  const progress = clockProgress(s.current, s.total);
  progressBar(ctx, 8 * k, y, W - 16 * k, progress, k, colors.line, colors.ink, 1.6 * k);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${3.2 * k}px ${FONT}`;
  ctx.fillText(s.current, 8 * k, y + 5.5 * k);
  ctx.textAlign = "right";
  ctx.fillText(s.total, W - 8 * k, y + 5.5 * k);

  // 控制鍵
  y += 20 * k;
  icon(ctx, 12 * k, y, 6 * k, colors.muted, Icons.shuffle);
  icon(ctx, 31 * k, y, 8 * k, colors.ink, (c, sz) => Icons.skip(c, sz, true));
  ctx.fillStyle = colors.ink;
  ctx.beginPath();
  ctx.arc(W / 2, y, 9.5 * k, 0, Math.PI * 2);
  ctx.fill();
  const inner = s.theme === "light" ? "#ffffff" : s.theme === "dark" ? "#121214" : "#1b1b1f";
  icon(ctx, W / 2 + (s.playing ? 0 : 0.8 * k), y, 8 * k, inner, s.playing ? Icons.pause : Icons.play);
  icon(ctx, W - 31 * k, y, 8 * k, colors.ink, (c, sz) => Icons.skip(c, sz));
  icon(ctx, W - 12 * k, y, 6 * k, colors.muted, Icons.repeat);

  // 最下面兩顆小圖示
  y += 17 * k;
  icon(ctx, 12 * k, y, 5 * k, colors.muted, Icons.share);
  icon(ctx, W - 12 * k, y, 5 * k, colors.muted, Icons.list);
}

function drawVideo(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size, photo: Box, s: VideoSettings) {
  const W = canvas.width;
  const k = W / 100;
  const colors = PALETTE[s.theme];
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(photo.x, photo.y, photo.width, photo.height);
  cover(ctx, source, from, photo);

  // 下方漸層,控制列壓在上面
  const bottom = photo.y + photo.height;
  const g = ctx.createLinearGradient(0, bottom - 12 * k, 0, bottom);
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.7)");
  ctx.fillStyle = g;
  ctx.fillRect(0, bottom - 12 * k, W, 12 * k);

  const barY = bottom - 7 * k;
  progressBar(ctx, 3 * k, barY, W - 6 * k, clockProgress(s.current, s.total), k * 0.6, "rgba(255, 255, 255, 0.35)", s.accent, 1.1 * k);

  const rowY = bottom - 3.2 * k;
  const sz = 3 * k;
  icon(ctx, 4.5 * k, rowY, sz, "#fff", s.paused ? Icons.play : Icons.pause);
  icon(ctx, 10 * k, rowY, sz, "#fff", (c, z) => Icons.skip(c, z));
  icon(ctx, 15.5 * k, rowY, sz, "#fff", Icons.volume);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${1.9 * k}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${s.current} / ${s.total}`, 19.5 * k, rowY);
  icon(ctx, W - 10 * k, rowY, sz, "#fff", Icons.gear);
  icon(ctx, W - 4.5 * k, rowY, sz, "#fff", Icons.fullscreen);

  // 暫停中:中間一顆大播放鍵
  if (s.paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.arc(W / 2, photo.y + photo.height / 2, 6 * k, 0, Math.PI * 2);
    ctx.fill();
    icon(ctx, W / 2 + 0.6 * k, photo.y + photo.height / 2, 5.5 * k, "#fff", Icons.play);
  }

  if (!s.info) return;
  // 標題資訊區
  const top = bottom + 2.4 * k;
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.ink;
  ctx.font = `700 ${3.1 * k}px ${FONT}`;
  fitText(ctx, s.title, 3 * k, top, W - 6 * k);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${2.2 * k}px ${FONT}`;
  fitText(ctx, s.meta, 3 * k, top + 4.6 * k, W * 0.5);

  // 右邊幾顆膠囊按鈕:讚、分享、收藏
  const pills: { label: string; draw: (c: Ctx, z: number) => void }[] = [
    { label: "收藏", draw: Icons.bookmark },
    { label: "分享", draw: Icons.share },
    { label: "讚", draw: Icons.thumb },
  ];
  let x = W - 3 * k;
  const py = top + 5.4 * k;
  ctx.font = `600 ${2.1 * k}px ${FONT}`;
  for (const pill of pills) {
    const w = ctx.measureText(pill.label).width + 7.5 * k;
    x -= w;
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    ctx.roundRect(x, py - 2.4 * k, w, 4.8 * k, 2.4 * k);
    ctx.fill();
    icon(ctx, x + 2.8 * k, py, 2.6 * k, colors.ink, pill.draw);
    ctx.fillStyle = colors.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(pill.label, x + 5 * k, py);
    x -= 1.5 * k;
  }
}

function drawSocial(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size, photo: Box, s: SocialSettings) {
  const W = canvas.width;
  const k = W / 100;
  const colors = PALETTE[s.theme];
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, canvas.height);

  // 頂部:頭像、名字、地點、更多
  const head = photo.y / 2;
  avatar(ctx, source, from, 9 * k, head, 4.6 * k, "#f2a65a");
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.ink;
  ctx.font = `700 ${3.8 * k}px ${FONT}`;
  const hasPlace = s.place.trim().length > 0;
  fitText(ctx, s.name, 17 * k, hasPlace ? head - 2.2 * k : head, W - 32 * k);
  if (hasPlace) {
    ctx.fillStyle = colors.muted;
    ctx.font = `500 ${3 * k}px ${FONT}`;
    fitText(ctx, s.place, 17 * k, head + 2.6 * k, W - 32 * k);
  }
  icon(ctx, W - 7 * k, head, 6 * k, colors.ink, (c, sz) => Icons.dots(c, sz));

  cover(ctx, source, from, photo);

  // 動作列
  let y = photo.y + photo.height + 7 * k;
  const sz = 6.6 * k;
  icon(ctx, 7 * k, y, sz, s.liked ? "#ff3b5c" : colors.ink, (c, z) => Icons.heart(c, z, s.liked));
  icon(ctx, 17 * k, y, sz, colors.ink, Icons.bubble);
  icon(ctx, 27 * k, y, sz, colors.ink, Icons.plane);
  icon(ctx, W - 7 * k, y, sz, colors.ink, Icons.bookmark);

  // 讚數、內文、時間
  y += 7.5 * k;
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.ink;
  ctx.font = `700 ${3.6 * k}px ${FONT}`;
  fitText(ctx, s.likes, 4 * k, y, W - 8 * k);
  y += 6 * k;
  ctx.font = `700 ${3.6 * k}px ${FONT}`;
  const nameWidth = ctx.measureText(`${s.name} `).width;
  ctx.fillText(s.name, 4 * k, y);
  ctx.font = `400 ${3.6 * k}px ${FONT}`;
  const lines = wrapText(ctx, s.caption, W - 8 * k - nameWidth, W - 8 * k, 3);
  lines.forEach((line, i) => ctx.fillText(line, i === 0 ? 4 * k + nameWidth : 4 * k, y + i * 5 * k));
  y += Math.max(0, lines.length - 1) * 5 * k;
  y += 6 * k;
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${2.8 * k}px ${FONT}`;
  fitText(ctx, s.time, 4 * k, y, W - 8 * k);
}

function drawStory(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size, s: StorySettings) {
  const W = canvas.width;
  const H = canvas.height;
  const k = W / 100;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  cover(ctx, source, from, { x: 0, y: 0, width: W, height: H });

  // 上下壓暗,白字才看得清楚
  const top = ctx.createLinearGradient(0, 0, 0, 22 * k);
  top.addColorStop(0, "rgba(0, 0, 0, 0.45)");
  top.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 22 * k);
  const bottom = ctx.createLinearGradient(0, H - 26 * k, 0, H);
  bottom.addColorStop(0, "rgba(0, 0, 0, 0)");
  bottom.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H - 26 * k, W, 26 * k);

  // 分段進度條
  const count = Math.max(1, Math.min(12, Math.round(s.segments)));
  const current = Math.max(1, Math.min(count, Math.round(s.current)));
  const gap = 1 * k;
  const segW = (W - 4 * k - gap * (count - 1)) / count;
  for (let i = 0; i < count; i += 1) {
    const x = 2 * k + i * (segW + gap);
    const fill = i < current - 1 ? 1 : i === current - 1 ? 0.55 : 0;
    progressBar(ctx, x, 3 * k, segW, fill, k * 0.85, "rgba(255, 255, 255, 0.38)", "#ffffff", 0);
  }

  // 頭像、名字、時間、關閉
  const head = 10.5 * k;
  avatar(ctx, source, from, 7.5 * k, head, 4.2 * k, null);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${3.8 * k}px ${FONT}`;
  const name = s.name.trim() || " ";
  fitText(ctx, name, 14 * k, head, W * 0.5);
  const nameW = Math.min(W * 0.5, ctx.measureText(name).width);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = `500 ${3.4 * k}px ${FONT}`;
  ctx.fillText(s.time, 14 * k + nameW + 2.4 * k, head);
  icon(ctx, W - 14 * k, head, 6 * k, "#fff", (c, sz) => Icons.dots(c, sz));
  icon(ctx, W - 6 * k, head, 6 * k, "#fff", Icons.close);

  // 底部回覆框 + 愛心 + 傳送
  const y = H - 9 * k;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = Math.max(1, 0.35 * k);
  ctx.beginPath();
  ctx.roundRect(4 * k, y - 5.5 * k, W - 28 * k, 11 * k, 5.5 * k);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = `500 ${3.6 * k}px ${FONT}`;
  fitText(ctx, s.reply, 9 * k, y, W - 40 * k);
  icon(ctx, W - 17 * k, y, 6.6 * k, "#fff", (c, sz) => Icons.heart(c, sz));
  icon(ctx, W - 7 * k, y, 6.6 * k, "#fff", Icons.plane);
}

export function drawInterface(
  ctx: Ctx,
  kind: InterfaceKind,
  source: CanvasImageSource,
  from: Size,
  layout: { canvas: Size; photo: Box },
  s: InterfaceSettings
) {
  switch (kind) {
    case "player":
      return drawPlayer(ctx, source, from, layout.canvas, layout.photo, s.player);
    case "video":
      return drawVideo(ctx, source, from, layout.canvas, layout.photo, s.video);
    case "social":
      return drawSocial(ctx, source, from, layout.canvas, layout.photo, s.social);
    case "story":
      return drawStory(ctx, source, from, layout.canvas, s.story);
  }
}
