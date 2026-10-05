import {
  autoCuts,
  EXPORT_IMAGE_SCALE,
  EXPORT_TEXT_SIZES,
  exportLayout,
  pageRanges,
  pageSizes,
  type UnitBox,
} from "./export-layout";
import { defaultPreferences } from "./preferences";

/** 一段段疊起來:每段 heights[i] 高,段與段之間空 gap */
function stack(heights: number[], gap = 0): UnitBox[] {
  let top = 0;
  return heights.map((height) => {
    const box = { top, bottom: top + height };
    top += height + gap;
    return box;
  });
}

describe("轉圖:分頁的尺寸", () => {
  it("每一張 = 第一段上緣到最後一段下緣 + 上下留白,換成輸出像素", () => {
    const sizes = pageSizes(stack([100, 200, 300]), new Set([0]), 1080, 50);
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toEqual({ from: 0, to: 0, width: 1080 * EXPORT_IMAGE_SCALE, height: (100 + 100) * EXPORT_IMAGE_SCALE, content: 100 });
    expect(sizes[1].content).toBe(500);
  });

  it("段距算在中間,不算在每張的頭尾", () => {
    const sizes = pageSizes(stack([100, 100, 100], 20), new Set([1]), 600, 0);
    expect(sizes.map((size) => size.content)).toEqual([220, 100]);
  });

  it("最後一段之後的切點不算", () => {
    expect(pageSizes(stack([100, 200]), new Set([1]), 600, 0)).toHaveLength(1);
    expect(pageRanges(3, new Set([0, 2]))).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it("自動分頁:塞不下就在前一段之後切", () => {
    expect([...autoCuts(stack([300, 300, 300, 300]), 650)]).toEqual([1]);
    expect([...autoCuts(stack([100, 900, 100]), 500)].sort()).toEqual([0, 1]);
    expect(autoCuts(stack([100, 100]), 1000).size).toBe(0);
  });
});

describe("轉圖:字級", () => {
  it("照一行幾個字反推字級,寬度變了比例不變", () => {
    const prefs = { ...defaultPreferences, exportTextSize: "m" as const };
    const wide = exportLayout(1080, prefs);
    const narrow = exportLayout(600, prefs);
    const perLine = EXPORT_TEXT_SIZES.m.perLine;
    expect(Math.floor(wide.contentWidth / wide.fontSize)).toBe(perLine);
    expect(Math.floor(narrow.contentWidth / narrow.fontSize)).toBe(perLine);
    // 1080 寬的圖字要夠大,手機上看才讀得下去(以前是 16px)
    expect(wide.fontSize).toBeGreaterThan(30);
  });

  it("字距沿用編輯器設定的比例,也算進一行的寬度", () => {
    const layout = exportLayout(1080, { ...defaultPreferences, fontSize: 16, letterSpacing: 1.6, exportTextSize: "m" });
    expect(layout.letterSpacing / layout.fontSize).toBeCloseTo(0.1, 2);
    expect(Math.floor(layout.contentWidth / (layout.fontSize + layout.letterSpacing))).toBe(EXPORT_TEXT_SIZES.m.perLine);
  });

  it("字越大一行越少字", () => {
    const sizes = (["s", "m", "l", "xl"] as const).map((size) => exportLayout(1080, { ...defaultPreferences, exportTextSize: size }).fontSize);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });
});
