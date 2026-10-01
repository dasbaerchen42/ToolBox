// 瀏覽器端:把照片畫成取樣用的小圖,交給 pattern.ts 平均。

import { ImageDecodeError } from "@/lib/tools/image/render";
import { fitRect, SAMPLES, sampleCells, type CellSample, type FitMode } from "./pattern";

/** 解碼帶 imageOrientation,手機直拍的照片才不會躺著 */
export async function decodePhoto(blob: Blob, fileName: string): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new ImageDecodeError(fileName);
  }
}

/**
 * 照片 → 每格的平均色。
 * 先讓瀏覽器把照片縮到每格 SAMPLES×SAMPLES 像素(高品質縮圖會先做一次平均),
 * 再逐格平均;換色數時只要重跑 matchPalette,不必再畫一次。
 */
export function samplePhoto(
  photo: ImageBitmap,
  cols: number,
  rows: number,
  fit: FitMode
): CellSample[] {
  const canvas = document.createElement("canvas");
  canvas.width = cols * SAMPLES;
  canvas.height = rows * SAMPLES;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立繪圖環境");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const rect = fitRect(photo.width, photo.height, cols, rows, fit);
  ctx.drawImage(
    photo,
    rect.x * SAMPLES,
    rect.y * SAMPLES,
    rect.width * SAMPLES,
    rect.height * SAMPLES
  );

  return sampleCells(ctx.getImageData(0, 0, canvas.width, canvas.height), cols, rows);
}
