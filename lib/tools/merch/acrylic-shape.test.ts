import {
  alphaBounds,
  contourAlpha,
  defaultPlacement,
  distanceToSolid,
  edgeBand,
  fillHoles,
  lowestNear,
  NO_TILT,
  placementQuad,
  tiltFromCorner,
} from "./acrylic-shape";
import { rectQuad, warpPixels } from "./perspective";

/** w×h 的空白 alpha,把 (x0,y0)–(x1,y1) 塗滿 */
function rect(w: number, h: number, x0: number, y0: number, x1: number, y1: number) {
  const a = new Uint8ClampedArray(w * h);
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) a[y * w + x] = 255;
  return a;
}

describe("壓克力外形", () => {
  it("距離轉換:實心是 0,往外一格一格變遠(斜的約 √2)", () => {
    const solid = new Uint8Array(25);
    solid[12] = 1;
    const d = distanceToSolid(solid, 5, 5);
    expect(d[12]).toBe(0);
    expect(d[13]).toBe(1);
    expect(d[18]).toBeCloseTo(Math.SQRT2);
    expect(d[14]).toBe(2);
  });

  it("補洞:包在裡面的空隙算裡面,連到外面的不算", () => {
    // 一個空心方框
    const w = 7;
    const ring = new Uint8Array(w * w);
    for (let i = 1; i <= 5; i += 1) for (const [x, y] of [[i, 1], [i, 5], [1, i], [5, i]]) ring[y * w + x] = 1;
    const filled = fillHoles(ring, w, w);
    expect(filled[3 * w + 3]).toBe(1);
    expect(filled[0]).toBe(0);
  });

  it("沿著圖案外緣多留一圈:留邊以內是壓克力,外面不是;中間的洞補滿", () => {
    const w = 60;
    // 空心方框圖案(像一個甜甜圈)
    const art = rect(w, w, 20, 20, 39, 39);
    for (let y = 25; y <= 34; y += 1) for (let x = 25; x <= 34; x += 1) art[y * w + x] = 0;
    const shape = contourAlpha(art, w, w, 6);
    expect(shape[30 * w + 30]).toBe(255); // 洞補滿
    expect(shape[30 * w + 15]).toBe(255); // 左邊留 6 以內
    expect(shape[30 * w + 10]).toBe(0); // 太遠
    const box = alphaBounds(shape, w, w)!;
    expect(box.x).toBeGreaterThanOrEqual(13);
    expect(box.x).toBeLessThanOrEqual(14);
    expect(box.width).toBeGreaterThanOrEqual(32);
    expect(box.width).toBeLessThanOrEqual(34);
  });

  it("邊緣那一圈:越靠邊越亮,裡面是 0", () => {
    const w = 40;
    const shape = rect(w, w, 5, 5, 34, 34);
    const band = edgeBand(shape, w, w, 3);
    expect(band[20 * w + 5]).toBeGreaterThan(200);
    expect(band[20 * w + 20]).toBe(0);
    expect(band[20 * w + 2]).toBe(0);
  });

  it("最下面那一點:卡榫接在這裡", () => {
    const w = 30;
    const shape = rect(w, w, 10, 2, 20, 18);
    expect(lowestNear(shape, w, w, 15, 3)).toBe(18);
    expect(lowestNear(shape, w, w, 2, 1)).toBeNull();
  });
});

describe("放在照片上的位置", () => {
  it("沒有旋轉、沒有傾斜:四個角就是置中的長方形,寬高比照壓克力", () => {
    const place = { x: 0.5, y: 0.5, size: 0.5, rotation: 0, tilt: NO_TILT };
    const q = placementQuad(place, 0.5, 800, 1000);
    expect(q[0]).toEqual({ x: 200, y: 100 });
    expect(q[2]).toEqual({ x: 600, y: 900 });
  });

  it("拖一個角再算回來:角就在手指的位置(旋轉過也一樣)", () => {
    const place = { ...defaultPlacement(), rotation: 20 };
    const target = { x: 300, y: 260 };
    const tilt = tiltFromCorner(place, 0.7, 900, 1200, 0, target);
    const q = placementQuad({ ...place, tilt }, 0.7, 900, 1200);
    expect(q[0].x).toBeCloseTo(target.x, 5);
    expect(q[0].y).toBeCloseTo(target.y, 5);
    // 其他角不動
    expect(tilt.slice(1)).toEqual(place.tilt.slice(1));
  });
});

describe("逐像素透視", () => {
  // 4×4 的圖:左半紅、右半半透明藍
  const w = 4;
  const src = { width: w, height: w, data: new Uint8ClampedArray(w * w * 4) };
  for (let i = 0; i < w * w; i += 1) {
    const right = i % w >= 2;
    src.data.set(right ? [0, 0, 255, 128] : [255, 0, 0, 255], i * 4);
  }
  const blank = (n: number) => ({ width: n, height: n, data: new Uint8ClampedArray(n * n * 4) });

  it("原地不動:像素一模一樣", () => {
    const dst = blank(w);
    warpPixels(src, dst, rectQuad(0, 0, w, w));
    expect([...dst.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    const last = (w * w - 1) * 4;
    expect([...dst.data.slice(last, last + 4)]).toEqual([0, 0, 255, 128]);
  });

  it("往右下移兩格:圖跟著移,左上角空著", () => {
    const dst = blank(8);
    warpPixels(src, dst, rectQuad(2, 2, w, w));
    expect(dst.data[3]).toBe(0);
    const at = (x: number, y: number) => [...dst.data.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 4)];
    expect(at(2, 2)).toEqual([255, 0, 0, 255]);
    expect(at(5, 5)).toEqual([0, 0, 255, 128]);
  });
});
