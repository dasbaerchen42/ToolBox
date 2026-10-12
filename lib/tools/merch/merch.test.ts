import { clampPlacement, defaultDesigns, placeSticker } from "./design";
import { readStoredMerch, sanitizeDesigns } from "./persist";
import { eraseCircle, eraseSelection, opaqueBounds, wandSelect, type Pixels } from "../image/wand";
import {
  applyHomography,
  homography,
  isConvex,
  rectQuad,
  triangleAffine,
  type Quad,
} from "./perspective";

function image(width: number, height: number, paint: (x: number, y: number) => number[]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(paint(x, y), (y * width + x) * 4);
  return { width, height, data };
}

const alphaAt = (px: { data: Uint8ClampedArray; width: number }, data: Uint8ClampedArray, x: number, y: number) =>
  data[(y * px.width + x) * 4 + 3];

describe("wand:魔術棒", () => {
  // 白底中間一個紅方塊,方塊右下角連著一條很淡的灰(容許值內)
  const px = image(10, 10, (x, y) =>
    x >= 3 && x <= 6 && y >= 3 && y <= 6 ? [220, 30, 30, 255] : x === 9 ? [240, 240, 240, 255] : [255, 255, 255, 255]
  );

  it("點背景:相連的相近顏色都選進來,紅方塊不選", () => {
    const mask = wandSelect(px, 0, 0, 0.1);
    expect(mask[0]).toBe(1);
    expect(mask[9]).toBe(1); // 淡灰在容許值內
    expect(mask[4 * 10 + 4]).toBe(0);
  });

  it("容許值 0 只選完全一樣的顏色", () => {
    const mask = wandSelect(px, 0, 0, 0);
    expect(mask[9]).toBe(0);
  });

  it("不相連的同色不會被選到", () => {
    // 紅框裡包著一塊白:從外面點,裡面那塊白不選
    const ring = image(7, 7, (x, y) =>
      (x === 1 || x === 5 || y === 1 || y === 5) && x >= 1 && x <= 5 && y >= 1 && y <= 5
        ? [200, 0, 0, 255]
        : [255, 255, 255, 255]
    );
    const mask = wandSelect(ring, 0, 0, 0.05);
    expect(mask[3 * 7 + 3]).toBe(0);
    expect(mask[0]).toBe(1);
  });

  it("清掉選區;羽化讓外緣一圈半透明", () => {
    const mask = wandSelect(px, 0, 0, 0.1);
    const hard = eraseSelection(px, mask, 0);
    expect(alphaAt(px, hard, 0, 0)).toBe(0);
    expect(alphaAt(px, hard, 3, 3)).toBe(255);

    // 羽化 1 格:只有緊貼選區的那一圈變淡(紅方塊只有 4×4,寬一點就整塊都在外緣裡)
    const soft = eraseSelection(px, mask, 1);
    const edge = alphaAt(px, soft, 3, 3);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(alphaAt(px, soft, 5, 5)).toBe(255); // 離邊緣夠遠的地方不受影響
  });

  it("點在範圍外什麼都不選", () => {
    expect(wandSelect(px, -1, 50, 0.5).some(Boolean)).toBe(false);
  });

  it("橡皮擦清掉圓形範圍;外框找得到剩下的部分", () => {
    const copy = { ...px, data: new Uint8ClampedArray(px.data) };
    eraseCircle(copy, 0, 0, 2);
    expect(copy.data[3]).toBe(0);
    expect(copy.data[(9 * 10 + 9) * 4 + 3]).toBe(255);

    const cleared = { ...px, data: eraseSelection(px, wandSelect(px, 0, 0, 0.1), 0) };
    expect(opaqueBounds(cleared)).toEqual({ x: 3, y: 3, width: 4, height: 4 });
    expect(opaqueBounds({ ...px, data: new Uint8ClampedArray(px.data.length) })).toBeNull();
  });
});

