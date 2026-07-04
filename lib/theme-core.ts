// ════════════════════════════════════════════════════════════════
// theme-core — 三專案共用的換色引擎(ToolBox 版)
// 4 色輸入(bg/bg2/ink/accent)→ deriveVars 衍生完整 token。
// preset 由 scripts/generate-theme-css.mjs 預算成 app/theme.css;
// 改 PRESETS 後必須重跑產生器,並同步 .mjs 內的 PRESETS 副本。
// ════════════════════════════════════════════════════════════════

export interface BaseInput {
  bg: string;
  bg2: string;
  ink: string;
  accent: string;
}
export type ThemeVars = Record<string, string>;
export interface PresetDef {
  id: string;
  name: string;
  emoji: string;
  input: BaseInput;
}

// ── 色彩數學 ──
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}
export function blend(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function lin(c: number) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function isDarkColor(bg: string): boolean {
  return relativeLuminance(bg) < 0.4;
}

// 固定語意色(不從 accent 衍生:刪除永遠像危險、成功永遠是綠的)
const SEMANTIC = {
  danger: { light: "#c0392b", dark: "#e0574f" },
  success: { light: "#2e9c6a", dark: "#5cba8a" },
  warning: { light: "#c8761f", dark: "#e89243" },
};

// ── 4 色 → 完整 token ──
export function deriveVars(input: BaseInput): ThemeVars {
  const { bg, bg2, ink, accent } = input;
  const dark = isDarkColor(bg);
  const [sr, sg, sb] = hexToRgb(blend(bg2, "#ffffff", 0.12));
  const alpha = dark ? 0.5 : 0.62;
  return {
    "--paper-bg": bg,
    "--paper-bg-2": bg2,
    "--paper-bg-3": blend(bg2, ink, 0.1),
    "--surface": `rgba(${sr}, ${sg}, ${sb}, ${alpha})`,
    "--border-light": blend(bg2, ink, 0.14),
    "--border-dark": blend(bg2, ink, 0.3),
    "--ink-primary": ink,
    "--ink-secondary": blend(ink, bg, 0.38),
    "--ink-tertiary": blend(ink, bg, 0.58),
    "--ink-black": blend(ink, "#000000", 0.1),
    "--accent": accent,
    "--accent-soft": blend(accent, bg, 0.3),
    "--on-accent":
      contrastRatio("#ffffff", accent) >= contrastRatio("#1a1a1a", accent) ? "#ffffff" : "#1a1a1a",
    "--danger": dark ? SEMANTIC.danger.dark : SEMANTIC.danger.light,
    "--success": dark ? SEMANTIC.success.dark : SEMANTIC.success.light,
    "--warning": dark ? SEMANTIC.warning.dark : SEMANTIC.warning.light,
    "--on-danger": "#ffffff",
    "--on-success": "#ffffff",
    "--on-warning": "#ffffff",
  };
}

export const VAR_NAMES = Object.keys(
  deriveVars({ bg: "#000", bg2: "#000", ink: "#fff", accent: "#fff" })
);

// 對比防呆:ink 對 bg 不足 AA(4.5) 就把 ink 往遠離 bg 推
export function ensureReadable(input: BaseInput): BaseInput {
  let ink = input.ink;
  const target = isDarkColor(input.bg) ? "#ffffff" : "#000000";
  let guard = 0;
  while (contrastRatio(ink, input.bg) < 4.5 && guard++ < 20) ink = blend(ink, target, 0.08);
  return { ...input, ink };
}

// ── 內建主題(改這裡要同步 scripts/generate-theme-css.mjs 並重產 app/theme.css)──
export const PRESETS: PresetDef[] = [
  { id: "huninn", name: "灰黃", emoji: "🐻", input: { bg: "#17181a", bg2: "#1f2023", ink: "#eae9e4", accent: "#e8c45c" } },
  { id: "latte", name: "拿鐵", emoji: "☕", input: { bg: "#faf6ef", bg2: "#f0e5d5", ink: "#3d2e22", accent: "#a33b26" } },
  { id: "stone", name: "薏仁", emoji: "🪨", input: { bg: "#f4f4f4", bg2: "#e8e8e8", ink: "#141414", accent: "#5a5a5a" } },
  { id: "mango", name: "情人果", emoji: "🥭", input: { bg: "#f3f8f0", bg2: "#ddecd6", ink: "#243d28", accent: "#a87a50" } },
  { id: "peach", name: "蜜桃", emoji: "🍑", input: { bg: "#1c1a1e", bg2: "#28252c", ink: "#ead5cc", accent: "#d4607a" } },
  { id: "butterfly", name: "蝶豆花", emoji: "🦋", input: { bg: "#1c1e28", bg2: "#262d3e", ink: "#ccd4e8", accent: "#7884cc" } },
  { id: "melon", name: "哈密瓜", emoji: "🍈", input: { bg: "#fff8f0", bg2: "#fce8d4", ink: "#2e5438", accent: "#d96c10" } },
];

// ── 和諧感隨機 ──
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
export function generateRandomScheme(): BaseInput {
  const hue = Math.random() * 360;
  const dark = Math.random() < 0.5;
  const comp = Math.random() < 0.5;
  const off = comp ? 150 + Math.random() * 60 : (Math.random() < 0.5 ? 1 : -1) * (20 + Math.random() * 20);
  const aHue = (((hue + off) % 360) + 360) % 360;
  const input = dark
    ? {
        bg: hslToHex(hue, 8 + Math.random() * 8, 8 + Math.random() * 8),
        bg2: hslToHex(hue, 10 + Math.random() * 8, 16 + Math.random() * 10),
        ink: hslToHex(hue, 10 + Math.random() * 10, 85 + Math.random() * 10),
        accent: hslToHex(aHue, 60 + Math.random() * 25, 55 + Math.random() * 15),
      }
    : {
        bg: hslToHex(hue, 8 + Math.random() * 12, 92 + Math.random() * 6),
        bg2: hslToHex(hue, 10 + Math.random() * 15, 84 + Math.random() * 8),
        ink: hslToHex(hue, 15 + Math.random() * 15, 10 + Math.random() * 12),
        accent: hslToHex(aHue, 60 + Math.random() * 25, 40 + Math.random() * 20),
      };
  return ensureReadable(input);
}

// ── 套用 / 持久化(client-only)──
const K_ID = "toolbox-theme";
const K_INPUT = "toolbox-theme-custom-input";
const K_VARS = "toolbox-theme-custom-vars";
const K_RANDOM = "toolbox-theme-random-saves";
const MAX_RANDOM = 5;

export function applyVarsToRoot(vars: ThemeVars) {
  const el = document.documentElement;
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}
export function clearCustomVars() {
  const el = document.documentElement;
  VAR_NAMES.forEach((v) => el.style.removeProperty(v));
}
export function applyTheme(id: string) {
  if (id === "custom") {
    const input = getCustomInput();
    if (input) return applyCustomTheme(input);
    id = PRESETS[0].id;
  }
  clearCustomVars();
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(K_ID, id);
}
export function applyCustomTheme(input: BaseInput) {
  const safe = ensureReadable(input);
  const vars = deriveVars(safe);
  clearCustomVars();
  applyVarsToRoot(vars);
  document.documentElement.setAttribute("data-theme", "custom");
  localStorage.setItem(K_ID, "custom");
  localStorage.setItem(K_INPUT, JSON.stringify(safe));
  localStorage.setItem(K_VARS, JSON.stringify(vars));
}
export function getCurrentThemeId(): string {
  return localStorage.getItem(K_ID) ?? PRESETS[0].id;
}
export function getCustomInput(): BaseInput | null {
  try {
    const raw = localStorage.getItem(K_INPUT);
    return raw ? (JSON.parse(raw) as BaseInput) : null;
  } catch {
    return null;
  }
}

// ── 隨機儲存(上限 5,FIFO)──
export function getSavedRandomSchemes(): BaseInput[] {
  try {
    const raw = localStorage.getItem(K_RANDOM);
    return raw ? (JSON.parse(raw) as BaseInput[]) : [];
  } catch {
    return [];
  }
}
export function saveRandomScheme(scheme: BaseInput): BaseInput[] {
  const saves = getSavedRandomSchemes();
  saves.push(scheme);
  while (saves.length > MAX_RANDOM) saves.shift();
  localStorage.setItem(K_RANDOM, JSON.stringify(saves));
  return saves;
}
export function deleteRandomScheme(i: number): BaseInput[] {
  const saves = getSavedRandomSchemes();
  saves.splice(i, 1);
  localStorage.setItem(K_RANDOM, JSON.stringify(saves));
  return saves;
}

// ── 無閃爍 bootstrap(注入 <head>,繪製前執行;custom 用存好的 vars 不重算)──
export const BOOTSTRAP_SCRIPT = `(function(){try{
var id=localStorage.getItem('${K_ID}')||'${PRESETS[0].id}';
if(id==='custom'){var v=JSON.parse(localStorage.getItem('${K_VARS}')||'{}');var s=document.documentElement.style;for(var k in v)s.setProperty(k,v[k]);document.documentElement.setAttribute('data-theme','custom');}
else{document.documentElement.setAttribute('data-theme',id);}
}catch(e){}})();`;
