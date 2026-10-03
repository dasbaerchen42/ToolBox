// 虛擬壓克力的畫法:透卡、打卡棒、壓克力御守共用同一套材質。
//
// 每一片都是「外形」(一張 alpha 遮罩)+「印刷」(圖案,背後有一層白墨所以不透光),
// 材質照外形算出來:
//   1. 厚度:把外形往右下疊幾層淡淡的藍灰,看起來是有側面的一片板子
//   2. 本體:外形裡一層很淡的白,加左上往右下的柔光
//   3. 印刷:圖案本身
//   4. 反光:斜斜兩道亮帶
//   5. 邊線:沿著內緣一圈亮線,可以調到完全沒有(像後製擦掉)或發光
// 「壓克力質感」控制 1、2、4 的強度,「邊線清晰度」控制 5。
//
// 放到照片上時,透明的地方會看到後面的照片,而且稍微放大、偏移一點(折射)。

import type { Art } from "./render";
import { drawCover, drawOmamoriBag, drawOmamoriCord, drawPlaced } from "./render";
import { artKey, type AcrylicDesign, type OmamoriDesign, type Placed } from "./design";
import { alphaBounds, contourAlpha, edgeBand, lowestNear, placementQuad, type Placement } from "./acrylic-shape";
import { warpPixels, type Quad } from "./perspective";

const SERIF = `"Noto Serif TC", "Songti TC", "PMingLiU", serif`;
const HAND = `"Klee One", "Zen Kurenaido", "Yuji Syuku", "Kaiti TC", cursive`;

/** 透卡:54×86mm;打卡棒:放圖案的範圍;四周留白給厚度與發光 */
export const CARD_SIZE = { width: 540, height: 860, radius: 30 };
export const STICK_AREA = { width: 600, height: 720 };
const ROD = { width: 40, length: 520 };
const KNOB = { width: 96, height: 62 };
const PAD = 36;
/** 透卡的鑰匙圈掛在右邊,多留一塊 */
const KEYRING_ROOM = 210;

export type AcrylicLook = { clarity: number; edge: number };

/**
 * 一片做好的壓克力。full 是攤平編輯用的(不裁切,拖貼紙時畫面不會跳),
 * canvas、mask 是裁到剛好的成品(下載、放到照片上用)。area 是放貼紙的範圍(full 的座標)。
 */
export type AcrylicPiece = {
  full: HTMLCanvasElement;
  canvas: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  area: { x: number; y: number; width: number; height: number };
  crop: { x: number; y: number; width: number; height: number };
  scale: number;
};

/**
 * readable:之後要讀像素的(算外形用的小圖)才開 willReadFrequently——
 * 開了之後那張畫布整個改用 CPU 畫,材質那幾層全都這樣畫會慢很多。
 */
function makeCanvas(width: number, height: number, readable = false) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", readable ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error("無法建立繪圖環境");
  return { canvas, ctx };
}

function alphaOf(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
  return alpha;
}