describe("perspective:透視", () => {
  const src = rectQuad(0, 0, 100, 50);
  const dst: Quad = [
    { x: 10, y: 20 },
    { x: 120, y: 5 },
    { x: 130, y: 90 },
    { x: 0, y: 70 },
  ];

  it("四個角對到四個角", () => {
    const h = homography(src, dst);
    src.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });

  it("沒有變形時就是原地", () => {
    const h = homography(src, src);
    const q = applyHomography(h, { x: 37, y: 12 });
    expect(q.x).toBeCloseTo(37, 6);
    expect(q.y).toBeCloseTo(12, 6);
  });

  it("拖成蝴蝶結或三點共線就不算凸四邊形", () => {
    expect(isConvex(dst)).toBe(true);
    expect(isConvex([dst[0], dst[2], dst[1], dst[3]])).toBe(false);
    expect(isConvex([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
  });

  it("三角形仿射:三個頂點對得上", () => {
    const s = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    const d = [{ x: 5, y: 5 }, { x: 25, y: 8 }, { x: 3, y: 30 }];
    const [a, b, c, dd, e, f] = triangleAffine(s[0], s[1], s[2], d[0], d[1], d[2]);
    s.forEach((p, i) => {
      expect(a * p.x + c * p.y + e).toBeCloseTo(d[i].x, 6);
      expect(b * p.x + dd * p.y + f).toBeCloseTo(d[i].y, 6);
    });
  });
});

describe("design:貼紙擺法與打卡棒的透視延伸", () => {
  it("新貼紙錯開放,不會疊在同一點;拖曳夾在設計區附近", () => {
    const first = placeSticker([], "a");
    const second = placeSticker([first], "b");
    expect(first.x).toBeCloseTo(0.5);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(0.1);
    expect(clampPlacement(2, -1)).toEqual({ x: 1.05, y: -0.05 });
  });

});

describe("persist:周邊存檔", () => {
  it("壞掉或缺欄位的設計補回預設值", () => {
    const base = defaultDesigns();
    const designs = sanitizeDesigns({
      card: { frame: "beads", laser: "yes", stickers: [{ id: "a", artId: "tpl:star-7", x: 0.5, y: 0.5, size: 0.3, rotation: 0 }, { id: 3 }] },
      charm: { pieces: "nope" },
      omamori: { front: "平安", bell: 5 },
      acrylic: { place: { x: 0.5 }, mode: "glass", edge: true, margin: 999 },
    });
    expect(designs.card.frame).toBe("beads");
    expect(designs.card.laser).toBe(base.card.laser);
    expect(designs.card.stickers).toHaveLength(1);
    expect(designs.card.mosaic).toEqual(base.card.mosaic);
    // 舊存檔的搖搖吊飾已經拿掉,讀回來直接丟掉
    expect("charm" in designs).toBe(false);
    expect(designs.omamori.front).toBe("平安");
    expect(designs.omamori.bell).toBeNull();
    expect(designs.acrylic.place).toEqual(base.acrylic.place);
    expect(designs.acrylic.mode).toBe(base.acrylic.mode);
    expect(designs.acrylic.edge).toBe(base.acrylic.edge);
    expect(designs.acrylic.margin).toBe(60);
  });

  it("不是這個格式就當作沒有存檔", () => {
    expect(readStoredMerch(null)).toBeNull();
    expect(readStoredMerch({ version: 2 })).toBeNull();
    const stored = readStoredMerch({ version: 1, kind: "omamori", designs: {}, photo: "x", cutouts: [{ id: 1 }] })!;
    expect(stored.kind).toBe("omamori");
    expect(stored.photo).toBeNull();
    expect(stored.cutouts).toEqual([]);
    expect(readStoredMerch({ version: 1, kind: "rocket" })!.kind).toBe("card");
    expect(readStoredMerch({ version: 1, kind: "charm" })!.kind).toBe("card");
  });
});
