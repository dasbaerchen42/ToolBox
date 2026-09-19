import type { Axis, Rect, Size } from "./types";

/** 沿著某個軸切出來的一段 */
export type Span = { start: number; size: number };

/**
 * 等分切:回傳切點位置(不含 0 與 total)。
 * parts 是要切成幾份,所以刀數是 parts - 1。
 */
export function equalCutPositions(total: number, parts: number): number[] {
  const count = Math.floor(parts);
  if (!Number.isFinite(total) || total <= 0 || count < 2) return [];

  // 除不盡時餘數平均分給前面幾段,不會出現「最後一段只剩 1px」
  const base = Math.floor(total / count);
  if (base < 1) return [];

  const remainder = total % count;
  const cuts: number[] = [];
  let position = 0;

  for (let i = 0; i < count - 1; i += 1) {
    position += base + (i < remainder ? 1 : 0);
    cuts.push(position);
  }

  return cuts;
}

/** 排序、去重、丟掉落在範圍外或會切出 0px 的刀 */
export function normalizeCuts(cuts: number[], total: number): number[] {
  const seen = new Set<number>();

  for (const raw of cuts) {
    const value = Math.round(raw);
    if (!Number.isFinite(value) || value <= 0 || value >= total) continue;
    seen.add(value);
  }

  return [...seen].sort((a, b) => a - b);
}

/** 切點 → 每一段的起點與長度 */
export function cutsToSpans(cuts: number[], total: number): Span[] {
  if (!Number.isFinite(total) || total <= 0) return [];

  const positions = normalizeCuts(cuts, total);
  const spans: Span[] = [];
  let start = 0;

  for (const cut of positions) {
    spans.push({ start, size: cut - start });
    start = cut;
  }

  spans.push({ start, size: total - start });
  return spans;
}

/** 一段 → 要從原圖裁下來的矩形 */
export function spanToRect(span: Span, axis: Axis, size: Size): Rect {
  if (axis === "y") {
    return { x: 0, y: span.start, width: size.width, height: span.size };
  }
  return { x: span.start, y: 0, width: span.size, height: size.height };
}

/** 切成幾段(給 UI 顯示用,不必真的算出每一段) */
export function countPieces(cuts: number[], total: number): number {
  return normalizeCuts(cuts, total).length + 1;
}
