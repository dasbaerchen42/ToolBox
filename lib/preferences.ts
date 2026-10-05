export type FontFamilyName =
  | "sans"
  | "serif"
  | "mono"
  | "cursive"
  | "round"
  | "wenkai"
  | "iansui"
  | "cactus";

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
  /** 圖片上的字級(一行大約幾個字),見 lib/export-layout */
  exportTextSize: "s" | "m" | "l" | "xl";
  /** 每張圖的比例:free 是照內容長度,其他是固定比例(社群輪播) */
  exportRatio: "free" | "1:1" | "4:5" | "3:4" | "9:16";
  /** 圖片配色:site 跟著網站目前的主題,其他是主題的 id */
  exportPalette: string;
  /** 每張右下角標「1/5」 */
  exportPageNumbers: boolean;
  /** 每張左下角的署名(空字串就不放) */
  exportSignature: string;
  /** 斜體改成淡色的正體(預覽與轉圖都適用) */
  softItalic: boolean;
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
  exportTextSize: "m",
  exportRatio: "free",
  exportPalette: "site",
  exportPageNumbers: false,
  exportSignature: "",
  softItalic: false,
};
