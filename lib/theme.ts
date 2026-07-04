// lib/theme.ts — 主題轉接層
// 實際顏色由 theme-core 引擎的 CSS 變數驅動([data-theme] 見 app/theme.css,
// 自訂主題為 :root 內聯變數)。這裡只提供「語意 → Tailwind token class」的固定對映,
// 換主題時 class 不變、變數值變,所以只有一套。

/** @deprecated 主題已全站統一,不再分淺/深;保留型別讓舊簽名相容。 */
export type ThemeMode = "light" | "dark";

export type ThemeClasses = {
  page: string;
  panel: string;
  subPanel: string;
  input: string;
  muted: string;
  primary: string;
  secondary: string;
  selected: string;
  unselected: string;
  divider: string;
  listSelected: string;
  listUnselected: string;
};

const TOKEN_CLASSES: ThemeClasses = {
  page: "bg-(--paper-bg) text-(--ink-primary)",
  panel: "border-(--border-light) bg-(--paper-bg-2)",
  subPanel: "border-(--border-light) bg-(--paper-bg)",
  input:
    "border-(--border-light) bg-(--paper-bg) text-(--ink-primary) placeholder:text-(--ink-tertiary)",
  muted: "text-(--ink-secondary)",
  primary: "border-(--accent) bg-(--accent) text-(--on-accent) hover:opacity-90",
  secondary:
    "border-(--border-dark) bg-(--paper-bg-2) text-(--ink-primary) hover:bg-(--paper-bg-3)",
  selected: "border-(--accent) bg-(--accent) text-(--on-accent)",
  unselected: "border-(--border-light) bg-(--paper-bg-2) text-(--ink-secondary)",
  divider: "border-(--border-light)",
  listSelected: "border-(--accent) bg-(--accent) text-(--on-accent) shadow-sm",
  listUnselected:
    "border-(--border-light) bg-(--paper-bg-2) text-(--ink-primary) hover:bg-(--paper-bg-3)",
};

export function getThemeClasses(_theme?: ThemeMode): ThemeClasses {
  return TOKEN_CLASSES;
}

// 編輯器頁的主題對映(原 app/editor/page.tsx 的 themeMap,收斂成一套 token)
export type EditorThemeConfig = {
  pageBg: string;
  sidebarBg: string;
  panelBg: string;
  cardBg: string;
  border: string;
  text: string;
  mutedText: string;
  subtleText: string;
  inputBg: string;
  textareaBg: string;
  primaryButton: string;
  primaryButtonText: string;
  secondaryButton: string;
  secondaryButtonText: string;
  activeItem: string;
  inactiveItem: string;
};

export const EDITOR_THEME: EditorThemeConfig = {
  pageBg: "bg-(--paper-bg)",
  sidebarBg: "bg-(--paper-bg-2)",
  panelBg: "bg-(--paper-bg-2)",
  cardBg: "bg-(--paper-bg-2)",
  border: "border-(--border-light)",
  text: "text-(--ink-primary)",
  mutedText: "text-(--ink-secondary)",
  subtleText: "text-(--ink-tertiary)",
  inputBg: "bg-(--paper-bg)",
  textareaBg: "bg-(--paper-bg-2)",
  primaryButton: "bg-(--accent) hover:opacity-90",
  primaryButtonText: "text-(--on-accent)",
  secondaryButton: "border-(--border-dark) hover:bg-(--paper-bg-3)",
  secondaryButtonText: "text-(--ink-primary)",
  activeItem: "border-(--accent) bg-(--paper-bg-3)",
  inactiveItem: "border-(--border-light) bg-(--paper-bg-2) hover:bg-(--paper-bg-3)",
};
