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
  smoothLuminance,
  riso,
  type Pixels,
} from "./pixels";
import { coverRect, DEFAULT_FRAMING, dragFraming, isCropped, MAX_ZOOM } from "./framing";
import { clockProgress, defaultInterfaceSettings, estimateLines, parseClock, switchLanguage } from "./interface";

const square = (size: { width: number; height: number }) => Math.min(size.width, size.height);
import { defaultPrintSettings, digicamDate, postmarkDate, printLayout, PRINT_GROUPS } from "./settings";

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

describe("print:海報的四階與質感", () => {
  const red = { r: 215, g: 38, b: 46 };
  const rgbOf = (out: Uint8ClampedArray) => [out[0], out[1], out[2]];

  it("四階:比主題色亮一點的地方是淡主題色,不會直接跳成白", () => {
    const at = (v: number) => rgbOf(posterTone(solid(2, 2, [v, v, v]), red, 4, 0));
    expect(at(10)[0]).toBeLessThan(40);
    expect(at(110)).toEqual([215, 38, 46]);
    const tint = at(160);
    expect(tint[0]).toBeGreaterThan(215);
    expect(tint[1]).toBeGreaterThan(100);
    expect(tint[1]).toBeLessThan(200);
    expect(at(250)[1]).toBeGreaterThan(240);
  });

  it("斜線質感:主題色與底色兩種,而且是一條一條的", () => {
    const out = posterTone(solid(30, 30, [110, 110, 110]), red, 3, 6, 0.5, "lines");
    const colors = new Set<string>();
    for (let i = 0; i < out.length; i += 4) colors.add(`${out[i]},${out[i + 1]},${out[i + 2]}`);
    expect(colors.size).toBe(2);
    // 沿著線的方向(右下斜)走,顏色不變
    const at = (x: number, y: number) => out[(y * 30 + x) * 4 + 1];
    for (let d = 0; d < 10; d += 1) expect(at(5 + d, 5 + d)).toBe(at(5, 5));
  });

  it("預設是四階平塗(人像最清楚)", () => {
    const { poster } = defaultPrintSettings();
    expect(poster.levels).toBe(4);
    expect(poster.texture).toBe("solid");
  });
});

describe("print:介面", () => {
  const size = { width: 800, height: 600 };
  const ui = defaultInterfaceSettings();

  it("時間字串換成秒;進度條照目前 ÷ 全長", () => {
    expect(parseClock("3:45")).toBe(225);
    expect(parseClock("1:02:03")).toBe(3723);
    expect(parseClock("abc")).toBeNull();
    expect(clockProgress("1:00", "4:00")).toBeCloseTo(0.25);
    expect(clockProgress("9:00", "4:00")).toBe(1);
    expect(clockProgress("??", "4:00")).toBeCloseTo(0.35);
  });

  it("播放器、貼文、限時動態以短邊當寬度,都是直式", () => {
    for (const kind of ["player", "social", "story"] as const) {
      const { canvas, photo } = printLayout(size, kind, ui);
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBeGreaterThan(canvas.width);
      expect(photo.x + photo.width).toBeLessThanOrEqual(canvas.width);
      expect(photo.y + photo.height).toBeLessThanOrEqual(canvas.height);
    }
    expect(printLayout(size, "story", ui).canvas.height).toBe(Math.round((600 * 16) / 9));
  });

  it("貼文:方形比 4:5 矮;照片內縮,不貼齊左右邊", () => {
    const square = printLayout(size, "social", { ...ui, social: { ...ui.social, ratio: "1:1" } }).photo;
    const tall = printLayout(size, "social", { ...ui, social: { ...ui.social, ratio: "4:5" } }).photo;
    expect(tall.height / tall.width).toBeCloseTo(1.25, 2);
    expect(square.height).toBe(square.width);
    expect(square.x).toBeGreaterThan(0);
  });

  it("文字為主的貼文:照片在內文下面,內文越長照片越往下", () => {
    const short = printLayout(size, "social", { ...ui, social: { ...ui.social, layout: "text", caption: "hi" } });
    const long = printLayout(size, "social", {
      ...ui,
      social: { ...ui.social, layout: "text", caption: "很長的一段內文".repeat(8) },
    });
    expect(short.photo.x).toBeGreaterThan(square(size) * 0.1);
    expect(long.photo.y).toBeGreaterThan(short.photo.y);
    expect(long.canvas.height).toBeGreaterThan(short.canvas.height);
  });

  it("影片是 16:9,關掉資訊區就只剩畫面", () => {
    const video = printLayout(size, "video", { ...ui, video: { ...ui.video, info: false } });
    expect(video.canvas).toEqual({ width: 800, height: 450 });
    expect(printLayout(size, "video", ui).canvas.height).toBeGreaterThan(450);
  });

  it("換語言:還是預設的內容跟著換,自己改過的不動", () => {
    const edited = { ...ui, player: { ...ui.player, title: "my song" } };
    const ja = switchLanguage(edited, "ja");
    expect(ja.ui.lang).toBe("ja");
    expect(ja.player.title).toBe("my song");
    expect(ja.social.time).toBe("3時間前");
    expect(switchLanguage(ja, "zh").story.reply).toBe("回覆…");
  });

  it("估計行數:英文比中文一行塞得多,有上限", () => {
    expect(estimateLines("abcdefghij", 10, 5)).toBe(1);
    expect(estimateLines("一二三四五六七八九十", 5, 5)).toBe(2);
    expect(estimateLines("字".repeat(100), 5, 4)).toBe(4);
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
    expect(kinds).toHaveLength(14);
  });
});

