import {
  blankPattern,
  floodFill,
  lineBetween,
  mirrorIndices,
  paint,
  replaceColor,
} from "./edit";
import {
  fromSavedWork,
  mergeAlbum,
  parseAlbum,
  serializeAlbum,
  toSavedWork,
  type SavedWork,
} from "./album";
import { DEFAULT_PALETTE } from "./palette";
import type { BeadPattern } from "./pattern";

/** 用字串畫格子:"." 是空格,數字是色盤索引,一列一行 */
function grid(...rows: string[]): BeadPattern {
  return {
    cols: rows[0].length,
    rows: rows.length,
    cells: rows.flatMap((row) => [...row].map((char) => (char === "." ? -1 : Number(char)))),
  };
}

function show(pattern: BeadPattern, cells: number[]): string[] {
  const rows: string[] = [];
  for (let r = 0; r < pattern.rows; r += 1) {
    rows.push(
      cells
        .slice(r * pattern.cols, (r + 1) * pattern.cols)
        .map((cell) => (cell < 0 ? "." : String(cell)))
        .join("")
    );
  }
  return rows;
}

describe("edit:對稱", () => {
  it("沒有對稱就只有自己", () => {
    expect(mirrorIndices(5, 4, 3, "none")).toEqual([5]);
  });

  it("左右、上下、四向", () => {
    // 4×3 的板子,第 0 列第 1 欄(index 1)
    expect(mirrorIndices(1, 4, 3, "x").sort()).toEqual([1, 2]);
    expect(mirrorIndices(1, 4, 3, "y").sort()).toEqual([1, 9]);
    expect(mirrorIndices(1, 4, 3, "both").sort((a, b) => a - b)).toEqual([1, 2, 9, 10]);
  });

  it("在對稱軸上的格子不會重複", () => {
    // 3 欄的中間那欄,左右鏡像就是自己
    expect(mirrorIndices(1, 3, 3, "x")).toEqual([1]);
  });
});

describe("edit:畫筆", () => {
  it("快速拖曳時中間跳過的格子要補上", () => {
    // 5 欄,從 (0,0) 拉到 (4,2)
    const line = lineBetween(0, 14, 5);
    expect(line[0]).toBe(0);
    expect(line.at(-1)).toBe(14);
    expect(line).toHaveLength(5);
  });

  it("起點終點同一格就只有那一格", () => {
    expect(lineBetween(7, 7, 5)).toEqual([7]);
  });

  it("塗色連同對稱位置一起塗", () => {
    const pattern = grid("....", "....");
    expect(show(pattern, paint(pattern, [0], 3, "x"))).toEqual(["3..3", "...."]);
  });

  it("沒有任何格子改變時回傳原本那份,才不會多記一步復原", () => {
    const pattern = grid("3...");
    expect(paint(pattern, [0], 3, "none")).toBe(pattern.cells);
  });

  it("橡皮擦就是塗成空格", () => {
    const pattern = grid("12");
    expect(show(pattern, paint(pattern, [1], -1, "none"))).toEqual(["1."]);
  });
});

describe("edit:油漆桶", () => {
  it("只換掉相連的同色區塊,斜對角不算相連", () => {
    const pattern = grid(
      "11.2",
      "1.22",
      ".1.."
    );
    expect(show(pattern, floodFill(pattern, 0, 5, "none"))).toEqual([
      "55.2",
      "5.22",
      ".1..",
    ]);
  });

  it("空格也能倒(把背景整片塗滿)", () => {
    const pattern = grid("1..", "1.1");
    expect(show(pattern, floodFill(pattern, 1, 4, "none"))).toEqual(["144", "141"]);
  });

  it("倒的顏色跟原本一樣就不動", () => {
    const pattern = grid("11");
    expect(floodFill(pattern, 0, 1, "none")).toBe(pattern.cells);
  });

  it("不會從左邊界繞到上一列的右邊界", () => {
    const pattern = grid("..1", "1..");
    // 從右上角的 1 開始倒,不能跳去第二列最左邊的 1
    expect(show(pattern, floodFill(pattern, 2, 7, "none"))).toEqual(["..7", "1.."]);
  });

  it("對稱模式下鏡像位置也各倒一次", () => {
    const pattern = grid("1.2.1");
    expect(show(pattern, floodFill(pattern, 0, 3, "x"))).toEqual(["3.2.3"]);
  });
});

