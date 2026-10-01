// 其他輸出格式:SVG 向量檔、照著拼的圖紙。
//
// SVG:每顆豆子都是算出來的圓(或方塊)加一個洞,放多大都不會糊,可以拿去印實體貼紙。
// 圖紙:格子圖,每格寫色號,下面附每色顆數——照著用實體豆子拼。

import { assertCanvasSize } from "@/lib/canvas-limits";
import { hexToRgb } from "./color";
import { canvasToPng, meltGeometry, tileGeometry } from "./draw";
import { MATERIAL_CLEAR, materialAt, type BeadShape } from "./finish";
import type { BeadColor } from "./palette";
import { countColors, type BeadPattern } from "./pattern";

const BOARD_COLOR = "#ecebe6";

/** 數字留到小數兩位就夠印刷用,檔案也小一點 */
const n = (value: number) => Number(value.toFixed(2));

/** 一顆豆子的 SVG path:外形 + 洞(配 fill-rule="evenodd") */
function beadPathData(cx: number, cy: number, cell: number, melt: number, shape: BeadShape): string {
  const { outer, hole } = meltGeometry(melt);
  let d: string;

  if (shape === "square") {
    const { half, corner } = tileGeometry(melt);
    const h = half * cell;
    const r = Math.min(corner * cell, h);
    const x0 = cx - h;
    const y0 = cy - h;
    const size = h * 2;
    d =
      `M${n(x0 + r)} ${n(y0)}h${n(size - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}` +
      `v${n(size - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(size - 2 * r))}` +
      `a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}v${n(-(size - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}z`;
  } else {
    const r = outer * cell;
    d = `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`;
  }

  const h = hole * cell;
  if (h > 0.05) {
    d += `M${n(cx - h)} ${n(cy)}a${n(h)} ${n(h)} 0 1 0 ${n(2 * h)} 0a${n(h)} ${n(h)} 0 1 0 ${n(-2 * h)} 0z`;
  }
  return d;
}

export type SvgOptions = {
  melt: number;
  shape: BeadShape;
  /** 連板子一起(含柱子);false = 透明背景 */
  board: boolean;
  /** 一格在 SVG 座標裡多大;印刷時用實際尺寸換算(拼豆一格約 5mm) */
  cell?: number;
};

/**
 * 格子資料 → SVG。同色的豆子併成一條 path,檔案小、在繪圖軟體裡也好選。
 * 半透明的豆子另外一組帶 opacity。
 */
export function patternToSvg(
  pattern: BeadPattern,
  palette: BeadColor[],
  { melt, shape, board, cell = 10 }: SvgOptions
): string {
  const width = pattern.cols * cell;
  const height = pattern.rows * cell;
  const groups = new Map<string, string[]>();

  pattern.cells.forEach((color, i) => {
    if (color < 0) return;
    const cx = ((i % pattern.cols) + 0.5) * cell;
    const cy = (Math.floor(i / pattern.cols) + 0.5) * cell;
    const clear = materialAt(pattern, i) === MATERIAL_CLEAR;
    const key = `${palette[color].hex}|${clear ? 1 : 0}`;
    const list = groups.get(key) ?? [];
    list.push(beadPathData(cx, cy, cell, melt, shape));
    groups.set(key, list);
  });

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  if (board) {
    parts.push(`<rect width="${width}" height="${height}" fill="${BOARD_COLOR}"/>`);
    const pegs: string[] = [];
    const r = cell * 0.14;
    for (let row = 0; row < pattern.rows; row += 1) {
      for (let col = 0; col < pattern.cols; col += 1) {
        const cx = (col + 0.5) * cell;
        const cy = (row + 0.5) * cell;
        pegs.push(`M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`);
      }
    }
    parts.push(`<path fill="#d6d3cb" d="${pegs.join("")}"/>`);
  }

  for (const [key, paths] of groups) {
    const [hex, clear] = key.split("|");
    const opacity = clear === "1" ? ' fill-opacity="0.6"' : "";
    parts.push(`<path fill="${hex}"${opacity} fill-rule="evenodd" d="${paths.join("")}"/>`);
  }

  parts.push("</svg>");
  return parts.join("\n");
}

/** 圖紙格子裡寫的字:色號去掉字母,只留數字(W15 → 15),小格子才塞得下 */
export function sheetLabel(code: string): string {
  return code.replace(/^[A-Za-z]+0*/, "") || code;
}

/** 底色太暗就用白字,不然用黑字(相對亮度,WCAG 的算法) */
export function readableInk(hex: string): "#000000" | "#ffffff" {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // 黑字對比 (L+0.05)/0.05,白字對比 1.05/(L+0.05),哪個大用哪個
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}

export type SheetEntry = { index: number; code: string; label: string; name: string; reading: string; hex: string; count: number };

