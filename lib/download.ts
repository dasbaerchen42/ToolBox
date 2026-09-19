/** 一個待下載的檔案:名字 + 內容 */
export type ExportedImage = {
  name: string;
  blob: Blob;
};

export function sanitizeFileName(title: string): string {
  const base = title.trim() || "未命名文件";
  return base.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
}

/** 多張圖用既有的 jszip 打包,免得一次噴出十個下載 */
export async function zipImages(
  images: ExportedImage[],
  fileTitle: string
): Promise<ExportedImage> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // 同名檔案在 zip 裡會互相覆蓋,先補序號
  const used = new Map<string, number>();
  for (const image of images) {
    const seen = used.get(image.name) ?? 0;
    used.set(image.name, seen + 1);
    const name = seen === 0 ? image.name : addSuffix(image.name, `-${seen + 1}`);
    zip.file(name, image.blob);
  }

  return {
    name: `${sanitizeFileName(fileTitle)}.zip`,
    blob: await zip.generateAsync({ type: "blob" }),
  };
}

function addSuffix(name: string, suffix: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}${suffix}`;
  return `${name.slice(0, dot)}${suffix}${name.slice(dot)}`;
}

export function downloadBlob({ name, blob }: ExportedImage): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 立刻 revoke 有機會讓瀏覽器來不及讀到檔名,延後釋放
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
