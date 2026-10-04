import { autoCuts, EXPORT_IMAGE_SCALE, pageSizes } from "./export-image";

describe("轉圖:手動分頁的尺寸", () => {
  it("每一張 = 那幾段加起來 + 上下留白,換成輸出像素", () => {
    const sizes = pageSizes([100, 200, 300], new Set([0]), 1080, 50);
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toEqual({ width: 1080 * EXPORT_IMAGE_SCALE, height: (100 + 100) * EXPORT_IMAGE_SCALE, content: 100 });
    expect(sizes[1].content).toBe(500);
  });

  it("最後一段之後的切點不算", () => {
    expect(pageSizes([100, 200], new Set([1]), 600, 0)).toHaveLength(1);
  });

  it("照自動分頁先排:塞不下就在前一段之後切", () => {
    expect([...autoCuts([300, 300, 300, 300], 650)]).toEqual([1]);
    expect([...autoCuts([100, 900, 100], 500)].sort()).toEqual([0, 1]);
    expect(autoCuts([100, 100], 1000).size).toBe(0);
  });
});
