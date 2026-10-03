// 周邊工坊的畫法。所有座標都是「設計單位」(DESIGN_SIZE),
// 輸出時呼叫端先 ctx.scale 放大,線條與拼豆都是算出來的,放大不糊。

import { shade } from "@/lib/tools/beads/color";
import { beadShades, drawBeads } from "@/lib/tools/beads/draw";
import type { BeadColor } from "@/lib/tools/beads/palette";
import type { BeadPattern } from "@/lib/tools/beads/pattern";
import { meltOf } from "@/lib/tools/beads/finish";
import {
  artKey,
  type AcrylicDesign,
  type BeadCharmDesign,
  type CardDesign,
  type CharmDesign,
  type OmamoriDesign,
  type Placed,
} from "./design";
import { applyHomography, drawPerspective, homography, isConvex, rectQuad, type Quad } from "./perspective";
import { partPosition, type Body, type Container } from "./physics";

const FONT = `system-ui, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
const SERIF = `"Noto Serif TC", "Songti TC", "PMingLiU", serif`;

/** 一份可以貼上去的圖:拼豆(有格子資料)或去背的圖片 */
export type Art = {
  id: string;
  label: string;
  source: CanvasImageSource;
  width: number;
  height: number;
  /** 拼豆圖才有;搖搖吊飾用它算碰撞形狀 */
  pattern?: BeadPattern;
};

/** 拼豆圖的點陣圖解析度:一顆豆子最多幾像素(貼紙放大也夠清楚);大幅作品縮到長邊 1600 */
const ART_CELL = 24;
const ART_MAX_SIDE = 1600;

/** 格子資料 → 透明背景的拼豆圖(中燙,材質照格子資料) */
export function rasterizeBeads(pattern: BeadPattern, palette: BeadColor[]): HTMLCanvasElement {
  const cell = Math.max(2, Math.min(ART_CELL, Math.floor(ART_MAX_SIDE / Math.max(pattern.cols, pattern.rows))));
  const canvas = document.createElement("canvas");
  canvas.width = pattern.cols * cell;
  canvas.height = pattern.rows * cell;
  const ctx = canvas.getContext("2d");
  if (ctx) drawBeads(ctx, pattern, beadShades(palette), cell, () => meltOf("medium"));
  return canvas;
}

/** 拼豆圖裡有豆子的格子的重心(格為單位);吊飾零件繞著它轉 */
export function patternCentroid(pattern: BeadPattern): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  pattern.cells.forEach((cell, i) => {
    if (cell < 0) return;
    sx += (i % pattern.cols) + 0.5;
    sy += Math.floor(i / pattern.cols) + 0.5;
    n += 1;
  });
  return n === 0 ? { x: pattern.cols / 2, y: pattern.rows / 2 } : { x: sx / n, y: sy / n };
}

/** 照片裁滿到指定區域 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.width, height / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}

/** 貼紙:中心點、寬度、旋轉 */
export function drawPlaced(
  ctx: CanvasRenderingContext2D,
  art: Art,
  placed: Placed,
  area: { x: number; y: number; width: number; height: number },
  shadow = true
) {
  const width = placed.size * area.width;
  const height = (width * art.height) / art.width;
  ctx.save();
  ctx.translate(area.x + placed.x * area.width, area.y + placed.y * area.height);
  ctx.rotate((placed.rotation * Math.PI) / 180);
  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = width * 0.03;
    ctx.shadowOffsetY = width * 0.015;
  }
  ctx.drawImage(art.source, -width / 2, -height / 2, width, height);
  ctx.restore();
}

/** 貼紙在畫面上佔的範圍(拖曳時判斷點到哪一張用,忽略旋轉) */
export function placedBounds(
  art: Art,
  placed: Placed,
  area: { x: number; y: number; width: number; height: number }
) {
  const width = placed.size * area.width;
  const height = (width * art.height) / art.width;
  return {
    x: area.x + placed.x * area.width - width / 2,
    y: area.y + placed.y * area.height - height / 2,
    width,
    height,
  };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 雷射膜:彩虹漸層跟著角度流動,用柔光疊在上面 */
function drawLaser(ctx: CanvasRenderingContext2D, w: number, h: number, angle: number) {
  const cx = w / 2;
  const cy = h / 2;
  const reach = Math.hypot(w, h) / 2;
  const dx = Math.cos(angle) * reach;
  const dy = Math.sin(angle) * reach;
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  const shift = (angle / (Math.PI * 2)) % 1;
  // 彩虹重複兩輪,色帶細一點才像雷射膜;起點跟著角度平移,顏色就會「流」
  const steps = 13;
  for (let i = 0; i < steps; i += 1) {
    const hue = ((i / (steps - 1)) * 720) % 360;
    g.addColorStop(i / (steps - 1), `hsla(${(hue + shift * 360) % 360}, 90%, 66%, 0.4)`);
  }
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.1;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 亮面:一道斜斜的反光掃過 */
function drawGloss(ctx: CanvasRenderingContext2D, w: number, h: number, offset: number) {
  const x = w * (offset * 1.6 - 0.3);
  const g = ctx.createLinearGradient(x - w * 0.18, 0, x + w * 0.18, h * 0.4);
  g.addColorStop(0, "rgba(255, 255, 255, 0)");
  g.addColorStop(0.5, "rgba(255, 255, 255, 0.32)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * 自己拼的框:一份拼豆素材沿著四邊排一圈,四個角各一個,中間平均分配。
 * 每個圖樣塞進邊框寬度的方格裡(保持比例),框比貼紙晚畫,會壓在貼紙上面。
 */
export function motifPositions(w: number, h: number, inset: number): { x: number; y: number; size: number }[] {
  const size = inset * 1.35;
  const c = inset * 0.55;
  const step = size * 1.12;
  const across = Math.max(1, Math.round((w - c * 2) / step));
  const down = Math.max(1, Math.round((h - c * 2) / step));
  const spots: { x: number; y: number; size: number }[] = [];
  for (let i = 0; i <= across; i += 1) {
    const x = c + ((w - c * 2) * i) / across;
    spots.push({ x, y: c, size }, { x, y: h - c, size });
  }
  for (let j = 1; j < down; j += 1) {
    const y = c + ((h - c * 2) * j) / down;
    spots.push({ x: c, y, size }, { x: w - c, y, size });
  }
  return spots;
}

function drawMotifFrame(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number, motif: Art) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = inset * 0.12;
  ctx.shadowOffsetY = inset * 0.05;
  for (const spot of motifPositions(w, h, inset)) {
    const scale = spot.size / Math.max(motif.width, motif.height);
    const dw = motif.width * scale;
    const dh = motif.height * scale;
    ctx.drawImage(motif.source, spot.x - dw / 2, spot.y - dh / 2, dw, dh);
  }
  ctx.restore();
}

/** 小卡套裡放照片與貼紙的範圍(框以內) */
export function cardArea(w: number, h: number) {
  const inset = w * 0.07;
  return { x: inset, y: inset, width: w - inset * 2, height: h - inset * 2 };
}

/** 透卡板子上放貼紙的範圍(握把不算) */
export function acrylicArea(design: AcrylicDesign) {
  const { width, boardHeight } = acrylicBoardSize(design);
  return { x: 0, y: 0, width, height: boardHeight };
}

export type CardAssets = { photo: (CanvasImageSource & { width: number; height: number }) | null; arts: Map<string, Art> };

/**
 * 小卡套。laserAngle 是雷射彩虹的角度(滑鼠位置或手機傾斜換算來的)。
 * 由下往上:底(照片/馬賽克/純色)→ 貼紙 → 框 → 卡套的塑膠(雷射膜、亮面、邊緣)。
 */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: CardDesign,
  assets: CardAssets,
  laserAngle: number
) {
  const r = w * 0.06;
  const area = cardArea(w, h);
  const inset = area.x;

  ctx.save();
  roundRectPath(ctx, 0, 0, w, h, r);
  ctx.clip();

  // 底
  ctx.fillStyle = design.color;
  ctx.fillRect(0, 0, w, h);
  if (design.background === "photo" && assets.photo) {
    drawCover(ctx, assets.photo, area.x, area.y, area.width, area.height);
  } else if (design.background === "mosaic") {
    // 馬賽克:方形磁磚交錯兩色,邊上留一點縫
    const tile = w / 14;
    for (let y = 0; y * tile < h; y += 1) {
      for (let x = 0; x * tile < w; x += 1) {
        ctx.fillStyle = design.mosaic[(x + y) % 2];
        ctx.beginPath();
        ctx.roundRect(x * tile + 1, y * tile + 1, tile - 2, tile - 2, tile * 0.18);
        ctx.fill();
      }
    }
  }

  for (const placed of design.stickers) {
    const art = assets.arts.get(artKey(placed));
    if (art) drawPlaced(ctx, art, placed, area);
  }

  // 框
  if (design.frame === "lace") {
    ctx.fillStyle = "#fffdf8";
    const bump = w * 0.03;
    const band = inset * 0.75;
    ctx.fillRect(0, 0, w, band);
    ctx.fillRect(0, h - band, w, band);
    ctx.fillRect(0, 0, band, h);
    ctx.fillRect(w - band, 0, band, h);
    // 蕾絲的波浪邊
    ctx.beginPath();
    for (let x = bump; x < w; x += bump * 2) {
      ctx.moveTo(x + bump, band);
      ctx.arc(x, band, bump, 0, Math.PI * 2);
      ctx.moveTo(x + bump, h - band);
      ctx.arc(x, h - band, bump, 0, Math.PI * 2);
    }
    for (let y = bump; y < h; y += bump * 2) {
      ctx.moveTo(band + bump, y);
      ctx.arc(band, y, bump, 0, Math.PI * 2);
      ctx.moveTo(w - band + bump, y);
      ctx.arc(w - band, y, bump, 0, Math.PI * 2);
    }
    ctx.fill();
    // 蕾絲上的小孔
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    for (let x = bump * 2; x < w - bump; x += bump * 2) {
      ctx.moveTo(x + bump * 0.25, band * 0.5);
      ctx.arc(x, band * 0.5, bump * 0.25, 0, Math.PI * 2);
      ctx.moveTo(x + bump * 0.25, h - band * 0.5);
      ctx.arc(x, h - band * 0.5, bump * 0.25, 0, Math.PI * 2);
    }
    ctx.fill();
  } else if (design.frame === "motif") {
    const motif = assets.arts.get(design.frameArt);
    if (motif) drawMotifFrame(ctx, w, h, inset, motif);
  } else if (design.frame === "beads") {
    // 拼豆框:沿邊一圈豆子,兩色交錯
    const cell = w / 18;
    const cols = Math.round(w / cell);
    const rows = Math.round(h / cell);
    const ring: number[] = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        ring.push(edge ? (x + y) % 2 : -1);
      }
    }
    const palette: BeadColor[] = design.frameColors.map((hex, i) => ({ code: `F${i}`, name: "", reading: "", hex }));
    ctx.save();
    ctx.scale(w / (cols * cell), h / (rows * cell));
    drawBeads(ctx, { cols, rows, cells: ring }, beadShades(palette), cell, () => meltOf("medium"));
    ctx.restore();
  }

  if (design.laser) drawLaser(ctx, w, h, laserAngle);
  if (design.gloss) drawGloss(ctx, w, h, (Math.cos(laserAngle) + 1) / 2);
  ctx.restore();

  // 卡套的塑膠邊
  ctx.save();
  roundRectPath(ctx, 1, 1, w - 2, h - 2, r);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.stroke();
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.stroke();
  ctx.restore();
}

/** 搖搖吊飾的外形與裡面的透明空間(物理的容器) */
export function charmGeometry(design: CharmDesign, w: number, h: number) {
  const border = w * 0.06;
  const top = h * 0.16;
  const outer =
    design.shape === "circle"
      ? { kind: "circle" as const, cx: w / 2, cy: top + (h - top) / 2, r: Math.min(w, h - top) / 2 - 4 }
      : { kind: "rect" as const, cx: w / 2, cy: top + (h - top) / 2, hw: w / 2 - 4, hh: (h - top) / 2 - 4, round: w * 0.12 };
  const inner: Container =
    outer.kind === "circle"
      ? { kind: "circle", cx: outer.cx, cy: outer.cy, r: outer.r - border }
      : { kind: "rect", cx: outer.cx, cy: outer.cy, hw: outer.hw - border, hh: outer.hh - border, round: Math.max(4, outer.round - border) };
  const hole = { x: w / 2, y: outer.kind === "circle" ? outer.cy - outer.r + border * 0.55 : outer.cy - outer.hh + border * 0.55 };
  return { outer, inner, hole, border };
}

function containerPath(ctx: CanvasRenderingContext2D, c: Container) {
  ctx.beginPath();
  if (c.kind === "circle") ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
  else ctx.roundRect(c.cx - c.hw, c.cy - c.hh, c.hw * 2, c.hh * 2, c.round);
}

export type CharmPiece = { id: string; body: Body; art: Art; cell: number; centroid: { x: number; y: number } };

/** 搖搖吊飾:白邊壓克力外框 + 打孔與金屬環 + 後層照片 + 會動的零件 + 前層反光 */
export function drawCharm(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: CharmDesign,
  photo: (CanvasImageSource & { width: number; height: number }) | null,
  pieces: CharmPiece[]
) {
  const { outer, inner, hole, border } = charmGeometry(design, w, h);

  // 吊繩與金屬環
  ctx.save();
  ctx.strokeStyle = "#8a8a8a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, hole.y - border * 0.9);
  ctx.stroke();
  ctx.restore();

  // 外框(壓克力白邊),陰影讓它浮起來
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  containerPath(ctx, outer);
  ctx.fillStyle = "#fbfbfb";
  ctx.fill();
  ctx.restore();

  // 後層
  ctx.save();
  containerPath(ctx, inner);
  ctx.clip();
  ctx.fillStyle = design.color;
  ctx.fillRect(0, 0, w, h);
  if (design.background === "photo" && photo) {
    const box =
      inner.kind === "circle"
        ? { x: inner.cx - inner.r, y: inner.cy - inner.r, w: inner.r * 2, h: inner.r * 2 }
        : { x: inner.cx - inner.hw, y: inner.cy - inner.hh, w: inner.hw * 2, h: inner.hh * 2 };
    drawCover(ctx, photo, box.x, box.y, box.w, box.h);
  }
  // 透明夾層讓後面的圖稍微霧一點
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(0, 0, w, h);

  // 會動的零件
  for (const piece of pieces) {
    const { body, art, cell, centroid } = piece;
    const pw = (art.pattern?.cols ?? 1) * cell;
    const ph = (art.pattern?.rows ?? 1) * cell;
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = cell * 0.6;
    ctx.shadowOffsetY = cell * 0.25;
    ctx.drawImage(art.source, -centroid.x * cell, -centroid.y * cell, pw, ph);
    ctx.restore();
  }

  // 前層壓克力的反光:斜斜一片 + 內緣亮線
  const g = ctx.createLinearGradient(0, outer.kind === "circle" ? outer.cy - outer.r : outer.cy - outer.hh, w, h);
  g.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  g.addColorStop(0.35, "rgba(255, 255, 255, 0.04)");
  g.addColorStop(0.6, "rgba(255, 255, 255, 0)");
  g.addColorStop(0.75, "rgba(255, 255, 255, 0.12)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  containerPath(ctx, inner);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke();
  containerPath(ctx, outer);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.stroke();
  ctx.restore();

  // 打孔 + 金屬環
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, border * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = design.ring;
  ctx.lineWidth = border * 0.16;
  ctx.beginPath();
  ctx.ellipse(hole.x, hole.y - border * 0.45, border * 0.36, border * 0.62, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 零件的世界座標外接範圍(拖曳判斷點到哪個零件用) */
export function pieceHit(piece: CharmPiece, p: { x: number; y: number }): boolean {
  return piece.body.parts.some((part) => {
    const q = partPosition(piece.body, part);
    return Math.hypot(q.x - p.x, q.y - p.y) <= part.r * 1.2;
  });
}

/** 御守的袋子:下方圓角,上方兩肩斜收成屋頂 */
function omamoriBag(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const left = w * 0.12;
  const right = w * 0.88;
  const top = h * 0.2;
  const shoulder = h * 0.27;
  const bottom = h * 0.95;
  const r = w * 0.06;
  ctx.beginPath();
  ctx.moveTo(w / 2, top);
  ctx.lineTo(right, shoulder);
  ctx.lineTo(right, bottom - r);
  ctx.quadraticCurveTo(right, bottom, right - r, bottom);
  ctx.lineTo(left + r, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - r);
  ctx.lineTo(left, shoulder);
  ctx.closePath();
  return { left, right, top, shoulder, bottom };
}

/** 布料花紋:麻葉、青海波、點點 */
function drawFabricPattern(ctx: CanvasRenderingContext2D, w: number, h: number, pattern: OmamoriDesign["pattern"], color: string) {
  if (pattern === "plain") return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1.2;
  const s = w * 0.09;
  if (pattern === "asanoha") {
    // 麻葉:每個六角形裡六條往中心的線
    for (let y = 0; y < h + s; y += s * 1.5) {
      for (let x = 0; x < w + s; x += s * Math.sqrt(3)) {
        const cx = x + ((Math.round(y / (s * 1.5)) % 2) * s * Math.sqrt(3)) / 2;
        for (let k = 0; k < 6; k += 1) {
          const a = (k * Math.PI) / 3 + Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(cx + Math.cos(a) * s, y + Math.sin(a) * s);
          ctx.stroke();
        }
      }
    }
  } else if (pattern === "seigaiha") {
    // 青海波:一排排同心半圓
    for (let y = 0; y < h + s; y += s * 0.5) {
      const offset = (Math.round(y / (s * 0.5)) % 2) * s;
      for (let x = -s; x < w + s; x += s * 2) {
        for (let ring = 1; ring <= 3; ring += 1) {
          ctx.beginPath();
          ctx.arc(x + offset, y, (s * ring) / 3, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  } else {
    for (let y = s / 2; y < h; y += s) {
      for (let x = s / 2 + ((Math.round(y / s) % 2) * s) / 2; x < w; x += s) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** 繡字:直書,一個字一個字往下排,深色描邊加淡淡的針腳 */
function drawEmbroidery(ctx: CanvasRenderingContext2D, text: string, x: number, y0: number, y1: number, size: number, thread: string) {
  const chars = [...text.trim()];
  if (chars.length === 0) return;
  const step = Math.min(size * 1.12, (y1 - y0) / chars.length);
  const fontSize = Math.min(size, step * 0.92);
  ctx.save();
  ctx.font = `700 ${fontSize}px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const top = y0 + ((y1 - y0) - step * chars.length) / 2 + step / 2;
  // 每個字先畫在小畫布上,針腳的斜線才只落在字上
  const box = Math.ceil(fontSize * 1.3);
  const scale = Math.max(1, Math.abs(ctx.getTransform().a));
  const glyph = document.createElement("canvas");
  glyph.width = Math.ceil(box * scale);
  glyph.height = Math.ceil(box * scale);
  const g = glyph.getContext("2d");
  chars.forEach((char, i) => {
    const y = top + i * step;
    ctx.lineWidth = fontSize * 0.08;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.strokeText(char, x, y + 1.5);
    if (!g) {
      ctx.fillStyle = thread;
      ctx.fillText(char, x, y);
      return;
    }
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, box, box);
    g.globalCompositeOperation = "source-over";
    g.font = ctx.font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = thread;
    g.fillText(char, box / 2, box / 2);
    // 針腳:一條條細細的斜線,讓字有刺繡的紋理
    g.globalCompositeOperation = "source-atop";
    g.strokeStyle = "rgba(0, 0, 0, 0.2)";
    g.lineWidth = 0.8;
    for (let k = -box; k < box * 2; k += 3) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + box * 0.35, box);
      g.stroke();
    }
    ctx.drawImage(glyph, x - box / 2, y - box / 2, box, box);
  });
  ctx.restore();
}

