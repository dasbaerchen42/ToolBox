import { getFontFamily } from "@/lib/editor-font";
import { ensureWebFont } from "@/lib/web-fonts";
import { type EditorPreferences } from "@/lib/preferences";
import { DEVICE_MAX_AREA, DEVICE_MAX_SIDE } from "@/lib/canvas-limits";
import {
  downloadBlob,
  sanitizeFileName,
  zipImages,
  type ExportedImage,
} from "@/lib/download";

// 這三個原本住在這裡,影像工作檯也要用,搬去 lib/download 後從這裡轉出,
// 既有的匯入路徑就不用動。
export { downloadBlob, sanitizeFileName, zipImages };
export type { ExportedImage };

/** 輸出時的像素密度:1080 CSS px 會變成 2160 px 的圖 */
export const EXPORT_IMAGE_SCALE = 2;

export type PaginateMode = "auto" | "manual" | "none";

/** 「一律單張」但內容放不下時丟這個,UI 才知道要提示改用分頁 */
export class ExportTooLongError extends Error {
  constructor(readonly contentHeight: number, readonly maxHeight: number) {
    super("內容太長,超過瀏覽器單張圖片的上限");
    this.name = "ExportTooLongError";
  }
}

/** 手動分頁時某一張自己就超過上限,要使用者再切一刀 */
export class ExportPageTooLongError extends Error {
  constructor(
    readonly pageIndex: number,
    readonly pageHeight: number,
    readonly maxHeight: number
  ) {
    super("某一張太長");
    this.name = "ExportPageTooLongError";
  }
}

export type ExportImageOptions = {
  /** 已經 sanitize 過的 HTML;純文字模式請先自行轉義 */
  html: string;
  /** 要不要在圖片開頭放文件標題;null 就是不放 */
  title: string | null;
  /** 檔名用的標題(跟圖片裡要不要顯示標題無關) */
  fileTitle: string;
  /** 輸出寬度(CSS px) */
  width: number;
  /** auto: 太長就自動分頁;manual: 只在 cuts 指定的地方切;none: 一律單張 */
  paginate: PaginateMode;
  /** 手動分頁時,要在第幾個區塊之後切開(含標題時標題算第 0 個) */
  cuts?: Set<number>;
  preferences: EditorPreferences;
};

/** 內容區要加的 class(例如斜體改淡色正體) */
export function contentClassFor(preferences: Pick<EditorPreferences, "softItalic">): string {
  return preferences.softItalic ? "md-preview md-soft-italic" : "md-preview";
}

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

/**
 * 中文網路字體被切成上百片,瀏覽器要等真的排版到那些字才開始抓。
 * 剛選的字體、剛插進畫面外的節點,document.fonts.ready 可能在抓之前就 resolve 了,
 * 只等它會截到系統字。這裡直接要求載入「這段內容會用到的字」(一般與粗體各一次)。
 */
async function loadFontsFor(page: HTMLElement, doc: Document = document): Promise<void> {
  if (!doc.fonts?.load) return;
  const view = doc.defaultView ?? window;
  if (!(page.textContent ?? "").trim()) return;

  // 每種「粗細＋斜不斜＋字體」各要一次,只帶真的用到那種樣式的字:
  // 粗體、淡色正體的對白(600)是另一組字檔,不要整篇都多下載一倍,也不能漏掉
  const variants = new Map<string, { font: string; text: string }>();
  const walker = doc.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    const parent = node.parentElement;
    if (!parent || !text.trim()) continue;
    const style = view.getComputedStyle(parent);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const entry = variants.get(font);
    if (entry) entry.text += text;
    else variants.set(font, { font, text });
  }
  try {
    await Promise.all(Array.from(variants.values(), ({ font, text }) => doc.fonts.load(font, text)));
    if (doc.fonts.ready) await doc.fonts.ready;
  } catch (error) {
    // 字載不到就用備援字體截,不要讓整張圖失敗
    console.warn("字體載入失敗:", error);
  }
}

/** 一頁內容區(不含留白)最多能有多高,超過就得換頁 */
function maxContentHeight(width: number, padding: number): number {
  const scale = EXPORT_IMAGE_SCALE;
  const bySide = DEVICE_MAX_SIDE / scale;
  const byArea = DEVICE_MAX_AREA / (width * scale * scale);
  return Math.max(200, Math.floor(Math.min(bySide, byArea)) - padding * 2);
}

/**
 * 分頁的最小單位就是一個頂層區塊(段落、清單、表格……),
 * 所以換頁點永遠落在區塊之間,不會從一行字中間切開。
 */
type Unit = { el: HTMLElement; index: number; height: number };

function collectUnits(content: HTMLElement): Unit[] {
  const els = Array.from(content.children) as HTMLElement[];
  if (els.length === 0) return [];

  const contentRect = content.getBoundingClientRect();
  const tops = els.map((el) => el.getBoundingClientRect().top - contentRect.top);

  return els.map((el, i) => ({
    el,
    index: i,
    // 用下一個單元的起點當這個單元的終點,中間的間距才不會被算丟
    height: (i + 1 < tops.length ? tops[i + 1] : contentRect.height) - tops[i],
  }));
}

