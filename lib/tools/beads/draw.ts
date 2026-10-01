// 豆子渲染器:依格子資料畫出板子、豆子、熨斗。
//
// 燙的程度是渲染參數(melt,0 = 剛放上去,1 = 全燙),不改動格子資料。
// 豆子用 evenodd 畫成環,洞是真的空的——板子或透明背景會從洞裡透出來,
// 不必另開圖層挖洞。

import { assertCanvasSize } from "@/lib/canvas-limits";
import { shade } from "./color";
import {
  DEFAULT_STYLE,
  MATERIAL_CLEAR,
  MATERIAL_GLOW,
  materialAt,
  type BeadStyle,
} from "./finish";
import type { BeadColor } from "./palette";
import type { BeadPattern } from "./pattern";

/** 板子是實體塑膠板,不跟著網站主題換色 */
const BOARD_COLOR = "#ecebe6";
const PEG_COLOR = "#d6d3cb";

/** 小到這個程度(像素)就改畫純色方塊,圓與洞只會變成雜訊 */
const TINY_CELL = 4;

export type BeadShades = { base: string; light: string; dark: string };

export function beadShades(palette: BeadColor[]): BeadShades[] {
  return palette.map((color) => ({
    base: color.hex,
    light: shade(color.hex, 0.45),
    dark: shade(color.hex, -0.35),
  }));
}

/**
 * 燙的程度 → 外徑與洞的半徑(以一格為 1)。
 * 外徑超過 0.5 就碰到上下左右,看起來黏在一起;超過 0.707 連斜對角的縫也封住。
 * 全燙(1)時洞消失、整片像一塊磁磚。
 */
export function meltGeometry(melt: number): { outer: number; hole: number } {
  const m = Math.min(1, Math.max(0, melt));
  return { outer: 0.46 + 0.27 * m, hole: 0.2 * (1 - m) ** 1.3 };
}

/** 方形磁磚:半邊長與圓角(以一格為 1),燙越久越方、越往外擴 */
export function tileGeometry(melt: number): { half: number; corner: number } {
  const m = Math.min(1, Math.max(0, melt));
  return { half: 0.44 + 0.08 * m, corner: 0.16 * (1 - m) + 0.02 };
}

