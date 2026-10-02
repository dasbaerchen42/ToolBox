// 沖印所的「介面」:把照片放進播放器、社群貼文這類常見的畫面裡。
// 刻意做成通用的樣子——圖示用最基本的幾何畫,版面也不照任何一家的規格:
// 貼文的動作列是「圖示＋數字」、照片內縮成圓角,另有文字在前的版型,
// 看得出是「播放器」「貼文」就好,不指向哪個網站或軟體。
//
// 介面文字有中文、English、日本語;預設是「紙感」配色(米白底、暖灰字、襯線標題)。
// 尺寸都以畫布寬度的 1% 為單位(下面的 k),照片多大輸出就跟著多大。

import { coverRect, DEFAULT_AVATAR_FRAMING, DEFAULT_FRAMING, type Framing } from "./framing";
import type { Size } from "./settings";

/** 照片與頭像的取景 */
type Frames = { photo: Framing; avatar: Framing };

const FONT = `system-ui, "Noto Sans TC", "Noto Sans JP", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif`;
const SERIF = `"Cormorant Garamond", "Noto Serif JP", "Noto Serif TC", "Hiragino Mincho ProN", "Yu Mincho", Georgia, "Times New Roman", serif`;

export type InterfaceKind = "player" | "video" | "social" | "story";
/** paper:米白紙感(文青);light、dark:一般的淺色深色 */
export type UiTheme = "paper" | "light" | "dark";
export type UiLang = "zh" | "en" | "ja";

export const UI_LANGS: { value: UiLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

/** 介面上固定的字(按鈕、標籤);使用者自己打的內容不在這裡 */
const STRINGS: Record<UiLang, { nowPlaying: string; like: string; share: string; save: string }> = {
  zh: { nowPlaying: "正在播放", like: "讚", share: "分享", save: "收藏" },
  en: { nowPlaying: "Now Playing", like: "Like", share: "Share", save: "Save" },
  ja: { nowPlaying: "再生中", like: "いいね", share: "シェア", save: "保存" },
};

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
  /** photo:照片為主(照片在上、文字在下);text:文字為主(頭像在左欄,文字在上、照片在下) */
  layout: "photo" | "text";
  name: string;
  place: string;
  caption: string;
  time: string;
  likes: string;
  comments: string;
  reposts: string;
  liked: boolean;
  ratio: "1:1" | "4:5";
  theme: UiTheme;
};

export type StorySettings = {
  name: string;
  time: string;
  segments: number;
  current: number;
  /** 底部放什麼:回覆框、一行大字、什麼都不放 */
  bottom: "reply" | "caption" | "none";
  reply: string;
  caption: string;
};

export type InterfaceSettings = {
  ui: { lang: UiLang };
  player: PlayerSettings;
  video: VideoSettings;
  social: SocialSettings;
  story: StorySettings;
};

/** 跟語言有關的預設內容:切換語言時,還沒改過的欄位跟著換 */
const LOCALIZED: Record<
  UiLang,
  {
    player: Pick<PlayerSettings, "title">;
    video: Pick<VideoSettings, "title" | "meta">;
    social: Pick<SocialSettings, "caption" | "time">;
    story: Pick<StorySettings, "time" | "reply" | "caption">;
  }
> = {
  zh: {
    player: { title: "午後的慢板" },
    video: { title: "週末的散步紀錄", meta: "1.2 萬次觀看・3 天前" },
    social: { caption: "光線很軟的下午，書翻得很慢。", time: "3 小時前" },
    story: { time: "5 小時", reply: "回覆…", caption: "今天也好好過" },
  },
  en: {
    player: { title: "slow afternoon" },
    video: { title: "a quiet walk on sunday", meta: "12K views · 3 days ago" },
    social: { caption: "soft light, slow pages.", time: "3h" },
    story: { time: "5h", reply: "Reply…", caption: "little things, softly." },
  },
  ja: {
    player: { title: "ひだまりの午後" },
    video: { title: "日曜日のおさんぽ記録", meta: "1.2万回視聴・3日前" },
    social: { caption: "やわらかい光と、ゆっくりめくるページ。", time: "3時間前" },
    story: { time: "5時間", reply: "返信する…", caption: "きょうも、いい日。" },
  },
};

