import { fromSavedWork, parseAlbum, serializeAlbum, toSavedWork } from "./album";
import { DEFAULT_PALETTE } from "./palette";
import { boardSize } from "./pattern";
import { boardMask, clipToOutline, onBoard, outlineContains } from "./outline";

describe("outline:板子外形", () => {
  it("方形沒有遮罩;其他外形中間有柱子、角落沒有", () => {
    expect(boardMask("rect", 29, 29)).toBeNull();
    expect(boardMask(undefined, 29, 29)).toBeNull();
    for (const outline of ["circle", "hexagon", "heart"] as const) {
      const mask = boardMask(outline, 29, 29)!;
      expect(mask[14 * 29 + 14]).toBe(1); // 正中間
      expect(mask[0]).toBe(0); // 左上角
      expect(mask[29 * 29 - 1]).toBe(0); // 右下角
    }
  });

  it("圓形大約佔 π/4;愛心的尖端在下面", () => {
    const mask = boardMask("circle", 58, 58)!;
    const ratio = mask.reduce((sum, v) => sum + v, 0) / mask.length;
    expect(ratio).toBeGreaterThan(0.74);
    expect(ratio).toBeLessThan(0.82);
    // 愛心:上緣中間是凹口,下緣中間是尖端
    expect(outlineContains("heart", 0, -0.9)).toBe(false);
    expect(outlineContains("heart", 0, 0.9)).toBe(true);
    expect(outlineContains("heart", -0.5, -0.7)).toBe(true);
  });

  it("板子外面的豆子與材質會被清掉;沒有要清的就回傳原陣列", () => {
    const pattern = { cols: 9, rows: 9, outline: "circle" as const };
    const cells = new Array(81).fill(3);
    const materials = new Array(81).fill(2);
    const clipped = clipToOutline(pattern, cells, materials);
    expect(clipped.cells[0]).toBe(-1);
    expect(clipped.materials![0]).toBe(0);
    expect(clipped.cells[40]).toBe(3);
    expect(onBoard(pattern, 0)).toBe(false);
    expect(onBoard(pattern, 40)).toBe(true);

    const again = clipToOutline(pattern, clipped.cells, clipped.materials);
    expect(again.cells).toBe(clipped.cells);
    expect(again.materials).toBe(clipped.materials);
    expect(clipToOutline({ cols: 9, rows: 9 }, cells).cells).toBe(cells);
  });

  it("圓形、六角形、愛心形的照片板子都是正方形", () => {
    for (const shape of ["circle", "hexagon", "heart"] as const) {
      expect(boardSize(1000, 500, 58, shape)).toEqual({ cols: 58, rows: 58 });
    }
  });

  it("收藏冊會記住外形;方形不存;壞掉的外形當成方形", () => {
    const pattern = { cols: 9, rows: 9, cells: new Array(81).fill(-1), outline: "heart" as const };
    const saved = toSavedWork(pattern, DEFAULT_PALETTE, "愛心板");
    expect(saved.outline).toBe("heart");
    expect(fromSavedWork(saved, DEFAULT_PALETTE).outline).toBe("heart");
    expect(toSavedWork({ ...pattern, outline: "rect" as const }, DEFAULT_PALETTE, "x").outline).toBeUndefined();

    const roundTrip = parseAlbum(serializeAlbum([saved])).works[0];
    expect(roundTrip.outline).toBe("heart");
    const broken = JSON.parse(serializeAlbum([saved]));
    (Array.isArray(broken) ? broken[0] : broken.works[0]).outline = "triangle";
    expect(parseAlbum(JSON.stringify(broken)).works[0].outline).toBeUndefined();
  });
});