/** alpha 陣列 → 一張填了某個顏色的圖(alpha 照抄) */
function alphaToCanvas(alpha: Uint8ClampedArray, width: number, height: number, rgb: [number, number, number] = [255, 255, 255]) {
  const { canvas, ctx } = makeCanvas(width, height);
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i += 1) {
    image.data[i * 4] = rgb[0];
    image.data[i * 4 + 1] = rgb[1];
    image.data[i * 4 + 2] = rgb[2];
    image.data[i * 4 + 3] = alpha[i];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** 外形塗上一個顏色(半透明也行) */
function tint(shape: HTMLCanvasElement, color: string) {
  const { canvas, ctx } = makeCanvas(shape.width, shape.height);
  ctx.drawImage(shape, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, shape.width, shape.height);
  return canvas;
}

/** 用外形把一張圖裁掉(只留外形裡面) */
function clipTo(image: HTMLCanvasElement, shape: HTMLCanvasElement) {
  const ctx = image.getContext("2d")!;
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(shape, 0, 0);
  ctx.restore();
}

/** 外形 + 印刷 → 有厚度、反光、邊線的一片壓克力(和外形一樣大) */
export function renderMaterial(shape: HTMLCanvasElement, band: HTMLCanvasElement | null, print: HTMLCanvasElement | null, look: AcrylicLook, scale: number) {
  const { width, height } = shape;
  const { canvas, ctx } = makeCanvas(width, height);
  const clarity = Math.min(1, Math.max(0, look.clarity));
  const edge = Math.min(1, Math.max(0, look.edge));

  // 1. 厚度:外形往右下錯開疊成側面,再把正面的範圍挖掉——
  //    只留邊上露出來的那一條,透明的地方才不會被疊成灰灰的一片
  const thick = Math.max(2, Math.round(6 * scale));
  const wall = makeCanvas(width, height);
  wall.ctx.drawImage(tint(shape, `rgba(150, 170, 190, ${0.25 + 0.45 * clarity})`), 0, 0);
  // 錯開兩層就夠連成一條側面(每多一層就多畫一整張,很貴)
  wall.ctx.drawImage(shape, thick * 0.18, thick * 0.5);
  wall.ctx.drawImage(shape, thick * 0.35, thick);
  wall.ctx.globalCompositeOperation = "source-in";
  const wallColor = wall.ctx.createLinearGradient(0, 0, 0, height);
  wallColor.addColorStop(0, `rgba(185, 200, 215, ${0.25 + 0.4 * clarity})`);
  wallColor.addColorStop(1, `rgba(120, 138, 156, ${0.3 + 0.4 * clarity})`);
  wall.ctx.fillStyle = wallColor;
  wall.ctx.fillRect(0, 0, width, height);
  wall.ctx.globalCompositeOperation = "destination-out";
  wall.ctx.drawImage(shape, 0, 0);
  ctx.drawImage(wall.canvas, 0, 0);

  // 2. 本體:一層很淡的白,左上比較亮
  ctx.drawImage(tint(shape, `rgba(255, 255, 255, ${0.03 + 0.14 * clarity})`), 0, 0);
  const glow = makeCanvas(width, height);
  const g = glow.ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, `rgba(255, 255, 255, ${0.16 * clarity})`);
  g.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  glow.ctx.fillStyle = g;
  glow.ctx.fillRect(0, 0, width, height);
  clipTo(glow.canvas, shape);
  ctx.drawImage(glow.canvas, 0, 0);

  // 3. 印刷
  if (print) ctx.drawImage(print, 0, 0);

  // 4. 反光:兩道斜斜的亮帶
  const shine = makeCanvas(width, height);
  const s = shine.ctx.createLinearGradient(0, 0, width * 0.9, height);
  s.addColorStop(0.18, "rgba(255, 255, 255, 0)");
  s.addColorStop(0.24, `rgba(255, 255, 255, ${0.34 * clarity})`);
  s.addColorStop(0.3, "rgba(255, 255, 255, 0)");
  s.addColorStop(0.36, `rgba(255, 255, 255, ${0.14 * clarity})`);
  s.addColorStop(0.4, "rgba(255, 255, 255, 0)");
  s.addColorStop(0.7, "rgba(255, 255, 255, 0)");
  s.addColorStop(0.76, `rgba(255, 255, 255, ${0.12 * clarity})`);
  s.addColorStop(0.8, "rgba(255, 255, 255, 0)");
  shine.ctx.fillStyle = s;
  shine.ctx.fillRect(0, 0, width, height);
  clipTo(shine.canvas, shape);
  ctx.drawImage(shine.canvas, 0, 0);

  // 5. 邊線:內緣一圈亮線;調高時多一圈光暈
  if (edge > 0.01 && band) {
    ctx.save();
    // 調高時多一圈光暈:亮線往四周錯開幾次、淡淡地疊(比模糊濾鏡便宜很多)
    if (edge > 0.5) {
      const r = 2.5 * scale * (edge - 0.5) * 2;
      ctx.globalAlpha = 0.18 * (edge - 0.5) * 2;
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) ctx.drawImage(band, dx, dy);
    }
    ctx.globalAlpha = 0.25 + 0.75 * edge;
    ctx.drawImage(band, 0, 0);
    ctx.restore();
  }
  return canvas;
}

/**
 * 外形與邊線要算距離轉換,整張全解析度算很慢(拖貼紙時每一步都要重算)。
 * 預覽時在一半解析度算,再平滑放大回來;輸出時(scale 大)用全解析度。
 */
function quality(scale: number): number {
  return scale < 1.2 ? 2 : 1;
}

