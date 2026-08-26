export type FontFamilyName =
  | "sans"
  | "serif"
  | "mono"
  | "cursive"
  | "round";

/** 編輯區的呈現方式：純文字、渲染結果、左右並排 */
export type EditorViewMode = "edit" | "preview" | "split";

/** 文轉圖的輸出寬度(CSS px,實際像素還會再乘上 EXPORT_IMAGE_SCALE) */
export type ExportImageWidth = 600 | 800 | 1080;

/** 匯出圖片的分頁方式 */
export type ExportPaginate = "auto" | "manual" | "none";

export type EditorPreferences = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  editorWidth: "narrow" | "medium" | "wide";
  fontFamily: FontFamilyName;
  viewMode: EditorViewMode;
  exportImageWidth: ExportImageWidth;
  exportImageTitle: boolean;
  exportPaginate: ExportPaginate;
};

export const PREFERENCES_KEY = "orange-writing-preferences";
export const ACTIVE_DOC_KEY = "orange-writing-active-doc";

export const defaultPreferences: EditorPreferences = {
  fontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0,
  editorWidth: "medium",
  fontFamily: "mono",
  viewMode: "edit",
  exportImageWidth: 1080,
  exportImageTitle: false,
  exportPaginate: "auto",
};
