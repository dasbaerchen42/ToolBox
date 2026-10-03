// 內建的迷你板模板。模板不記「這格是紅色」,而是記「這格是第 1 號色位」;
// 套用時才決定每個色位用哪個顏色,之後在「色位」清單換一個色,整張圖跟著變。

import type { BeadColor } from "./palette";
import type { BeadPattern } from "./pattern";

export type BeadTemplate = {
  id: string;
  name: string;
  /** 一列一行:"." 是空格,"1"–"9" 是色位編號 */
  rows: string[];
  /** 每個色位預設的色號(第 0 個是色位 1) */
  slots: string[];
};

export const TEMPLATES: BeadTemplate[] = [
  {
    id: "heart-5",
    name: "小愛心",
    rows: [".1.1.", "11111", "11111", ".111.", "..1.."],
    slots: ["W15"],
  },
  {
    id: "star-7",
    name: "星星",
    rows: ["...1...", "..111..", "1112111", ".11211.", "..111..", ".11.11.", ".1...1."],
    slots: ["W29", "W34"],
  },
  {
    id: "flower-7",
    name: "小花",
    rows: [".11.11.", "1111111", "1112111", ".12221.", "1112111", "1111111", ".11.11."],
    slots: ["W74", "W29"],
  },
  {
    id: "mushroom-7",
    name: "蘑菇",
    rows: ["..111..", ".12111.", "1111121", "1211111", "..333..", "..333..", "..333.."],
    slots: ["W15", "W01", "W23"],
  },
  {
    id: "cat-9",
    name: "貓咪臉",
    rows: [
      "1.......1",
      "11.....11",
      "111111111",
      "111111111",
      "112111211",
      "111111111",
      "111131111",
      ".1111111.",
      "..11111..",
    ],
    slots: ["W04", "W09", "W74"],
  },
];

/**
 * 換色:照色號把某幾色換成另一色(色號 → 色號)。找不到的色號就不換。
 * 素材以色位存,同一份素材放進周邊後可以換成別的顏色,不必回去重拼。
 */
export function recolorPattern(pattern: BeadPattern, palette: BeadColor[], recolor: Record<string, string>): BeadPattern {
  const byCode = new Map(palette.map((color, index) => [color.code, index]));
  const swap = new Map<number, number>();
  for (const [from, to] of Object.entries(recolor)) {
    const a = byCode.get(from);
    const b = byCode.get(to);
    if (a !== undefined && b !== undefined) swap.set(a, b);
  }
  if (swap.size === 0) return pattern;
  return { ...pattern, cells: pattern.cells.map((cell) => swap.get(cell) ?? cell) };
}

/** 模板 → 格子資料。slotColors 給了就用它(色盤索引),沒給就用模板預設的色號 */
export function templatePattern(
  template: BeadTemplate,
  palette: BeadColor[],
  slotColors?: number[]
): BeadPattern {
  const colors =
    slotColors ??
    template.slots.map((code) => Math.max(0, palette.findIndex((color) => color.code === code)));

  return {
    cols: template.rows[0].length,
    rows: template.rows.length,
    cells: template.rows.flatMap((row) =>
      [...row].map((char) => (char === "." ? -1 : colors[Number(char) - 1]))
    ),
  };
}
