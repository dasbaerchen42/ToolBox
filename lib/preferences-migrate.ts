// 讀回存在瀏覽器裡的編輯器偏好:跟預設值合併,並把舊版的轉圖設定換成新的。
//
// 舊版轉圖有寬度(600/800/1080)、字級四段、比例與分頁兩個選單、每個主題一個配色;
// 新版寬度固定、字級是一行幾個字、切頁一個選單、配色只有「預設」(跟著網站)與「自選」。

import { defaultPreferences, type EditorPreferences, type ExportPages } from "./preferences";
import { PRESETS } from "./theme-core";

const PER_LINE_OF_SIZE: Record<string, number> = { s: 30, m: 24, l: 20, xl: 16 };
const PAGES: ExportPages[] = ["auto", "manual", "1:1", "4:5", "3:4", "9:16"];

/** 一行幾個字的範圍(滑桿兩端) */
export const PER_LINE_MIN = 14;
export const PER_LINE_MAX = 32;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function migratePreferences(raw: unknown): EditorPreferences {
  if (!isRecord(raw)) return { ...defaultPreferences };
  const {
    exportImageWidth: _width,
    exportTextSize,
    exportRatio,
    exportPaginate,
    ...rest
  } = raw;
  void _width;
  const next = { ...defaultPreferences, ...(rest as Partial<EditorPreferences>) };

  // 字級:舊的四段換成一行幾個字
  if (typeof raw.exportPerLine !== "number" && typeof exportTextSize === "string") {
    next.exportPerLine = PER_LINE_OF_SIZE[exportTextSize] ?? defaultPreferences.exportPerLine;
  }
  next.exportPerLine = Math.round(Math.min(PER_LINE_MAX, Math.max(PER_LINE_MIN, Number(next.exportPerLine) || defaultPreferences.exportPerLine)));

  // 切頁:有固定比例就用比例(會自動切);否則看原本是不是手動;「一律單張」併進自動
  if (!PAGES.includes(raw.exportPages as ExportPages)) {
    next.exportPages =
      typeof exportRatio === "string" && PAGES.includes(exportRatio as ExportPages)
        ? (exportRatio as ExportPages)
        : exportPaginate === "manual"
          ? "manual"
          : "auto";
  }

  // 留白:「寬」拿掉了,併進一般
  if (next.exportMargin !== "narrow" && next.exportMargin !== "normal") next.exportMargin = "normal";

  // 配色:以前挑了某個主題的,換成自選並帶入那個主題的底色與字色,圖看起來不會變
  const palette = raw.exportPalette;
  if (palette !== "site" && palette !== "custom") {
    const preset = PRESETS.find((item) => item.id === palette);
    if (preset) {
      next.exportPalette = "custom";
      next.exportCustomBg = preset.input.bg;
      next.exportCustomInk = preset.input.ink;
    } else {
      next.exportPalette = "site";
    }
  }
  return next;
}