export function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/** 每顆豆子固定的亂數(亮粉的位置、焦痕),同一格每次畫都一樣 */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  cell: number
): void {
  ctx.fillStyle = BOARD_COLOR;
  ctx.fillRect(0, 0, cols * cell, rows * cell);

  if (cell < TINY_CELL) return;

  ctx.fillStyle = PEG_COLOR;
  ctx.beginPath();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cx = (col + 0.5) * cell;
      const cy = (row + 0.5) * cell;
      ctx.moveTo(cx + cell * 0.14, cy);
      ctx.arc(cx, cy, cell * 0.14, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

/** 底圖檢視:每格一個平的色塊,還沒放豆子之前用來看轉換結果 */
export function drawFlat(
  ctx: CanvasRenderingContext2D,
  pattern: BeadPattern,
  palette: BeadColor[],
  cell: number
): void {
  const gap = cell >= 8 ? 1 : 0;

  pattern.cells.forEach((index, i) => {
    if (index < 0) return;
    const col = i % pattern.cols;
    const row = Math.floor(i / pattern.cols);
    ctx.fillStyle = palette[index].hex;
    ctx.fillRect(col * cell + gap / 2, row * cell + gap / 2, cell - gap, cell - gap);
  });

  // 平的色塊看不出材質,不是霧面的格子在中間點一個小點提示
  if (cell < 8 || !pattern.materials) return;
  ctx.save();
  ctx.lineWidth = Math.max(1, cell * 0.06);
  pattern.cells.forEach((index, i) => {
    if (index < 0 || materialAt(pattern, i) === 0) return;
    const cx = ((i % pattern.cols) + 0.5) * cell;
    const cy = (Math.floor(i / pattern.cols) + 0.5) * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

/** 豆子的外形(圓或方)加上中間的洞;fill("evenodd") 就是一顆有洞的豆子 */
function beadPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  melt: number,
  shape: BeadStyle["shape"]
) {
  const { outer, hole } = meltGeometry(melt);
  ctx.beginPath();
  if (shape === "square") {
    const { half, corner } = tileGeometry(melt);
    ctx.roundRect(cx - half * r, cy - half * r, half * 2 * r, half * 2 * r, corner * r);
  } else {
    ctx.arc(cx, cy, outer * r, 0, Math.PI * 2);
  }
  if (hole * r > 0.3) {
    ctx.moveTo(cx + hole * r, cy);
    ctx.arc(cx, cy, hole * r, 0, Math.PI * 2);
  }
}

type BeadArgs = {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  cell: number;
  shades: BeadShades;
  melt: number;
  material: number;
  style: BeadStyle;
  /** 格子編號:亮粉位置之類的固定亂數用 */
  seed: number;
  scale?: number;
  /** 往外擴的範圍限制:燙到外徑超過半格時,只准擴進自己這格與旁邊的空格 */
  clip?: (ctx: CanvasRenderingContext2D) => void;
};

/** 半透明豆子的不透明度 */
const CLEAR_ALPHA = 0.6;

/** 一顆豆子的底色(第一層) */
function fillBead({ ctx, cx, cy, cell, shades, melt, material, style, scale = 1, clip }: BeadArgs) {
  const base = ctx.globalAlpha;
  if (clip) {
    ctx.save();
    clip(ctx);
  }
  if (material === MATERIAL_CLEAR) ctx.globalAlpha = base * CLEAR_ALPHA;
  ctx.fillStyle = shades.base;

  if (cell < TINY_CELL) {
    ctx.fillRect(cx - cell / 2, cy - cell / 2, cell, cell);
  } else {
    beadPath(ctx, cx, cy, cell * scale, melt, style.shape);
    if (material === MATERIAL_GLOW && style.glow) {
      ctx.shadowColor = shades.light;
      ctx.shadowBlur = cell * 0.9;
    }
    ctx.fill("evenodd");
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  if (clip) ctx.restore();
  ctx.globalAlpha = base;
}

/** 一顆豆子的立體感與材質(第二層):洞口陰影、反光、珍珠光、亮粉;燙得越平越淡 */
function shadeBead({ ctx, cx, cy, cell, shades, melt, material, style, seed, scale = 1 }: BeadArgs) {
  if (cell < TINY_CELL) return;

  const base = ctx.globalAlpha;
  const { outer, hole } = meltGeometry(melt);
  const r = cell * scale;
  const flat = smoothstep(melt);
  const clear = material === MATERIAL_CLEAR ? CLEAR_ALPHA : 1;
  // 方磚的反光沿著比較靠外的一圈走
  const ring = style.shape === "square" ? 0.33 : (Math.min(outer, 0.5) + hole) / 2;

  if (hole > 0.01) {
    ctx.beginPath();
    ctx.arc(cx, cy, (hole + 0.07) * r, 0, Math.PI * 2);
    ctx.moveTo(cx + hole * r, cy);
    ctx.arc(cx, cy, hole * r, 0, Math.PI * 2);
    ctx.globalAlpha = base * (0.55 - 0.25 * flat) * clear;
    ctx.fillStyle = shades.dark;
    ctx.fill("evenodd");
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 反光:圓豆沿著左上的一段弧,方磚沿著左上角的直角(圓弧畫在方塊上會變成怪怪的 C)
  const highlight = (from: number, to: number) => {
    ctx.beginPath();
    if (style.shape === "square") {
      const q = ring * r;
      const along = (to - from) / (Math.PI * 0.5);
      ctx.moveTo(cx - q, cy + q * (0.6 * along - 0.2));
      ctx.lineTo(cx - q, cy - q);
      ctx.lineTo(cx + q * (0.6 * along - 0.2), cy - q);
    } else {
      ctx.arc(cx, cy, ring * r, from, to);
    }
  };

  highlight(Math.PI * 1.05, Math.PI * 1.55);
  ctx.globalAlpha = base * (0.7 - 0.55 * flat) * clear;
  ctx.strokeStyle = shades.light;
  ctx.lineWidth = Math.max(1, r * (0.07 - 0.03 * flat));
  ctx.stroke();

  if (material === 1) {
    // 珍珠光:一大片柔和的白光,對面帶一點冷色;燙平了光澤也跟著收斂
    highlight(Math.PI * 0.95, Math.PI * 1.85);
    ctx.globalAlpha = base * 0.3 * (1 - 0.55 * flat);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, r * (0.2 - 0.08 * flat));
    ctx.stroke();
    if (style.shape !== "square") {
      ctx.beginPath();
      ctx.arc(cx, cy, ring * r, Math.PI * 0.1, Math.PI * 0.6);
      ctx.globalAlpha = base * 0.22 * (1 - 0.55 * flat);
      ctx.strokeStyle = "#d8e8ff";
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.stroke();
    }
  } else if (material === 2) {
    // 亮粉:環上散著幾點亮片,位置跟著格子固定
    ctx.fillStyle = "#ffffff";
    for (let k = 0; k < 5; k += 1) {
      const angle = hash(seed * 7 + k) * Math.PI * 2;
      const radius = (hole + 0.04 + hash(seed * 13 + k) * (Math.min(outer, 0.5) - hole - 0.08)) * r;
      ctx.globalAlpha = base * (0.65 + 0.35 * hash(seed * 31 + k));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, Math.max(0.6, r * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = base;
}

/**
 * 畫整板豆子。meltAt 決定每一欄燙到什麼程度(熨斗動畫時每欄不同);
 * only 給了就只畫這些格子(落豆動畫時已經落地的那些)。
 *
 * 先把所有底色畫完再畫立體感,隔壁黏過來的那一圈才不會蓋掉這顆的反光。
 */
export function drawBeads(
  ctx: CanvasRenderingContext2D,
  pattern: BeadPattern,
  shades: BeadShades[],
  cell: number,
  meltAt: (col: number) => number,
  style: BeadStyle = DEFAULT_STYLE,
  only?: Iterable<number>
): void {
  const indexes = only ? [...only] : pattern.cells.map((_, i) => i);
  const { cols, rows, cells } = pattern;

  /**
   * 燙到外徑超過半格(會碰到隔壁)時,每顆只准擴進自己這格與旁邊的空格:
   * 不然後畫的豆子會把先畫的吃成月牙形,實際燙好的兩色交界是直的。
   * 往空格擴不受限,作品的外輪廓才會是圓潤的。
   */
  const clipFor = (col: number, row: number, melt: number) => {
    if (cell < TINY_CELL || melt <= 0.14) return undefined;
    return (c: CanvasRenderingContext2D) => {
      c.beginPath();
      // 自己這格多吃半個像素,同色相鄰的豆子之間才不會留下反鋸齒的細縫
      c.rect(col * cell - 0.5, row * cell - 0.5, cell + 1, cell + 1);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = col + dx;
          const y = row + dy;
          const inside = x >= 0 && y >= 0 && x < cols && y < rows;
          if (!inside || cells[y * cols + x] < 0) c.rect(x * cell, y * cell, cell, cell);
        }
      }
      c.clip();
    };
  };

  for (const pass of [fillBead, shadeBead]) {
    for (const i of indexes) {
      const color = cells[i];
      if (color < 0) continue;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const melt = meltAt(col);
      pass({
        ctx,
        cx: (col + 0.5) * cell,
        cy: (row + 0.5) * cell,
        cell,
        shades: shades[color],
        melt,
        material: materialAt(pattern, i),
        style,
        seed: i,
        clip: pass === fillBead ? clipFor(col, row, melt) : undefined,
      });
    }
  }
}

/** 正在往下掉的一顆:progress 0 = 剛出現在上方,1 = 落進柱子 */
export function drawFallingBead(
  ctx: CanvasRenderingContext2D,
  pattern: BeadPattern,
  shades: BeadShades[],
  cell: number,
  index: number,
  progress: number,
  style: BeadStyle = DEFAULT_STYLE
): void {
  const color = pattern.cells[index];
  if (color < 0) return;

  const t = Math.min(1, Math.max(0, progress));
  // 先快後慢地落下
  const ease = 1 - (1 - t) ** 3;
  const col = index % pattern.cols;
  const row = Math.floor(index / pattern.cols);
  const args: BeadArgs = {
    ctx,
    cx: (col + 0.5) * cell,
    cy: (row + 0.5) * cell - (1 - ease) * cell * 1.6,
    cell,
    shades: shades[color],
    melt: 0,
    material: materialAt(pattern, index),
    style,
    seed: index,
    scale: 1 + (1 - ease) * 0.35,
  };

  ctx.globalAlpha = Math.min(1, t * 2.5);
  fillBead(args);
  shadeBead(args);
  ctx.globalAlpha = 1;
}

/**
 * 焦痕:燙過頭的地方泛一點褐色。位置與深淺由 seed 決定——
 * 每燙一次換一個 seed,畫面與下載的圖用同一個,兩邊才一致。
 * 只畫在已經有東西(豆子或板子)的地方,透明背景不會被染色。
 */
export function drawScorch(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  cell: number,
  seed: number,
  strength = 1
): void {
  if (seed === 0 || strength <= 0) return;
  const count = Math.max(1, Math.round((cols * rows) / 350));

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  for (let k = 0; k < count; k += 1) {
    const x = hash(seed + k * 3) * cols * cell;
    const y = hash(seed + k * 3 + 1) * rows * cell;
    const radius = (1.2 + hash(seed + k * 3 + 2) * 2.6) * cell;
    const alpha = (0.08 + hash(seed * 5 + k) * 0.22) * strength;
    const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, `rgba(92, 52, 18, ${alpha.toFixed(3)})`);
    spot.addColorStop(1, "rgba(92, 52, 18, 0)");
    ctx.fillStyle = spot;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

/** 熨斗的長度(跟著板子高度,但至少七格) */
export function ironLength(boardHeight: number, cell: number): number {
  return Math.max(cell * 7, boardHeight * 0.42);
}

/**
 * 熨斗(俯視):尖端在 tipX,往右推。time 是動畫經過的毫秒,蒸氣與反光跟著動。
 * 高度蓋過整塊板子——這是玩具,一趟燙完一整條比較好看。
 */
export function drawIron(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  boardHeight: number,
  cell: number,
  time = 0
): void {
  const length = ironLength(boardHeight, cell);
  const back = tipX - length;
  const top = -boardHeight * 0.04;
  const bottom = boardHeight * 1.04;
  const mid = boardHeight / 2;

  ctx.save();

  // 熱氣:熨斗後方剛燙過的地方泛一層暖光
  const glow = ctx.createLinearGradient(back - length * 0.5, 0, back, 0);
  glow.addColorStop(0, "rgba(255, 214, 170, 0)");
  glow.addColorStop(1, "rgba(255, 214, 170, 0.28)");
  ctx.fillStyle = glow;
  ctx.fillRect(back - length * 0.5, 0, length * 0.5, boardHeight);

  // 蒸氣:從熨斗後緣冒出來,往後飄、慢慢散開
  const puffs = 7;
  for (let k = 0; k < puffs; k += 1) {
    const age = (time / 700 + k / puffs) % 1;
    const y = boardHeight * ((k + 0.5) / puffs) + Math.sin(time / 300 + k) * cell;
    const x = back - age * length * 0.6;
    const radius = cell * (1.2 + age * 3);
    const steam = ctx.createRadialGradient(x, y, 0, x, y, radius);
    steam.addColorStop(0, `rgba(255, 255, 255, ${(0.35 * (1 - age)).toFixed(3)})`);
    steam.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = steam;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = cell * 1.2;
  ctx.shadowOffsetY = cell * 0.4;

  ctx.beginPath();
  ctx.moveTo(back, top + cell);
  ctx.quadraticCurveTo(back, top, back + cell, top);
  ctx.lineTo(tipX - length * 0.4, top);
  ctx.quadraticCurveTo(tipX - length * 0.05, top + boardHeight * 0.12, tipX, mid);
  ctx.quadraticCurveTo(tipX - length * 0.05, bottom - boardHeight * 0.12, tipX - length * 0.4, bottom);
  ctx.lineTo(back + cell, bottom);
  ctx.quadraticCurveTo(back, bottom, back, bottom - cell);
  ctx.closePath();

  const body = ctx.createLinearGradient(0, top, 0, bottom);
  body.addColorStop(0, "#f4f6f8");
  body.addColorStop(0.5, "#d9dee4");
  body.addColorStop(1, "#c3cad2");
  ctx.fillStyle = body;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(1, cell * 0.15);
  ctx.strokeStyle = "#9aa3ad";
  ctx.stroke();

  // 金屬反光:一道斜斜的亮帶在機身上來回滑
  ctx.save();
  ctx.clip();
  const sweep = back + ((time / 900) % 1) * length * 1.4 - length * 0.2;
  const sheen = ctx.createLinearGradient(sweep - length * 0.15, top, sweep + length * 0.15, bottom);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.5, "rgba(255, 255, 255, 0.55)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(back, top, length, bottom - top);
  ctx.restore();

  // 握把
  const handleTop = mid - boardHeight * 0.09;
  const handleHeight = boardHeight * 0.18;
  ctx.beginPath();
  ctx.roundRect(back + length * 0.12, handleTop, length * 0.5, handleHeight, handleHeight / 2);
  ctx.fillStyle = "#5b6670";
  ctx.fill();

  ctx.restore();
}

export type ExportOptions = {
  /** 每格幾像素 */
  cell: number;
  melt: number;
  /** false = 透明背景,只留豆子 */
  board: boolean;
  style?: BeadStyle;
  /** 焦痕的種子;0 = 沒有焦痕 */
  scorchSeed?: number;
};

/** 輸出 PNG */
export async function renderPatternPng(
  pattern: BeadPattern,
  palette: BeadColor[],
  { cell, melt, board, style = DEFAULT_STYLE, scorchSeed = 0 }: ExportOptions
): Promise<Blob> {
  const width = pattern.cols * cell;
  const height = pattern.rows * cell;
  assertCanvasSize(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立繪圖環境");

  if (board) drawBoard(ctx, pattern.cols, pattern.rows, cell);
  drawBeads(ctx, pattern, beadShades(palette), cell, () => melt, style);
  drawScorch(ctx, pattern.cols, pattern.rows, cell, scorchSeed, melt);

  return canvasToPng(canvas);
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("無法產生圖片檔"))), "image/png");
  });
}
