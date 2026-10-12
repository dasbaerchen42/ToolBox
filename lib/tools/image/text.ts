// 放字:像限時動態那樣,在圖上隨意放幾段字,每段可以搬、轉、縮放。
// 排版與繪製都在這裡,預覽(畫在疊加層的 canvas)跟套用(畫進原圖)用同一套,
// 看到的就是輸出的。座標一律是原圖像素;x、y 是那段字的中心點。

import type { FontFamilyName } from "@/lib/preferences";
import type { Point, Size } from "./types";

/** 文字底下要不要墊東西:無、每行一塊色底(限動的「螢光筆」)、整段半透明底 */
export type TextBackdrop = "none" | "line" | "block";

export type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  /** 字級(原圖像素) */
  size: number;
  /** 旋轉(度,順時針) */
  rotation: number;
  font: FontFamilyName;
  bold: boolean;
  color: string;
  align: "left" | "center" | "right";
  backdrop: TextBackdrop;
  backdropColor: string;
  /** 文字描邊(粗細是字級的比例,0 = 不描) */
  stroke: number;
  strokeColor: string;
  shadow: boolean;
};

export const LINE_HEIGHT = 1.3;

/** 新的一段字:放在 at,字級照圖的短邊抓 */
export function newTextLayer(id: string, at: Point, image: Size, base?: Partial<TextLayer>): TextLayer {
  return {
    text: "點這裡輸入文字",
    rotation: 0,
    font: "sans",
    bold: true,
    color: "#ffffff",
    align: "center",
    backdrop: "none",
    backdropColor: "#000000",
    stroke: 0,
    strokeColor: "#000000",
    shadow: true,
    ...base,
    id,
    x: at.x,
    y: at.y,
    size: base?.size ?? Math.max(12, Math.round(Math.min(image.width, image.height) * 0.07)),
  };
}

export type TextMetricsLike = { width: number };
export type Measure = (text: string) => TextMetricsLike;

export type TextBox = {
  lines: { text: string; width: number }[];
  /** 整段的寬高(含底色的內距) */
  width: number;
  height: number;
  /** 底色塊、半透明底的內距 */
  padX: number;
  padY: number;
  lineHeight: number;
};

export function fontString(layer: Pick<TextLayer, "bold" | "size">, family: string): string {
  return `${layer.bold ? 700 : 400} ${layer.size}px ${family}`;
}

/** 排一段字:每行多寬、整段多大(不含旋轉)。measure 用 ctx.measureText,可以換成假的來測 */
export function layoutTextLayer(layer: TextLayer, measure: Measure): TextBox {
  const lineHeight = layer.size * LINE_HEIGHT;
  const lines = (layer.text || " ").split("\n").map((text) => ({ text, width: measure(text).width }));
  const hasBackdrop = layer.backdrop !== "none";
  const padX = hasBackdrop ? layer.size * 0.45 : 0;
  const padY = hasBackdrop ? layer.size * 0.18 : 0;
  const inner = Math.max(...lines.map((line) => line.width), layer.size * 0.5);
  return { lines, width: inner + padX * 2, height: lines.length * lineHeight + padY * 2, padX, padY, lineHeight };
}

/** 一行字在整段裡的左緣(相對中心點) */
function lineLeft(layer: TextLayer, box: TextBox, width: number): number {
  const inner = box.width - box.padX * 2;
  if (layer.align === "left") return -inner / 2;
  if (layer.align === "right") return inner / 2 - width;
  return -width / 2;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 半透明底用的顏色:#rrggbb → rgba(…, alpha) */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * 把一段字畫到 ctx 上。scale 是 ctx 對原圖的縮放(預覽用小一點的 canvas)。
 * family 要先用 canvasFontFamily 換成真正的字體名稱、載好字。
 */
export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, family: string, scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.font = fontString(layer, family);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const box = layoutTextLayer(layer, (text) => ctx.measureText(text));
  const top = -box.height / 2 + box.padY;

  if (layer.backdrop === "block") {
    ctx.fillStyle = withAlpha(layer.backdropColor, 0.55);
    roundRect(ctx, -box.width / 2, -box.height / 2, box.width, box.height, layer.size * 0.35);
    ctx.fill();
  }
  if (layer.backdrop === "line") {
    // 每行一塊,相鄰兩行的色塊會黏在一起,像限動的文字底
    ctx.fillStyle = layer.backdropColor;
    box.lines.forEach((line, i) => {
      if (!line.text.trim()) return;
      const x = lineLeft(layer, box, line.width) - box.padX;
      const y = top + i * box.lineHeight - box.padY;
      roundRect(ctx, x, y, line.width + box.padX * 2, box.lineHeight + box.padY * 2, layer.size * 0.3);
      ctx.fill();
    });
  }

  box.lines.forEach((line, i) => {
    const x = lineLeft(layer, box, line.width);
    const y = top + (i + 0.5) * box.lineHeight;
    if (layer.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = layer.size * 0.15;
      ctx.shadowOffsetY = layer.size * 0.04;
    }
    if (layer.stroke > 0) {
      ctx.lineJoin = "round";
      ctx.lineWidth = layer.size * layer.stroke;
      ctx.strokeStyle = layer.strokeColor;
      ctx.strokeText(line.text, x, y);
      // 描邊已經帶了陰影,填色就不要再疊一次
      ctx.shadowColor = "transparent";
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(line.text, x, y);
    ctx.shadowColor = "transparent";
  });

  ctx.restore();
}

/** 點 p 有沒有落在這段字上(把點轉回這段字自己的座標系,再看在不在框裡) */
export function hitTextLayer(layer: TextLayer, box: Pick<TextBox, "width" | "height">, p: Point): boolean {
  const a = (-layer.rotation * Math.PI) / 180;
  const dx = p.x - layer.x;
  const dy = p.y - layer.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  const margin = layer.size * 0.3;
  return Math.abs(lx) <= box.width / 2 + margin && Math.abs(ly) <= box.height / 2 + margin;
}

/** 右下角把手的位置(原圖座標):拖它同時旋轉與縮放 */
export function handlePoint(layer: TextLayer, box: Pick<TextBox, "width" | "height">): Point {
  const a = (layer.rotation * Math.PI) / 180;
  const hx = box.width / 2;
  const hy = box.height / 2;
  return { x: layer.x + hx * Math.cos(a) - hy * Math.sin(a), y: layer.y + hx * Math.sin(a) + hy * Math.cos(a) };
}

/**
 * 拖把手:從 start(按下時的把手位置)拖到 p,換算新的字級與角度。
 * 離中心越遠字越大,繞著中心轉多少字就轉多少。
 */
export function dragHandle(layer: TextLayer, startLayer: Pick<TextLayer, "size" | "rotation">, start: Point, p: Point): Pick<TextLayer, "size" | "rotation"> {
  const v0 = { x: start.x - layer.x, y: start.y - layer.y };
  const v1 = { x: p.x - layer.x, y: p.y - layer.y };
  const d0 = Math.hypot(v0.x, v0.y) || 1;
  const d1 = Math.hypot(v1.x, v1.y);
  const angle = ((Math.atan2(v1.y, v1.x) - Math.atan2(v0.y, v0.x)) * 180) / Math.PI;
  let rotation = startLayer.rotation + angle;
  rotation = ((((rotation + 180) % 360) + 360) % 360) - 180;
  // 接近水平時吸附到 0 度,比較好擺正
  if (Math.abs(rotation) < 3) rotation = 0;
  return { size: Math.max(6, Math.round(startLayer.size * (d1 / d0))), rotation: Math.round(rotation * 10) / 10 };
}
