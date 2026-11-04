// 分隔線產生器。
//
// 常用造型直接點，想微調時再進進階產生器。

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
  { key: "spark", label: "閃光", unit: "✧", spaced: true },
  { key: "petal", label: "花瓣", unit: "❁", spaced: true },
  { key: "cross", label: "十字", unit: "┈┈✦┈┈" },
];

export type DividerPresetGroup = {
  key: string;
  label: string;
  items: { label: string; value: string }[];
};

export const DIVIDER_PRESET_GROUPS: DividerPresetGroup[] = [
  { key: "simple", label: "簡潔線條", items: [
    { label: "細線", value: "────────────────" }, { label: "粗線", value: "━━━━━━━━━━━━━━━━" },
    { label: "雙線", value: "════════════════" }, { label: "點線", value: "· · · · · · · · · ·" },
    { label: "短虛線", value: "╌╌╌╌╌╌╌╌╌╌╌╌" }, { label: "上下框", value: "▔▔▔▔▔▔▔▔▔▔▔▔" },
  ] },
  { key: "star", label: "星光", items: [
    { label: "小星", value: "✦ · · · · · ✦" }, { label: "閃光", value: "✧･ﾟ: *✧･ﾟ:*" },
    { label: "星鏈", value: "⋆｡°✩ ⋆｡°✩ ⋆｡°✩" }, { label: "星河", value: "☆。*。☆。*。☆" },
    { label: "中央星", value: "━━━ ✦ ━━━" }, { label: "雙星", value: "✦ ───── ✦" },
  ] },
  { key: "flower", label: "花草", items: [
    { label: "小花", value: "❀ · ─ · ❀ · ─ · ❀" }, { label: "花枝", value: "❁ ───── ❁" },
    { label: "葉片", value: "❧ ─────── ☙" }, { label: "花園", value: "✿°•∘ɷ∘•°✿" },
    { label: "雪花", value: "❄︎ · · ❄︎ · · ❄︎" }, { label: "花點", value: "･ﾟ✧ ❀ ✧ﾟ･" },
  ] },
  { key: "heart", label: "愛心", items: [
    { label: "輕心", value: "♡ · · · ♡ · · · ♡" }, { label: "心線", value: "♡ ─────── ♡" },
    { label: "雙心", value: "♥︎ ┈┈┈┈┈ ♥︎" }, { label: "心花", value: "❀ ♡ ❀ ♡ ❀" },
    { label: "相連", value: "୨୧ ───── ୨୧" }, { label: "中央心", value: "──── ♡ ────" },
  ] },
  { key: "cute", label: "可愛裝飾", items: [
    { label: "蝴蝶結", value: "୨୧ ┈┈┈┈┈ ୨୧" }, { label: "小熊腳步", value: "ʕ·ᴥ·ʔ ─ ʕ·ᴥ·ʔ" },
    { label: "糖果", value: "꒰ა ☆ ໒꒱ ─ ꒰ა ☆ ໒꒱" }, { label: "柔波", value: "〜 〜 〜 〜 〜 〜" },
    { label: "小珍珠", value: "○ ◦ ○ ◦ ○ ◦ ○" }, { label: "泡泡", value: "｡･:*˚:✧｡" },
  ] },
  { key: "classic", label: "古典裝飾", items: [
    { label: "菱飾", value: "◆◇◆◇◆◇◆◇◆" }, { label: "中央菱", value: "━━━━ ◈ ━━━━" },
    { label: "卷葉", value: "☙ ───────── ❧" }, { label: "章節", value: "§ ───────── §" },
    { label: "細菱", value: "⋄ ─ ⋄ ─ ⋄ ─ ⋄" }, { label: "宮廷花", value: "⚜ ─────── ⚜" },
  ] },
];

export const DIVIDER_CENTERS = ["", "✦", "♡", "❀", "◈", "୨୧", "§", "文字"] as const;
export const DIVIDER_ENDPOINTS = [
  { label: "無", left: "", right: "" }, { label: "圓括號", left: "（", right: "）" },
  { label: "方括號", left: "【", right: "】" }, { label: "葉片", left: "☙ ", right: " ❧" },
  { label: "星星", left: "✦ ", right: " ✦" }, { label: "愛心", left: "♡ ", right: " ♡" },
] as const;

export const DIVIDER_MIN = 1;
export const DIVIDER_MAX = 60;

/** 重複單位到指定長度;spaced 的單位用空白隔開 */
export function buildDivider(unit: DividerUnit, length: number): string {
  const count = Math.min(Math.max(Math.round(length), DIVIDER_MIN), DIVIDER_MAX);
  const parts = Array.from({ length: count }, () => unit.unit);
  return parts.join(unit.spaced ? " " : "");
}

export function buildDecoratedDivider(
  unit: DividerUnit,
  length: number,
  decoration: { center?: string; left?: string; right?: string } = {}
): string {
  const count = Math.min(Math.max(Math.round(length), DIVIDER_MIN), DIVIDER_MAX);
  const center = decoration.center?.trim() ?? "";
  const body = center
    ? `${buildDivider(unit, Math.floor(count / 2))} ${center} ${buildDivider(unit, Math.ceil(count / 2))}`
    : buildDivider(unit, count);
  return `${decoration.left ?? ""}${body}${decoration.right ?? ""}`;
}
