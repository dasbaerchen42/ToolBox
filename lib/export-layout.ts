// 文轉圖的排版與分頁計算(純函式,不碰 DOM,才能測)。
// 轉圖視窗的預覽與真正的轉圖共用這一份,兩邊才會一模一樣。

import { DEVICE_MAX_AREA, DEVICE_MAX_SIDE } from "@/lib/canvas-limits";
import type { EditorPreferences } from "@/lib/preferences";
import { blend, deriveVars } from "@/lib/theme-core";

/** 輸出時的像素密度:1080 CSS px 會變成 2160 px 的圖 */
export const EXPORT_IMAGE_SCALE = 2;

/** 圖片上的字級。用「一行大約幾個字」定義,換寬度只是換解析度,版面比例不變 */
export type ExportTextSize = "s" | "m" | "l" | "xl";

export const EXPORT_TEXT_SIZES: Record<ExportTextSize, { label: string; perLine: number }> = {
  s: { label: "小字", perLine: 30 },
  m: { label: "中字", perLine: 24 },
  l: { label: "大字", perLine: 20 },
  xl: { label: "特大", perLine: 16 },
};

/** 每張圖的比例(高/寬);free 是照內容多長就多長 */
export type ExportRatio = "free" | "1:1" | "4:5" | "3:4" | "9:16";

export const EXPORT_RATIOS: Record<ExportRatio, { label: string; ratio: number | null }> = {
  free: { label: "照內容長度", ratio: null },
  "1:1": { label: "1:1 方形", ratio: 1 },
  "4:5": { label: "4:5 IG 貼文", ratio: 5 / 4 },
  "3:4": { label: "3:4 直式", ratio: 4 / 3 },
  "9:16": { label: "9:16 限動", ratio: 16 / 9 },
};

/** 四周留白佔寬度的比例 */
export type ExportMargin = "narrow" | "normal" | "wide";

export const EXPORT_MARGINS: Record<ExportMargin, { label: string; ratio: number }> = {
  narrow: { label: "留白窄", ratio: 0.04 },
  normal: { label: "留白標準", ratio: 0.06 },
  wide: { label: "留白寬", ratio: 0.09 },
};

export type ExportLayout = {
  width: number;
  padding: number;
  contentWidth: number;
  /** 字級(CSS px,輸出時再乘 EXPORT_IMAGE_SCALE) */
  fontSize: number;
  /** 字距(CSS px) */
  letterSpacing: number;
  lineHeight: number;
  /** 固定比例時每張的高度(CSS px);照內容長度時是 null */
  pageHeight: number | null;
  /** 頁碼、署名的字級與離底邊的距離(放在下方留白裡,不佔內容的位置) */
  footerSize: number;
  footerBottom: number;
};

/**
 * 圖片的排版。字級不沿用編輯器的 16px:1080 寬的圖放到手機上看會縮成三分之一,
 * 字只剩 6px。改成照「一行幾個字」反推字級,圖在手機上看起來就跟一般文章差不多大。
 * 字距沿用編輯器設定,換成跟字級的比例。
 */
export function exportLayout(
  width: number,
  preferences: Pick<EditorPreferences, "fontSize" | "letterSpacing" | "lineHeight" | "exportTextSize"> &
    Partial<Pick<EditorPreferences, "exportRatio" | "exportMargin">>
): ExportLayout {
  const padding = Math.round(width * (EXPORT_MARGINS[preferences.exportMargin ?? "normal"] ?? EXPORT_MARGINS.normal).ratio);
  const contentWidth = width - padding * 2;
  const perLine = (EXPORT_TEXT_SIZES[preferences.exportTextSize] ?? EXPORT_TEXT_SIZES.m).perLine;
  const spacingEm = preferences.fontSize > 0 ? preferences.letterSpacing / preferences.fontSize : 0;
  // 中文一個字一個 em,再加字距;留 0.3 個字的餘裕,剛好滿行時才不會被擠到下一行
  const fontSize = Math.floor((contentWidth / ((perLine + 0.3) * (1 + spacingEm))) * 10) / 10;
  return {
    width,
    padding,
    contentWidth,
    fontSize,
    letterSpacing: Math.round(fontSize * spacingEm * 100) / 100,
    lineHeight: preferences.lineHeight,
    pageHeight: ratioHeight(width, preferences.exportRatio ?? "free"),
    footerSize: Math.max(11, Math.round(fontSize * 0.5)),
    footerBottom: Math.round(padding * 0.3),
  };
}

function ratioHeight(width: number, ratio: ExportRatio): number | null {
  const value = EXPORT_RATIOS[ratio]?.ratio;
  return value ? Math.round(width * value) : null;
}

