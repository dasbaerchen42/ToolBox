import { getFontFamily } from "@/lib/editor-font";
import { type EditorPreferences } from "@/lib/preferences";

/** 輸出時的像素密度:1080 CSS px 會變成 2160 px 的圖 */
export const EXPORT_IMAGE_SCALE = 2;

// 瀏覽器對單張 canvas 有上限,iOS Safari 最嚴(總面積約 16.7M 裝置像素),
// 超過會直接吐出空白圖。抓保守一點,超過就自動分頁成多張。
const DEVICE_MAX_SIDE = 8192;
const DEVICE_MAX_AREA = 16_000_000;

export type ExportImageOptions = {
  /** 已經 sanitize 過的 HTML;純文字模式請先自行轉義 */
  html: string;
  /** 要不要在圖片開頭放文件標題;null 就是不放 */
  title: string | null;
  /** 檔名用的標題(跟圖片裡要不要顯示標題無關) */
  fileTitle: string;
  /** 輸出寬度(CSS px) */
  width: number;
  preferences: EditorPreferences;
};

export type ExportedImage = {
  name: string;
  blob: Blob;
};

function readThemeColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("無法產生圖片檔"));
    }, "image/png");
  });
}

/** 一頁內容區(不含留白)最多能有多高,超過就得換頁 */
function maxContentHeight(width: number, padding: number): number {
  const scale = EXPORT_IMAGE_SCALE;
  const bySide = DEVICE_MAX_SIDE / scale;
  const byArea = DEVICE_MAX_AREA / (width * scale * scale);
  return Math.max(200, Math.floor(Math.min(bySide, byArea)) - padding * 2);
}

/**
 * 盡量在區塊元素之間換頁,避免把一行字從中間切開。
 * 單一元素本身就超過一頁時只能硬切。
 */
function computePageRanges(
  content: HTMLElement,
  totalHeight: number,
  pageHeight: number
): Array<[number, number]> {
  if (totalHeight <= pageHeight) return [[0, totalHeight]];

  const contentTop = content.getBoundingClientRect().top;
  const ranges: Array<[number, number]> = [];
  let start = 0;

  for (const child of Array.from(content.children)) {
    const rect = child.getBoundingClientRect();
    const top = rect.top - contentTop;
    const bottom = rect.bottom - contentTop;

    if (bottom - start <= pageHeight) continue;

    if (top > start) {
      ranges.push([start, top]);
      start = top;
    }

    while (bottom - start > pageHeight) {
      ranges.push([start, start + pageHeight]);
      start += pageHeight;
    }
  }

  if (start < totalHeight) ranges.push([start, totalHeight]);
  return ranges;
}

/**
 * 把內容畫成 PNG。
 *
 * 刻意不截畫面上那塊預覽區:預覽會跟著視窗寬度變,手機永遠截不出 1080 寬的圖。
 * 這裡另外在畫面外組一個固定寬度的節點來截,輸出結果跟裝置無關。
 * 顏色一律讀當下主題的 CSS 變數,所以深色主題匯出就是深底淺字。
 */
export async function exportContentToImages({
  html,
  title,
  fileTitle,
  width,
  preferences,
}: ExportImageOptions): Promise<ExportedImage[]> {
  const background = readThemeColor("--paper-bg", "#ffffff");
  const color = readThemeColor("--ink-primary", "#000000");
  const padding = Math.round(width * 0.06);

  const stage = document.createElement("div");
  stage.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: -100000px",
    "z-index: -1",
    "pointer-events: none",
    `width: ${width}px`,
  ].join("; ");

  const page = document.createElement("div");
  page.style.cssText = [
    `width: ${width}px`,
    `padding: ${padding}px`,
    "box-sizing: border-box",
    `background: ${background}`,
    `color: ${color}`,
    `font-family: ${getFontFamily(preferences.fontFamily)}`,
    `font-size: ${preferences.fontSize}px`,
    `line-height: ${preferences.lineHeight}`,
    `letter-spacing: ${preferences.letterSpacing}px`,
  ].join("; ");

  // 裁切視窗:每頁把內容往上位移,只露出這一頁的範圍
  const viewport = document.createElement("div");
  viewport.style.cssText = "overflow: hidden; position: relative";

  const shift = document.createElement("div");

  const content = document.createElement("div");
  content.className = "md-preview";
  content.style.position = "relative";

  // 標題與內文都直接放在 content 底下:分頁是照 content 的直接子元素找換頁點,
  // 中間多包一層 div 的話就只剩下一個巨大的子元素可以切,會從行中間切斷。
  if (title) {
    const heading = document.createElement("div");
    heading.className = "md-preview-title";
    heading.textContent = title;
    content.appendChild(heading);
  }

  content.insertAdjacentHTML("beforeend", html);

  shift.appendChild(content);
  viewport.appendChild(shift);
  page.appendChild(viewport);
  stage.appendChild(page);
  document.body.appendChild(stage);

  try {
    // 不等字型載完就截圖,粉圓體會掉回系統字
    if (document.fonts?.ready) await document.fonts.ready;

    const totalHeight = content.getBoundingClientRect().height;
    const pageHeight = maxContentHeight(width, padding);
    const ranges = computePageRanges(content, totalHeight, pageHeight);

    const { default: html2canvas } = await import("html2canvas-pro");
    const images: ExportedImage[] = [];

    for (const [index, [start, end]] of ranges.entries()) {
      viewport.style.height = `${end - start}px`;
      shift.style.transform = `translateY(${-start}px)`;

      const canvas = await html2canvas(page, {
        scale: EXPORT_IMAGE_SCALE,
        backgroundColor: background,
        useCORS: true,
        logging: false,
        width,
        height: end - start + padding * 2,
      });

      const suffix = ranges.length > 1 ? `-${String(index + 1).padStart(2, "0")}` : "";
      images.push({
        name: `${sanitizeFileName(fileTitle)}${suffix}.png`,
        blob: await toBlob(canvas),
      });
    }

    return images;
  } finally {
    stage.remove();
  }
}

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

  for (const image of images) zip.file(image.name, image.blob);

  return {
    name: `${sanitizeFileName(fileTitle)}.zip`,
    blob: await zip.generateAsync({ type: "blob" }),
  };
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
