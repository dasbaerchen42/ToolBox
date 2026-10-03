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

/**
 * 一張一張下載(不打包)。中間隔一小段時間,
 * 瀏覽器才不會把連續的下載當成同一個而擋掉;第一次可能會問「允許下載多個檔案」。
 */
export async function downloadEach(images: ExportedImage[], gapMs = 500): Promise<void> {
  for (const [index, image] of images.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
    downloadBlob(image);
  }
}

let shareSupport: boolean | null = null;

/**
 * 瀏覽器能不能把圖片檔交給系統的分享選單。
 * 手機上那個選單裡就有「儲存影像」,這是網頁唯一能直接把圖放進相簿的路。
 * 桌機多半不支援,那就只顯示下載。
 */
export function canShareImages(): boolean {
  if (shareSupport !== null) return shareSupport;
  if (typeof navigator === "undefined" || typeof File === "undefined") return false;
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    shareSupport = navigator.canShare?.({ files: [probe] }) ?? false;
  } catch {
    shareSupport = false;
  }
  return shareSupport;
}

/**
 * shared:已交給系統(使用者選了存相簿或傳給誰)
 * cancelled:使用者自己把選單關掉
 * needs-tap:瀏覽器認為這次不算「使用者剛按下去」——
 *   產圖花太久,按鈕帶來的授權過期了。圖已經在手上,再按一次就會成功。
 */
export type ShareResult = "shared" | "cancelled" | "needs-tap";

export async function shareImages(images: ExportedImage[]): Promise<ShareResult> {
  const files = images.map(
    ({ name, blob }) => new File([blob], name, { type: blob.type || "image/png" })
  );
  if (!navigator.canShare?.({ files })) {
    throw new Error("這個瀏覽器無法分享這些圖片");
  }

  try {
    // 刻意不帶 title/text:有些 App 收到文字就不把它當成純圖片分享
    await navigator.share({ files });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "AbortError") return "cancelled";
      if (error.name === "NotAllowedError") return "needs-tap";
    }
    throw error;
  }
}
