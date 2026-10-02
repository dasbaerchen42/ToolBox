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
  /** 斜體改成淡色的正體(預覽與轉圖都適用) */
  softItalic: boolean;
  /** 轉圖用對話框樣式:標了左/右的段落變成聊天泡泡 */
  exportChat: boolean;
  /** 對話框左右兩邊的名字;空的就不顯示 */
  exportChatLeft: string;
  exportChatRight: string;
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
  softItalic: false,
  exportChat: false,
  exportChatLeft: "",
  exportChatRight: "",
};
