// 自由拼的編輯操作:畫筆、橡皮擦、油漆桶、對稱。全部是純函式,
// 輸入一份 cells 回傳新的一份(沒變就回傳原本那份,呼叫端才好判斷要不要記一步復原)。

import type { BeadPattern } from "./pattern";

/** 對稱模式:左右鏡像、上下鏡像、或兩個方向一起(畫一角長出四角) */
export type Symmetry = "none" | "x" | "y" | "both";

/** 一個格子在對稱模式下會連帶影響哪些格子(含自己,不重複) */
export function mirrorIndices(
  index: number,
  cols: number,
  rows: number,
  symmetry: Symmetry
): number[] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const mirrorCol = cols - 1 - col;
  const mirrorRow = rows - 1 - row;

  const result = new Set([index]);
  if (symmetry === "x" || symmetry === "both") result.add(row * cols + mirrorCol);
  if (symmetry === "y" || symmetry === "both") result.add(mirrorRow * cols + col);
  if (symmetry === "both") result.add(mirrorRow * cols + mirrorCol);
  return [...result];
}

/**
 * 兩格之間經過哪些格子(Bresenham)。
 * 拖得快的時候 pointermove 會跳格,不補中間的格子線就會斷成虛線。
 */
export function lineBetween(from: number, to: number, cols: number): number[] {
  let x0 = from % cols;
  let y0 = Math.floor(from / cols);
  const x1 = to % cols;
  const y1 = Math.floor(to / cols);

  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  const cells: number[] = [];

  for (;;) {
    cells.push(y0 * cols + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y0 += sy;
    }
  }

  return cells;
}

/** 把這些格子(連同對稱的格子)塗成 color;-1 就是橡皮擦 */
export function paint(
  pattern: BeadPattern,
  indexes: number[],
  color: number,
  symmetry: Symmetry
): number[] {
  const { cols, rows, cells } = pattern;
  let next: number[] | null = null;

  for (const index of indexes) {
    if (index < 0 || index >= cells.length) continue;
    for (const target of mirrorIndices(index, cols, rows, symmetry)) {
      if ((next ?? cells)[target] === color) continue;
      next ??= [...cells];
      next[target] = color;
    }
  }

  return next ?? cells;
}

/**
 * 油漆桶:從起點往上下左右擴散,同一個顏色(或同樣是空格)的相連區塊整片換掉。
 * 對稱模式下,鏡像位置也各自倒一次。
 */
export function floodFill(
  pattern: BeadPattern,
  start: number,
  color: number,
  symmetry: Symmetry
): number[] {
  const { cols, rows } = pattern;
  let cells = pattern.cells;

  for (const origin of mirrorIndices(start, cols, rows, symmetry)) {
    const target = cells[origin];
    if (target === undefined || target === color) continue;

    const next = [...cells];
    const stack = [origin];
    next[origin] = color;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      const col = index % cols;
      const neighbours = [
        col > 0 ? index - 1 : -1,
        col < cols - 1 ? index + 1 : -1,
        index - cols,
        index + cols,
      ];
      for (const n of neighbours) {
        if (n < 0 || n >= next.length || next[n] !== target) continue;
        next[n] = color;
        stack.push(n);
      }
    }

    cells = next;
  }

  return cells;
}

/** 某個顏色全部換掉(清掉背景、或之後的換色) */
export function replaceColor(cells: number[], from: number, to: number): number[] {
  return cells.includes(from) ? cells.map((cell) => (cell === from ? to : cell)) : cells;
}

export function blankPattern(cols: number, rows: number): BeadPattern {
  return { cols, rows, cells: Array(cols * rows).fill(-1) };
}
