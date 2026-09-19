import { sanitizeFileName } from "@/lib/download";
import type { OutputFormat } from "./types";

export const OUTPUT_FORMATS: {
  value: OutputFormat;
  label: string;
  hint: string;
}[] = [
  { value: "png", label: "PNG", hint: "無損。文字截圖、色塊遮罩用這個" },
  { value: "jpeg", label: "JPEG", hint: "照片用。不支援透明,文字邊緣會有雜訊" },
  { value: "webp", label: "WebP", hint: "同畫質下最小,但有些平台不吃" },
];

const MIME: Record<OutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const EXTENSION: Record<OutputFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

export function mimeFor(format: OutputFormat): string {
  return MIME[format];
}

export function extensionFor(format: OutputFormat): string {
  return EXTENSION[format];
}

/** PNG 是無損的,給它品質參數沒有意義 */
export function supportsQuality(format: OutputFormat): boolean {
  return format !== "png";
}

/** 這個格式存得住透明嗎?存不住就得先墊底色,不然透明會變成黑的 */
export function supportsAlpha(format: OutputFormat): boolean {
  return format !== "jpeg";
}

/** 從原始檔名去掉副檔名,當成之後所有衍生檔的名字 */
export function baseNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return sanitizeFileName(base || "圖片");
}

/** 單張不編號,多張才補 -01 -02,排序才不會跳掉 */
export function buildFileName(
  base: string,
  format: OutputFormat,
  index = 0,
  total = 1
): string {
  const name = sanitizeFileName(base || "圖片");
  const suffix =
    total > 1 ? `-${String(index + 1).padStart(String(total).length, "0")}` : "";
  return `${name}${suffix}.${extensionFor(format)}`;
}

/** 人看得懂的檔案大小 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