describe("print:日期", () => {
  it("古早相機的日期印字與郵戳的日期格式", () => {
    expect(digicamDate({ y: 2026, m: 10, d: 1 })).toBe("'26 10 01");
    expect(postmarkDate({ y: 2026, m: 3, d: 9 })).toBe("2026.03.09");
  });
});

describe("print:分階前的平滑", () => {
  it("單一個雜訊點被抹平,大片的明暗不變", () => {
    const px = solid(9, 9, [200, 200, 200]);
    px.data.set([0, 0, 0, 255], (4 * 9 + 4) * 4);
    const out = smoothLuminance(px, 1);
    expect(out[4 * 9 + 4]).toBeGreaterThan(0.5);
    expect(out[0]).toBeCloseTo(luminance(200, 200, 200) / 255, 5);
  });
});

describe("print:構圖", () => {
  // 橫的 200×100 照片放進 100×100 的方框:左右多出 100
  const from = { width: 200, height: 100 };
  const box = { x: 10, y: 20, width: 100, height: 100 };

  it("預設置中;x = 0 貼齊左邊、1 貼齊右邊", () => {
    expect(coverRect(from, box)).toEqual({ x: -40, y: 20, width: 200, height: 100 });
    expect(coverRect(from, box, { x: 0, y: 0.5, zoom: 1 }).x).toBe(10);
    expect(coverRect(from, box, { x: 1, y: 0.5, zoom: 1 }).x).toBe(-90);
  });

  it("放大兩倍:上下也有多的,而且還是填滿框", () => {
    const rect = coverRect(from, box, { x: 0.5, y: 0.5, zoom: 2 });
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(200);
    expect(rect.y).toBe(20 - 50);
    expect(isCropped(from, box, { x: 0.5, y: 0.5, zoom: 1 })).toBe(true);
    expect(isCropped({ width: 100, height: 100 }, box)).toBe(false);
  });

  it("往右拖 = 看到更左邊;沒有多出來的方向拖了也不動;拖過頭會停在邊上", () => {
    const moved = dragFraming(DEFAULT_FRAMING, from, box, 25, 30);
    expect(moved.x).toBeCloseTo(0.25);
    expect(moved.y).toBe(0.5);
    expect(dragFraming(DEFAULT_FRAMING, from, box, 999, 0).x).toBe(0);
  });

  it("縮放有上下限,壞掉的數字當成預設", () => {
    expect(coverRect(from, box, { x: 0.5, y: 0.5, zoom: 0.2 }).width).toBe(200);
    expect(coverRect(from, box, { x: 0.5, y: 0.5, zoom: 99 }).height).toBe(100 * MAX_ZOOM);
    expect(coverRect(from, box, { x: Number.NaN, y: 0.5, zoom: Number.NaN }).x).toBe(-40);
  });
});