/** 圖紙下方的清單:用到的每個顏色、色號、顆數,依色號排(找豆子時照順序找) */
export function sheetLegend(pattern: BeadPattern, palette: BeadColor[]): SheetEntry[] {
  return countColors(pattern.cells)
    .map(({ index, count }) => ({
      index,
      code: palette[index].code,
      label: sheetLabel(palette[index].code),
      name: palette[index].name,
      reading: palette[index].reading,
      hex: palette[index].hex,
      count,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** 圖紙每格幾像素:夠寫兩位數 */
const SHEET_CELL = 24;
const SHEET_MARGIN = 36;
const LEGEND_ROW = 28;
const LEGEND_COL = 260;

/** 圖紙 PNG:上面格子圖(每 5 格一條粗線、每 29 格一塊小板的邊界最粗),下面每色顆數 */
export async function renderSheetPng(
  pattern: BeadPattern,
  palette: BeadColor[],
  title: string
): Promise<Blob> {
  const legend = sheetLegend(pattern, palette);
  const gridWidth = pattern.cols * SHEET_CELL;
  const gridHeight = pattern.rows * SHEET_CELL;
  const width = Math.max(gridWidth + SHEET_MARGIN * 2, LEGEND_COL * 2 + SHEET_MARGIN * 2);
  const perRow = Math.max(1, Math.floor((width - SHEET_MARGIN * 2) / LEGEND_COL));
  const legendHeight = Math.ceil(legend.length / perRow) * LEGEND_ROW;
  // 標題兩行 + 上方座標的高度
  const top = SHEET_MARGIN + 56;
  const height = top + gridHeight + 40 + legendHeight + SHEET_MARGIN;
  assertCanvasSize(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立繪圖環境");

  const font = (size: number, weight = 400) =>
    `${weight} ${size}px system-ui, "Noto Sans TC", "PingFang TC", sans-serif`;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const total = legend.reduce((sum, item) => sum + item.count, 0);
  ctx.fillStyle = "#222222";
  ctx.font = font(18, 600);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, SHEET_MARGIN, SHEET_MARGIN + 6);
  ctx.font = font(13);
  ctx.fillStyle = "#666666";
  ctx.fillText(
    `${pattern.cols} × ${pattern.rows} 格・${legend.length} 色・共 ${total} 顆`,
    SHEET_MARGIN,
    SHEET_MARGIN + 26
  );

  const left = SHEET_MARGIN;

  // 座標:每 5 格標一次,數的時候不用從頭算
  ctx.font = font(10);
  ctx.fillStyle = "#888888";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let col = 4; col < pattern.cols; col += 5) {
    ctx.fillText(String(col + 1), left + (col + 0.5) * SHEET_CELL, top - 3);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let row = 4; row < pattern.rows; row += 5) {
    ctx.fillText(String(row + 1), left - 4, top + (row + 0.5) * SHEET_CELL);
  }

  // 格子
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(10, 600);
  pattern.cells.forEach((color, i) => {
    const x = left + (i % pattern.cols) * SHEET_CELL;
    const y = top + Math.floor(i / pattern.cols) * SHEET_CELL;
    if (color < 0) return;
    ctx.fillStyle = palette[color].hex;
    ctx.fillRect(x, y, SHEET_CELL, SHEET_CELL);
    ctx.fillStyle = readableInk(palette[color].hex);
    ctx.fillText(sheetLabel(palette[color].code), x + SHEET_CELL / 2, y + SHEET_CELL / 2 + 0.5);
  });

  // 格線:細線每格、粗一點每 5 格、最粗每 29 格(一塊小板)
  const line = (x0: number, y0: number, x1: number, y1: number, widthPx: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = widthPx;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  const weight = (k: number, size: number) =>
    k === 0 || k === size || k % 29 === 0 ? [2.5, "#333333"] as const : k % 5 === 0 ? [1.2, "#777777"] as const : [0.5, "#bbbbbb"] as const;
  for (let col = 0; col <= pattern.cols; col += 1) {
    const [w, c] = weight(col, pattern.cols);
    line(left + col * SHEET_CELL, top, left + col * SHEET_CELL, top + gridHeight, w, c);
  }
  for (let row = 0; row <= pattern.rows; row += 1) {
    const [w, c] = weight(row, pattern.rows);
    line(left, top + row * SHEET_CELL, left + gridWidth, top + row * SHEET_CELL, w, c);
  }

  // 顏色清單
  const legendTop = top + gridHeight + 40;
  ctx.textAlign = "left";
  legend.forEach((item, k) => {
    const x = SHEET_MARGIN + (k % perRow) * LEGEND_COL;
    const y = legendTop + Math.floor(k / perRow) * LEGEND_ROW;
    ctx.fillStyle = item.hex;
    ctx.fillRect(x, y, 22, 22);
    ctx.strokeStyle = "#999999";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, 21, 21);
    ctx.fillStyle = readableInk(item.hex);
    ctx.font = font(10, 600);
    ctx.textAlign = "center";
    ctx.fillText(item.label, x + 11, y + 11.5);
    ctx.textAlign = "left";
    ctx.fillStyle = "#222222";
    ctx.font = font(13);
    ctx.fillText(`${item.code} ${item.name}`, x + 30, y + 11);
    ctx.fillStyle = "#666666";
    ctx.fillText(`${item.count} 顆`, x + 190, y + 11);
  });

  return canvasToPng(canvas);
}
