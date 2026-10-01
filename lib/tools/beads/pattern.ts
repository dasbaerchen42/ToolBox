// 照片 → 格子資料。全部是純函式,不碰 canvas,方便單獨測試。
//
// 管線:照片先畫成每格 SAMPLES×SAMPLES 個像素的小圖(這一步在瀏覽器裡做),
// 再由這裡把每一格平均成一個顏色、換成最接近的豆子、最後壓到指定色數。

import { labDistanceSq, linearToOklab, srgbToLinear, type Lab } from "./color";

/** 一格取樣幾×幾個像素來平均;太少會被雜點帶偏,太多只是白算 */
export const SAMPLES = 6;

/** 一格平均後的不透明度沒超過這個就當作空格(透明 PNG 的背景、完整放進時的留白) */
const EMPTY_ALPHA = 0.5;

/** 格子資料:cells 依列排,值是色盤索引,-1 是空格 */
export type BeadPattern = {
  cols: number;
  rows: number;
  cells: number[];
};

export type FitMode = "cover" | "contain";

export type Rect = { x: number; y: number; width: number; height: number };

/** 只要 data/width/height,測試裡可以直接用陣列假造,不必有真的 ImageData */
export type PixelData = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

/**
 * 照片要畫在板子的哪裡(單位是格)。
 * cover:裁掉多的部分把板子填滿;contain:整張放進去,四周留空格。
 */
export function fitRect(
  srcWidth: number,
  srcHeight: number,
  cols: number,
  rows: number,
  mode: FitMode
): Rect {
  if (srcWidth <= 0 || srcHeight <= 0) return { x: 0, y: 0, width: cols, height: rows };

  const scaleX = cols / srcWidth;
  const scaleY = rows / srcHeight;
  const scale = mode === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const width = srcWidth * scale;
  const height = srcHeight * scale;

  return { x: (cols - width) / 2, y: (rows - height) / 2, width, height };
}

/** 一格的平均色;null 是空格 */
export type CellSample = Lab | null;

/**
 * 每格取平均色。平均在線性光裡做,並以透明度加權——
 * 在 sRGB 數值上直接平均,黑白交錯的格子會變得比實際暗。
 */
export function sampleCells(pixels: PixelData, cols: number, rows: number): CellSample[] {
  const cellWidth = pixels.width / cols;
  const cellHeight = pixels.height / rows;
  const samples: CellSample[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor(row * cellHeight);
    const y1 = Math.max(y0 + 1, Math.floor((row + 1) * cellHeight));

    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor(col * cellWidth);
      const x1 = Math.max(x0 + 1, Math.floor((col + 1) * cellWidth));

      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      let count = 0;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * pixels.width + x) * 4;
          const a = pixels.data[i + 3] / 255;
          r += srgbToLinear(pixels.data[i]) * a;
          g += srgbToLinear(pixels.data[i + 1]) * a;
          b += srgbToLinear(pixels.data[i + 2]) * a;
          alpha += a;
          count += 1;
        }
      }

      samples.push(
        count === 0 || alpha / count <= EMPTY_ALPHA
          ? null
          : linearToOklab(r / alpha, g / alpha, b / alpha)
      );
    }
  }

  return samples;
}

function nearest(sample: Lab, palette: Lab[], allowed: number[]): number {
  let best = allowed[0];
  let bestDistance = Infinity;

  for (const index of allowed) {
    const distance = labDistanceSq(sample, palette[index]);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * 每格換成最接近的豆子,再把色數壓到 maxColors 以下。
 *
 * 壓色數的做法:每次拿掉用量最少的那一色,原本用它的格子
 * 拿「原始的平均色」重新找最近的豆子——不是找離被拿掉那顆豆子最近的,
 * 否則一路換下去顏色會越漂越遠。不抖色,保留一格一色的味道。
 */
export function matchPalette(
  samples: CellSample[],
  palette: Lab[],
  maxColors: number
): number[] {
  let allowed = palette.map((_, index) => index);
  const cells = samples.map((sample) => (sample ? nearest(sample, palette, allowed) : -1));
  const limit = Math.max(1, Math.floor(maxColors));

  for (;;) {
    const usage = new Map<number, number>();
    for (const cell of cells) {
      if (cell >= 0) usage.set(cell, (usage.get(cell) ?? 0) + 1);
    }
    if (usage.size <= limit) break;

    // 用量最少的先走;一樣少就拿掉索引大的,結果才是固定的
    let drop = -1;
    let dropCount = Infinity;
    for (const [index, count] of usage) {
      if (count < dropCount || (count === dropCount && index > drop)) {
        drop = index;
        dropCount = count;
      }
    }

    allowed = [...usage.keys()].filter((index) => index !== drop);
    for (let i = 0; i < cells.length; i += 1) {
      if (cells[i] === drop) cells[i] = nearest(samples[i] as Lab, palette, allowed);
    }
  }

  return cells;
}

/** 把指定的顏色整批清成空格(例如一鍵清掉背景) */
export function clearColors(pattern: BeadPattern, removed: ReadonlySet<number>): BeadPattern {
  if (removed.size === 0) return pattern;
  return {
    ...pattern,
    cells: pattern.cells.map((cell) => (removed.has(cell) ? -1 : cell)),
  };
}

export type ColorCount = { index: number; count: number };

/** 每種顏色要幾顆,多的排前面 */
export function countColors(cells: number[]): ColorCount[] {
  const usage = new Map<number, number>();
  for (const cell of cells) {
    if (cell >= 0) usage.set(cell, (usage.get(cell) ?? 0) + 1);
  }
  return [...usage]
    .map(([index, count]) => ({ index, count }))
    .sort((x, y) => y.count - x.count || x.index - y.index);
}

/** 固定種子的亂數,同一張圖每次落豆的順序都一樣 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 自動落豆的順序:有豆子的格子打散成亂序 */
export function dropOrder(cells: number[], seed = 1): number[] {
  const order = cells.flatMap((cell, index) => (cell >= 0 ? [index] : []));
  const random = mulberry32(seed);

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order;
}
