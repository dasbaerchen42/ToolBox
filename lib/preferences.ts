export type FontFamilyName =
  | "sans"
  | "serif"
  | "mono"
  | "cursive"
  | "round"
  | "wenkai"
  | "iansui"
  | "cactus"
  | "goround"
  | "chocolate"
  | "marker"
  | "lubrifont"
  | "dancing"
  | "caveat"
  | "pacifico"
  | "permanent"
  | "playfair"
  | "bebas";

/** 編輯區的呈現方式：純文字、渲染結果、左右並排 */
export type EditorViewMode = "edit" | "preview" | "split";

/**
 * 匯出圖片怎麼切頁,一個選單就決定:自動(照內容長度,太長才切)、手動(自己點段落切),
 * 或固定比例(每張一樣大,系統照比例自動切)。比例跟手動不能並存,選了比例就是懶人模式。
 */
export type ExportPages = "auto" | "manual" | "1:1" | "4:5" | "3:4" | "9:16";

export type EditorPreferences = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: FontFamilyName;
  viewMode: EditorViewMode;
  /** 文件要用哪種方式編輯:rich 是直接看排好的樣子,source 是改 Markdown 原文 */
  docView: "rich" | "source";
  exportImageTitle: boolean;
  exportPages: ExportPages;
  /** 圖片上的字級:一行大約幾個字(越少字越大),見 lib/export-layout */
  exportPerLine: number;
  /** 圖片配色:site 跟著網站目前的主題,custom 是自選的底色與字色 */
  exportPalette: "site" | "custom";
  /** 自選配色的底色與字色 */
  exportCustomBg: string;
  exportCustomInk: string;
  /** 每張右下角標「1/5」 */
  exportPageNumbers: boolean;
  /** 轉圖時要遮起來的字(逗號、頓號或換行隔開),見 lib/export-mask */
  exportMasks: string;
  /** 每張左下角的署名(空字串就不放) */
  exportSignature: string;
  /** 四周留白:稍窄、一般 */
  exportMargin: "narrow" | "normal";
  /** 斜體改成淡色的正體(預覽與轉圖都適用) */
  softItalic: boolean;
  /** 斜體改淡色正體時,對白(正體)要不要加粗 */
  softItalicBold: boolean;
  /** 編輯區下面要不要顯示格式檢查提示 */
  showHints: boolean;
};

export const PREFERENCES_KEY = "orange-writing-preferences";
export const ACTIVE_DOC_KEY = "orange-writing-active-doc";

export const defaultPreferences: EditorPreferences = {
  fontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0,
  fontFamily: "mono",
  viewMode: "edit",
  docView: "rich",
  exportImageTitle: false,
  exportPages: "auto",
  exportPerLine: 24,
  exportPalette: "site",
  exportCustomBg: "#fdf6ec",
  exportCustomInk: "#4a3a32",
  exportPageNumbers: false,
  exportSignature: "",
  exportMasks: "",
  exportMargin: "normal",
  softItalic: false,
  softItalicBold: false,
  showHints: false,
};