/** 一張圖縮成 1/q 大小(alpha 會被平均) */
function shrink(source: HTMLCanvasElement, q: number) {
  if (q === 1) return { canvas: source, width: source.width, height: source.height };
  const width = Math.ceil(source.width / q);
  const height = Math.ceil(source.height / q);
  const { canvas, ctx } = makeCanvas(width, height, true);
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, width, height };
}

/** 小圖放大回 w×h(平滑) */
function grow(small: HTMLCanvasElement, w: number, h: number) {
  if (small.width === w && small.height === h) return small;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, w, h);
  return canvas;
}

/** 沿著印刷圖案外緣多留 margin 像素的外形 */
function contourShape(print: HTMLCanvasElement, margin: number, q: number): HTMLCanvasElement {
  const small = shrink(print, q);
  const alpha = contourAlpha(alphaOf(small.canvas), small.width, small.height, margin / q);
  return grow(alphaToCanvas(alpha, small.width, small.height), print.width, print.height);
}

/** 外形內緣的亮線(width 像素寬) */
function edgeCanvas(shape: HTMLCanvasElement, width: number, q: number): HTMLCanvasElement {
  const small = shrink(shape, q);
  const band = edgeBand(alphaOf(small.canvas), small.width, small.height, Math.max(1, width / q));
  return grow(alphaToCanvas(band, small.width, small.height), shape.width, shape.height);
}

const bandWidth = (look: AcrylicLook, scale: number) => (1.5 + 2.5 * Math.min(1, Math.max(0, look.edge))) * scale;

function crop(source: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }) {
  const { canvas, ctx } = makeCanvas(box.width, box.height);
  ctx.drawImage(source, -box.x, -box.y);
  return canvas;
}

/** 外形的範圍往外多留一點(厚度、發光);在縮小的圖上找,再換回原尺寸 */
function paddedBounds(shape: HTMLCanvasElement, pad: number, q: number) {
  const { width, height } = shape;
  const small = shrink(shape, q);
  const found = alphaBounds(alphaOf(small.canvas), small.width, small.height);
  const box = found ? { x: found.x * q, y: found.y * q, width: found.width * q, height: found.height * q } : { x: 0, y: 0, width, height };
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  return { x, y, width: Math.min(width, box.x + box.width + pad) - x, height: Math.min(height, box.y + box.height + pad) - y };
}

function drawStickers(ctx: CanvasRenderingContext2D, stickers: Placed[], arts: Map<string, Art>, area: AcrylicPiece["area"]) {
  for (const placed of stickers) {
    const art = arts.get(artKey(placed));
    if (art) drawPlaced(ctx, art, placed, area, false);
  }
}

/** 一道金屬環 */
function metalRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, width: number, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = "#8f9299";
  ctx.stroke();
  ctx.lineWidth = width * 0.45;
  ctx.strokeStyle = "#eef0f3";
  ctx.stroke();
}

