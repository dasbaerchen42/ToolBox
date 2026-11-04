import { type FontFamilyName } from "@/lib/preferences";

export type FontOption = {
  key: FontFamilyName;
  label: string;
  group: "core" | "latin" | "effect";
  sample: string;
  note?: string;
};

const CORE_OPTIONS: FontOption[] = [
  { key: "sans", label: "通用黑體", group: "core", sample: "清風明月，讀寫日常 Abc" },
  { key: "serif", label: "通用明體 500", group: "core", sample: "清風明月，讀寫日常 Abc" },
  { key: "round", label: "jf open 粉圓", group: "core", sample: "清風明月，讀寫日常 Abc" },
  { key: "wenkai", label: "霞鶩文楷 TC", group: "core", sample: "清風明月，讀寫日常 Abc" },
  { key: "shippori", label: "Shippori 衍生明體 90", group: "core", sample: "清風明月，讀寫日常 Abc", note: "500・90% 寬・微寬字距" },
  { key: "peak", label: "隨峰體 Plus", group: "core", sample: "清風明月，讀寫日常 Abc" },
  { key: "thenkhung", label: "宇文天穹", group: "core", sample: "清風明月，讀寫日常 Abc" },
  { key: "wenkaiMono", label: "霞鶩文楷等寬 TC", group: "core", sample: "清風明月 0123 Abc" },
];

const LATIN_OPTIONS: FontOption[] = [
  { key: "fraunces", label: "Fraunces", group: "latin", sample: "Fresh stories, softly told." },
  { key: "lora", label: "Lora", group: "latin", sample: "Fresh stories, softly told." },
  { key: "nunito", label: "Nunito", group: "latin", sample: "Fresh stories, softly told." },
  { key: "quicksand", label: "Quicksand", group: "latin", sample: "Fresh stories, softly told." },
];

const EFFECT_OPTIONS: FontOption[] = [
  { key: "chenyu", label: "辰宇落雁體", group: "effect", sample: "今天也把喜歡的事寫下來" },
  { key: "ryusenkei", label: "流線形", group: "effect", sample: "沿著風的方向，寫一段柔軟的故事" },
  { key: "kaitou", label: "怪盜預告黑體", group: "effect", sample: "今晚，我將取走最珍貴的祕密" },
  { key: "konatu", label: "小夏 Konatu", group: "effect", sample: "夏日午後的小小記事" },
];

export const EDITOR_FONT_OPTIONS = [...CORE_OPTIONS, ...LATIN_OPTIONS];
export const IMAGE_FONT_OPTIONS = [...CORE_OPTIONS, ...LATIN_OPTIONS, ...EFFECT_OPTIONS];
export const FONT_OPTIONS = EDITOR_FONT_OPTIONS;

const CJK_SANS = 'var(--font-noto-sans-tc), "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const CJK_SERIF = 'var(--font-noto-serif-tc), "Noto Serif TC", "PMingLiU", serif';

export function getFontFamily(fontFamily: FontFamilyName): string {
  switch (fontFamily) {
    case "serif": return `var(--font-noto-serif-tc), "Noto Serif TC", Georgia, serif`;
    case "mono": return '"SFMono-Regular", "Cascadia Mono", "Fira Code", Consolas, monospace';
    case "cursive": return '"Segoe Script", "Brush Script MT", cursive';
    case "round": return "var(--font-round)";
    case "wenkai": return 'var(--font-wenkai), "LXGW WenKai TC", serif';
    case "shippori": return 'var(--font-shippori-90), "ToolBox Shiori 90", serif';
    case "peak": return 'var(--font-peak), "The Peak Font Plus", cursive';
    case "thenkhung": return 'var(--font-thenkhung), UoqMunThenKhung, serif';
    case "wenkaiMono": return 'var(--font-wenkai-mono), "LXGW WenKai Mono TC", monospace';
    case "fraunces": return `var(--font-fraunces), Fraunces, ${CJK_SERIF}`;
    case "lora": return `var(--font-lora), Lora, ${CJK_SERIF}`;
    case "nunito": return `var(--font-nunito), Nunito, ${CJK_SANS}`;
    case "quicksand": return `var(--font-quicksand), Quicksand, ${CJK_SANS}`;
    case "chenyu": return 'var(--font-chenyu), "ChenYu LuoYan", cursive';
    case "ryusenkei": return 'var(--font-ryusenkei), "02流線形", serif';
    case "kaitou": return 'var(--font-kaitou), "KaitouYokokuGothic Heavy", sans-serif';
    case "konatu": return 'var(--font-konatu), Konatu, sans-serif';
    case "iansui": return 'var(--font-iansui), Iansui, cursive';
    case "cactus": return 'var(--font-cactus), "Cactus Classical Serif", serif';
    case "goround": return 'var(--font-goround), "Chiron GoRound TC", sans-serif';
    case "chocolate": return 'var(--font-chocolate), "Chocolate Classical Sans", sans-serif';
    case "marker": return 'var(--font-marker), "LXGW Marker Gothic", sans-serif';
    case "lubrifont": return 'var(--font-lubrifont), "WDXL Lubrifont TC", sans-serif';
    case "dancing": return `var(--font-dancing), "Dancing Script", ${CJK_SANS}`;
    case "caveat": return `var(--font-caveat), Caveat, ${CJK_SANS}`;
    case "pacifico": return `var(--font-pacifico), Pacifico, ${CJK_SANS}`;
    case "permanent": return `var(--font-permanent), "Permanent Marker", ${CJK_SANS}`;
    case "playfair": return `var(--font-playfair), "Playfair Display", ${CJK_SERIF}`;
    case "bebas": return `var(--font-bebas), "Bebas Neue", ${CJK_SANS}`;
    case "sans":
    default: return CJK_SANS;
  }
}

export function fontWeightFor(font: FontFamilyName, bold = false): number {
  if (bold) return 700;
  return font === "serif" || font === "shippori" ? 500 : 400;
}

export function fontExtraLetterSpacingEm(font: FontFamilyName): number {
  return font === "shippori" ? 0.06 : 0;
}

export function getFontStyle(font: FontFamilyName, letterSpacingPx = 0) {
  const extra = fontExtraLetterSpacingEm(font);
  return {
    fontFamily: getFontFamily(font),
    fontWeight: fontWeightFor(font),
    letterSpacing: extra ? `calc(${letterSpacingPx}px + ${extra}em)` : `${letterSpacingPx}px`,
  } as const;
}