/**
 * 御守。side 是正面或背面;sway 是繩結晃動的角度(弧度)。
 * 背面只有「御守」兩個大字與一行小字。
 */
export function drawOmamori(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: OmamoriDesign,
  side: "front" | "back",
  sway: number,
  bell: Art | null
) {
  // 繩結:從袋口往上繞一圈再打結,繞著袋口晃
  ctx.save();
  ctx.translate(w / 2, h * 0.21);
  ctx.rotate(sway);
  ctx.strokeStyle = design.knot;
  ctx.lineWidth = w * 0.022;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.03, 0);
  ctx.bezierCurveTo(-w * 0.12, -h * 0.12, w * 0.12, -h * 0.12, w * 0.03, 0);
  ctx.stroke();
  // 結
  ctx.fillStyle = design.knot;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.005, w * 0.06, w * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 拼豆小鈴鐺掛在結的右邊
  if (bell) {
    const size = w * 0.2;
    const bh = (size * bell.height) / bell.width;
    ctx.strokeStyle = design.knot;
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.moveTo(w * 0.04, 0);
    ctx.quadraticCurveTo(w * 0.16, h * 0.02, w * 0.22, h * 0.05);
    ctx.stroke();
    ctx.save();
    ctx.translate(w * 0.22, h * 0.05);
    ctx.rotate(sway * 1.8);
    ctx.drawImage(bell.source, -size / 2, 0, size, bh);
    ctx.restore();
  }
  ctx.restore();

  // 袋子
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const bag = omamoriBag(ctx, w, h);
  ctx.fillStyle = design.fabric;
  ctx.fill();
  ctx.restore();

  ctx.save();
  omamoriBag(ctx, w, h);
  ctx.clip();
  drawFabricPattern(ctx, w, h, design.pattern, design.trim);
  // 布料的光影:中間亮、兩邊暗
  const shade = ctx.createLinearGradient(bag.left, 0, bag.right, 0);
  shade.addColorStop(0, "rgba(0, 0, 0, 0.18)");
  shade.addColorStop(0.45, "rgba(255, 255, 255, 0.08)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 滾邊
  ctx.save();
  const inset = w * 0.035;
  ctx.translate(w / 2, (bag.top + bag.bottom) / 2);
  ctx.scale(1 - (inset * 2) / w, 1 - (inset * 2) / (bag.bottom - bag.top));
  ctx.translate(-w / 2, -(bag.top + bag.bottom) / 2);
  omamoriBag(ctx, w, h);
  ctx.restore();
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = design.trim;
  ctx.stroke();
  ctx.restore();

  // 中間的繡字底(稍微淺一點的一條)
  const panelW = w * 0.26;
  const panelTop = bag.shoulder + h * 0.05;
  const panelBottom = bag.bottom - h * 0.06;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(w / 2 - panelW / 2, panelTop, panelW, panelBottom - panelTop);
  ctx.strokeStyle = design.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w / 2 - panelW / 2, panelTop, panelW, panelBottom - panelTop);
  ctx.restore();

  if (side === "front") {
    drawEmbroidery(ctx, design.front, w / 2, panelTop + 10, panelBottom - 10, w * 0.17, design.thread);
  } else {
    drawEmbroidery(ctx, "御守", w / 2, panelTop + 10, panelTop + (panelBottom - panelTop) * 0.55, w * 0.2, design.thread);
    ctx.save();
    ctx.font = `500 ${w * 0.05}px ${FONT}`;
    ctx.fillStyle = design.thread;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = [...design.back.trim()].slice(0, 10);
    const y0 = panelTop + (panelBottom - panelTop) * 0.62;
    chars.forEach((char, i) => ctx.fillText(char, w / 2, y0 + i * w * 0.055));
    ctx.restore();
  }
}

