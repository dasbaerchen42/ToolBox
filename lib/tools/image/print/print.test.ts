import {
  addGrain,
  filmGrade,
  flash,
  halftone,
  hexToRgb,
  inkDensities,
  luminance,
  photocopy,
  posterTone,
  rgbToCmyk,
  riso,
  type Pixels,
} from "./pixels";
import { digicamDate, postmarkDate, printLayout, PRINT_GROUPS } from "./settings";

function solid(width: number, height: number, rgb: [number, number, number], alpha = 255): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([...rgb, alpha], i * 4);
  return { width, height, data };
}

/** 整張圖的平均亮度 */
function meanLum(data: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += luminance(data[i], data[i + 1], data[i + 2]);
  return sum / (data.length / 4);
}

const PAPER = { r: 255, g: 255, b: 255 };

describe("print:CMYK", () => {
  it("白色沒有墨、黑色只有 K、紅色是 M+Y", () => {
    expect(rgbToCmyk(255, 255, 255)).toEqual([0, 0, 0, 0]);
    expect(rgbToCmyk(0, 0, 0)).toEqual([0, 0, 0, 1]);
    const [c, m, y, k] = rgbToCmyk(255, 0, 0);
    expect([c, m, y, k]).toEqual([0, 1, 1, 0]);
  });
});

describe("print:網點", () => {
  it("白紙還是白紙,深色印出來平均也是深的", () => {
    const white = halftone(solid(40, 40, [255, 255, 255]), 6, PAPER);
    expect(meanLum(white)).toBeCloseTo(255, 0);

    const dark = halftone(solid(40, 40, [60, 60, 60]), 6, PAPER);
    const mid = halftone(solid(40, 40, [160, 160, 160]), 6, PAPER);
    expect(meanLum(dark)).toBeLessThan(meanLum(mid));
    expect(meanLum(mid)).toBeLessThan(250);
  });

  it("中間調真的是一顆顆的點:同一張圖裡有純紙色也有墨", () => {
    const out = halftone(solid(40, 40, [128, 128, 128]), 8, PAPER);
    const lums = new Set<number>();
    for (let i = 0; i < out.length; i += 4) lums.add(Math.round(luminance(out[i], out[i + 1], out[i + 2]) / 32));
    expect(lums.size).toBeGreaterThan(2);
  });

  it("透明的地方不上墨,透明度保留", () => {
    const out = halftone(solid(10, 10, [0, 0, 0], 0), 4, PAPER);
    expect(out[3]).toBe(0);
    expect(out[0]).toBe(255);
  });
});

