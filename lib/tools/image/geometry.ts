import type { Point, Rect, Size } from "./types";

/**
 * 把畫面上的點換算成原圖像素座標。
 *
 * 這是整個工具最容易出錯的一步:顯示用的圖會被縮放去配合視窗寬度,
 * 但遮罩、刀線、裁切框全部都必須存成原圖座標,否則輸出成原解析度時位置會歪。
 * 所有 pointer 事件都只能經由這裡進來。
 */
export function toImagePoint(
  point: Point,
  displaySize: Size,
  imageSize: Size
): Point {
  if (displaySize.width <= 0 || displaySize.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: (point.x / displaySize.width) * imageSize.width,
    y: (point.y / displaySize.height) * imageSize.height,
  };
}

/** 反方向:原圖座標 → 顯示比例(0–1),給 CSS 百分比定位用 */
export function toDisplayRatio(value: number, total: number): number {
  if (total <= 0) return 0;
  return value / total;
}

/** 兩個對角點 → 正規化矩形(寬高永遠是正的) */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** 把矩形壓回圖片範圍內,並取整數像素 */
export function clampRect(rect: Rect, size: Size): Rect {
  const left = Math.round(Math.min(Math.max(rect.x, 0), size.width));
  const top = Math.round(Math.min(Math.max(rect.y, 0), size.height));
  const right = Math.round(
    Math.min(Math.max(rect.x + rect.width, 0), size.width)
  );
  const bottom = Math.round(
    Math.min(Math.max(rect.y + rect.height, 0), size.height)
  );

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/** 太小的框多半是手滑點到,不該變成遮罩 */
export function isUsableRect(rect: Rect, minSize = 2): boolean {
  return rect.width >= minSize && rect.height >= minSize;
}

export function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** 把矩形整個平移,並確保不會被推出圖外(維持原寬高) */
export function moveRectWithin(rect: Rect, delta: Point, size: Size): Rect {
  const maxX = Math.max(0, size.width - rect.width);
  const maxY = Math.max(0, size.height - rect.height);

  return {
    ...rect,
    x: Math.round(Math.min(Math.max(rect.x + delta.x, 0), maxX)),
    y: Math.round(Math.min(Math.max(rect.y + delta.y, 0), maxY)),
  };
}