describe("edit:整色替換與空板", () => {
  it("某色全部換掉;沒有那個色就回傳原本那份", () => {
    expect(replaceColor([1, 2, 1], 1, -1)).toEqual([-1, 2, -1]);
    const cells = [1, 2];
    expect(replaceColor(cells, 9, -1)).toBe(cells);
  });

  it("空板每格都是空格", () => {
    const pattern = blankPattern(3, 2);
    expect(pattern.cells).toEqual([-1, -1, -1, -1, -1, -1]);
  });
});

describe("album:存檔", () => {
  const pattern = grid("5.5", "07.");

  it("存檔只記用到的顏色,讀回來跟原本一樣", () => {
    const saved = toSavedWork(pattern, DEFAULT_PALETTE, "  小狗 ");
    expect(saved.name).toBe("小狗");
    expect(saved.colors.map((color) => color.code)).toEqual(["W06", "W01", "W08"]);
    expect(fromSavedWork(saved, DEFAULT_PALETTE)).toEqual(pattern);
  });

  it("沒取名字就叫未命名作品", () => {
    expect(toSavedWork(pattern, DEFAULT_PALETTE, "  ").name).toBe("未命名作品");
  });

  it("覆蓋舊的那筆時保留 id 與建立時間", () => {
    const first = toSavedWork(pattern, DEFAULT_PALETTE, "a", undefined, "2026-01-01T00:00:00Z");
    const again = toSavedWork(pattern, DEFAULT_PALETTE, "a", first, "2026-02-01T00:00:00Z");
    expect(again.id).toBe(first.id);
    expect(again.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(again.updatedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("色號不在色盤裡時,用色碼找最接近的豆子", () => {
    const saved = toSavedWork(grid("0"), DEFAULT_PALETTE, "a");
    saved.colors[0] = { code: "OLD-1", hex: "#fefefe" };
    expect(fromSavedWork(saved, DEFAULT_PALETTE).cells).toEqual([0]); // W01 白
  });
});

describe("album:匯入", () => {
  const good = toSavedWork(grid("1."), DEFAULT_PALETTE, "好的", undefined, "2026-01-01T00:00:00Z");

  it("匯出的檔案可以原樣讀回來", () => {
    expect(parseAlbum(serializeAlbum([good]))).toEqual({ works: [good], skipped: 0 });
  });

  it("也吃單純的陣列", () => {
    expect(parseAlbum(JSON.stringify([good])).works).toEqual([good]);
  });

  it("壞掉的那幾筆略過,其他照樣讀", () => {
    const broken = [
      { ...good, id: "b1", cells: [0] }, // 格數對不上
      { ...good, id: "b2", cells: [5, -1] }, // 指到不存在的顏色
      { ...good, id: "b3", colors: [{ code: "x", hex: "red" }] }, // 色碼格式錯
      { ...good, id: "b4", cols: 0 },
      "不是物件",
    ];
    const result = parseAlbum(JSON.stringify([good, ...broken]));
    expect(result.works.map((work) => work.id)).toEqual([good.id]);
    expect(result.skipped).toBe(5);
  });

  it("不是 JSON 就是空的", () => {
    expect(parseAlbum("hello")).toEqual({ works: [], skipped: 0 });
  });

  it("合併時同一個 id 留比較新的,新的排前面", () => {
    const older: SavedWork = { ...good, name: "舊", updatedAt: "2026-01-01T00:00:00Z" };
    const newer: SavedWork = { ...good, name: "新", updatedAt: "2026-03-01T00:00:00Z" };
    const other: SavedWork = { ...good, id: "other", updatedAt: "2026-02-01T00:00:00Z" };

    const merged = mergeAlbum([older, other], [newer]);
    expect(merged.map((work) => work.name)).toEqual(["新", good.name]);
    expect(mergeAlbum([newer], [older])[0].name).toBe("新");
  });
});
