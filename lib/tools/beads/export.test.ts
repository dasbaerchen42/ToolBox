import { patternToSvg, readableInk, sheetLabel, sheetLegend } from "./export";
import { DEFAULT_PALETTE } from "./palette";
import { TEMPLATES, templatePattern } from "./templates";

const codeIndex = (code: string) => DEFAULT_PALETTE.findIndex((color) => color.code === code);

describe("templates:內建模板", () => {
  it.each(TEMPLATES.map((template) => [template.name, template]))("%s 的格子與色位都對得上", (_, template) => {
    const width = template.rows[0].length;
    for (const row of template.rows) {
      expect(row).toHaveLength(width);
      expect(row).toMatch(/^[.1-9]+$/);
    }
    const used = new Set(template.rows.join("").replace(/\./g, ""));
    for (const slot of used) expect(Number(slot)).toBeLessThanOrEqual(template.slots.length);
    for (const code of template.slots) expect(codeIndex(code)).toBeGreaterThanOrEqual(0);
  });

  it("id 不重複", () => {
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
  });

  it("套用模板:預設顏色照色號,也可以指定每個色位的顏色", () => {
    const heart = TEMPLATES.find((template) => template.id === "heart-5")!;
    const pattern = templatePattern(heart, DEFAULT_PALETTE);
    expect(pattern.cols).toBe(5);
    expect(pattern.rows).toBe(5);
    expect(pattern.cells[0]).toBe(-1);
    expect(pattern.cells[1]).toBe(codeIndex("W15"));

    const blue = templatePattern(heart, DEFAULT_PALETTE, [codeIndex("W54")]);
    expect(blue.cells[1]).toBe(codeIndex("W54"));
    expect(blue.cells.filter((cell) => cell >= 0)).toHaveLength(16);
  });
});

describe("export:SVG", () => {
  const pattern = { cols: 2, rows: 1, cells: [0, codeIndex("W15")], materials: [0, 3] };

  it("同色併成一條 path,半透明另外一組", () => {
    const svg = patternToSvg(pattern, DEFAULT_PALETTE, { melt: 0, shape: "round", board: false });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="20" height="10"/);
    expect(svg).toContain('fill="#ffffff" fill-rule="evenodd"');
    expect(svg).toContain('fill="#e2041b" fill-opacity="0.6"');
    expect(svg).not.toContain("<rect");
  });

  it("有洞的豆子是外圈加內圈兩段;全燙沒有洞", () => {
    const raw = patternToSvg({ cols: 1, rows: 1, cells: [0] }, DEFAULT_PALETTE, { melt: 0, shape: "round", board: false });
    const full = patternToSvg({ cols: 1, rows: 1, cells: [0] }, DEFAULT_PALETTE, { melt: 1, shape: "round", board: false });
    expect((raw.match(/M/g) ?? []).length).toBe(2);
    expect((full.match(/M/g) ?? []).length).toBe(1);
  });

  it("連板子一起時有底色與柱子;方磚用圓角方形", () => {
    const svg = patternToSvg({ cols: 1, rows: 1, cells: [0] }, DEFAULT_PALETTE, { melt: 1, shape: "square", board: true });
    expect(svg).toContain('<rect width="10" height="10" fill="#ecebe6"/>');
    expect(svg).toContain('fill="#d6d3cb"');
    expect(svg).toMatch(/h[\d.]+a[\d.]+ [\d.]+ 0 0 1/);
  });

  it("空板就只有外框", () => {
    const svg = patternToSvg({ cols: 2, rows: 2, cells: [-1, -1, -1, -1] }, DEFAULT_PALETTE, { melt: 0, shape: "round", board: false });
    expect(svg).not.toContain("<path");
  });
});

describe("export:圖紙", () => {
  it("格子裡只寫色號的數字", () => {
    expect(sheetLabel("W15")).toBe("15");
    expect(sheetLabel("W01")).toBe("1");
    expect(sheetLabel("P36")).toBe("36");
  });

  it("深色底用白字、淺色底用黑字", () => {
    expect(readableInk("#0d0015")).toBe("#ffffff");
    expect(readableInk("#ffffff")).toBe("#000000");
    expect(readableInk("#fbca4d")).toBe("#000000");
  });

  it("清單依色號排,附顆數", () => {
    const pattern = { cols: 3, rows: 1, cells: [codeIndex("W15"), 0, codeIndex("W15")] };
    expect(sheetLegend(pattern, DEFAULT_PALETTE).map((item) => [item.code, item.count])).toEqual([
      ["W01", 1],
      ["W15", 2],
    ]);
  });
});
