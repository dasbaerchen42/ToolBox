// 分隔線產生器。
//
// 做成產生器而不是二十條寫死的線:單位字元 × 長度的組合遠比固定清單有彈性,
// 而且想要的長度往往取決於貼文寬度,不是我們能先決定的。

export type DividerUnit = {
  key: string;
  label: string;
  /** 重複的單位,可以是多個字元 */
  unit: string;
  /** 單位之間要不要夾一個空白 */
  spaced?: boolean;
};

export const DIVIDER_UNITS: DividerUnit[] = [
  { key: "line", label: "細線", unit: "─" },
  { key: "bold", label: "粗線", unit: "━" },
  { key: "double", label: "雙線", unit: "═" },
  { key: "dash", label: "虛線", unit: "╌" },
  { key: "dot", label: "點", unit: "·", spaced: true },
  { key: "star", label: "星", unit: "✦", spaced: true },
  { key: "flower", label: "花", unit: "❀", spaced: true },
  { key: "diamond", label: "菱", unit: "◈", spaced: true },
  { key: "wave", label: "波浪", unit: "～" },
  { key: "tilde", label: "連續波", unit: "〜" },
  { key: "heart", label: "心", unit: "♡", spaced: true },
  { key: "leaf", label: "葉", unit: "❧", spaced: true },
  { key: "snow", label: "雪", unit: "❄", spaced: true },
  { key: "note", label: "音符", unit: "♪", spaced: true },
  { key: "circle", label: "圓點", unit: "●", spaced: true },
  { key: "smallCircle", label: "小圓", unit: "○", spaced: true },
  { key: "diamondLine", label: "菱鏈", unit: "◆◇" },
  { key: "arrowLine", label: "箭頭", unit: "➤", spaced: true },
  { key: "boxTop", label: "上框線", unit: "▔" },
  { key: "boxBottom", label: "下框線", unit: "▁" },
];

export const DIVIDER_MIN = 1;
export const DIVIDER_MAX = 60;

/** 重複單位到指定長度;spaced 的單位用空白隔開 */
export function buildDivider(unit: DividerUnit, length: number): string {
  const count = Math.min(Math.max(Math.round(length), DIVIDER_MIN), DIVIDER_MAX);
  const parts = Array.from({ length: count }, () => unit.unit);
  return parts.join(unit.spaced ? " " : "");
}
