export type FontFamilyName =
  | "sans"
  | "serif"
  | "mono"
  | "cursive"
  | "round";

export type EditorPreferences = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  editorWidth: "narrow" | "medium" | "wide";
  fontFamily: FontFamilyName;
};

export const PREFERENCES_KEY = "orange-writing-preferences";
export const ACTIVE_DOC_KEY = "orange-writing-active-doc";

export const defaultPreferences: EditorPreferences = {
  fontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0,
  editorWidth: "medium",
  fontFamily: "mono",
};