export function defaultInterfaceSettings(lang: UiLang = "en"): InterfaceSettings {
  const text = LOCALIZED[lang];
  return {
    ui: { lang },
    player: {
      ...text.player,
      artist: "TOOLBOX",
      current: "1:24",
      total: "3:45",
      playing: true,
      liked: true,
      theme: "paper",
    },
    video: {
      ...text.video,
      current: "2:08",
      total: "8:30",
      paused: false,
      accent: "#c0573e",
      info: true,
      theme: "paper",
    },
    social: {
      ...text.social,
      layout: "photo",
      name: "toolbox.daily",
      place: "",
      likes: "128",
      comments: "12",
      reposts: "3",
      liked: true,
      ratio: "4:5",
      theme: "paper",
    },
    story: { ...text.story, name: "toolbox", segments: 4, current: 2, bottom: "caption" },
  };
}

/**
 * 換介面語言:還是某個語言預設內容的欄位,換成新語言的預設;使用者自己改過的不動。
 */
export function switchLanguage(settings: InterfaceSettings, lang: UiLang): InterfaceSettings {
  const next = LOCALIZED[lang];
  const isDefault = (group: keyof typeof next, field: string, value: string) =>
    (Object.keys(LOCALIZED) as UiLang[]).some(
      (l) => (LOCALIZED[l][group] as Record<string, string>)[field] === value
    );
  const swap = <G extends keyof typeof next>(group: G, current: InterfaceSettings[G]) => {
    const out = { ...current } as Record<string, unknown>;
    for (const [field, value] of Object.entries(next[group])) {
      if (isDefault(group, field, String(out[field]))) out[field] = value;
    }
    return out as InterfaceSettings[G];
  };
  return {
    ...settings,
    ui: { lang },
    player: swap("player", settings.player),
    video: swap("video", settings.video),
    social: swap("social", settings.social),
    story: swap("story", settings.story),
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

/**
 * 估計一段字要排幾行(版面要在畫之前就決定高度,這時還沒有 canvas 可以量)。
 * 中日文一個字算一個字寬,英數算半個多一點。
 */
export function estimateLines(text: string, charsPerLine: number, maxLines: number): number {
  let lines = 1;
  let used = 0;
  for (const char of text) {
    if (char === "\n") {
      lines += 1;
      used = 0;
      continue;
    }
    const w = /[\u0000-ɏ]/.test(char) ? 0.56 : 1;
    if (used + w > charsPerLine) {
      lines += 1;
      used = 0;
    }
    used += w;
  }
  return Math.max(1, Math.min(maxLines, lines));
}

type Box = { x: number; y: number; width: number; height: number };

/** 文字貼文的內文:字級與每行可放的字數,版面與畫圖共用 */
const TEXT_POST = { size: 4.2, lineHeight: 6, left: 17, right: 5, maxLines: 5 };

/**
 * 介面的版面:畫布多大、照片放在哪。
 * 以照片的短邊當基準寬度,播放器、貼文、限時動態都是直式;影片照長邊、16:9。
 */
export function interfaceLayout(size: Size, kind: InterfaceKind, s: InterfaceSettings): { canvas: Size; photo: Box } {
  const base = Math.round(Math.min(size.width, size.height));
  const k = base / 100;
  switch (kind) {
    case "player": {
      const side = Math.round(base * 0.8);
      return {
        canvas: { width: base, height: Math.round(base * 1.8) },
        photo: { x: Math.round(base * 0.1), y: Math.round(base * 0.2), width: side, height: side },
      };
    }
    case "video": {
      const width = Math.round(Math.max(size.width, size.height));
      const height = Math.round((width * 9) / 16);
      const info = s.video.info ? Math.round(width * 0.17) : 0;
      return { canvas: { width, height: height + info }, photo: { x: 0, y: 0, width, height } };
    }
    case "social": {
      const ratio = s.social.ratio === "4:5" ? 1.25 : 1;
      if (s.social.layout === "text") {
        const width = base - Math.round((TEXT_POST.left + TEXT_POST.right) * k);
        const charsPerLine = (100 - TEXT_POST.left - TEXT_POST.right) / TEXT_POST.size;
        const lines = estimateLines(s.social.caption, charsPerLine, TEXT_POST.maxLines);
        const top = Math.round((13 + lines * TEXT_POST.lineHeight + 3) * k);
        const height = Math.round(width * ratio);
        return {
          canvas: { width: base, height: top + height + Math.round(16 * k) },
          photo: { x: Math.round(TEXT_POST.left * k), y: top, width, height },
        };
      }
      const inset = Math.round(4 * k);
      const width = base - inset * 2;
      const height = Math.round(width * ratio);
      const header = Math.round(15 * k);
      const lines = estimateLines(s.social.caption, (100 - 8) / 3.8, 3);
      const place = s.social.place.trim() ? 6 * k : 0;
      return {
        canvas: { width: base, height: Math.round(header + height + place + (8 + lines * 5.4 + 16) * k) },
        photo: { x: inset, y: header, width, height },
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
  repost(ctx: Ctx, s: number) {
    const r = s * 0.42;
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, r * 0.15);
    ctx.lineTo(-r * 0.75, -r * 0.55);
    ctx.lineTo(r * 0.55, -r * 0.55);
    ctx.moveTo(-r * 1.05, -r * 0.15);
    ctx.lineTo(-r * 0.75, r * 0.15);
    ctx.lineTo(-r * 0.45, -r * 0.15);
    ctx.moveTo(r * 0.75, -r * 0.15);
    ctx.lineTo(r * 0.75, r * 0.55);
    ctx.lineTo(-r * 0.55, r * 0.55);
    ctx.moveTo(r * 1.05, r * 0.15);
    ctx.lineTo(r * 0.75, -r * 0.15);
    ctx.lineTo(r * 0.45, r * 0.15);
    ctx.stroke();
  },
  pin(ctx: Ctx, s: number) {
    const r = s * 0.36;
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.62, Math.PI * 0.82, Math.PI * 2.18);
    ctx.lineTo(0, r * 1.05);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.2, 0, Math.PI * 2);
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

function cover(ctx: Ctx, source: CanvasImageSource, from: Size, box: Box, radius = 0, framing: Framing = DEFAULT_FRAMING) {
  const rect = coverRect(from, box, framing);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, radius);
  ctx.clip();
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
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

const NO_LINE_START = /[、。，．,.!?！？）」』】ーっゃゅょァィゥェォッャュョ…・:;：；]/;

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
    // 避頭:句讀與長音不放在行首,寧可讓這一行稍微超出一點
    if (ctx.measureText(line + char).width > limit && line && !NO_LINE_START.test(char)) {
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
function avatar(
  ctx: Ctx,
  source: CanvasImageSource,
  from: Size,
  cx: number,
  cy: number,
  r: number,
  ring: string | null,
  framing: Framing = DEFAULT_AVATAR_FRAMING
) {
  if (ring) {
    ctx.save();
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const rect = coverRect(from, { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, framing);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

type Colors = { bg: string; ink: string; muted: string; line: string; card: string; accent: string };

const PALETTE: Record<UiTheme, Colors> = {
  // 米白紙、暖灰墨、磚紅點綴
  paper: { bg: "#f3eee4", ink: "#3b352d", muted: "#958b7b", line: "#e0d7c7", card: "#fbf8f2", accent: "#c0573e" },
  light: { bg: "#ffffff", ink: "#1c1c1f", muted: "#7a7a80", line: "#ececef", card: "#f5f5f6", accent: "#e5484d" },
  dark: { bg: "#141416", ink: "#f2f2f3", muted: "#9a9aa2", line: "#2b2b30", card: "#1e1e22", accent: "#ff6b6b" },
};

/** 紙感用襯線字當標題,另外兩種用無襯線 */
const titleFont = (theme: UiTheme | "blur") => (theme === "paper" ? SERIF : FONT);

/** 紙感的細微紙紋:很淡的斑點,只在紙感底色上加 */
function paperTexture(ctx: Ctx, canvas: Size) {
  const k = canvas.width / 100;
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.save();
  const count = Math.round((canvas.width * canvas.height) / (k * k * 6));
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = random() < 0.5 ? "rgba(120, 100, 70, 0.05)" : "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(random() * canvas.width, random() * canvas.height, k * 0.25, k * 0.25);
  }
  ctx.restore();
}

function fillBackground(ctx: Ctx, canvas: Size, theme: UiTheme) {
  ctx.fillStyle = PALETTE[theme].bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (theme === "paper") paperTexture(ctx, canvas);
}

/** 照片外面一圈白紙邊,像貼在本子上的相片 */
function matted(ctx: Ctx, source: CanvasImageSource, from: Size, box: Box, k: number, colors: Colors, framing: Framing) {
  const mat = 1.6 * k;
  ctx.save();
  ctx.shadowColor = "rgba(60, 45, 30, 0.22)";
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetY = 1 * k;
  ctx.fillStyle = colors.card;
  ctx.fillRect(box.x - mat, box.y - mat, box.width + mat * 2, box.height + mat * 2);
  ctx.restore();
  cover(ctx, source, from, box, 0, framing);
}

// ---- 四種介面 ----

function drawPlayer(
  ctx: Ctx,
  source: CanvasImageSource,
  from: Size,
  canvas: Size,
  photo: Box,
  s: PlayerSettings,
  lang: UiLang,
  f: Frames
) {
  const W = canvas.width;
  const k = W / 100;
  const paper = s.theme === "paper";
  const colors: Colors =
    s.theme === "blur"
      ? { bg: "", ink: "#ffffff", muted: "rgba(255, 255, 255, 0.7)", line: "rgba(255, 255, 255, 0.28)", card: "#fff", accent: "#ffb4a2" }
      : PALETTE[s.theme];
  if (s.theme === "blur") blurredBackdrop(ctx, source, from, canvas);
  else fillBackground(ctx, canvas, s.theme);

  // 上方列:紙感時是「— Now Playing —」的斜體小字
  const top = 9 * k;
  icon(ctx, 10 * k, top, 6 * k, colors.ink, Icons.chevronDown);
  icon(ctx, W - 10 * k, top, 6 * k, colors.ink, (c, sz) => Icons.dots(c, sz));
  ctx.fillStyle = colors.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = STRINGS[lang].nowPlaying;
  if (paper) {
    ctx.font = `italic 500 ${4 * k}px ${SERIF}`;
    ctx.fillText(label, W / 2, top);
    const half = ctx.measureText(label).width / 2 + 2.5 * k;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = Math.max(1, 0.25 * k);
    ctx.beginPath();
    ctx.moveTo(W / 2 - half - 6 * k, top);
    ctx.lineTo(W / 2 - half, top);
    ctx.moveTo(W / 2 + half, top);
    ctx.lineTo(W / 2 + half + 6 * k, top);
    ctx.stroke();
  } else {
    ctx.font = `600 ${3.4 * k}px ${FONT}`;
    ctx.fillText(label, W / 2, top);
  }

  // 封面:紙感是加白邊的相片,其他是圓角
  if (paper) matted(ctx, source, from, photo, k, colors, f.photo);
  else {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 5 * k;
    ctx.shadowOffsetY = 2 * k;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(photo.x, photo.y, photo.width, photo.height, 3 * k);
    ctx.fill();
    ctx.restore();
    cover(ctx, source, from, photo, 3 * k, f.photo);
  }

  // 歌名、歌手、愛心
  const left = photo.x;
  const right = photo.x + photo.width;
  let y = photo.y + photo.height + 12 * k;
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink;
  ctx.font = `${paper ? "600" : "700"} ${(paper ? 6.6 : 6) * k}px ${titleFont(s.theme)}`;
  fitText(ctx, s.title, left, y, right - left - 12 * k);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${3.6 * k}px ${FONT}`;
  if (paper) ctx.letterSpacing = `${0.5 * k}px`;
  fitText(ctx, s.artist, left, y + 7 * k, right - left - 12 * k);
  ctx.letterSpacing = "0px";
  icon(ctx, right - 3 * k, y + 3 * k, 6.5 * k, s.liked ? colors.accent : colors.muted, (c, sz) => Icons.heart(c, sz, s.liked));

  // 進度:紙感用細線
  y += 18 * k;
  const progress = clockProgress(s.current, s.total);
  progressBar(ctx, left, y, right - left, progress, paper ? k * 0.5 : k, colors.line, colors.ink, paper ? 1.1 * k : 1.6 * k);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${3.1 * k}px ${FONT}`;
  ctx.fillText(s.current, left, y + 5.5 * k);
  ctx.textAlign = "right";
  ctx.fillText(s.total, right, y + 5.5 * k);

  // 控制鍵:紙感的播放鍵是細圈,不是實心
  y += 20 * k;
  icon(ctx, left + 3 * k, y, 5.5 * k, colors.muted, Icons.shuffle);
  icon(ctx, W / 2 - 21 * k, y, 7 * k, colors.ink, (c, sz) => Icons.skip(c, sz, true));
  if (paper) {
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = Math.max(1, 0.45 * k);
    ctx.beginPath();
    ctx.arc(W / 2, y, 9 * k, 0, Math.PI * 2);
    ctx.stroke();
    icon(ctx, W / 2 + (s.playing ? 0 : 0.8 * k), y, 7 * k, colors.ink, s.playing ? Icons.pause : Icons.play);
  } else {
    ctx.fillStyle = colors.ink;
    ctx.beginPath();
    ctx.arc(W / 2, y, 9.5 * k, 0, Math.PI * 2);
    ctx.fill();
    const inner = s.theme === "light" ? "#ffffff" : s.theme === "dark" ? "#141416" : "#1b1b1f";
    icon(ctx, W / 2 + (s.playing ? 0 : 0.8 * k), y, 8 * k, inner, s.playing ? Icons.pause : Icons.play);
  }
  icon(ctx, W / 2 + 21 * k, y, 7 * k, colors.ink, (c, sz) => Icons.skip(c, sz));
  icon(ctx, right - 3 * k, y, 5.5 * k, colors.muted, Icons.repeat);

  y += 17 * k;
  icon(ctx, left + 3 * k, y, 4.6 * k, colors.muted, Icons.share);
  icon(ctx, right - 3 * k, y, 4.6 * k, colors.muted, Icons.list);
}

function drawVideo(
  ctx: Ctx,
  source: CanvasImageSource,
  from: Size,
  canvas: Size,
  photo: Box,
  s: VideoSettings,
  lang: UiLang,
  f: Frames
) {
  const W = canvas.width;
  const k = W / 100;
  const colors = PALETTE[s.theme];
  fillBackground(ctx, canvas, s.theme);
  ctx.fillStyle = "#000";
  ctx.fillRect(photo.x, photo.y, photo.width, photo.height);
  cover(ctx, source, from, photo, 0, f.photo);

  // 下方漸層,控制列壓在上面
  const bottom = photo.y + photo.height;
  const g = ctx.createLinearGradient(0, bottom - 12 * k, 0, bottom);
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.65)");
  ctx.fillStyle = g;
  ctx.fillRect(0, bottom - 12 * k, W, 12 * k);

  const barY = bottom - 7 * k;
  progressBar(ctx, 3 * k, barY, W - 6 * k, clockProgress(s.current, s.total), k * 0.5, "rgba(255, 255, 255, 0.35)", s.accent, 1 * k);

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

  if (s.paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.arc(W / 2, photo.y + photo.height / 2, 6 * k, 0, Math.PI * 2);
    ctx.fill();
    icon(ctx, W / 2 + 0.6 * k, photo.y + photo.height / 2, 5.5 * k, "#fff", Icons.play);
  }

  if (!s.info) return;
  const top = bottom + 2.6 * k;
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.ink;
  ctx.font = `${s.theme === "paper" ? "600" : "700"} ${3.2 * k}px ${titleFont(s.theme)}`;
  fitText(ctx, s.title, 3 * k, top, W * 0.6);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${2.1 * k}px ${FONT}`;
  fitText(ctx, s.meta, 3 * k, top + 5 * k, W * 0.5);

  // 右邊幾顆膠囊按鈕:讚、分享、收藏
  const t = STRINGS[lang];
  const pills: { label: string; draw: (c: Ctx, z: number) => void }[] = [
    { label: t.save, draw: Icons.bookmark },
    { label: t.share, draw: Icons.share },
    { label: t.like, draw: Icons.thumb },
  ];
  let x = W - 3 * k;
  const py = top + 5.6 * k;
  ctx.font = `600 ${2 * k}px ${FONT}`;
  for (const pill of pills) {
    const w = ctx.measureText(pill.label).width + 7.5 * k;
    x -= w;
    if (s.theme === "paper") {
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = Math.max(1, 0.25 * k);
      ctx.beginPath();
      ctx.roundRect(x, py - 2.4 * k, w, 4.8 * k, 2.4 * k);
      ctx.stroke();
    } else {
      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.roundRect(x, py - 2.4 * k, w, 4.8 * k, 2.4 * k);
      ctx.fill();
    }
    icon(ctx, x + 2.8 * k, py, 2.5 * k, colors.ink, pill.draw);
    ctx.fillStyle = colors.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(pill.label, x + 5 * k, py);
    x -= 1.5 * k;
  }
}

/** 動作列:愛心、留言、轉發各帶數字,分享靠右 */
function actionRow(ctx: Ctx, x: number, right: number, y: number, k: number, s: SocialSettings, colors: Colors) {
  const sz = 5.4 * k;
  const items: { draw: (c: Ctx, z: number) => void; count: string; color: string }[] = [
    { draw: (c, z) => Icons.heart(c, z, s.liked), count: s.likes, color: s.liked ? colors.accent : colors.ink },
    { draw: Icons.bubble, count: s.comments, color: colors.ink },
    { draw: Icons.repost, count: s.reposts, color: colors.ink },
  ];
  ctx.font = `500 ${3.2 * k}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let cx = x + sz / 2;
  for (const item of items) {
    icon(ctx, cx, y, sz, item.color, item.draw);
    let next = cx + sz / 2 + 4 * k;
    if (item.count.trim()) {
      ctx.fillStyle = colors.muted;
      ctx.fillText(item.count, cx + sz / 2 + 1.6 * k, y);
      next = cx + sz / 2 + 1.6 * k + ctx.measureText(item.count).width + 5 * k;
    }
    cx = next + sz / 2;
  }
  icon(ctx, right - sz / 2, y, sz * 0.92, colors.ink, Icons.share);
}

/** 名字＋「・時間」 */
function nameLine(ctx: Ctx, s: SocialSettings, x: number, y: number, maxWidth: number, k: number, colors: Colors) {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.ink;
  ctx.font = `700 ${3.7 * k}px ${FONT}`;
  const name = s.name.trim() || " ";
  fitText(ctx, name, x, y, maxWidth * 0.7);
  const used = Math.min(maxWidth * 0.7, ctx.measureText(name).width);
  if (s.time.trim()) {
    ctx.fillStyle = colors.muted;
    ctx.font = `400 ${3.2 * k}px ${FONT}`;
    fitText(ctx, `・${s.time}`, x + used + 0.6 * k, y, maxWidth - used);
  }
}

function drawSocial(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size, photo: Box, s: SocialSettings, f: Frames) {
  const W = canvas.width;
  const k = W / 100;
  const colors = PALETTE[s.theme];
  const paper = s.theme === "paper";
  fillBackground(ctx, canvas, s.theme);
  const bodyFont = paper ? SERIF : FONT;

  if (s.layout === "text") {
    // 頭像在左欄,名字與內文在右邊,照片接在內文下面
    avatar(ctx, source, from, 9 * k, 8.5 * k, 4.6 * k, colors.line, f.avatar);
    nameLine(ctx, s, TEXT_POST.left * k, 6.5 * k, W - (TEXT_POST.left + 12) * k, k, colors);
    icon(ctx, W - 7 * k, 6.5 * k, 5.4 * k, colors.muted, (c, sz) => Icons.dots(c, sz));
    ctx.fillStyle = colors.ink;
    ctx.font = `400 ${TEXT_POST.size * k}px ${bodyFont}`;
    ctx.textBaseline = "middle";
    const width = W - (TEXT_POST.left + TEXT_POST.right) * k;
    const maxLines = Math.max(1, Math.round((photo.y / k - 16) / TEXT_POST.lineHeight));
    wrapText(ctx, s.caption, width, width, maxLines).forEach((line, i) =>
      ctx.fillText(line, TEXT_POST.left * k, (13.5 + TEXT_POST.lineHeight * (i + 0.5)) * k)
    );
    // 左欄一條細線,把頭像跟這則串起來
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = Math.max(1, 0.3 * k);
    ctx.beginPath();
    ctx.moveTo(9 * k, 15 * k);
    ctx.lineTo(9 * k, photo.y + photo.height);
    ctx.stroke();
    if (paper) matted(ctx, source, from, photo, k * 0.7, colors, f.photo);
    else cover(ctx, source, from, photo, 2.4 * k, f.photo);
    actionRow(ctx, photo.x, photo.x + photo.width, photo.y + photo.height + 8 * k, k, s, colors);
    return;
  }

  // 照片為主:頭像、名字・時間、更多;照片內縮成圓角(紙感是白邊相片)
  const head = photo.y / 2;
  avatar(ctx, source, from, 9 * k, head, 4.4 * k, colors.line, f.avatar);
  nameLine(ctx, s, 16 * k, head, W - 30 * k, k, colors);
  icon(ctx, W - 7 * k, head, 5.4 * k, colors.muted, (c, sz) => Icons.dots(c, sz));
  if (paper) matted(ctx, source, from, photo, k * 0.7, colors, f.photo);
  else cover(ctx, source, from, photo, 2.4 * k, f.photo);

  let y = photo.y + photo.height + 6 * k;
  if (s.place.trim()) {
    icon(ctx, photo.x + 1.6 * k, y, 3.6 * k, colors.muted, Icons.pin);
    ctx.fillStyle = colors.muted;
    ctx.font = `${paper ? "italic " : ""}400 ${3 * k}px ${bodyFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fitText(ctx, s.place, photo.x + 4.6 * k, y, photo.width - 6 * k);
    y += 6 * k;
  }
  ctx.fillStyle = colors.ink;
  ctx.font = `400 ${3.8 * k}px ${bodyFont}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lines = wrapText(ctx, s.caption, photo.width, photo.width, 3);
  lines.forEach((line, i) => ctx.fillText(line, photo.x, y + i * 5.4 * k));
  y += Math.max(1, lines.length) * 5.4 * k + 6 * k;
  // 一條細分隔線,動作列在下面
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = Math.max(1, 0.25 * k);
  ctx.beginPath();
  ctx.moveTo(photo.x, y - 2 * k);
  ctx.lineTo(photo.x + photo.width, y - 2 * k);
  ctx.stroke();
  actionRow(ctx, photo.x, photo.x + photo.width, y + 4.5 * k, k, s, colors);
}

function drawStory(ctx: Ctx, source: CanvasImageSource, from: Size, canvas: Size, s: StorySettings, f: Frames) {
  const W = canvas.width;
  const H = canvas.height;
  const k = W / 100;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  cover(ctx, source, from, { x: 0, y: 0, width: W, height: H }, 0, f.photo);

  // 上下壓暗,白字才看得清楚
  const top = ctx.createLinearGradient(0, 0, 0, 22 * k);
  top.addColorStop(0, "rgba(0, 0, 0, 0.4)");
  top.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 22 * k);
  if (s.bottom !== "none") {
    const bottom = ctx.createLinearGradient(0, H - 34 * k, 0, H);
    bottom.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottom.addColorStop(1, "rgba(0, 0, 0, 0.42)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H - 34 * k, W, 34 * k);
  }

  // 分段進度條
  const count = Math.max(1, Math.min(12, Math.round(s.segments)));
  const current = Math.max(1, Math.min(count, Math.round(s.current)));
  const gap = 1 * k;
  const segW = (W - 4 * k - gap * (count - 1)) / count;
  for (let i = 0; i < count; i += 1) {
    const x = 2 * k + i * (segW + gap);
    const fill = i < current - 1 ? 1 : i === current - 1 ? 0.55 : 0;
    progressBar(ctx, x, 3 * k, segW, fill, k * 0.7, "rgba(255, 255, 255, 0.38)", "#ffffff", 0);
  }

  // 頭像、名字、時間、更多、關閉
  const head = 10.5 * k;
  avatar(ctx, source, from, 7.5 * k, head, 4 * k, "rgba(255, 255, 255, 0.8)", f.avatar);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${3.7 * k}px ${FONT}`;
  const name = s.name.trim() || " ";
  fitText(ctx, name, 14 * k, head, W * 0.5);
  const nameW = Math.min(W * 0.5, ctx.measureText(name).width);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = `400 ${3.3 * k}px ${FONT}`;
  ctx.fillText(s.time, 14 * k + nameW + 2.4 * k, head);
  icon(ctx, W - 14 * k, head, 6 * k, "#fff", (c, sz) => Icons.dots(c, sz));
  icon(ctx, W - 6 * k, head, 6 * k, "#fff", Icons.close);

  if (s.bottom === "caption" && s.caption.trim()) {
    // 一行(最多兩行)襯線大字,置中,淡淡的影子
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 2 * k;
    ctx.font = `italic 500 ${7 * k}px ${SERIF}`;
    const lines = wrapText(ctx, s.caption, W - 16 * k, W - 16 * k, 2);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H - (12 + (lines.length - 1 - i) * 9) * k));
    ctx.restore();
  } else if (s.bottom === "reply") {
    const y = H - 9 * k;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = Math.max(1, 0.3 * k);
    ctx.beginPath();
    ctx.roundRect(4 * k, y - 5.5 * k, W - 20 * k, 11 * k, 5.5 * k);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `400 ${3.6 * k}px ${FONT}`;
    fitText(ctx, s.reply, 9 * k, y, W - 32 * k);
    icon(ctx, W - 8 * k, y, 6.4 * k, "#fff", (c, sz) => Icons.heart(c, sz));
  }
}

export function drawInterface(
  ctx: Ctx,
  kind: InterfaceKind,
  source: CanvasImageSource,
  from: Size,
  layout: { canvas: Size; photo: Box },
  s: InterfaceSettings,
  f: Frames = { photo: DEFAULT_FRAMING, avatar: DEFAULT_AVATAR_FRAMING }
) {
  const lang = s.ui?.lang ?? "en";
  switch (kind) {
    case "player":
      return drawPlayer(ctx, source, from, layout.canvas, layout.photo, s.player, lang, f);
    case "video":
      return drawVideo(ctx, source, from, layout.canvas, layout.photo, s.video, lang, f);
    case "social":
      return drawSocial(ctx, source, from, layout.canvas, layout.photo, s.social, f);
    case "story":
      return drawStory(ctx, source, from, layout.canvas, s.story, f);
  }
}
