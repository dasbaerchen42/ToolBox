// 浮水印的版面計算:只算位置與尺寸,不碰 canvas(畫在 render.ts)。
// 所有尺寸都是「相對於這張圖」的比例,批次套用到大小不一的圖時,
// 每張看起來的密度與大小才會一致。
import type { FontFamilyName } from "@/lib/preferences";
import type { Point, Size } from "./types";

export type WatermarkSource = "text" | "image";
export type WatermarkLayout = "tile" | "single";
export type TextFrame = "none" | "pill";
export type NoiseBlend = "overlay" | "soft-light" | "multiply" | "screen";

/** 九宮格位置:x 與 y 各自是 0(左/上)、0.5(中)、1(右/下) */
export type Anchor = { x: 0 | 0.5 | 1; y: 0 | 0.5 | 1 };

export type WatermarkSettings = {
  enabled: boolean;
  source: WatermarkSource;
  text: string;
  fontKey: FontFamilyName;
  bold: boolean;
  frame: TextFrame;
  color: string;
  /** 0–1 */
  opacity: number;
  /** 文字浮水印的字高,佔短邊的百分比 */
  size: number;
  /** 圖片浮水印的寬度,佔短邊的百分比(跟文字分開記,切換來源時才不會一個太大一個太小) */
  imageSize: number;
  /** 度,正值順時針 */
  angle: number;
  layout: WatermarkLayout;
  /** 平鋪時,相鄰兩個浮水印之間的空隙,是浮水印本身尺寸的百分比 */
  spacing: number;
  anchor: Anchor;
  /** 單個擺放時離邊緣多遠,短邊的百分比 */
  margin: number;
};

export type NoiseSettings = {
  enabled: boolean;
  color: boolean;
  blend: NoiseBlend;
  /** 0–1 */
  opacity: number;
  /** 一顆顆粒幾個像素寬(輸出圖的像素) */
  grain: number;
};

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: true,
  source: "text",
  text: "@",
  fontKey: "round",
  bold: true,
  frame: "pill",
  color: "#ffffff",
  opacity: 0.35,
  size: 4,
  imageSize: 20,
  angle: -20,
  layout: "tile",
  spacing: 80,
  anchor: { x: 1, y: 1 },
  margin: 3,
};

export const DEFAULT_NOISE: NoiseSettings = {
  enabled: false,
  color: false,
  blend: "overlay",
  opacity: 0.25,
  grain: 1,
};

export function shortSide(size: Size): number {
  return Math.min(size.width, size.height);
}

/** 浮水印的「基準長度」像素:文字是字高,圖片是寬 */
export function markScale(canvas: Size, sizePercent: number): number {
  return Math.max(1, (shortSide(canvas) * sizePercent) / 100);
}

/**
 * 平鋪:回傳每個浮水印中心點,座標系是「以畫布中心為原點、已經轉過 angle」的座標系。
 *
 * 畫的時候先把 context 移到畫布中心、轉 angle,再照這些點畫,
 * 所以只要鋪滿一個邊長等於對角線的正方形,轉到任何角度四個角都不會露白。
 * 奇數列往右錯開半格,排出來像磚牆,比方格自然。
 */
export function tileCenters(canvas: Size, mark: Size, spacingPercent: number): Point[] {
  const gap = Math.max(0, spacingPercent) / 100;
  const stepX = Math.max(1, mark.width * (1 + gap));
  const stepY = Math.max(1, mark.height * (1 + gap));

  const half = Math.hypot(canvas.width, canvas.height) / 2;
  // 多鋪一格,錯開半格的那幾列邊緣才不會缺
  const cols = Math.ceil(half / stepX) + 1;
  const rows = Math.ceil(half / stepY) + 1;

  const points: Point[] = [];
  for (let row = -rows; row <= rows; row++) {
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    for (let col = -cols; col <= cols; col++) {
      points.push({ x: col * stepX + offset, y: row * stepY });
    }
  }
  return points;
}

/**
 * 單個擺放:回傳浮水印中心點(一般畫布座標)。
 * 用「轉過之後的外框」去貼邊,斜放的浮水印才不會有一角跑出畫面。
 */
export function singleCenter(
  canvas: Size,
  mark: Size,
  angle: number,
  anchor: Anchor,
  marginPercent: number
): Point {
  const bounds = rotatedBounds(mark, angle);
  const margin = (shortSide(canvas) * Math.max(0, marginPercent)) / 100;

  const place = (length: number, extent: number, at: 0 | 0.5 | 1) => {
    if (at === 0.5) return length / 2;
    const near = margin + extent / 2;
    return at === 0 ? near : length - near;
  };

  return {
    x: place(canvas.width, bounds.width, anchor.x),
    y: place(canvas.height, bounds.height, anchor.y),
  };
}

/** 一個矩形轉 angle 度之後,外接矩形的大小 */
export function rotatedBounds(size: Size, angle: number): Size {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: size.width * cos + size.height * sin,
    height: size.width * sin + size.height * cos,
  };
}

/**
 * 固定種子的亂數:同一組設定每次產生的雜訊都一樣,
 * 預覽看到的顆粒分佈就是輸出的樣子,批次每張也一致。
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