/** 透卡的印刷框(畫在印刷層,壓克力材質會疊在上面) */
function drawCardFrame(ctx: CanvasRenderingContext2D, design: AcrylicDesign, x: number, y: number, w: number, h: number, s: number) {
  if (design.frame === "none") return;
  ctx.save();
  if (design.frame === "line") {
    const inset = 22 * s;
    ctx.strokeStyle = design.frameColor;
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    // 四個角各一個小十字,像裁切線
    ctx.lineWidth = 2 * s;
    for (const [cx, cy] of [
      [x + inset, y + inset],
      [x + w - inset, y + inset],
      [x + w - inset, y + h - inset],
      [x + inset, y + h - inset],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s, cy);
      ctx.lineTo(cx + 10 * s, cy);
      ctx.moveTo(cx, cy - 10 * s);
      ctx.lineTo(cx, cy + 10 * s);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // 相框:四邊一樣;拍立得:下面寬很多。中間的窗是透明的,看得到後面的景
  const side = w * 0.075;
  const bottom = design.frame === "polaroid" ? w * 0.3 : w * 0.13;
  ctx.fillStyle = design.frameColor;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.rect(x + side, y + side, w - side * 2, h - side - bottom);
  ctx.fill("evenodd");
  // 窗的內緣一條細線,印刷感
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(x + side, y + side, w - side * 2, h - side - bottom);
  const caption = design.caption.trim();
  if (caption) {
    const size = Math.min(bottom * 0.42, (w - side * 2) / Math.max(4, [...caption].length) * 1.3);
    ctx.fillStyle = "rgba(60, 52, 45, 0.85)";
    ctx.font = `500 ${size}px ${design.frame === "polaroid" ? HAND : SERIF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption, x + w / 2, y + h - bottom / 2, w - side * 2);
  }
  ctx.restore();
}

/** 透卡:卡片形的壓克力,可加印刷框、打孔掛鑰匙圈 */
function buildCard(design: AcrylicDesign, arts: Map<string, Art>, s: number): AcrylicPiece {
  const cw = CARD_SIZE.width * s;
  const ch = CARD_SIZE.height * s;
  const pad = PAD * s;
  const right = design.keyring ? KEYRING_ROOM * s : 0;
  const width = Math.round(cw + pad * 2 + right);
  const height = Math.round(ch + pad * 2);
  const x = pad;
  const y = pad;
  const hole = { x: x + cw - 30 * s, y: y + 30 * s, r: 11 * s };

  const shape = makeCanvas(width, height);
  shape.ctx.fillStyle = "#fff";
  shape.ctx.beginPath();
  shape.ctx.roundRect(x, y, cw, ch, CARD_SIZE.radius * s);
  shape.ctx.fill();
  if (design.keyring) {
    shape.ctx.globalCompositeOperation = "destination-out";
    shape.ctx.beginPath();
    shape.ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    shape.ctx.fill();
  }
  const area = { x, y, width: cw, height: ch };
  const print = makeCanvas(width, height);
  drawCardFrame(print.ctx, design, x, y, cw, ch, s);
  drawStickers(print.ctx, design.stickers, arts, area);
  clipTo(print.canvas, shape.canvas);

  const band = edgeCanvas(shape.canvas, bandWidth(design, s), quality(s));
  const full = renderMaterial(shape.canvas, band, print.canvas, design, s);
  if (design.keyring) {
    // 小圈穿過孔 → 三節短鍊 → 大鑰匙圈,往右下垂
    const ctx = full.getContext("2d")!;
    metalRing(ctx, hole.x + 4 * s, hole.y, 15 * s, 9 * s, 4 * s, 0.9);
    let px = hole.x + 16 * s;
    let py = hole.y + 14 * s;
    for (let k = 0; k < 3; k += 1) {
      metalRing(ctx, px, py, 11 * s, k % 2 ? 4 * s : 7 * s, 3.5 * s, 0.9);
      px += 12 * s;
      py += 15 * s;
    }
    metalRing(ctx, px + 46 * s, py + 50 * s, 56 * s, 56 * s, 7 * s);
  }
  const box = { x: 0, y: 0, width, height };
  return { full, canvas: full, mask: shape.canvas, area, crop: box, scale: s };
}

/** 打卡棒:沿著圖案外緣多留一圈邊切下來,下面接卡榫與透明棒子 */
function buildStick(design: AcrylicDesign, arts: Map<string, Art>, s: number): AcrylicPiece {
  const pad = PAD * s;
  const aw = STICK_AREA.width * s;
  const ah = STICK_AREA.height * s;
  const margin = design.margin * s;
  const width = Math.round(aw + pad * 2 + margin * 2);
  const height = Math.round(ah + pad * 2 + margin * 2 + (KNOB.height + ROD.length) * s);
  const area = { x: pad + margin, y: pad + margin, width: aw, height: ah };

  const print = makeCanvas(width, height);
  drawStickers(print.ctx, design.stickers, arts, area);
  const q = quality(s);
  const cx = area.x + aw / 2;
  let shape = contourShape(print.canvas, margin, q);
  let small = shrink(shape, q);
  let smallAlpha = alphaOf(small.canvas);
  // 沒有圖案時先給一塊圓角板子,不然什麼都看不到
  if (!alphaBounds(smallAlpha, small.width, small.height)) {
    const tmp = makeCanvas(width, height);
    tmp.ctx.fillStyle = "#fff";
    tmp.ctx.beginPath();
    tmp.ctx.roundRect(cx - aw * 0.3, area.y + ah * 0.2, aw * 0.6, ah * 0.6, 40 * s);
    tmp.ctx.fill();
    shape = tmp.canvas;
    small = shrink(shape, q);
    smallAlpha = alphaOf(small.canvas);
  }

  // 卡榫接在外形最下面、靠中間的地方;棒子從卡榫往下
  const lowest = lowestNear(smallAlpha, small.width, small.height, cx / q, (KNOB.width * 0.4 * s) / q);
  const bottom = lowest === null ? area.y + ah : (lowest + 1) * q;
  const knob = { x: cx - (KNOB.width * s) / 2, y: bottom - KNOB.height * 0.45 * s, w: KNOB.width * s, h: KNOB.height * s };
  const rod = { x: cx - (ROD.width * s) / 2, y: knob.y + knob.h * 0.5, w: ROD.width * s, h: ROD.length * s };

  // 板子底下的小舌頭插進卡榫,和棒子一起算進外形(都是同一種壓克力)
  const sctx = shape.getContext("2d")!;
  sctx.fillStyle = "#fff";
  sctx.beginPath();
  sctx.roundRect(cx - (KNOB.width * 0.3 * s), bottom - 10 * s, KNOB.width * 0.6 * s, knob.y + knob.h * 0.6 - (bottom - 10 * s), 6 * s);
  sctx.roundRect(rod.x, rod.y, rod.w, rod.h, rod.w / 2);
  sctx.fill();

  clipTo(print.canvas, shape);
  const full = renderMaterial(shape, edgeCanvas(shape, bandWidth(design, s), q), print.canvas, design, s);

  // 卡榫:霧面透明的小方塊 + 中間一顆圓扣
  const ctx = full.getContext("2d")!;
  ctx.save();
  ctx.fillStyle = "rgba(240, 244, 248, 0.72)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2 * s;
  ctx.shadowColor = "rgba(40, 50, 60, 0.2)";
  ctx.shadowBlur = 6 * s;
  ctx.shadowOffsetY = 2 * s;
  ctx.beginPath();
  ctx.roundRect(knob.x, knob.y, knob.w, knob.h, 12 * s);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.strokeStyle = "rgba(150, 160, 170, 0.6)";
  ctx.beginPath();
  ctx.arc(cx, knob.y + knob.h / 2, knob.h * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const box = paddedBounds(shape, pad, q);
  return { full, canvas: crop(full, box), mask: crop(shape, box), area, crop: box, scale: s };
}

/** 攤平編輯時整片(未裁切)的大小與放貼紙的範圍,設計單位(和解析度無關) */
export function acrylicLayout(design: AcrylicDesign) {
  if (design.mode === "card") {
    const right = design.keyring ? KEYRING_ROOM : 0;
    return {
      width: CARD_SIZE.width + PAD * 2 + right,
      height: CARD_SIZE.height + PAD * 2,
      area: { x: PAD, y: PAD, width: CARD_SIZE.width, height: CARD_SIZE.height },
    };
  }
  const m = design.margin;
  return {
    width: STICK_AREA.width + PAD * 2 + m * 2,
    height: STICK_AREA.height + PAD * 2 + m * 2 + KNOB.height + ROD.length,
    area: { x: PAD + m, y: PAD + m, width: STICK_AREA.width, height: STICK_AREA.height },
  };
}

/** 依款式做一片;scale 是解析度倍率(預覽小一點、輸出大一點) */
export function buildAcrylic(design: AcrylicDesign, arts: Map<string, Art>, scale: number): AcrylicPiece {
  return design.mode === "card" ? buildCard(design, arts, scale) : buildStick(design, arts, scale);
}

/** 外形 + 印刷是現成的(例如御守):只套材質,外緣多留一圈透明邊 */
export function buildFromPrint(print: HTMLCanvasElement, look: AcrylicLook, margin: number, scale: number, punch?: { x: number; y: number; r: number }) {
  const q = quality(scale);
  const shape = contourShape(print, margin * scale, q);
  if (punch) {
    const ctx = shape.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(punch.x, punch.y, punch.r, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas: renderMaterial(shape, edgeCanvas(shape, bandWidth(look, scale), q), print, look, scale), mask: shape };
}

/** 一張圖的像素只讀一次(拖曳時每一格都要用) */
const pixelCache = new WeakMap<HTMLCanvasElement, ImageData>();
function pixelsOf(canvas: HTMLCanvasElement): ImageData {
  let data = pixelCache.get(canvas);
  if (!data) {
    data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    pixelCache.set(canvas, data);
  }
  return data;
}

/** 把一張圖透視貼到 w×h 的新圖層上(逐像素,沒有接縫) */
function warp(source: HTMLCanvasElement, quad: Quad, w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);
  warpPixels(pixelsOf(source), out, quad);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** 照片(或沒有照片時的淡色漸層)鋪滿 */
function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, photo: (CanvasImageSource & { width: number; height: number }) | null) {
  if (photo) {
    drawCover(ctx, photo, 0, 0, w, h);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#e8efe6");
  g.addColorStop(0.55, "#d4e2d8");
  g.addColorStop(1, "#bccbd8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * 照片 + 壓克力。照片照原本比例鋪滿(場景就是照片的比例);
 * 壓克力透明的地方,後面的照片稍微放大、偏移(折射),再疊上壓克力本身。
 */
export function drawAcrylicScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  photo: (CanvasImageSource & { width: number; height: number }) | null,
  piece: AcrylicPiece,
  quad: Quad,
  clarity: number
) {
  drawBackdrop(ctx, w, h, photo);
  const scale = Math.abs(ctx.getTransform().a) || 1;
  const pw = Math.max(1, Math.round(w * scale));
  const ph = Math.max(1, Math.round(h * scale));

  // 折射:放大一點點、往右下偏一點點的照片,只留壓克力的範圍
  const deviceQuad = quad.map((p) => ({ x: p.x * scale, y: p.y * scale })) as Quad;
  const mask = warp(piece.mask, deviceQuad, pw, ph);
  const lens = makeCanvas(pw, ph);
  lens.ctx.scale(scale, scale);
  const cx = (quad[0].x + quad[2].x) / 2;
  const cy = (quad[0].y + quad[2].y) / 2;
  lens.ctx.translate(cx + 3, cy + 4);
  lens.ctx.scale(1.035, 1.035);
  lens.ctx.translate(-cx, -cy);
  drawBackdrop(lens.ctx, w, h, photo);
  lens.ctx.setTransform(1, 0, 0, 1, 0, 0);
  lens.ctx.globalCompositeOperation = "destination-in";
  lens.ctx.drawImage(mask, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, Math.max(0, clarity));
  ctx.drawImage(lens.canvas, 0, 0, w, h);
  ctx.restore();

  // 壓克力本身逐像素透視(切三角形畫的話,半透明的地方會看到接縫)
  ctx.drawImage(warp(piece.canvas, deviceQuad, pw, ph), 0, 0, w, h);
}

/** 場景大小:有照片就照照片的比例(寬 900),沒有就 3:4 */
export function sceneSize(photo: { width: number; height: number } | null): { width: number; height: number } {
  if (!photo) return { width: 900, height: 1200 };
  const ratio = Math.min(2, Math.max(0.5, photo.height / photo.width));
  return { width: 900, height: Math.round(900 * ratio) };
}

/** 壓克力在照片上的四個角 */
export function sceneQuad(piece: AcrylicPiece, place: Placement, w: number, h: number): Quad {
  return placementQuad(place, piece.canvas.width / piece.canvas.height, w, h);
}

// ---- 壓克力御守:御守袋印在一片壓克力上,外緣多留一圈透明邊,袋口打孔穿繩結 ----

/** 繩結穿過的孔(設計單位,和 drawOmamoriCord 的繩結位置一致) */
const omamoriHole = (w: number, h: number) => ({ x: w / 2, y: h * 0.21, r: 9 });

export function buildOmamori(design: OmamoriDesign, side: "front" | "back", w: number, h: number, scale: number) {
  const print = makeCanvas(w * scale, h * scale);
  print.ctx.scale(scale, scale);
  drawOmamoriBag(print.ctx, w, h, design, side);
  const hole = omamoriHole(w, h);
  return buildFromPrint(print.canvas, design, 16, scale, { x: hole.x * scale, y: hole.y * scale, r: hole.r * scale });
}

/** 壓克力御守 + 繩結(繩結不是壓克力,畫在上面) */
export function drawAcrylicOmamori(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  design: OmamoriDesign,
  piece: { canvas: HTMLCanvasElement },
  sway: number,
  bell: Art | null
) {
  ctx.drawImage(piece.canvas, 0, 0, w, h);
  drawOmamoriCord(ctx, w, h, design, sway, bell);
}