/** 一頁內容區(不含留白)最多能有多高,超過就得換頁;固定比例時就是那個比例扣掉留白 */
export function maxContentHeight(width: number, padding: number, pageHeight: number | null = null): number {
  if (pageHeight) return Math.max(100, pageHeight - padding * 2);
  const scale = EXPORT_IMAGE_SCALE;
  const bySide = DEVICE_MAX_SIDE / scale;
  const byArea = DEVICE_MAX_AREA / (width * scale * scale);
  return Math.max(200, Math.floor(Math.min(bySide, byArea)) - padding * 2);
}

/**
 * 一個頂層區塊(段落、清單、標題……)在內容裡的上緣與下緣(不含外距)。
 * 一張圖的內容高 = 最後一段的下緣 − 第一段的上緣:每張的第一段不留上外距、
 * 最後一段不留下外距,中間的段距照原樣。
 */
export type UnitBox = { top: number; bottom: number };

/** cuts 是「在第幾個區塊之後切」→ 每一張的 [第一段, 最後一段](最後一段之後的切點不算) */
export function pageRanges(count: number, cuts: Set<number>): [number, number][] {
  const ranges: [number, number][] = [];
  let from = 0;
  for (let index = 0; index < count; index += 1) {
    if (index === count - 1 || cuts.has(index)) {
      ranges.push([from, index]);
      from = index + 1;
    }
  }
  return ranges;
}

export function spanHeight(units: UnitBox[], from: number, to: number): number {
  return Math.max(0, units[to].bottom - units[from].top);
}

/** 自動分頁:照順序塞,塞不下就在前一段之後切。回傳切點(給手動分頁當起點也用這個) */
export function autoCuts(units: UnitBox[], maxHeight: number): Set<number> {
  const cuts = new Set<number>();
  let from = 0;
  for (let index = 1; index < units.length; index += 1) {
    if (spanHeight(units, from, index) > maxHeight) {
      cuts.add(index - 1);
      from = index;
    }
  }
  return cuts;
}

export type PageSize = { from: number; to: number; width: number; height: number; content: number };

/** 每一張的範圍與輸出尺寸(像素) */
export function pageSizes(units: UnitBox[], cuts: Set<number>, width: number, padding: number, pageHeight: number | null = null): PageSize[] {
  return pageRanges(units.length, cuts).map(([from, to]) => {
    const content = spanHeight(units, from, to);
    return {
      from,
      to,
      width: Math.round(width * EXPORT_IMAGE_SCALE),
      height: Math.round((pageHeight ?? content + padding * 2) * EXPORT_IMAGE_SCALE),
      content,
    };
  });
}

/**
 * 單一段落自己就比一張還長時,要在段落裡面切。切點挑在「兩行字之間」:
 * lineGaps 是每兩行之間的位置(從段落頂端量),每一刀挑放得下的最後一個行縫,
 * 一行字都不會被切成兩半。真的一個行縫都沒有(例如一張超大的圖)才照高度硬切。
 * 回傳每一張的 [起點, 高度]。
 */
export function planSlices(height: number, maxHeight: number, lineGaps: number[]): [number, number][] {
  const gaps = [...lineGaps].sort((a, b) => a - b);
  const slices: [number, number][] = [];
  let start = 0;
  while (height - start > maxHeight) {
    const limit = start + maxHeight;
    let cut = -1;
    for (const gap of gaps) {
      if (gap > start + 1 && gap <= limit) cut = gap;
      if (gap > limit) break;
    }
    if (cut < 0) cut = limit;
    slices.push([start, cut - start]);
    start = cut;
  }
  slices.push([start, height - start]);
  return slices;
}

/**
 * 圖片配色要掛到紙上的東西:內建主題掛 data-theme(主題的 CSS 變數是 [data-theme] 選擇器),
 * 自選配色直接給一整組 CSS 變數(次要字色、引用線、分隔線都從底色和字色推出來)。
 */
export function exportPalette(
  preferences: Pick<EditorPreferences, "exportPalette" | "exportCustomBg" | "exportCustomInk">
): { theme?: string; vars?: Record<string, string> } {
  const palette = preferences.exportPalette;
  if (!palette || palette === "site") return {};
  if (palette !== "custom") return { theme: palette };
  const bg = preferences.exportCustomBg || "#ffffff";
  const ink = preferences.exportCustomInk || "#000000";
  return { vars: deriveVars({ bg, bg2: blend(bg, ink, 0.06), ink, accent: blend(ink, bg, 0.35) }) };
}
