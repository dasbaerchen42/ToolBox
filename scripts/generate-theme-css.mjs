// 產生 app/theme.css:node scripts/generate-theme-css.mjs > app/theme.css
// 色彩邏輯與 lib/theme-core.ts 一致;改 PRESETS 時兩邊要同步(.ts 為準)。

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function blend(c1, c2, t) {
  const [r1, g1, b1] = hexToRgb(c1), [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function isDarkColor(bg) { return relativeLuminance(bg) < 0.4; }

const SEMANTIC = {
  danger: { light: "#c0392b", dark: "#e0574f" },
  success: { light: "#2e9c6a", dark: "#5cba8a" },
  warning: { light: "#c8761f", dark: "#e89243" },
};

function deriveVars(input) {
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
    "--on-accent": contrastRatio("#ffffff", accent) >= contrastRatio("#1a1a1a", accent) ? "#ffffff" : "#1a1a1a",
    "--danger": dark ? SEMANTIC.danger.dark : SEMANTIC.danger.light,
    "--success": dark ? SEMANTIC.success.dark : SEMANTIC.success.light,
    "--warning": dark ? SEMANTIC.warning.dark : SEMANTIC.warning.light,
    "--on-danger": "#ffffff",
    "--on-success": "#ffffff",
    "--on-warning": "#ffffff",
  };
}

const PRESETS = [
  { id: "huninn", input: { bg: "#17181a", bg2: "#1f2023", ink: "#eae9e4", accent: "#e8c45c" } },
  { id: "latte", input: { bg: "#faf6ef", bg2: "#f0e5d5", ink: "#3d2e22", accent: "#a33b26" } },
  { id: "stone", input: { bg: "#f4f4f4", bg2: "#e8e8e8", ink: "#141414", accent: "#5a5a5a" } },
  { id: "mango", input: { bg: "#f3f8f0", bg2: "#ddecd6", ink: "#243d28", accent: "#a87a50" } },
  { id: "peach", input: { bg: "#1c1a1e", bg2: "#28252c", ink: "#ead5cc", accent: "#d4607a" } },
  { id: "butterfly", input: { bg: "#1c1e28", bg2: "#262d3e", ink: "#ccd4e8", accent: "#7884cc" } },
  { id: "melon", input: { bg: "#fff8f0", bg2: "#fce8d4", ink: "#2e5438", accent: "#d96c10" } },
];

let out = "/* 自動產生 — node scripts/generate-theme-css.mjs > app/theme.css。請勿手改。 */\n";
for (const p of PRESETS) {
  const vars = deriveVars(p.input);
  out += `\n[data-theme="${p.id}"] {\n`;
  for (const [k, v] of Object.entries(vars)) out += `  ${k}: ${v};\n`;
  out += "}\n";
}
process.stdout.write(out);
