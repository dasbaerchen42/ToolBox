// 板子形狀:方形以外,現實中還有圓形、六角形、愛心形的拼豆板。
//
// 格子還是方格排列,只是外形以外的格子沒有柱子(不能放豆子)。
// 外形用 -1–1 的正規化座標描述,判斷一格在不在板子上看的是格子中心;
// 畫板子時用同一個外形,所以看到的柱子跟能放豆子的格子一定一致。

import type { BeadPattern } from "./pattern";

export type BoardOutline = "rect" | "circle" | "hexagon" | "heart";

export const OUTLINES: { value: BoardOutline; label: string }[] = [
  { value: "rect", label: "方形" },
  { value: "circle", label: "圓形" },
  { value: "hexagon", label: "六角形" },
  { value: "heart", label: "愛心形" },
];

export function isOutline(value: unknown): value is BoardOutline {
  return value === "rect" || value === "circle" || value === "hexagon" || value === "heart";
}

type Point = { x: number; y: number };

/** 平頂的正六角形:左右兩個尖角碰到邊,上下留一點 */
const HEXAGON: Point[] = [0, 1, 2, 3, 4, 5].map((k) => ({
  x: Math.cos((k * Math.PI) / 3),
  y: Math.sin((k * Math.PI) / 3),
}));

/** 愛心:經典的參數式愛心曲線,縮放到 -1–1,尖端朝下 */
const HEART: Point[] = Array.from({ length: 160 }, (_, i) => {
  const t = (i / 160) * Math.PI * 2;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  // x 在 ±16、y 在 -17–12 之間;y 翻過來讓尖端在下
  return { x: (x / 16) * 0.98, y: (-(y + 2.5) / 14.5) * 0.98 };
});

/** 外形的多邊形(正規化座標);方形與圓形不用多邊形 */
export function outlinePolygon(outline: BoardOutline): Point[] | null {
  if (outline === "hexagon") return HEXAGON;
  if (outline === "heart") return HEART;
  return null;
}

function insidePolygon(points: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** (x, y) 是正規化座標:板子左上 (-1,-1)、右下 (1,1) */
export function outlineContains(outline: BoardOutline, x: number, y: number): boolean {
  if (outline === "rect") return Math.abs(x) <= 1 && Math.abs(y) <= 1;
  if (outline === "circle") return x * x + y * y <= 1;
  return insidePolygon(outlinePolygon(outline) as Point[], x, y);
}

const masks = new Map<string, Uint8Array>();

/**
 * 每一格有沒有柱子(1 = 有)。方形板子回傳 null,代表全部都有。
 * 同樣的外形與尺寸只算一次。
 */
export function boardMask(outline: BoardOutline | undefined, cols: number, rows: number): Uint8Array | null {
  if (!outline || outline === "rect") return null;
  const key = `${outline}:${cols}x${rows}`;
  const cached = masks.get(key);
  if (cached) return cached;
  const mask = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = ((col + 0.5) / cols) * 2 - 1;
      const y = ((row + 0.5) / rows) * 2 - 1;
      mask[row * cols + col] = outlineContains(outline, x, y) ? 1 : 0;
    }
  }
  masks.set(key, mask);
  return mask;
}

/** 這一格在不在板子上 */
export function onBoard(pattern: Pick<BeadPattern, "cols" | "rows" | "outline">, index: number): boolean {
  const mask = boardMask(pattern.outline, pattern.cols, pattern.rows);
  return !mask || mask[index] === 1;
}

/**
 * 把板子外面的格子清成空格(材質也歸零)。
 * 編輯、照片轉換之後都過一次,油漆桶倒出界也不會留下豆子。
 * 沒有東西要清時回傳原本的陣列,方便比對有沒有變。
 */
export function clipToOutline(
  pattern: Pick<BeadPattern, "cols" | "rows" | "outline">,
  cells: number[],
  materials?: number[]
): { cells: number[]; materials?: number[] } {
  const mask = boardMask(pattern.outline, pattern.cols, pattern.rows);
  if (!mask) return { cells, materials };
  const needs = cells.some((cell, i) => cell >= 0 && mask[i] === 0);
  const materialNeeds = materials?.some((m, i) => m !== 0 && mask[i] === 0) ?? false;
  return {
    cells: needs ? cells.map((cell, i) => (mask[i] ? cell : -1)) : cells,
    materials: materialNeeds && materials ? materials.map((m, i) => (mask[i] ? m : 0)) : materials,
  };
}

/** 在 (x, y, width, height) 的範圍裡畫出外形的路徑(畫板子的底用) */
export function outlinePath(
  ctx: CanvasRenderingContext2D,
  outline: BoardOutline,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.beginPath();
  if (outline === "rect") {
    ctx.rect(x, y, width, height);
    return;
  }
  if (outline === "circle") {
    ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
    return;
  }
  const points = outlinePolygon(outline) as Point[];
  points.forEach((p, i) => {
    const px = cx + (p.x * width) / 2;
    const py = cy + (p.y * height) / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}