/** 透卡的板子(攤平):透明壓克力 + 貼紙 + 邊;打卡棒在下面多一根握把 */
export function acrylicBoardSize(design: AcrylicDesign) {
  const width = 600;
  const boardHeight = design.shape === "circle" ? 600 : 420;
  const stick = design.mode === "stick" ? 260 : 0;
  return { width, height: boardHeight + stick, boardHeight };
}

export function drawAcrylicBoard(ctx: CanvasRenderingContext2D, design: AcrylicDesign, arts: Map<string, Art>) {
  const { width, boardHeight, height } = acrylicBoardSize(design);
  const path = () => {
    ctx.beginPath();
    if (design.shape === "circle") ctx.arc(width / 2, boardHeight / 2, width / 2 - 6, 0, Math.PI * 2);
    else ctx.roundRect(6, 6, width - 12, boardHeight - 12, 36);
  };

  // 握把(打卡棒):在板子後面
  if (design.mode === "stick") {
    ctx.save();
    const sw = 46;
    const g = ctx.createLinearGradient(width / 2 - sw / 2, 0, width / 2 + sw / 2, 0);
    g.addColorStop(0, "rgba(230, 236, 245, 0.55)");
    g.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
    g.addColorStop(1, "rgba(210, 218, 230, 0.55)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(width / 2 - sw / 2, boardHeight - 40, sw, height - boardHeight + 34, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 壓克力本體:幾乎透明,只帶一點點白
  ctx.save();
  path();
  ctx.fillStyle = design.edge ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0)";
  ctx.fill();
  ctx.restore();

  const area = acrylicArea(design);
  ctx.save();
  path();
  ctx.clip();
  for (const placed of design.stickers) {
    const art = arts.get(artKey(placed));
    if (art) drawPlaced(ctx, art, placed, area);
  }
  ctx.restore();

  if (design.edge) {
    // 壓克力的厚度:亮色描邊 + 內側一條細亮線 + 淡淡的斜反光
    ctx.save();
    path();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.stroke();
    path();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, width, boardHeight);
    g.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    g.addColorStop(0.3, "rgba(255, 255, 255, 0)");
    g.addColorStop(0.62, "rgba(255, 255, 255, 0)");
    g.addColorStop(0.7, "rgba(255, 255, 255, 0.16)");
    g.addColorStop(0.78, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, boardHeight);
    ctx.restore();
  }
}

