import { getFontFamily } from "@/lib/editor-font";
import { ensureWebFont, loadableFamilies } from "@/lib/web-fonts";
import { type EditorPreferences } from "@/lib/preferences";
import {
  autoCuts,
  EXPORT_IMAGE_SCALE,
  exportLayout,
  maxContentHeight,
  pageRanges,
  spanHeight,
  type ExportLayout,
  type UnitBox,
} from "@/lib/export-layout";
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

export { autoCuts, EXPORT_IMAGE_SCALE, exportLayout, pageSizes } from "@/lib/export-layout";

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
    // 一套字一套字分開要:清單裡有一套載不到時,其他的照樣載得到
    for (const family of loadableFamilies(style.fontFamily)) {
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`;
      const entry = variants.get(font);
      if (entry) entry.text += text;
      else variants.set(font, { font, text });
    }
  }
  const results = await Promise.allSettled(Array.from(variants.values(), ({ font, text }) => doc.fonts.load(font, text)));
  // 字載不到就用備援字體截,不要讓整張圖失敗
  for (const result of results) if (result.status === "rejected") console.warn("字體載入失敗:", result.reason);
  try {
    if (doc.fonts.ready) await doc.fonts.ready;
  } catch {
    // 同上
  }
}

/**
 * 目前頁面已經載好的所有 CSS 規則,串成一段文字。
 * html2canvas 截圖時會把頁面複製到一個隱藏的 iframe,那邊的 <link> 要重新下載 CSS;
 * 手機或網路慢的時候,它常常在 CSS 到之前就截了——引用框、淡色正體、粗體全部不見,
 * 只剩瀏覽器預設的樣子。把這段文字直接塞進複製頁,就不必等網路。
 */
function collectPageCss(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) parts.push(rule.cssText);
    } catch {
      // 別的網域的樣式表讀不到規則,略過(那種本來就不歸我們管)
    }
  }
  return parts.join("\n");
}

/**
 * 分頁的最小單位就是一個頂層區塊(段落、清單、表格……),
 * 所以換頁點永遠落在區塊之間,不會從一行字中間切開。
 */
function collectUnits(content: HTMLElement): { els: HTMLElement[]; boxes: UnitBox[] } {
  const els = Array.from(content.children) as HTMLElement[];
  const top = content.getBoundingClientRect().top;
  return {
    els,
    boxes: els.map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top - top, bottom: rect.bottom - top };
    }),
  };
}

/** 轉圖用的暫存節點:固定寬度、照當下主題上色、放在畫面外。量高度與截圖都用這一份 */
function buildStage(html: string, title: string | null, width: number, preferences: EditorPreferences) {
  const layout = exportLayout(width, preferences);
  const { padding } = layout;

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
  // 另外挑了配色就把主題掛在這張紙上:主題的 CSS 變數是 [data-theme] 選擇器,掛在哪個元素都吃得到
  if (preferences.exportPalette && preferences.exportPalette !== "site") page.dataset.theme = preferences.exportPalette;
  page.style.cssText = [
    "position: relative",
    `width: ${width}px`,
    ...(layout.pageHeight ? [`height: ${layout.pageHeight}px`, "overflow: hidden"] : []),
    `padding: ${padding}px`,
    "box-sizing: border-box",
    "background: var(--paper-bg)",
    "color: var(--ink-primary)",
    `font-family: ${getFontFamily(preferences.fontFamily)}`,
    `font-size: ${layout.fontSize}px`,
    `line-height: ${layout.lineHeight}`,
    `letter-spacing: ${layout.letterSpacing}px`,
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

  // 頁碼與署名:放在下方留白裡,不佔內容的位置
  const footer = buildFooter(layout, preferences);
  if (footer) page.appendChild(footer.el);

  stage.appendChild(page);
  document.body.appendChild(stage);
  const colors = getComputedStyle(page);
  const background = colors.getPropertyValue("--paper-bg").trim() || readThemeColor("--paper-bg", "#ffffff");
  return { stage, page, viewport, shift, content, background, padding, layout, footer };
}

/** 頁碼、署名那一列(兩個都沒開就是 null) */
function buildFooter(layout: ExportLayout, preferences: EditorPreferences) {
  const signature = preferences.exportSignature?.trim() ?? "";
  if (!signature && !preferences.exportPageNumbers) return null;
  const el = document.createElement("div");
  el.style.cssText = [
    "position: absolute",
    `left: ${layout.padding}px`,
    `right: ${layout.padding}px`,
    `bottom: ${layout.footerBottom}px`,
    "display: flex",
    "justify-content: space-between",
    "gap: 1em",
    `font-size: ${layout.footerSize}px`,
    "line-height: 1.4",
    "letter-spacing: 0.05em",
    "color: var(--ink-tertiary)",
  ].join("; ");
  const left = document.createElement("span");
  left.textContent = signature;
  const number = document.createElement("span");
  el.append(left, number);
  return {
    el,
    /** 換到第 n 張(共 total 張);只有一張時不標頁碼 */
    set(n: number, total: number) {
      number.textContent = preferences.exportPageNumbers && total > 1 ? `${n} / ${total}` : "";
    },
  };
}

export type ExportMeasure = { units: UnitBox[]; padding: number; maxHeight: number; layout: ExportLayout };

/**
 * 只量不截:照轉圖時一模一樣的排版,量出每個區塊的上下緣(含標題時標題是第 0 個)。
 * 轉圖視窗用它預告每一張切出來多長、會不會太長。
 */
export async function measureExport({
  html,
  title,
  width,
  preferences,
}: Pick<ExportImageOptions, "html" | "title" | "width" | "preferences">): Promise<ExportMeasure> {
  const { stage, page, content, padding, layout } = buildStage(html, title, width, preferences);
  try {
    await ensureWebFont(preferences.fontFamily);
    await loadFontsFor(page);
    return { units: collectUnits(content).boxes, padding, maxHeight: maxContentHeight(width, padding, layout.pageHeight), layout };
  } finally {
    stage.remove();
  }
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
  const { stage, page, viewport, shift, content, background, padding, layout, footer } = buildStage(html, title, width, preferences);

  /**
   * 截一張。height 給了才是「在區塊內硬切」:只截 start 起的那一段。
   * 一般的一頁不設高度,讓 html2canvas 照它複製出來那份文件實際排出來的高度截——
   * 先量好高度再截的話,複製文件裡字型晚一步載入、換行多一行,最後幾行就會被切掉。
   */
  const pageCss = collectPageCss();
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
      ...(height === null ? {} : { height: layout.pageHeight ?? height + padding * 2 }),
      // html2canvas 在另一份複製的文件裡排版,那邊的網路字型要自己再等一次
      onclone: async (clonedDoc: Document) => {
        // 樣式直接內嵌,不等複製頁自己去下載 CSS
        const style = clonedDoc.createElement("style");
        style.textContent = pageCss;
        clonedDoc.head.appendChild(style);
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

    const maxHeight = maxContentHeight(width, padding, layout.pageHeight);
    const { els, boxes } = collectUnits(content);

    if (els.length === 0) {
      footer?.set(1, 1);
      const canvas = await capture(0, null);
      return [{ name: `${sanitizeFileName(fileTitle)}.png`, blob: await toBlob(canvas) }];
    }

    if (paginate === "none" && spanHeight(boxes, 0, boxes.length - 1) > maxHeight) {
      throw new ExportTooLongError(Math.round(spanHeight(boxes, 0, boxes.length - 1)), maxHeight);
    }

    const ranges =
      paginate === "none"
        ? [[0, els.length - 1] as [number, number]]
        : pageRanges(els.length, paginate === "manual" ? (cuts ?? new Set<number>()) : autoCuts(boxes, maxHeight));

    const images: ExportedImage[] = [];
    // 頁碼要先知道總共幾張:自動分頁時太長的那張會在段落中間再切開
    const slicesOf = ([from, to]: [number, number]) =>
      paginate === "auto" ? Math.max(1, Math.ceil(spanHeight(boxes, from, to) / maxHeight)) : 1;
    const total = ranges.reduce((sum, range) => sum + slicesOf(range), 0);
    const shoot = async (start: number, height: number | null) => {
      footer?.set(images.length + 1, total);
      const canvas = await capture(start, height);
      images.push({ name: "", blob: await toBlob(canvas) });
    };

    for (const [index, [from, to]] of ranges.entries()) {
      // 只留這一張的區塊,其餘 display:none。被藏起來的完全不佔空間,
      // 所以每一張的高度就是它自己內容的高度。第一段不留上外距、最後一段不留下外距,
      // 上下留白才會一樣寬(預覽也是這樣排的)。
      els.forEach((el, i) => {
        el.style.display = i >= from && i <= to ? "" : "none";
        el.style.marginTop = i === from ? "0" : "";
        el.style.marginBottom = i === to ? "0" : "";
      });

      const height = content.getBoundingClientRect().height;

      if (height > maxHeight) {
        // 手動分頁時使用者切得不夠細,直接說是第幾張太長
        if (paginate === "manual") {
          throw new ExportPageTooLongError(index + 1, Math.round(height), maxHeight);
        }
        // 自動分頁遇到「單一區塊自己就超過一頁」,只能在區塊內硬切
        for (let offset = 0; offset < height; offset += maxHeight) {
          await shoot(offset, Math.min(maxHeight, height - offset));
        }
        continue;
      }

      await shoot(0, null);
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
