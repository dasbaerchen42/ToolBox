// 瀏覽器端:把照片畫成取樣用的小圖,交給 pattern.ts 決定每格的顏色。

import { ImageDecodeError } from "@/lib/tools/image/render";
import type { Lab } from "./color";
import {
  fitRect,
  MAJORITY_SAMPLES,
  SAMPLES,
  sampleCells,
  sampleMajority,
  type CellSample,
  type FitMode,
  type SampleMethod,
} from "./pattern";

/** 解碼帶 imageOrientation,手機直拍的照片才不會躺著 */
export async function decodePhoto(blob: Blob, fileName: string): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new ImageDecodeError(fileName);
  }
}

/**
 * 照片 → 每格的取樣色(平均或主色)。
 * 先讓瀏覽器把照片縮到每格 N×N 像素,再逐格處理;
 * 換色數時只要重跑 matchPalette,不必再畫一次。
 */
export function samplePhoto(
  photo: ImageBitmap,
  cols: number,
  rows: number,
  fit: FitMode,
  method: SampleMethod,
  palette: Lab[]
): CellSample[] {
  const per = method === "majority" ? MAJORITY_SAMPLES : SAMPLES;
  const canvas = document.createElement("canvas");
  canvas.width = cols * per;
  canvas.height = rows * per;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立繪圖環境");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const rect = fitRect(photo.width, photo.height, cols, rows, fit);
  ctx.drawImage(photo, rect.x * per, rect.y * per, rect.width * per, rect.height * per);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return method === "majority"
    ? sampleMajority(pixels, cols, rows, palette)
    : sampleCells(pixels, cols, rows);
}
