import type { Align, Axis, FitMode, Rect, Size } from "./types";

export type MergeOptions = {
  axis: Axis;
  align: Align;
  /** 另一個軸上的尺寸要不要統一:none 保持原樣,min 縮到最小,max 放到最大 */
  fit: FitMode;
  /** 圖與圖之間的間距(px) */
  gap: number;
};

export type MergeLayout = {
  canvas: Size;
  /** 每一張圖在畫布上的位置與(可能被縮放過的)尺寸,順序同輸入 */
  placements: Rect[];
};

/**
 * 算出拼接後的畫布尺寸與每張圖的落點。
 *
 * 只做算術、不碰 canvas,所以可以單獨測。
 * axis = "y" 時沿著 y 軸往下堆,寬度是「另一個軸」;axis = "x" 反之。
 */
export function layoutMerge(sizes: Size[], options: MergeOptions): MergeLayout {
  const valid = sizes.filter((size) => size.width > 0 && size.height > 0);
  if (valid.length === 0) return { canvas: { width: 0, height: 0 }, placements: [] };

  const gap = Math.max(0, Math.round(options.gap));
  const vertical = options.axis === "y";

  // 先決定每張圖最後的尺寸:fit 只作用在「另一個軸」,且等比縮放
  const crossOf = (size: Size) => (vertical ? size.width : size.height);
  const target = resolveCrossSize(valid.map(crossOf), options.fit);

  const scaled = valid.map((size) => {
    const cross = crossOf(size);
    const ratio = target === null || cross === 0 ? 1 : target / cross;
    return {
      width: Math.max(1, Math.round(size.width * ratio)),
      height: Math.max(1, Math.round(size.height * ratio)),
    };
  });

  const crossMax = Math.max(...scaled.map(crossOf));
  const mainTotal =
    scaled.reduce((sum, size) => sum + (vertical ? size.height : size.width), 0) +
    gap * (scaled.length - 1);

  const canvas: Size = vertical
    ? { width: crossMax, height: mainTotal }
    : { width: mainTotal, height: crossMax };

  const placements: Rect[] = [];
  let cursor = 0;

  for (const size of scaled) {
    const offset = alignOffset(crossOf(size), crossMax, options.align);

    placements.push(
      vertical
        ? { x: offset, y: cursor, width: size.width, height: size.height }
        : { x: cursor, y: offset, width: size.width, height: size.height }
    );

    cursor += (vertical ? size.height : size.width) + gap;
  }

  return { canvas, placements };
}

/** null 代表不統一,各自保留原尺寸 */
function resolveCrossSize(values: number[], fit: FitMode): number | null {
  if (fit === "none") return null;
  return fit === "min" ? Math.min(...values) : Math.max(...values);
}

function alignOffset(size: number, total: number, align: Align): number {
  if (align === "start") return 0;
  if (align === "end") return total - size;
  return Math.round((total - size) / 2);
}
