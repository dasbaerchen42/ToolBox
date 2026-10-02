// 沖印所的 canvas 組版:把逐像素效果與邊框、文字組成一張圖。
// 預覽與輸出都走 drawPrint,只差在畫布大小(預覽傳縮小過的 size 與 scale)。

import { assertCanvasSize } from "@/lib/canvas-limits";
import { createWorkImage } from "@/lib/tools/image/render";
import type { WorkImage } from "@/lib/tools/image/types";
import {
  addGrain,
  filmGrade,
  flash,
  halftone,
  hexToRgb,
  mulberry32,
  photocopy,
  posterTone,
  riso,
  type Pixels,
} from "./pixels";
import { coverRect, type Framing } from "./framing";
import { drawInterface } from "./interface";
import { isInterfaceKind, printLayout, type PosterTextStyle, type PrintSettings, type Size } from "./settings";

const FONT = `system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
const PAPER_COPY = hexToRgb("#e9e7e1");

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立繪圖環境");
  return [canvas, ctx];
}

/** 把來源畫成 w×h 讀出像素(cover:照比例裁滿) */
function pixelsOf(source: CanvasImageSource, from: Size, w: number, h: number): Pixels {
  const [, ctx] = makeCanvas(w, h);
  const scale = Math.max(w / from.width, h / from.height);
  const dw = from.width * scale;
  const dh = from.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const image = ctx.getImageData(0, 0, Math.round(w), Math.round(h));
  return { width: image.width, height: image.height, data: image.data };
}

function putPixels(ctx: CanvasRenderingContext2D, px: Pixels, data: Uint8ClampedArray, x: number, y: number) {
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), px.width, px.height), Math.round(x), Math.round(y));
}

/** putImageData 不吃變形與透明疊加;要旋轉或疊在別的東西上時先放進一張小畫布 */
function pixelsToCanvas(px: Pixels, data: Uint8ClampedArray): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(px.width, px.height);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), px.width, px.height), 0, 0);
  return canvas;
}

/** 照片裁滿到指定區域(邊框類用),取景照使用者調的構圖 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  from: Size,
  box: { x: number; y: number; width: number; height: number },
  framing: Framing
) {
  const rect = coverRect(from, box, framing);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

/** 在畫布上「挖洞」:郵票齒孔、票券缺口 */
function punch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPostmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  u: number,
  date: string,
  place: string
) {
  const r = 11 * u;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.strokeStyle = "rgba(34, 34, 48, 0.72)";
  ctx.fillStyle = "rgba(34, 34, 48, 0.78)";
  ctx.lineWidth = Math.max(1, 0.6 * u);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${2.8 * u}px ${FONT}`;
  ctx.fillText(place, 0, -r * 0.42);
  ctx.font = `600 ${2.6 * u}px ${FONT}`;
  ctx.fillText(date, 0, 0.6 * u);

  // 郵戳旁邊的波浪線
  for (let k = 0; k < 4; k += 1) {
    const y = -r * 0.45 + k * r * 0.3;
    ctx.beginPath();
    for (let x = -r * 3.4; x <= -r * 1.05; x += u * 0.5) {
      const yy = y + Math.sin(x / (1.8 * u)) * u * 0.9;
      if (x === -r * 3.4) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 剪貼字:每個字一塊自己的底色、大小、角度,像從報紙剪下來拼的 */
function drawCollageText(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvas: Size,
  u: number,
  theme: string,
  seed: number
) {
  const chars = [...text.trim()].filter((c) => c.trim());
  if (chars.length === 0) return;
  const random = mulberry32(seed * 31 + 7);
  const styles = [
    { bg: "#141212", fg: "#faf8f2" },
    { bg: "#faf8f2", fg: "#141212" },
    { bg: theme, fg: "#faf8f2" },
  ];

  let x = 6 * u;
  let y = canvas.height - 16 * u;
  const maxX = canvas.width * 0.72;

  for (const char of chars) {
    const size = (7 + random() * 4) * u;
    if (x + size > maxX) {
      x = 6 * u;
      y -= 12 * u;
    }
    const style = styles[Math.floor(random() * styles.length)];
    const angle = ((random() - 0.5) * 22 * Math.PI) / 180;

    ctx.save();
    ctx.translate(x + size / 2, y + (random() - 0.5) * 2 * u);
    ctx.rotate(angle);
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = u;
    ctx.shadowOffsetY = u * 0.4;
    ctx.fillStyle = style.bg;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = style.fg;
    ctx.font = `900 ${size * 0.72}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, 0, size * 0.04);
    ctx.restore();

    x += size + u * (0.5 + random() * 1.5);
  }
}

const INK = "#141212";
const PAPER = "#faf8f2";

/** 彩帶:一條斜斜的長帶子,兩端剪成燕尾,後面墊一條黑色的影子帶 */
function drawRibbon(ctx: CanvasRenderingContext2D, text: string, canvas: Size, u: number, theme: string) {
  const width = canvas.width * 0.68;
  const height = 11 * u;
  const notch = height * 0.42;
  ctx.save();
  ctx.translate(canvas.width * 0.04 + width / 2, canvas.height - 15 * u);
  ctx.rotate((-7 * Math.PI) / 180);
  const band = (dx: number, dy: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + dx, -height / 2 + dy);
    ctx.lineTo(width / 2 + dx, -height / 2 + dy);
    ctx.lineTo(width / 2 - notch + dx, dy);
    ctx.lineTo(width / 2 + dx, height / 2 + dy);
    ctx.lineTo(-width / 2 + dx, height / 2 + dy);
    ctx.lineTo(-width / 2 + notch + dx, dy);
    ctx.closePath();
    ctx.fill();
  };
  band(1.2 * u, 1.4 * u, INK);
  band(0, 0, theme);
  // 上下兩條細白線,像緞帶的車邊
  ctx.strokeStyle = "rgba(250, 248, 242, 0.75)";
  ctx.lineWidth = Math.max(1, 0.35 * u);
  ctx.setLineDash([u * 0.9, u * 0.6]);
  ctx.beginPath();
  ctx.moveTo(-width / 2 + notch * 1.4, -height / 2 + 1.3 * u);
  ctx.lineTo(width / 2 - notch * 1.4, -height / 2 + 1.3 * u);
  ctx.moveTo(-width / 2 + notch * 1.4, height / 2 - 1.3 * u);
  ctx.lineTo(width / 2 - notch * 1.4, height / 2 - 1.3 * u);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PAPER;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = height * 0.62;
  ctx.font = `900 ${size}px ${FONT}`;
  const room = width - notch * 3;
  const measured = ctx.measureText(text).width;
  if (measured > room) {
    size *= room / measured;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
}

/** 圓點字:每個字一顆圓,顏色輪流換,高低稍微錯開 */
function drawCircles(ctx: CanvasRenderingContext2D, chars: string[], canvas: Size, u: number, theme: string, seed: number) {
  const random = mulberry32(seed * 17 + 3);
  const styles = [
    { bg: theme, fg: PAPER, ring: null },
    { bg: INK, fg: PAPER, ring: null },
    { bg: PAPER, fg: INK, ring: INK },
  ];
  let x = 6 * u;
  let y = canvas.height - 14 * u;
  const maxX = canvas.width * 0.72;
  chars.forEach((char, i) => {
    const r = (4.4 + random() * 1.2) * u;
    if (x + r * 2 > maxX) {
      x = 6 * u;
      y -= 12 * u;
    }
    const style = styles[i % styles.length];
    const cy = y + (random() - 0.5) * 2.5 * u;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = u;
    ctx.shadowOffsetY = u * 0.4;
    ctx.fillStyle = style.bg;
    ctx.beginPath();
    ctx.arc(x + r, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (style.ring) {
      ctx.strokeStyle = style.ring;
      ctx.lineWidth = Math.max(1, 0.4 * u);
      ctx.stroke();
    }
    ctx.fillStyle = style.fg;
    ctx.font = `900 ${r * 1.15}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, x + r, cy + r * 0.05);
    ctx.restore();
    x += r * 2 - 0.4 * u;
  });
}