/** 自動分頁:照順序塞,塞不下就換一張 */
function packUnits(units: Unit[], pageHeight: number): Unit[][] {
  const pages: Unit[][] = [];
  let current: Unit[] = [];
  let used = 0;

  for (const unit of units) {
    if (current.length > 0 && used + unit.height > pageHeight) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(unit);
    used += unit.height;
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

/** 手動分頁:在使用者點過的區塊之後切開 */
function splitUnitsAt(units: Unit[], cuts: Set<number>): Unit[][] {
  const pages: Unit[][] = [];
  let current: Unit[] = [];

  for (const unit of units) {
    current.push(unit);
    if (cuts.has(unit.index)) {
      pages.push(current);
      current = [];
    }
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

/**
 * 把內容畫成 PNG。
 *
 * 刻意不截畫面上那塊預覽區:預覽會跟著視窗寬度變,手機永遠截不出 1080 寬的圖。
 * 這裡另外在畫面外組一個固定寬度的節點來截,輸出結果跟裝置無關。
 * 顏色一律讀當下主題的 CSS 變數,所以深色主題匯出就是深底淺字。
 *
 * 每一張是把不屬於這張的區塊 display:none 之後整塊截圖,而不是把長圖裁開,
 * 所以邊界永遠是完整的區塊。
 */
export async function exportContentToImages({
  html,
  title,
  fileTitle,
  width,
  paginate,
  cuts,
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
  page.dataset.exportPage = "";
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
    // 新版 Chrome 會把相鄰的全形標點(「。「」)擠成半格,html2canvas 量到的寬度變 0,
    // 那個「就整個不見。轉圖時關掉擠壓,每個標點都是完整一格
    "text-spacing-trim: space-all",
  ].join("; ");

  // 裁切視窗:單一區塊本身就超過一頁時,只能在它內部硬切
  const viewport = document.createElement("div");
  viewport.style.cssText = "overflow: hidden; position: relative";

  const shift = document.createElement("div");

  const content = document.createElement("div");
  content.className = contentClassFor(preferences);
  content.style.position = "relative";

  // 標題與內文都直接放在 content 底下:分頁是照 content 的直接子元素切,
  // 中間多包一層 div 的話就只剩下一個巨大的子元素可以切。
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

  /**
   * 截一張。height 給了才是「在區塊內硬切」:只截 start 起的那一段。
   * 一般的一頁不設高度,讓 html2canvas 照它複製出來那份文件實際排出來的高度截——
   * 先量好高度再截的話,複製文件裡字型晚一步載入、換行多一行,最後幾行就會被切掉。
   */
  const capture = async (start: number, height: number | null) => {
    viewport.style.height = height === null ? "" : `${height}px`;
    shift.style.transform = start ? `translateY(${-start}px)` : "";
    const { default: html2canvas } = await import("html2canvas-pro");
    return html2canvas(page, {
      scale: EXPORT_IMAGE_SCALE,
      backgroundColor: background,
      useCORS: true,
      logging: false,
      width,
      ...(height === null ? {} : { height: height + padding * 2 }),
      // html2canvas 在另一份複製的文件裡排版,那邊的網路字型要自己再等一次
      onclone: async (clonedDoc: Document) => {
        const clonedPage = clonedDoc.body.querySelector<HTMLElement>("[data-export-page]");
        if (clonedPage) await loadFontsFor(clonedPage, clonedDoc);
      },
    });
  };

  try {
    // 不等字型載完就截圖,粉圓體會掉回系統字
    await ensureWebFont(preferences.fontFamily);
    await loadFontsFor(page);
    if (document.fonts?.ready) await document.fonts.ready;

    const maxHeight = maxContentHeight(width, padding);
    const units = collectUnits(content);
    const totalHeight = content.getBoundingClientRect().height;

    if (paginate === "none" && totalHeight > maxHeight) {
      throw new ExportTooLongError(Math.round(totalHeight), maxHeight);
    }

    let pages: Unit[][];
    if (paginate === "none" || units.length === 0) {
      pages = units.length > 0 ? [units] : [];
    } else if (paginate === "manual") {
      pages = splitUnitsAt(units, cuts ?? new Set<number>());
    } else {
      pages = packUnits(units, maxHeight);
    }

    if (pages.length === 0) {
      const canvas = await capture(0, null);
      return [{ name: `${sanitizeFileName(fileTitle)}.png`, blob: await toBlob(canvas) }];
    }

    const images: ExportedImage[] = [];
    const allUnits = units.map((unit) => unit.el);

    for (const [index, pageUnits] of pages.entries()) {
      // 只留這一頁的區塊,其餘 display:none。被藏起來的完全不佔空間,
      // 所以每一張的高度就是它自己內容的高度。
      const keep = new Set(pageUnits.map((unit) => unit.el));
      for (const el of allUnits) el.style.display = keep.has(el) ? "" : "none";

      const height = content.getBoundingClientRect().height;

      if (height > maxHeight) {
        // 手動分頁時使用者切得不夠細,直接說是第幾張太長
        if (paginate === "manual") {
          throw new ExportPageTooLongError(index + 1, Math.round(height), maxHeight);
        }
        // 自動分頁遇到「單一區塊自己就超過一頁」,只能在區塊內硬切
        for (let offset = 0; offset < height; offset += maxHeight) {
          const slice = Math.min(maxHeight, height - offset);
          const canvas = await capture(offset, slice);
          images.push({ name: "", blob: await toBlob(canvas) });
        }
        continue;
      }

      const canvas = await capture(0, null);
      images.push({ name: "", blob: await toBlob(canvas) });
    }

    // 檔名等全部產生完才編號,中途硬切多出來的張數才數得對
    return images.map((image, index) => ({
      ...image,
      name: `${sanitizeFileName(fileTitle)}${
        images.length > 1 ? `-${String(index + 1).padStart(2, "0")}` : ""
      }.png`,
    }));
  } finally {
    stage.remove();
  }
}
