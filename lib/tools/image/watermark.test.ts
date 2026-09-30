import {
  markScale,
  rotatedBounds,
  seededRandom,
  singleCenter,
  tileCenters,
} from "./watermark";

describe("markScale", () => {
  it("以短邊的百分比計算,橫圖直圖同樣大小", () => {
    expect(markScale({ width: 2000, height: 1000 }, 5)).toBe(50);
    expect(markScale({ width: 1000, height: 2000 }, 5)).toBe(50);
  });

  it("再小也至少 1px", () => {
    expect(markScale({ width: 10, height: 10 }, 0)).toBe(1);
  });
});

describe("rotatedBounds", () => {
  it("不轉就是原尺寸", () => {
    const box = rotatedBounds({ width: 100, height: 20 }, 0);
    expect(box.width).toBeCloseTo(100);
    expect(box.height).toBeCloseTo(20);
  });

  it("轉 90 度寬高互換", () => {
    const box = rotatedBounds({ width: 100, height: 20 }, 90);
    expect(box.width).toBeCloseTo(20);
    expect(box.height).toBeCloseTo(100);
  });

  it("正負角度外框一樣大", () => {
    expect(rotatedBounds({ width: 100, height: 20 }, -30)).toEqual(
      rotatedBounds({ width: 100, height: 20 }, 30)
    );
  });
});

describe("tileCenters", () => {
  const canvas = { width: 1200, height: 800 };
  const mark = { width: 200, height: 40 };

  it("鋪滿以對角線為邊長的正方形,轉任何角度都不露白", () => {
    const points = tileCenters(canvas, mark, 50);
    const half = Math.hypot(canvas.width, canvas.height) / 2;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    // 最外圈的中心點要超出半條對角線,浮水印的邊才蓋得到角落
    expect(Math.min(...xs)).toBeLessThanOrEqual(-half);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(half);
    expect(Math.min(...ys)).toBeLessThanOrEqual(-half);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(half);
  });

  it("間距是浮水印尺寸的百分比", () => {
    const points = tileCenters(canvas, mark, 100);
    const row0 = points.filter((p) => p.y === 0).map((p) => p.x).sort((a, b) => a - b);
    expect(row0[1] - row0[0]).toBe(400);
    const ys = [...new Set(points.map((p) => p.y))].sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBe(80);
  });

  it("奇數列錯開半格", () => {
    const points = tileCenters(canvas, mark, 0);
    expect(points.some((p) => p.y === 0 && p.x === 0)).toBe(true);
    expect(points.some((p) => p.y === 40 && p.x === 100)).toBe(true);
  });

  it("間距越大數量越少", () => {
    expect(tileCenters(canvas, mark, 300).length).toBeLessThan(
      tileCenters(canvas, mark, 20).length
    );
  });
});

describe("singleCenter", () => {
  const canvas = { width: 1000, height: 500 };
  const mark = { width: 100, height: 20 };

  it("右下角:離邊緣留 margin 再加半個浮水印", () => {
    // 短邊 500 的 4% = 20
    expect(singleCenter(canvas, mark, 0, { x: 1, y: 1 }, 4)).toEqual({ x: 930, y: 470 });
  });

  it("置中不吃 margin", () => {
    expect(singleCenter(canvas, mark, 0, { x: 0.5, y: 0.5 }, 4)).toEqual({ x: 500, y: 250 });
  });

  it("斜放時用轉過的外框貼邊,不會有角跑出去", () => {
    const center = singleCenter(canvas, mark, 45, { x: 0, y: 0 }, 0);
    const box = rotatedBounds(mark, 45);
    expect(center.x - box.width / 2).toBeCloseTo(0);
    expect(center.y - box.height / 2).toBeCloseTo(0);
  });
});

describe("seededRandom", () => {
  it("同一個種子產生同一串數字", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it("落在 0 到 1 之間", () => {
    const next = seededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