/** 字串切成幾行,每行最多 per 個字(盡量平均) */
function splitLines(chars: string[], maxLines: number, per: number): string[] {
  const lines = Math.min(maxLines, Math.max(1, Math.ceil(chars.length / per)));
  const each = Math.ceil(chars.length / lines);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += each) out.push(chars.slice(i, i + each).join(""));
  return out;
}

/** 圓章:一顆大圓,外圈虛線、裡面兩條橫線夾著字 */
function drawBadge(ctx: CanvasRenderingContext2D, chars: string[], canvas: Size, u: number, theme: string) {
  const r = 17 * u;
  ctx.save();
  ctx.translate(r + 5 * u, canvas.height - r - 6 * u);
  ctx.rotate((-10 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 1.5 * u;
  ctx.shadowOffsetY = 0.6 * u;
  ctx.fillStyle = theme;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = Math.max(1, 0.5 * u);
  ctx.setLineDash([1.2 * u, 0.9 * u]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const lines = splitLines(chars, 3, 4);
  const size = Math.min(r * 0.42, (r * 1.15) / lines.length, (r * 1.35) / Math.max(...lines.map((l) => [...l].length)));
  const top = (-(lines.length - 1) * size * 1.1) / 2;
  ctx.fillStyle = PAPER;
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, 0, top + i * size * 1.1));
  // 字的上下各一條細線
  const half = r * 0.5;
  const edge = top - size * 0.85;
  ctx.lineWidth = Math.max(1, 0.4 * u);
  ctx.beginPath();
  ctx.moveTo(-half, edge);
  ctx.lineTo(half, edge);
  ctx.moveTo(-half, -edge);
  ctx.lineTo(half, -edge);
  ctx.stroke();
  ctx.restore();
}

/** 標籤條:一行一條長方標籤,黑底與主題色交錯,左邊錯開一點 */
function drawLabels(ctx: CanvasRenderingContext2D, chars: string[], canvas: Size, u: number, theme: string) {
  const lines = splitLines(chars, 3, 6);
  const size = 6.4 * u;
  const pad = 1.6 * u;
  let y = canvas.height - 8 * u - (lines.length - 1) * (size + pad * 2 + 1.2 * u);
  lines.forEach((line, i) => {
    ctx.save();
    ctx.font = `900 ${size}px ${FONT}`;
    const width = Math.min(canvas.width * 0.7, ctx.measureText(line).width + pad * 3);
    const x = 5 * u + (i % 2) * 4 * u;
    ctx.translate(x, y);
    ctx.rotate(((i % 2 ? 2 : -2) * Math.PI) / 180);
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = u;
    ctx.shadowOffsetY = u * 0.4;
    ctx.fillStyle = i % 2 ? theme : INK;
    ctx.fillRect(0, -size / 2 - pad, width, size + pad * 2);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(line, pad * 1.5, size * 0.04, width - pad * 3);
    ctx.restore();
    y += size + pad * 2 + 1.2 * u;
  });
}

function drawPosterText(
  ctx: CanvasRenderingContext2D,
  style: PosterTextStyle,
  text: string,
  canvas: Size,
  u: number,
  theme: string,
  seed: number
) {
  const chars = [...text.trim()].filter((c) => c.trim());
  if (chars.length === 0) return;
  switch (style) {
    case "ribbon":
      return drawRibbon(ctx, text.trim(), canvas, u, theme);
    case "circles":
      return drawCircles(ctx, chars, canvas, u, theme, seed);
    case "badge":
      return drawBadge(ctx, chars, canvas, u, theme);
    case "label":
      return drawLabels(ctx, chars, canvas, u, theme);
    default:
      return drawCollageText(ctx, text, canvas, u, theme, seed);
  }
}

/**
 * 主程式:把 source(size 大小)照 settings 畫到 ctx 上。
 * ctx 的畫布要先設成 printLayout(size).canvas 的大小。
 * scale = 預覽縮小的比例(輸出時是 1);只有「古早數位相機的解析度」這種絕對像素用得到。
 * develop = 拍立得顯影進度(0 全白 → 1 顯影完成),只有預覽動畫會傳。
 */
export function drawPrint(
  ctx: CanvasRenderingContext2D,
  size: Size,
  source: CanvasImageSource,
  settings: PrintSettings,
  { scale = 1, develop = 1 }: { scale?: number; develop?: number } = {}
): void {
  const layout = printLayout(size, settings.kind, settings);
  const { canvas, photo } = layout;
  const u = Math.min(size.width, size.height) / 100;
  const w = Math.round(photo.width);
  const h = Math.round(photo.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (isInterfaceKind(settings.kind)) {
    drawInterface(ctx, settings.kind, source, size, layout, settings, {
      photo: settings.framing,
      avatar: settings.avatarFraming,
    });
  } else switch (settings.kind) {
    case "halftone": {
      const px = pixelsOf(source, size, w, h);
      putPixels(ctx, px, halftone(px, settings.halftone.dot * u, hexToRgb(settings.halftone.paper)), 0, 0);
      break;
    }

    case "riso": {
      const px = pixelsOf(source, size, w, h);
      const inks = settings.riso.inks.slice(0, settings.riso.count).map(hexToRgb);
      const o = settings.riso.offset * u;
      const offsets = [
        { x: 0, y: 0 },
        { x: o, y: o * 0.6 },
        { x: -o * 0.7, y: o * 0.4 },
      ];
      const grain = Math.max(1, settings.riso.grain * u);
      putPixels(ctx, px, riso(px, inks, hexToRgb("#f7f3ea"), grain, offsets), 0, 0);
      break;
    }

    case "photocopy": {
      const px = pixelsOf(source, size, w, h);
      const { contrast, toner } = settings.photocopy;
      putPixels(ctx, px, photocopy(px, contrast, toner, settings.seed, PAPER_COPY), 0, 0);
      break;
    }

    case "polaroid": {
      ctx.fillStyle = "#f8f6f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const px = pixelsOf(source, size, w, h);
      putPixels(ctx, px, filmGrade(px, settings.polaroid), photo.x, photo.y);
      if (develop < 1) {
        // 顯影:一開始一片乳白,慢慢透出影像
        ctx.fillStyle = `rgba(236, 233, 224, ${(1 - develop).toFixed(3)})`;
        ctx.fillRect(photo.x, photo.y, w, h);
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = Math.max(1, 0.3 * u);
      ctx.strokeRect(photo.x, photo.y, w, h);
      break;
    }

    case "digicam": {
      let px: Pixels;
      if (settings.digicam.lowRes) {
        // 先縮到當年的解析度(長邊約 640)再放大回來,糊糊的
        const k = Math.min(1, (640 * scale) / Math.max(w, h));
        const [small, smallCtx] = makeCanvas(w * k, h * k);
        smallCtx.drawImage(source, 0, 0, small.width, small.height);
        const [, bigCtx] = makeCanvas(w, h);
        bigCtx.imageSmoothingEnabled = true;
        bigCtx.drawImage(small, 0, 0, w, h);
        const image = bigCtx.getImageData(0, 0, w, h);
        px = { width: w, height: h, data: image.data };
      } else {
        px = pixelsOf(source, size, w, h);
      }
      putPixels(ctx, px, flash(px, settings.digicam.flash), 0, 0);

      if (settings.digicam.showDate && settings.digicam.date.trim()) {
        ctx.save();
        ctx.font = `700 ${4.6 * u}px "Courier New", ui-monospace, monospace`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(255, 120, 20, 0.85)";
        ctx.shadowBlur = 1.2 * u;
        ctx.fillStyle = "#ff9a2e";
        ctx.fillText(settings.digicam.date, w - 4 * u, h - 3.5 * u);
        ctx.restore();
      }
      break;
    }

    case "stamp": {
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCover(ctx, source, size, photo, settings.framing);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = Math.max(1, 0.25 * u);
      ctx.strokeRect(photo.x, photo.y, w, h);

      // 面額
      if (settings.stamp.value.trim()) {
        ctx.save();
        ctx.font = `800 ${6 * u}px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
        ctx.shadowBlur = u;
        ctx.fillText(settings.stamp.value, photo.x + 3 * u, photo.y + 2.5 * u);
        ctx.restore();
      }

      // 齒孔:圓心落在邊上,挖掉半圈
      const r = 1.7 * u;
      const step = 4.6 * u;
      for (let x = step / 2; x < canvas.width; x += step) {
        punch(ctx, x, 0, r);
        punch(ctx, x, canvas.height, r);
      }
      for (let y = step / 2; y < canvas.height; y += step) {
        punch(ctx, 0, y, r);
        punch(ctx, canvas.width, y, r);
      }

      if (settings.stamp.postmark) {
        drawPostmark(ctx, canvas.width - 13 * u, 15 * u, u, settings.stamp.date, settings.stamp.place);
      }
      break;
    }

    case "postcard": {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#faf6ec";
      ctx.fillRect(0, 0, W, H);
      drawCover(ctx, source, size, photo, settings.framing);

      ctx.strokeStyle = "#8a8174";
      ctx.fillStyle = "#6d6559";
      ctx.lineWidth = Math.max(1, 0.35 * u);

      // 中間分隔線
      ctx.beginPath();
      ctx.moveTo(W * 0.53, 14 * u);
      ctx.lineTo(W * 0.53, H - 8 * u);
      ctx.stroke();

      // 抬頭
      ctx.font = `600 ${4.2 * u}px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(settings.postcard.heading, W * 0.56, 5 * u);

      // 郵票框
      const sw = 15 * u;
      const sh = 18 * u;
      ctx.save();
      ctx.setLineDash([u, u * 0.8]);
      ctx.strokeRect(W - 5 * u - sw, 5 * u, sw, sh);
      ctx.restore();
      ctx.font = `${2.2 * u}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("貼郵票處", W - 5 * u - sw / 2, 5 * u + sh / 2 - u);

      // 地址線
      for (let k = 0; k < 4; k += 1) {
        const y = H * 0.48 + k * 11 * u;
        ctx.beginPath();
        ctx.moveTo(W * 0.57, y);
        ctx.lineTo(W - 5 * u, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      break;
    }

    case "ticket": {
      const W = canvas.width;
      const H = canvas.height;
      const tear = size.width;
      ctx.fillStyle = settings.ticket.color;
      ctx.fillRect(0, 0, W, H);
      drawCover(ctx, source, size, photo, settings.framing);

      // 內框
      ctx.strokeStyle = "rgba(60, 40, 20, 0.35)";
      ctx.lineWidth = Math.max(1, 0.4 * u);
      ctx.strokeRect(tear + 3 * u, 3 * u, W - tear - 6 * u, H - 6 * u);

      // 撕線:虛線 + 上下兩個半圓缺口
      ctx.save();
      ctx.setLineDash([1.6 * u, 1.2 * u]);
      ctx.strokeStyle = "rgba(60, 40, 20, 0.55)";
      ctx.lineWidth = Math.max(1, 0.5 * u);
      ctx.beginPath();
      ctx.moveTo(tear, 4 * u);
      ctx.lineTo(tear, H - 4 * u);
      ctx.stroke();
      ctx.restore();
      punch(ctx, tear, 0, 3.2 * u);
      punch(ctx, tear, H, 3.2 * u);

      // 票根上的直書文字
      ctx.save();
      ctx.translate(tear + (W - tear) / 2, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#3b2a1a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${6 * u}px ${FONT}`;
      ctx.fillText(settings.ticket.title, 0, -4 * u);
      ctx.font = `500 ${3.6 * u}px ${FONT}`;
      ctx.fillText(settings.ticket.number, 0, 4.5 * u);
      ctx.restore();
      break;
    }

    case "film": {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#16130f";
      ctx.fillRect(0, 0, W, H);
      drawCover(ctx, source, size, photo, settings.framing);

      // 齒孔
      const band = photo.y;
      const holeW = band * 0.32;
      const holeH = band * 0.42;
      const step = band * 0.62;
      ctx.fillStyle = "#e9e4d8";
      for (let x = step * 0.4; x < W - holeW; x += step) {
        for (const y of [band * 0.18, H - band * 0.18 - holeH]) {
          ctx.beginPath();
          ctx.roundRect(x, y, holeW, holeH, holeW * 0.25);
          ctx.fill();
        }
      }

      // 片號與片邊字
      ctx.fillStyle = "#f0a830";
      ctx.font = `700 ${band * 0.2}px ${FONT}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const textY = band * 0.8;
      ctx.fillText(`▸ ${settings.film.number}`, photo.x + band * 0.2, textY);
      ctx.fillText(`${settings.film.number}A`, photo.x + photo.width * 0.55, textY);
      ctx.textAlign = "right";
      ctx.fillText(settings.film.label, photo.x + photo.width - band * 0.2, H - band * 0.8);
      break;
    }

    case "poster": {
      const W = canvas.width;
      const H = canvas.height;
      const theme = settings.poster.color;
      const themeRgb = hexToRgb(theme);
      ctx.fillStyle = "#f6f1e7";
      ctx.fillRect(0, 0, W, H);

      // 背景:放射線或斜條紋
      ctx.save();
      ctx.fillStyle = theme;
      ctx.globalAlpha = 0.9;
      if (settings.poster.background === "rays") {
        const cx = W * 0.5;
        const cy = H * 0.45;
        const reach = Math.hypot(W, H);
        const wedges = 18;
        for (let k = 0; k < wedges; k += 1) {
          const a0 = (k / wedges) * Math.PI * 2;
          const a1 = a0 + Math.PI / wedges;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach);
          ctx.lineTo(cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
          ctx.closePath();
          ctx.fill();
        }
      } else if (settings.poster.background === "stripes") {
        const gap = 6 * u;
        ctx.rotate(-Math.PI / 6);
        for (let x = -H; x < W + H; x += gap * 2) ctx.fillRect(x, -H, gap, H * 3);
      }
      ctx.restore();

      // 照片:轉成單色高反差,斜放,加白邊與陰影
      const pw = Math.round(w * 0.76);
      const ph = Math.round(h * 0.76);
      const px = pixelsOf(source, size, pw, ph);
      const toned = pixelsToCanvas(
        px,
        posterTone(
          px,
          themeRgb,
          settings.poster.levels,
          settings.poster.texture === "solid" ? 0 : settings.poster.dotSize * u,
          settings.poster.balance,
          settings.poster.texture === "lines" ? "lines" : "dots"
        )
      );
      ctx.save();
      ctx.translate(W * 0.5, H * 0.46);
      ctx.rotate((settings.poster.tilt * Math.PI) / 180);
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 2 * u;
      ctx.shadowOffsetY = u;
      const border = 1.6 * u;
      ctx.fillStyle = "#faf8f2";
      ctx.fillRect(-pw / 2 - border, -ph / 2 - border, pw + border * 2, ph + border * 2);
      ctx.shadowColor = "transparent";
      ctx.drawImage(toned, -pw / 2, -ph / 2);
      ctx.restore();

      // 大色塊斜切右下角,旁邊一條黑色細帶
      ctx.fillStyle = "#141212";
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H);
      ctx.lineTo(W, H * 0.5);
      ctx.lineTo(W, H * 0.47);
      ctx.lineTo(W * 0.47, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = theme;
      ctx.beginPath();
      ctx.moveTo(W * 0.54, H);
      ctx.lineTo(W, H * 0.54);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      drawPosterText(ctx, settings.poster.textStyle, settings.poster.text, canvas, u, theme, settings.seed);
      break;
    }
  }

  if (settings.grain.enabled) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = { width: image.width, height: image.height, data: image.data };
    addGrain(px, settings.grain.amount, Math.max(1, settings.grain.size * u), settings.seed + 99);
    ctx.putImageData(image, 0, 0);
  }
}

/** 沖印所:壓平成新圖(邊框類的圖會比原圖大) */
export async function applyPrint(image: WorkImage, settings: PrintSettings): Promise<WorkImage> {
  const { canvas: size } = printLayout(image, settings.kind, settings);
  assertCanvasSize(size.width, size.height);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image.blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`無法讀取「${image.name}」`);
  }

  try {
    const [canvas, ctx] = makeCanvas(size.width, size.height);
    drawPrint(ctx, image, bitmap, settings);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("無法產生圖片檔"))), "image/png")
    );
    const result = await createWorkImage(blob, image.name);
    return { ...result, name: image.name };
  } finally {
    bitmap.close();
  }
}
