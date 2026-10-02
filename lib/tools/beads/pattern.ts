// 照片 → 格子資料。全部是純函式,不碰 canvas,方便單獨測試。
//
// 管線:照片先畫成每格 N×N 個像素的小圖(這一步在瀏覽器裡做),
// 再由這裡決定每一格的顏色(平均或取主色)、換成最接近的豆子、最後壓到指定色數。

import { labDistanceSq, linearToOklab, srgbToLinear, type Lab } from "./color";
import type { BoardOutline } from "./outline";

/** 一格取樣幾×幾個像素來平均;太少會被雜點帶偏,太多只是白算 */
export const SAMPLES = 6;

/**
 * 取主色時一格看幾×幾個像素。要比平均法多:
 * 細線只佔格子的一小條,像素太少的話線條那一色永遠搶不到票。
 */
export const MAJORITY_SAMPLES = 10;

/**
 * average:每格取平均色。照片的漸層比較順,但細線會跟背景平均成中間色。
 * majority:每格先把每個像素換成豆子色,取出現最多的那一色。插畫的線條與色塊會乾淨很多。
 */
export type SampleMethod = "average" | "majority";

/**
 * 照片轉換時的板子:依照片比例(寬固定、高跟著照片算)、正方形,
 * 或圓形/六角形/愛心形(都是正方形的板子,外形以外沒有柱子)
 */
export type BoardShape = "aspect" | "square" | "circle" | "hexagon" | "heart";

/** 板子邊長的上限:116 = 2×2 塊大板 */
export const MAX_BOARD_SIDE = 116;

/** 一格平均後的不透明度沒超過這個就當作空格(透明 PNG 的背景、完整放進時的留白) */
const EMPTY_ALPHA = 0.5;

/** 格子資料:cells 依列排,值是色盤索引,-1 是空格 */
export type BeadPattern = {
  cols: number;
  rows: number;
  cells: number[];
  /** 每一格的材質(見 finish.ts);沒有就是全部霧面 */
  materials?: number[];
  /** 板子外形(見 outline.ts);沒有就是方形 */
  outline?: BoardOutline;
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

/**
 * 板子要幾格寬、幾格高。依照片比例時高度跟著照片算,
 * 但至少 1 格、最多 MAX_BOARD_SIDE 格(太高的直幅照片會改成以高為準縮寬)。
 */
export function boardSize(
  photoWidth: number,
  photoHeight: number,
  width: number,
  shape: BoardShape
): { cols: number; rows: number } {
  if (shape !== "aspect" || photoWidth <= 0 || photoHeight <= 0) {
    return { cols: width, rows: width };
  }

  const rows = Math.round((width * photoHeight) / photoWidth);
  if (rows <= MAX_BOARD_SIDE) return { cols: width, rows: Math.max(1, rows) };

  // 很高的直幅照片:高度頂到上限,寬度照比例縮
  return {
    cols: Math.max(1, Math.round((MAX_BOARD_SIDE * photoWidth) / photoHeight)),
    rows: MAX_BOARD_SIDE,
  };
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

/**
 * 每格取主色:格內每個像素先找最接近的豆子,票數最多的那一色就是這格的顏色。
 * 回傳那顆豆子的 OKLab 值,後面壓色數時拿它重新配對。
 *
 * 插畫裡同一個顏色會重複出現很多次,所以「像素色 → 豆子」用快取,
 * 不然大板(116 格)要比對上億次。
 */
export function sampleMajority(
  pixels: PixelData,
  cols: number,
  rows: number,
  palette: Lab[]
): CellSample[] {
  const cellWidth = pixels.width / cols;
  const cellHeight = pixels.height / rows;
  const all = palette.map((_, index) => index);
  const cache = new Map<number, number>();
  const votes = new Float64Array(palette.length);
  const samples: CellSample[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor(row * cellHeight);
    const y1 = Math.max(y0 + 1, Math.floor((row + 1) * cellHeight));

    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor(col * cellWidth);
      const x1 = Math.max(x0 + 1, Math.floor((col + 1) * cellWidth));

      votes.fill(0);
      let alpha = 0;
      let count = 0;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * pixels.width + x) * 4;
          const a = pixels.data[i + 3] / 255;
          count += 1;
          alpha += a;
          // 幾乎透明的像素(去背圖的邊)不投票,免得邊緣被染成背景色
          if (a <= EMPTY_ALPHA) continue;

          const key = (pixels.data[i] << 16) | (pixels.data[i + 1] << 8) | pixels.data[i + 2];
          let bead = cache.get(key);
          if (bead === undefined) {
            const lab = linearToOklab(
              srgbToLinear(pixels.data[i]),
              srgbToLinear(pixels.data[i + 1]),
              srgbToLinear(pixels.data[i + 2])
            );
            bead = nearest(lab, palette, all);
            cache.set(key, bead);
          }
          votes[bead] += a;
        }
      }

      if (count === 0 || alpha / count <= EMPTY_ALPHA) {
        samples.push(null);
        continue;
      }

      let best = 0;
      for (let index = 1; index < votes.length; index += 1) {
        if (votes[index] > votes[best]) best = index;
      }
      samples.push(palette[best]);
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
 * 每格換成最接近的豆子,再把色數壓到 maxColors 以下、
 * 並把用量少於 minCount 顆的顏色併掉(實際去拼時,為了一兩顆買一整包不划算)。
 *
 * 做法:每次拿掉用量最少的那一色,原本用它的格子
 * 拿「原始的取樣色」重新找最近的豆子——不是找離被拿掉那顆豆子最近的,
 * 否則一路換下去顏色會越漂越遠。不抖色,保留一格一色的味道。
 * 不管門檻多高,至少留一色。
 */
export function matchPalette(
  samples: CellSample[],
  palette: Lab[],
  maxColors: number,
  minCount = 0
): number[] {
  let allowed = palette.map((_, index) => index);
  const cells = samples.map((sample) => (sample ? nearest(sample, palette, allowed) : -1));
  const limit = Math.max(1, Math.floor(maxColors));

  for (;;) {
    const usage = new Map<number, number>();
    for (const cell of cells) {
      if (cell >= 0) usage.set(cell, (usage.get(cell) ?? 0) + 1);
    }
    if (usage.size <= 1) break;
    const fewest = Math.min(...usage.values());
    if (usage.size <= limit && fewest >= minCount) break;

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
