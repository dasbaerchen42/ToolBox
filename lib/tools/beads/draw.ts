// 豆子渲染器:依格子資料畫出板子、豆子、熨斗。
//
// 燙的程度是渲染參數(melt,0 = 剛放上去,1 = 燙好),不改動格子資料。
// 豆子一律用 evenodd 畫成圓環,洞是真的空的——板子或透明背景會從洞裡透出來,
// 不必另開圖層挖洞。

import { assertCanvasSize } from "@/lib/canvas-limits";
import { shade } from "./color";
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
 * 外徑超過 0.5 就會碰到隔壁,看起來黏在一起;斜對角(0.707)要燙很久才會封住,
 * 所以燙好的板子在四顆之間還留著小縫,跟實物一樣。
 */
export function meltGeometry(melt: number): { outer: number; hole: number } {
  const m = Math.min(1, Math.max(0, melt));
  return { outer: 0.46 + 0.1 * m, hole: 0.2 - 0.13 * m };
}

export function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
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
}

function ringPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.moveTo(cx + inner, cy);
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
}

/** 一顆豆子的底色(第一層) */
function fillBead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  shades: BeadShades,
  melt: number,
  scale = 1
) {
  const { outer, hole } = meltGeometry(melt);

  if (cell < TINY_CELL) {
    ctx.fillStyle = shades.base;
    ctx.fillRect(cx - cell / 2, cy - cell / 2, cell, cell);
    return;
  }

  ringPath(ctx, cx, cy, outer * cell * scale, hole * cell * scale);
  ctx.fillStyle = shades.base;
  ctx.fill("evenodd");
}

/** 一顆豆子的立體感(第二層):洞口的陰影與左上的反光,燙得越平越淡 */
function shadeBead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  shades: BeadShades,
  melt: number,
  scale = 1
) {
  if (cell < TINY_CELL) return;

  const { outer, hole } = meltGeometry(melt);
  const r = cell * scale;
  const flat = smoothstep(melt);

  ringPath(ctx, cx, cy, (hole + 0.07) * r, hole * r);
  ctx.globalAlpha = 0.55 - 0.25 * flat;
  ctx.fillStyle = shades.dark;
  ctx.fill("evenodd");

  ctx.beginPath();
  ctx.arc(cx, cy, ((outer + hole) / 2) * r, Math.PI * 1.05, Math.PI * 1.55);
  ctx.globalAlpha = 0.7 - 0.45 * flat;
  ctx.strokeStyle = shades.light;
  ctx.lineWidth = Math.max(1, r * (0.07 - 0.03 * flat));
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.globalAlpha = 1;
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
  only?: Iterable<number>
): void {
  const indexes = only ? [...only] : pattern.cells.map((_, i) => i);

  for (const pass of [fillBead, shadeBead]) {
    for (const i of indexes) {
      const color = pattern.cells[i];
      if (color < 0) continue;
      const col = i % pattern.cols;
      const row = Math.floor(i / pattern.cols);
      pass(ctx, (col + 0.5) * cell, (row + 0.5) * cell, cell, shades[color], meltAt(col));
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
  progress: number
): void {
  const color = pattern.cells[index];
  if (color < 0) return;

  const t = Math.min(1, Math.max(0, progress));
  // 先快後慢地落下,最後一點點回彈
  const ease = 1 - (1 - t) ** 3;
  const col = index % pattern.cols;
  const row = Math.floor(index / pattern.cols);
  const cx = (col + 0.5) * cell;
  const cy = (row + 0.5) * cell - (1 - ease) * cell * 1.6;
  const scale = 1 + (1 - ease) * 0.35;

  ctx.globalAlpha = Math.min(1, t * 2.5);
  fillBead(ctx, cx, cy, cell, shades[color], 0, scale);
  shadeBead(ctx, cx, cy, cell, shades[color], 0, scale);
  ctx.globalAlpha = 1;
}

/**
 * 熨斗(俯視):尖端在 tipX,往右推。
 * 高度蓋過整塊板子——這是玩具,一趟燙完一整條比較好看。
 */
export function drawIron(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  boardHeight: number,
  cell: number
): void {
  const length = Math.max(cell * 7, boardHeight * 0.42);
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
};

/** 輸出 PNG */
export async function renderPatternPng(
  pattern: BeadPattern,
  palette: BeadColor[],
  { cell, melt, board }: ExportOptions
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
  drawBeads(ctx, pattern, beadShades(palette), cell, () => melt);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("無法產生圖片檔"))), "image/png");
  });
}
