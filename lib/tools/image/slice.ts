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

/**
 * 照比例切時每一段要多長:另一邊(寬或高)整個保留,沿著下刀方向照比例算。
 * 橫刀(分上下)時一段的高 = 寬 × h/w;直刀(分左右)時一段的寬 = 高 × w/h。
 */
export function ratioPieceLength(size: Size, axis: Axis, ratio: { w: number; h: number }): number {
  if (ratio.w <= 0 || ratio.h <= 0) return 0;
  const length = axis === "y" ? (size.width * ratio.h) / ratio.w : (size.height * ratio.w) / ratio.h;
  return Math.max(1, Math.round(length));
}

/**
 * 比例切:每隔一段長度下一刀,最後剩多少就是多少(要不要補滿由呼叫端決定)。
 * 整張還不到一段長就不下刀。
 */
export function ratioCutPositions(total: number, pieceLength: number): number[] {
  const step = Math.round(pieceLength);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(step) || step < 1) return [];

  const cuts: number[] = [];
  for (let position = step; position < total; position += step) cuts.push(position);
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
