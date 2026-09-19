import type { Align, Rect, Size } from "./types";

export type BorderMode = "outset" | "inset";

export type FrameLayout = {
  canvas: Size;
  /** 原圖要畫在畫布上的哪裡、畫多大 */
  draw: Rect;
};

/**
 * 描邊:outset 是往外長一圈(圖變大、內容不動),
 * inset 是把邊框壓在原本的邊緣上(圖不變大、會蓋掉最外圈的內容)。
 */
export function borderLayout(
  size: Size,
  borderWidth: number,
  mode: BorderMode
): FrameLayout {
  const width = Math.max(0, Math.round(borderWidth));

  if (mode === "inset") {
    return {
      canvas: { ...size },
      draw: { x: 0, y: 0, width: size.width, height: size.height },
    };
  }

  return {
    canvas: {
      width: size.width + width * 2,
      height: size.height + width * 2,
    },
    draw: { x: width, y: width, width: size.width, height: size.height },
  };
}

export type Ratio = { w: number; h: number };

export const RATIO_PRESETS: { label: string; ratio: Ratio }[] = [
  { label: "1:1", ratio: { w: 1, h: 1 } },
  { label: "4:5", ratio: { w: 4, h: 5 } },
  { label: "3:4", ratio: { w: 3, h: 4 } },
  { label: "16:9", ratio: { w: 16, h: 9 } },
  { label: "9:16", ratio: { w: 9, h: 16 } },
];

/**
 * 補成指定比例:只往外補背景,絕不縮放或裁切原圖。
 * 不夠的那一邊補到剛好,另一邊維持原尺寸。
 */
export function ratioLayout(
  size: Size,
  ratio: Ratio,
  align: { x: Align; y: Align }
): FrameLayout {
  if (size.width <= 0 || size.height <= 0 || ratio.w <= 0 || ratio.h <= 0) {
    return {
      canvas: { ...size },
      draw: { x: 0, y: 0, width: size.width, height: size.height },
    };
  }

  const current = size.width / size.height;
  const wanted = ratio.w / ratio.h;

  const canvas: Size =
    current < wanted
      ? { width: Math.round(size.height * wanted), height: size.height }
      : { width: size.width, height: Math.round(size.width / wanted) };

  // 四捨五入可能讓畫布比原圖小一兩個像素,補回來免得裁到邊
  canvas.width = Math.max(canvas.width, size.width);
  canvas.height = Math.max(canvas.height, size.height);

  return {
    canvas,
    draw: {
      x: offsetFor(size.width, canvas.width, align.x),
      y: offsetFor(size.height, canvas.height, align.y),
      width: size.width,
      height: size.height,
    },
  };
}

function offsetFor(size: number, total: number, align: Align): number {
  if (align === "start") return 0;
  if (align === "end") return total - size;
  return Math.round((total - size) / 2);
}
