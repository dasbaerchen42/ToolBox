import { hexToRgb, labDistanceSq, linearToSrgb, rgbToHex, rgbToOklab, shade, srgbToLinear } from "./color";
import { DEFAULT_PALETTE, paletteLab } from "./palette";
import {
  boardSize,
  clearColors,
  MAX_BOARD_SIDE,
  sampleMajority,
  countColors,
  dropOrder,
  fitRect,
  matchPalette,
  sampleCells,
  type PixelData,
} from "./pattern";
import { meltGeometry, smoothstep } from "./draw";

/** 做一張 width×height 的假圖,每個像素的顏色由 paint 決定 */
function makePixels(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number]
): PixelData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(paint(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const labs = paletteLab(DEFAULT_PALETTE);
/** 用色盤自己的顏色當取樣,測試就不綁定色盤挑了哪些色 */
const indexOf = (name: string, reading?: string) =>
  DEFAULT_PALETTE.findIndex(
    (color) => color.name === name && (reading === undefined || color.reading === reading)
  );
const hexOf = (name: string) => DEFAULT_PALETTE[indexOf(name)].hex;

describe("color:色彩換算", () => {
  it("sRGB 與線性光來回換不會走樣", () => {
    for (const value of [0, 1, 10, 128, 200, 255]) {
      expect(linearToSrgb(srgbToLinear(value))).toBe(value);
    }
  });

  it("白色的 OKLab 亮度是 1、沒有彩度", () => {
    const white = rgbToOklab({ r: 255, g: 255, b: 255 });
    expect(white.L).toBeCloseTo(1, 3);
    expect(white.a).toBeCloseTo(0, 3);
    expect(white.b).toBeCloseTo(0, 3);
  });

  it("十六進位色碼可以來回換,也吃三碼縮寫", () => {
    expect(hexToRgb("#1e1f22")).toEqual({ r: 30, g: 31, b: 34 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(rgbToHex({ r: 30, g: 31, b: 34 })).toBe("#1e1f22");
  });

  it("shade 往白或往黑混", () => {
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#808080", 0)).toBe("#808080");
  });
});

describe("palette:預設色盤", () => {
  it("色號不重複、色碼格式正確", () => {
    const codes = new Set(DEFAULT_PALETTE.map((color) => color.code));
    expect(codes.size).toBe(DEFAULT_PALETTE.length);
    for (const color of DEFAULT_PALETTE) expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("同名的色靠讀音分得開", () => {
    const keys = new Set(DEFAULT_PALETTE.map((color) => `${color.name}/${color.reading}`));
    expect(keys.size).toBe(DEFAULT_PALETTE.length);
    expect(indexOf("葡萄色", "えびいろ")).not.toBe(indexOf("葡萄色", "ぶどういろ"));
  });

  it("任兩色不會近到分不出來", () => {
    for (let i = 0; i < labs.length; i += 1) {
      for (let j = i + 1; j < labs.length; j += 1) {
        expect(Math.sqrt(labDistanceSq(labs[i], labs[j]))).toBeGreaterThan(0.03);
      }
    }
  });

  it("同一份色盤的 OKLab 只算一次", () => {
    expect(paletteLab(DEFAULT_PALETTE)).toBe(labs);
  });
});

describe("pattern:構圖", () => {
  it("cover 會把板子填滿,多的部分裁掉", () => {
    // 橫的照片放進正方形板子:高剛好,寬超出
    const rect = fitRect(200, 100, 10, 10, "cover");
    expect(rect).toEqual({ x: -5, y: 0, width: 20, height: 10 });
  });

  it("contain 整張放進去,上下留空", () => {
    const rect = fitRect(200, 100, 10, 10, "contain");
    expect(rect).toEqual({ x: 0, y: 2.5, width: 10, height: 5 });
  });

  it("尺寸還沒量到(0)時不會除以零", () => {
    expect(fitRect(0, 0, 29, 29, "cover")).toEqual({ x: 0, y: 0, width: 29, height: 29 });
  });
});

describe("pattern:取樣", () => {
  it("每格取平均色,透明的格子變成空格", () => {
    // 2×1 格,每格 2×2 像素:左邊純紅、右邊全透明
    const pixels = makePixels(4, 2, (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
    const samples = sampleCells(pixels, 2, 1);

    expect(samples[1]).toBeNull();
    expect(samples[0]).not.toBeNull();
    expect(labDistanceSq(samples[0]!, rgbToOklab({ r: 255, g: 0, b: 0 }))).toBeLessThan(1e-6);
  });

  it("黑白交錯的格子平均在線性光裡做,不會偏暗", () => {
    const pixels = makePixels(2, 2, (x, y) =>
      (x + y) % 2 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]
    );
    const [sample] = sampleCells(pixels, 1, 1);
    // 線性光平均是 0.5,換回 sRGB 約 188;直接平均 sRGB 才會是 128
    const expected = rgbToOklab({ r: 188, g: 188, b: 188 });
    expect(Math.sqrt(labDistanceSq(sample!, expected))).toBeLessThan(0.01);
  });

  it("半透明的邊只要不透明度過半就算有豆子", () => {
    const pixels = makePixels(2, 2, (x) => (x === 0 ? [0, 0, 255, 255] : [0, 0, 0, 0]));
    expect(sampleCells(pixels, 1, 1)[0]).toBeNull(); // 剛好一半:不過半
    const mostly = makePixels(4, 1, (x) => (x < 3 ? [0, 0, 255, 255] : [0, 0, 0, 0]));
    expect(sampleCells(mostly, 1, 1)[0]).not.toBeNull();
  });
});

describe("pattern:換成豆子色", () => {
  const sampleOf = (hex: string) => rgbToOklab(hexToRgb(hex));

  it("每格找最接近的豆子,空格維持空格", () => {
    const cells = matchPalette([sampleOf("#fcfcfa"), null, sampleOf(hexOf("臙脂"))], labs, 99);
    expect(cells).toEqual([indexOf("白"), -1, indexOf("臙脂")]);
  });

  it("壓色數:用量最少的顏色併到其他顏色,總色數不超過上限", () => {
    const samples = [
      ...Array(5).fill(sampleOf(hexOf("漆黒"))), // ×5
      ...Array(3).fill(sampleOf(hexOf("白"))), // ×3
      sampleOf(hexOf("紫黒")), // ×1,最少
    ];
    const cells = matchPalette(samples, labs, 2);

    expect(countColors(cells).length).toBe(2);
    // 紫黒很暗,比較接近漆黒,應該併進漆黒
    expect(cells[8]).toBe(indexOf("漆黒"));
  });

  it("被拿掉的格子用原始顏色重新找,不是找離被拿掉那顆最近的", () => {
    // 桜鼠被拿掉後,要回頭用自己的原色去比剩下的白與漆黒
    const samples = [
      ...Array(4).fill(sampleOf(hexOf("白"))),
      ...Array(4).fill(sampleOf(hexOf("漆黒"))),
      sampleOf(hexOf("桜鼠")),
    ];
    const cells = matchPalette(samples, labs, 2);
    expect(cells[8]).toBe(indexOf("白"));
  });

  it("上限給 0 或小數也至少留一色", () => {
    const cells = matchPalette([sampleOf(hexOf("臙脂")), sampleOf(hexOf("杜若色"))], labs, 0);
    expect(countColors(cells).length).toBe(1);
  });
});

describe("pattern:清空與計數", () => {
  const pattern = { cols: 3, rows: 1, cells: [2, 5, 2] };

  it("指定的顏色整批清成空格", () => {
    expect(clearColors(pattern, new Set([2])).cells).toEqual([-1, 5, -1]);
  });

  it("沒有要清的顏色就回傳原本那份", () => {
    expect(clearColors(pattern, new Set())).toBe(pattern);
  });

  it("每色顆數,多的排前面", () => {
    expect(countColors([2, 5, 2, -1])).toEqual([
      { index: 2, count: 2 },
      { index: 5, count: 1 },
    ]);
  });
});

describe("pattern:落豆順序", () => {
  const cells = [0, -1, 3, 3, -1, 7, 1, 1, 2];

  it("只包含有豆子的格子,每格剛好一次", () => {
    const order = dropOrder(cells, 42);
    expect([...order].sort((x, y) => x - y)).toEqual([0, 2, 3, 5, 6, 7, 8]);
  });

  it("同一個種子每次順序都一樣", () => {
    expect(dropOrder(cells, 7)).toEqual(dropOrder(cells, 7));
  });
});

describe("draw:熨燙參數", () => {
  it("越燙洞越小、豆子越往外擴", () => {
    const raw = meltGeometry(0);
    const done = meltGeometry(1);
    expect(done.hole).toBeLessThan(raw.hole);
    expect(done.outer).toBeGreaterThan(raw.outer);
  });

  it("剛放上去時豆子之間不相黏,燙好後跟上下左右黏在一起", () => {
    expect(meltGeometry(0).outer).toBeLessThan(0.5);
    expect(meltGeometry(1).outer).toBeGreaterThan(0.5);
  });

  it("燙好時斜對角之間還留著小縫,洞也沒有完全消失", () => {
    expect(meltGeometry(1).outer).toBeLessThan(Math.SQRT1_2);
    expect(meltGeometry(1).hole).toBeGreaterThan(0);
  });

  it("超出範圍的程度會被夾住", () => {
    expect(meltGeometry(2)).toEqual(meltGeometry(1));
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
  });
});

describe("pattern:板子大小", () => {
  it("照照片比例:寬固定,高跟著照片算", () => {
    expect(boardSize(1000, 500, 58, "aspect")).toEqual({ cols: 58, rows: 29 });
    expect(boardSize(484, 258, 116, "aspect")).toEqual({ cols: 116, rows: 62 });
  });

  it("正方形就是寬×寬", () => {
    expect(boardSize(1000, 500, 58, "square")).toEqual({ cols: 58, rows: 58 });
  });

  it("很高的直幅照片:高頂到上限,寬照比例縮", () => {
    const size = boardSize(500, 2000, 116, "aspect");
    expect(size.rows).toBe(MAX_BOARD_SIDE);
    expect(size.cols).toBe(29);
  });

  it("超寬的照片高度至少一格", () => {
    expect(boardSize(10000, 10, 29, "aspect").rows).toBe(1);
  });
});

describe("pattern:取主色", () => {
  const sampleOf = (hex: string) => rgbToOklab(hexToRgb(hex));

  it("一條細黑線穿過淺色格子:平均會變灰,主色維持背景色", () => {
    // 1 格 10×10:左邊 3 欄是黑線,其餘是白
    const pixels = makePixels(10, 10, (x) => (x < 3 ? [13, 0, 21, 255] : [255, 255, 255, 255]));
    const [majority] = sampleMajority(pixels, 1, 1, labs);
    expect(majority).toBe(labs[indexOf("白")]);

    const [average] = sampleCells(pixels, 1, 1);
    const [cell] = matchPalette([average], labs, 99);
    expect(cell).not.toBe(indexOf("白"));
    expect(cell).not.toBe(indexOf("漆黒"));
  });

  it("線條佔多數的格子就是線條色", () => {
    const pixels = makePixels(10, 10, (x) => (x < 6 ? [13, 0, 21, 255] : [255, 255, 255, 255]));
    expect(sampleMajority(pixels, 1, 1, labs)[0]).toBe(labs[indexOf("漆黒")]);
  });

  it("透明的格子是空格,半透明的邊不投票", () => {
    const pixels = makePixels(20, 10, (x) =>
      x < 10 ? [0, 0, 0, 0] : x < 12 ? [255, 255, 255, 60] : [226, 4, 27, 255]
    );
    const [left, right] = sampleMajority(pixels, 2, 1, labs);
    expect(left).toBeNull();
    expect(right).toBe(labs[indexOf("猩々緋")]);
  });

  it("結果可以直接接 matchPalette", () => {
    const pixels = makePixels(4, 2, (x) => (x < 2 ? [255, 255, 255, 255] : [226, 4, 27, 255]));
    const cells = matchPalette(sampleMajority(pixels, 2, 1, labs), labs, 99);
    expect(cells).toEqual([indexOf("白"), indexOf("猩々緋")]);
    expect(sampleOf("#ffffff")).toEqual(labs[indexOf("白")]);
  });
});

describe("pattern:併掉稀有色", () => {
  const sampleOf = (hex: string) => rgbToOklab(hexToRgb(hex));
  const samples = [
    ...Array(10).fill(sampleOf(hexOf("白"))),
    ...Array(6).fill(sampleOf(hexOf("漆黒"))),
    ...Array(2).fill(sampleOf(hexOf("紫黒"))),
  ];

  it("門檻 0 就不併", () => {
    expect(countColors(matchPalette(samples, labs, 99, 0))).toHaveLength(3);
  });

  it("少於門檻的顏色併進最接近的顏色,色數上限沒到也一樣", () => {
    const cells = matchPalette(samples, labs, 99, 5);
    expect(countColors(cells)).toEqual([
      { index: indexOf("白"), count: 10 },
      { index: indexOf("漆黒"), count: 8 },
    ]);
  });

  it("門檻比所有顏色都高時至少留一色", () => {
    expect(countColors(matchPalette(samples, labs, 99, 1000))).toHaveLength(1);
  });
});