describe("print:孔版", () => {
  const pink = hexToRgb("#ff48b0");
  const blue = hexToRgb("#0078bf");

  it("像素就是某一色墨時,那色濃度約 1、另一色約 0", () => {
    const [p, b] = inkDensities(pink, PAPER, [pink, blue]);
    expect(p).toBeGreaterThan(0.9);
    expect(b).toBeLessThan(0.1);
  });

  it("紙色沒有墨;濃度一律夾在 0–1", () => {
    expect(inkDensities(PAPER, PAPER, [pink, blue])).toEqual([0, 0]);
    for (const d of inkDensities({ r: 0, g: 0, b: 0 }, PAPER, [pink, blue])) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it("錯位:同一張圖,有偏移跟沒偏移印出來不一樣", () => {
    const src = solid(30, 30, [255, 255, 255]);
    for (let y = 10; y < 20; y += 1) for (let x = 10; x < 20; x += 1) src.data.set([40, 40, 120, 255], (y * 30 + x) * 4);
    const aligned = riso(src, [pink, blue], PAPER, 1, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    const shifted = riso(src, [pink, blue], PAPER, 1, [{ x: 0, y: 0 }, { x: 4, y: 3 }]);
    expect(Buffer.from(aligned).equals(Buffer.from(shifted))).toBe(false);
  });
});

describe("print:影印機", () => {
  it("中間調被推向黑或白,反差變大", () => {
    const src = solid(20, 20, [255, 255, 255]);
    for (let i = 0; i < 200; i += 1) src.data.set([90, 90, 90, 255], i * 4); // 上半深灰
    const out = photocopy(src, 1, 0, 1, { r: 233, g: 231, b: 225 });
    expect(luminance(out[0], out[1], out[2])).toBeLessThan(40); // 深灰 → 幾乎黑
    const last = out.length - 4;
    expect(luminance(out[last], out[last + 1], out[last + 2])).toBeGreaterThan(200); // 白 → 紙色
  });

  it("同一個種子結果一樣,換種子碳粉痕位置不同", () => {
    const src = solid(40, 40, [250, 250, 250]);
    const a = photocopy(src, 0.6, 1, 7, { r: 233, g: 231, b: 225 });
    const b = photocopy(src, 0.6, 1, 7, { r: 233, g: 231, b: 225 });
    const c = photocopy(src, 0.6, 1, 8, { r: 233, g: 231, b: 225 });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });
});

describe("print:顆粒", () => {
  it("強度 0 不動;有強度時亮度上下抖,平均差不多", () => {
    const px = solid(30, 30, [128, 128, 128]);
    addGrain(px, 0, 2, 1);
    expect(meanLum(px.data)).toBeCloseTo(128, 0);

    addGrain(px, 0.5, 1, 1);
    const values = new Set<number>();
    for (let i = 0; i < px.data.length; i += 4) values.add(px.data[i]);
    expect(values.size).toBeGreaterThan(10);
    expect(Math.abs(meanLum(px.data) - 128)).toBeLessThan(8);
  });

  it("顆粒大小 3:同一塊 3×3 裡的抖動一樣", () => {
    const px = solid(6, 6, [128, 128, 128]);
    addGrain(px, 0.5, 3, 1);
    expect(px.data[0]).toBe(px.data[(1 * 6 + 2) * 4]);
  });
});

describe("print:相機調色", () => {
  it("拍立得:暖色調讓紅比藍高,暗角讓四角比中間暗", () => {
    const src = solid(41, 41, [128, 128, 128]);
    const out = filmGrade(src, { warmth: 1, fade: 0, vignette: 1 });
    const center = (20 * 41 + 20) * 4;
    expect(out[center]).toBeGreaterThan(out[center + 2]);
    expect(luminance(out[0], out[1], out[2])).toBeLessThan(luminance(out[center], out[center + 1], out[center + 2]));
  });

  it("褪色:純黑被提亮", () => {
    const out = filmGrade(solid(4, 4, [0, 0, 0]), { warmth: 0, fade: 1, vignette: 0 });
    expect(out[1]).toBeGreaterThan(30);
  });

  it("閃光:中間比四周亮", () => {
    const out = flash(solid(41, 41, [120, 120, 120]), 1);
    const center = (18 * 41 + 20) * 4;
    expect(out[center + 1]).toBeGreaterThan(out[1]);
  });
});

describe("print:單色高反差", () => {
  const red = { r: 215, g: 38, b: 46 };

  it("三階:暗部黑、中間主題色、亮部白", () => {
    const dark = posterTone(solid(2, 2, [10, 10, 10]), red, 3, 0);
    const mid = posterTone(solid(2, 2, [128, 128, 128]), red, 3, 0);
    const light = posterTone(solid(2, 2, [250, 250, 250]), red, 3, 0);
    expect(dark[0]).toBeLessThan(40);
    expect([mid[0], mid[1], mid[2]]).toEqual([215, 38, 46]);
    expect(light[0]).toBeGreaterThan(240);
  });

  it("兩階沒有白,亮部也是主題色", () => {
    const light = posterTone(solid(2, 2, [250, 250, 250]), red, 2, 0);
    expect([light[0], light[1], light[2]]).toEqual([215, 38, 46]);
  });

  it("主題色那一階改成網點時,同時有主題色與紙白", () => {
    const out = posterTone(solid(20, 20, [128, 128, 128]), red, 3, 5);
    const colors = new Set<string>();
    for (let i = 0; i < out.length; i += 4) colors.add(`${out[i]},${out[i + 1]},${out[i + 2]}`);
    expect(colors.has("215,38,46")).toBe(true);
    expect(colors.size).toBe(2);
  });
});

describe("print:版面", () => {
  const size = { width: 800, height: 600 };

  it("印刷質感與相機、海報跟原圖一樣大", () => {
    for (const kind of ["halftone", "riso", "photocopy", "digicam", "poster"] as const) {
      expect(printLayout(size, kind).canvas).toEqual(size);
    }
  });

  it("拍立得下方的白邊比其他三邊寬", () => {
    const { canvas, photo } = printLayout(size, "polaroid");
    const bottom = canvas.height - photo.y - photo.height;
    expect(bottom).toBeGreaterThan(photo.x * 3);
    expect(photo.width).toBe(800);
  });

  it("明信片是 3:2,照片在左半邊", () => {
    const { canvas, photo } = printLayout(size, "postcard");
    expect(canvas.width / canvas.height).toBeCloseTo(1.5, 2);
    expect(photo.x + photo.width).toBeLessThan(canvas.width / 2);
  });

  it("郵票、票券、底片條都比原圖大,照片完整放在裡面", () => {
    for (const kind of ["stamp", "ticket", "film"] as const) {
      const { canvas, photo } = printLayout(size, kind);
      expect(canvas.width * canvas.height).toBeGreaterThan(size.width * size.height);
      expect(photo.x + photo.width).toBeLessThanOrEqual(canvas.width);
      expect(photo.y + photo.height).toBeLessThanOrEqual(canvas.height);
    }
  });

  it("每一種都有出現在分類裡,而且只出現一次", () => {
    const kinds = PRINT_GROUPS.flatMap((group) => group.kinds.map((item) => item.kind));
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toHaveLength(10);
  });
});

describe("print:日期", () => {
  it("古早相機的日期印字與郵戳的日期格式", () => {
    expect(digicamDate({ y: 2026, m: 10, d: 1 })).toBe("'26 10 01");
    expect(postmarkDate({ y: 2026, m: 3, d: 9 })).toBe("2026.03.09");
  });
});