/**
 * 四個角只管板子;打卡棒的握把在板子下面,用同一個透視延伸出去。
 * 延伸到地平線另一邊(透視拉太斜)時回傳 null,只好把整張塞進四個角。
 */
export function acrylicImageQuad(design: AcrylicDesign, board: Quad): Quad | null {
  const { width, height, boardHeight } = acrylicBoardSize(design);
  if (height === boardHeight) return board;
  const h = homography(rectQuad(0, 0, width, boardHeight), board);
  const corners = rectQuad(0, 0, width, height);
  if (corners.some((p) => h[6] * p.x + h[7] * p.y + h[8] <= 0.05)) return null;
  const quad = corners.map((p) => applyHomography(h, p)) as Quad;
  return isConvex(quad) ? quad : null;
}

/**
 * 透卡整張:照片當背景,板子透視貼在四個角上。
 * 沒有照片時用一張淡淡的漸層當背景,也能直接做。
 */
export function drawAcrylicScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: AcrylicDesign,
  photo: (CanvasImageSource & { width: number; height: number }) | null,
  board: HTMLCanvasElement
) {
  if (photo) drawCover(ctx, photo, 0, 0, w, h);
  else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#f3e6c8");
    g.addColorStop(1, "#bbc8e6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const quad = design.corners.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;
  drawPerspective(ctx, board, board.width, board.height, acrylicImageQuad(design, quad) ?? quad);
}

// ---- 拼豆吊飾:作品本身打孔掛鍊 ----

/**
 * 掛點:最上面一列有豆子的格子裡,離中線最近的那一顆(格為單位的中心)。
 * 真的拼豆吊飾就是讓小圈穿過最上面那顆豆子的洞,掛起來才正。
 */
export function hangBead(pattern: BeadPattern): { x: number; y: number } | null {
  const center = (pattern.cols - 1) / 2;
  for (let row = 0; row < pattern.rows; row += 1) {
    let best = -1;
    for (let col = 0; col < pattern.cols; col += 1) {
      if (pattern.cells[row * pattern.cols + col] < 0) continue;
      if (best < 0 || Math.abs(col - center) < Math.abs(best - center)) best = col;
    }
    if (best >= 0) return { x: best + 0.5, y: row + 0.5 };
  }
  return null;
}

/**
 * 吊飾的版面:作品要畫多大。作品是從掛點那顆豆子吊著的,掛點不一定在正中間,
 * 所以照「掛點往左、往右哪一邊比較寬」來算,兩邊都留擺動的空間,才不會擺出畫面。
 */
export function beadCharmLayout(w: number, h: number, art: Art, hang: { x: number; y: number }) {
  const cols = art.pattern?.cols ?? 1;
  const rows = art.pattern?.rows ?? 1;
  const reach = Math.max(hang.x, cols - hang.x);
  const cell = Math.min((w * 0.36) / reach, (h * 0.6) / rows);
  return { scale: cell / (art.width / cols), cell, drop: h * 0.07 };
}

function metalStroke(ctx: CanvasRenderingContext2D, color: string, width: number) {
  ctx.lineWidth = width;
  ctx.strokeStyle = shade(color, -0.25);
  ctx.stroke();
  ctx.lineWidth = width * 0.45;
  ctx.strokeStyle = shade(color, 0.35);
  ctx.stroke();
}

/**
 * 拼豆吊飾。swing 是繞吊點擺動的角度(弧度)。
 * 上面是鑰匙圈加短鍊(或手機吊繩),小圈穿過作品最上面那顆豆子的洞。
 */
export function drawBeadCharm(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: BeadCharmDesign,
  art: Art | null,
  swing: number
) {
  const pivot = { x: w / 2, y: h * 0.2 };

  // 吊繩或鑰匙圈(不跟著擺)
  ctx.save();
  if (design.hardware === "ring") {
    const r = w * 0.085;
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y - r * 1.05, r, 0, Math.PI * 2);
    metalStroke(ctx, design.metal, w * 0.016);
  } else {
    // 手機吊繩:一條細繩繞成長圈,往上延伸出畫面
    ctx.lineCap = "round";
    ctx.strokeStyle = design.strap;
    ctx.lineWidth = w * 0.013;
    ctx.beginPath();
    ctx.moveTo(pivot.x - w * 0.02, pivot.y);
    ctx.bezierCurveTo(pivot.x - w * 0.09, pivot.y - h * 0.08, pivot.x - w * 0.05, 0, pivot.x - w * 0.03, -4);
    ctx.moveTo(pivot.x + w * 0.02, pivot.y);
    ctx.bezierCurveTo(pivot.x + w * 0.09, pivot.y - h * 0.08, pivot.x + w * 0.05, 0, pivot.x + w * 0.03, -4);
    ctx.stroke();
    ctx.fillStyle = shade(design.strap, -0.2);
    ctx.beginPath();
    ctx.roundRect(pivot.x - w * 0.03, pivot.y - h * 0.012, w * 0.06, h * 0.028, w * 0.01);
    ctx.fill();
  }
  ctx.restore();

  if (!art || !art.pattern) return;
  const hang = hangBead(art.pattern);
  if (!hang) return;
  const { scale, cell, drop } = beadCharmLayout(w, h, art, hang);

  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(swing);

  // 短鍊:幾個橢圓環一上一下
  const links = design.hardware === "ring" ? 3 : 1;
  const linkH = drop / Math.max(1, links);
  for (let k = 0; k < links; k += 1) {
    ctx.beginPath();
    if (k % 2 === 0) ctx.ellipse(0, linkH * (k + 0.5), w * 0.012, linkH * 0.62, 0, 0, Math.PI * 2);
    else ctx.ellipse(0, linkH * (k + 0.5), w * 0.004, linkH * 0.62, 0, 0, Math.PI * 2);
    metalStroke(ctx, design.metal, w * 0.008);
  }

  // 作品:讓掛點那顆豆子的中心剛好在鍊子下面
  const bead = { x: hang.x * cell, y: hang.y * cell };
  const top = drop + cell * 0.55;
  ctx.save();
  ctx.translate(-bead.x, top - bead.y);
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = cell * 0.9;
  ctx.shadowOffsetY = cell * 0.35;
  ctx.drawImage(art.source, 0, 0, art.width * scale, art.height * scale);
  ctx.restore();

  // 小圈:從鍊子末端繞過那顆豆子的洞(前半圈畫在豆子上面)
  ctx.beginPath();
  ctx.ellipse(0, (drop + top) / 2, cell * 0.2, (top - drop) / 2 + cell * 0.12, 0, 0, Math.PI * 2);
  metalStroke(ctx, design.metal, Math.max(2, cell * 0.1));
  ctx.restore();
}
