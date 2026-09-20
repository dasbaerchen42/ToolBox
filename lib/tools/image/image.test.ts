import { checkCanvasSize, DEVICE_MAX_SIDE } from "@/lib/canvas-limits";
import {
  clampRect,
  isPointInRect,
  isUsableRect,
  moveRectWithin,
  rectFromPoints,
  toImagePoint,
} from "./geometry";
import {
  countPieces,
  cutsToSpans,
  equalCutPositions,
  normalizeCuts,
  spanToRect,
} from "./slice";
import { coverRect, layoutGrid, layoutMerge, suggestCellWidth } from "./merge";
import { borderLayout, ratioLayout } from "./frame";
import { baseNameOf, buildFileName, supportsAlpha, supportsQuality } from "./format";

describe("geometry:顯示座標換原圖座標", () => {
  it("等比縮放時照比例還原", () => {
    // 畫面上寬 300,原圖寬 900 → 畫面上的 100 是原圖的 300
    const point = toImagePoint(
      { x: 100, y: 50 },
      { width: 300, height: 200 },
      { width: 900, height: 600 }
    );
    expect(point).toEqual({ x: 300, y: 150 });
  });

  it("非等比縮放時兩軸各自換算", () => {
    const point = toImagePoint(
      { x: 50, y: 50 },
      { width: 100, height: 100 },
      { width: 1000, height: 200 }
    );
    expect(point).toEqual({ x: 500, y: 100 });
  });

  it("顯示尺寸還沒量到(0)時不會除以零", () => {
    expect(
      toImagePoint({ x: 10, y: 10 }, { width: 0, height: 0 }, { width: 100, height: 100 })
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("geometry:矩形", () => {
  it("從右下往左上拖也要得到正的寬高", () => {
    expect(rectFromPoints({ x: 80, y: 90 }, { x: 20, y: 30 })).toEqual({
      x: 20,
      y: 30,
      width: 60,
      height: 60,
    });
  });

  it("超出圖片的部分會被切掉", () => {
    expect(
      clampRect({ x: -10, y: -10, width: 200, height: 200 }, { width: 100, height: 50 })
    ).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it("整個框都在圖外時寬高歸零", () => {
    const rect = clampRect(
      { x: 500, y: 500, width: 50, height: 50 },
      { width: 100, height: 100 }
    );
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  it("手滑點出來的小框不算數", () => {
    expect(isUsableRect({ x: 0, y: 0, width: 1, height: 40 })).toBe(false);
    expect(isUsableRect({ x: 0, y: 0, width: 40, height: 40 })).toBe(true);
  });

  it("點在框裡", () => {
    const rect = { x: 10, y: 10, width: 20, height: 20 };
    expect(isPointInRect({ x: 15, y: 15 }, rect)).toBe(true);
    expect(isPointInRect({ x: 5, y: 15 }, rect)).toBe(false);
  });

  it("拖動遮罩不會被推出圖外,而且維持原寬高", () => {
    const moved = moveRectWithin(
      { x: 80, y: 80, width: 30, height: 30 },
      { x: 999, y: 999 },
      { width: 100, height: 100 }
    );
    expect(moved).toEqual({ x: 70, y: 70, width: 30, height: 30 });
  });
});

describe("slice:等分切", () => {
  it("整除時刀落在整數位置", () => {
    expect(equalCutPositions(900, 3)).toEqual([300, 600]);
  });

  it("除不盡時餘數分給前面幾段,不會留下 1px 的尾巴", () => {
    const cuts = equalCutPositions(1000, 3);
    expect(cuts).toEqual([334, 667]);

    const spans = cutsToSpans(cuts, 1000);
    expect(spans.map((span) => span.size)).toEqual([334, 333, 333]);
    expect(spans.reduce((sum, span) => sum + span.size, 0)).toBe(1000);
  });

  it("切一份等於不切", () => {
    expect(equalCutPositions(900, 1)).toEqual([]);
  });

  it("份數比像素還多時不給切", () => {
    expect(equalCutPositions(3, 10)).toEqual([]);
  });
});

describe("slice:自由下刀", () => {
  it("排序、去重、丟掉範圍外的刀", () => {
    expect(normalizeCuts([500, 100, 100, 0, 900, -5, 1200], 900)).toEqual([100, 500]);
  });

  it("切點換成每一段的起點與長度,加起來等於原長", () => {
    const spans = cutsToSpans([200, 500], 900);
    expect(spans).toEqual([
      { start: 0, size: 200 },
      { start: 200, size: 300 },
      { start: 500, size: 400 },
    ]);
  });

  it("沒有刀就是一整段", () => {
    expect(cutsToSpans([], 900)).toEqual([{ start: 0, size: 900 }]);
  });

  it("段數 = 有效刀數 + 1", () => {
    expect(countPieces([100, 100, 9999], 900)).toBe(2);
  });

  it("橫刀留住整個寬度,直刀留住整個高度", () => {
    const size = { width: 400, height: 900 };
    expect(spanToRect({ start: 200, size: 300 }, "y", size)).toEqual({
      x: 0,
      y: 200,
      width: 400,
      height: 300,
    });
    expect(spanToRect({ start: 100, size: 150 }, "x", size)).toEqual({
      x: 100,
      y: 0,
      width: 150,
      height: 900,
    });
  });
});

describe("merge:拼接版面", () => {
  const sizes = [
    { width: 100, height: 50 },
    { width: 200, height: 80 },
  ];

  it("直向堆疊:高度相加,寬度取最寬", () => {
    const layout = layoutMerge(sizes, { axis: "y", align: "start", fit: "none", gap: 0 });
    expect(layout.canvas).toEqual({ width: 200, height: 130 });
    expect(layout.placements).toEqual([
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 200, height: 80 },
    ]);
  });

  it("間距會算進總長,但不會多出尾端的一段", () => {
    const layout = layoutMerge(sizes, { axis: "y", align: "start", fit: "none", gap: 20 });
    expect(layout.canvas.height).toBe(50 + 20 + 80);
  });

  it("置中對齊時窄的那張往中間靠", () => {
    const layout = layoutMerge(sizes, { axis: "y", align: "center", fit: "none", gap: 0 });
    expect(layout.placements[0].x).toBe(50);
    expect(layout.placements[1].x).toBe(0);
  });

  it("靠右對齊", () => {
    const layout = layoutMerge(sizes, { axis: "y", align: "end", fit: "none", gap: 0 });
    expect(layout.placements[0].x).toBe(100);
  });

  it("fit=min 全部縮到最窄,而且是等比縮放", () => {
    const layout = layoutMerge(sizes, { axis: "y", align: "start", fit: "min", gap: 0 });
    expect(layout.canvas.width).toBe(100);
    // 200×80 等比縮到寬 100 → 高度也要減半
    expect(layout.placements[1]).toEqual({ x: 0, y: 50, width: 100, height: 40 });
  });

  it("fit=max 全部放到最寬", () => {
    const layout = layoutMerge(sizes, { axis: "y", align: "start", fit: "max", gap: 0 });
    expect(layout.canvas.width).toBe(200);
    expect(layout.placements[0]).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it("橫向排列時換成寬度相加、高度取最高", () => {
    const layout = layoutMerge(sizes, { axis: "x", align: "start", fit: "none", gap: 0 });
    expect(layout.canvas).toEqual({ width: 300, height: 80 });
    expect(layout.placements[1].x).toBe(100);
  });

  it("沒有圖就沒有畫布", () => {
    expect(layoutMerge([], { axis: "y", align: "start", fit: "none", gap: 0 })).toEqual({
      canvas: { width: 0, height: 0 },
      placements: [],
    });
  });
});

describe("frame:描邊", () => {
  it("往外描邊時圖變大,內容位置往內推一個線寬", () => {
    const layout = borderLayout({ width: 100, height: 200 }, 10, "outset");
    expect(layout.canvas).toEqual({ width: 120, height: 220 });
    expect(layout.draw).toEqual({ x: 10, y: 10, width: 100, height: 200 });
  });

  it("往內描邊時尺寸不變", () => {
    const layout = borderLayout({ width: 100, height: 200 }, 10, "inset");
    expect(layout.canvas).toEqual({ width: 100, height: 200 });
    expect(layout.draw).toEqual({ x: 0, y: 0, width: 100, height: 200 });
  });
});

describe("frame:補成比例", () => {
  it("長條圖補成正方形是往左右補,高度不動", () => {
    const layout = ratioLayout(
      { width: 400, height: 1000 },
      { w: 1, h: 1 },
      { x: "center", y: "center" }
    );
    expect(layout.canvas).toEqual({ width: 1000, height: 1000 });
    expect(layout.draw).toEqual({ x: 300, y: 0, width: 400, height: 1000 });
  });

  it("寬圖補成正方形是往上下補", () => {
    const layout = ratioLayout(
      { width: 1000, height: 400 },
      { w: 1, h: 1 },
      { x: "center", y: "center" }
    );
    expect(layout.canvas).toEqual({ width: 1000, height: 1000 });
    expect(layout.draw.y).toBe(300);
  });

  it("絕不縮放或裁切原圖", () => {
    const size = { width: 939, height: 2000 };
    const layout = ratioLayout(size, { w: 4, h: 5 }, { x: "center", y: "start" });
    expect(layout.draw.width).toBe(size.width);
    expect(layout.draw.height).toBe(size.height);
    expect(layout.canvas.width).toBeGreaterThanOrEqual(size.width);
    expect(layout.canvas.height).toBeGreaterThanOrEqual(size.height);
  });

  it("已經是目標比例就原樣不動", () => {
    const layout = ratioLayout(
      { width: 500, height: 500 },
      { w: 1, h: 1 },
      { x: "center", y: "center" }
    );
    expect(layout.canvas).toEqual({ width: 500, height: 500 });
    expect(layout.draw).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });
});

describe("format", () => {
  it("PNG 沒有品質參數,但存得住透明", () => {
    expect(supportsQuality("png")).toBe(false);
    expect(supportsAlpha("png")).toBe(true);
  });

  it("JPEG 存不住透明——所以輸出前一定要墊底色", () => {
    expect(supportsAlpha("jpeg")).toBe(false);
    expect(supportsAlpha("webp")).toBe(true);
  });

  it("檔名去掉副檔名,並清掉不能當檔名的字元", () => {
    expect(baseNameOf("螢幕截圖 2026-09-19.png")).toBe("螢幕截圖 2026-09-19");
    expect(baseNameOf("a/b:c.png")).toBe("a_b_c");
  });

  it("單張不編號,多張才補序號而且位數對齊", () => {
    expect(buildFileName("圖片", "png")).toBe("圖片.png");
    expect(buildFileName("圖片", "jpeg", 0, 3)).toBe("圖片-1.jpg");
    expect(buildFileName("圖片", "webp", 9, 12)).toBe("圖片-10.webp");
  });
});

describe("canvas 上限", () => {
  it("一般尺寸過關", () => {
    expect(checkCanvasSize(939, 2000)).toEqual({ ok: true });
  });

  it("超長圖會被邊長上限擋下來——這正是要先切再拼的原因", () => {
    const result = checkCanvasSize(939, DEVICE_MAX_SIDE + 1);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "side" });
  });

  it("邊長都沒爆但總面積爆了也要擋", () => {
    const result = checkCanvasSize(8000, 8000);
    expect(result).toMatchObject({ ok: false, reason: "area" });
  });
});

describe("merge:棋盤拼貼", () => {
  const square = { w: 1, h: 1 };
  const base = {
    columns: 3,
    cellWidth: 100,
    ratio: square,
    fit: "cover" as const,
    gap: 0,
    lastRow: "start" as const,
  };
  const nine = Array.from({ length: 9 }, () => ({ width: 200, height: 200 }));

  it("九宮格:三欄三列，格子等大", () => {
    const layout = layoutGrid(nine, base);
    expect(layout.canvas).toEqual({ width: 300, height: 300 });
    expect(layout.placements).toHaveLength(9);
    expect(layout.placements.every((p) => p.width === 100 && p.height === 100)).toBe(true);
  });

  it("照列優先排,左上到右下", () => {
    const layout = layoutGrid(nine, base);
    expect(layout.placements[0]).toMatchObject({ x: 0, y: 0 });
    expect(layout.placements[2]).toMatchObject({ x: 200, y: 0 });
    expect(layout.placements[3]).toMatchObject({ x: 0, y: 100 });
    expect(layout.placements[8]).toMatchObject({ x: 200, y: 200 });
  });

  it("間距算進畫布,但不會多出邊緣那一圈", () => {
    const layout = layoutGrid(nine, { ...base, gap: 10 });
    expect(layout.canvas).toEqual({ width: 320, height: 320 });
    expect(layout.placements[8]).toMatchObject({ x: 220, y: 220 });
  });

  it("張數不滿時最後一列可以置中", () => {
    const seven = nine.slice(0, 7);
    const start = layoutGrid(seven, base);
    const center = layoutGrid(seven, { ...base, lastRow: "center" });

    // 7 張 3 欄 → 最後一列只有 1 張,置中要往右推一格
    expect(start.placements[6].x).toBe(0);
    expect(center.placements[6].x).toBe(100);
    // 前面幾列不受影響
    expect(center.placements[0].x).toBe(0);
  });

  it("非正方形的格子照比例算高度", () => {
    const layout = layoutGrid(nine.slice(0, 3), {
      ...base,
      columns: 3,
      ratio: { w: 4, h: 5 },
    });
    expect(layout.canvas).toEqual({ width: 300, height: 125 });
  });

  it("裁切填滿:目的地是整個格子,另外帶要裁的來源", () => {
    // 寬圖放進正方形格子 → 左右各裁掉一些,高度整個保留
    const layout = layoutGrid([{ width: 400, height: 100 }], { ...base, columns: 1 });
    const place = layout.placements[0];

    expect(place).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    expect(place.source).toEqual({ x: 150, y: 0, width: 100, height: 100 });
  });

  it("完整留白:圖縮到放得進去並置中,沒有來源裁切", () => {
    const layout = layoutGrid([{ width: 400, height: 100 }], {
      ...base,
      columns: 1,
      fit: "contain",
    });
    const place = layout.placements[0];

    // 400×100 縮到寬 100 → 100×25,垂直置中落在 y=38
    expect(place).toMatchObject({ width: 100, height: 25 });
    expect(place.y).toBe(38);
    expect(place.source).toBeUndefined();
  });

  it("裁切填滿永不拉變形:來源的長寬比等於格子的長寬比", () => {
    for (const size of [
      { width: 400, height: 100 },
      { width: 100, height: 400 },
      { width: 333, height: 777 },
    ]) {
      const source = coverRect(size, { width: 100, height: 100 });
      expect(source.width).toBe(source.height);
      // 而且不會裁到圖片以外
      expect(source.x + source.width).toBeLessThanOrEqual(size.width);
      expect(source.y + source.height).toBeLessThanOrEqual(size.height);
    }
  });

  it("格子比原圖大時整張都用上,不是裁一小塊", () => {
    const source = coverRect({ width: 50, height: 50 }, { width: 500, height: 500 });
    expect(source).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it("沒有圖就沒有畫布", () => {
    expect(layoutGrid([], base)).toEqual({ canvas: { width: 0, height: 0 }, placements: [] });
  });

  it("預設格子寬度取最大那張,避免把圖放大到糊掉", () => {
    expect(suggestCellWidth([{ width: 300, height: 1 }, { width: 900, height: 1 }])).toBe(900);
    expect(suggestCellWidth([])).toBe(1000);
  });
});
