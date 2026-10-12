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

/**
 * 鎖定比例拖框:從起點拖到目前位置,框照 ratio(寬/高)長出去,
 * 方向跟著拖的方向;碰到圖片邊緣就整個等比縮小,不會變形。
 */
export function ratioRectFromPoints(origin: Point, current: Point, ratio: number, size: Size): Rect {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const signX = dx < 0 ? -1 : 1;
  const signY = dy < 0 ? -1 : 1;
  // 拖得比較遠的那個方向決定框多大
  let width = Math.max(Math.abs(dx), Math.abs(dy) * ratio);
  let height = width / ratio;
  // 朝拖曳方向最多能長多大
  const roomX = signX > 0 ? size.width - origin.x : origin.x;
  const roomY = signY > 0 ? size.height - origin.y : origin.y;
  const shrink = Math.min(1, roomX / Math.max(width, 1e-9), roomY / Math.max(height, 1e-9));
  width *= shrink;
  height *= shrink;
  const rect = {
    x: signX > 0 ? origin.x : origin.x - width,
    y: signY > 0 ? origin.y : origin.y - height,
    width,
    height,
  };
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

/** 圖片裡放得下的最大、置中的指定比例框(選了比例就先擺一個,不用自己拖) */
export function largestRatioRect(size: Size, ratio: number): Rect {
  let width = size.width;
  let height = width / ratio;
  if (height > size.height) {
    height = size.height;
    width = height * ratio;
  }
  width = Math.round(width);
  height = Math.round(height);
  return { x: Math.round((size.width - width) / 2), y: Math.round((size.height - height) / 2), width, height };
}
