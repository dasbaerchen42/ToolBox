import { hexToRgb, labDistanceSq, rgbToOklab } from "./color";
import { DEFAULT_PALETTE } from "./palette";
import {
  addBoxPalette,
  anchorPositions,
  BEADS_PER_CELL,
  correctCount,
  extendedPalette,
  isCorrect,
  isLocked,
  isSorted,
  newlyCorrect,
  newSortBox,
  pickBead,
  readBoxStore,
  rewardColors,
  seededRng,
  straysLeft,
  swapCells,
  type SortBox,
} from "./sortbox";

const lab = (hex: string) => rgbToOklab(hexToRgb(hex));
const gap = (x: string, y: string) => Math.sqrt(labDistanceSq(lab(x), lab(y)));

/** 一格一格把對的豆子換過來,直到排好(模擬玩家) */
function solve(box: SortBox): SortBox {
  let current = box;
  for (let pos = 0; pos < current.cells.length; pos += 1) {
    if (isCorrect(current, pos)) continue;
    const from = current.cells.findIndex((_, p) => p !== pos && !isLocked(current, p) && current.cells[p] === pos);
    current = swapCells(current, pos, from);
  }
  return current;
}

describe("整理豆盒:開盒", () => {
  it("色條兩端、漸層盒四角固定;其他打亂,排對的不超過一成", () => {
    for (const [shape, level] of [
      ["strip", "easy"],
      ["strip", "hard"],
      ["box", "medium"],
      ["box", "hard"],
    ] as const) {
      const box = newSortBox(shape, level, DEFAULT_PALETTE, seededRng(7));
      expect(box.anchors).toEqual(anchorPositions(shape, box.cols, box.rows));
      expect(box.targets).toHaveLength(box.cols * box.rows);
      for (const pos of box.anchors) expect(box.cells[pos]).toBe(pos);
      expect([...box.cells].sort((a, b) => a - b)).toEqual(box.targets.map((_, i) => i));
      const free = box.cells.length - box.anchors.length;
      expect(correctCount(box) - box.anchors.length).toBeLessThanOrEqual(Math.max(1, Math.floor(free * 0.1)));
      expect(isSorted(box)).toBe(false);
    }
  });

  it("越難,相鄰兩格的色差越小;但都還分得出來", () => {
    const meanStep = (box: SortBox) => {
      const steps = box.targets.slice(1).map((hex, i) => gap(box.targets[i], hex));
      return steps.reduce((sum, s) => sum + s, 0) / steps.length;
    };
    const easy = newSortBox("strip", "easy", DEFAULT_PALETTE, seededRng(3));
    const hard = newSortBox("strip", "hard", DEFAULT_PALETTE, seededRng(3));
    expect(meanStep(easy)).toBeGreaterThan(meanStep(hard));
    expect(meanStep(hard)).toBeGreaterThan(0.02);
    expect(hard.cols).toBeGreaterThan(easy.cols);
  });
});

describe("整理豆盒:互換與卡住", () => {
  const box = newSortBox("box", "easy", DEFAULT_PALETTE, seededRng(11));

  it("端點與排對的格子拖不動", () => {
    const free = box.cells.findIndex((_, p) => !isLocked(box, p));
    expect(swapCells(box, box.anchors[0], free)).toBe(box);
  });

  it("換到對的位置會「喀」;一路換下去會排好", () => {
    const pos = box.cells.findIndex((_, p) => !isLocked(box, p));
    const from = box.cells.indexOf(pos);
    const after = swapCells(box, pos, from);
    expect(newlyCorrect(box, after)).toContain(pos);
    const solved = solve(box);
    expect(isSorted(solved)).toBe(true);
  });
});

describe("整理豆盒:撿雜豆與色盤", () => {
  const box = solveBox();
  function solveBox() {
    return solve(newSortBox("box", "medium", DEFAULT_PALETTE, seededRng(5)));
  }

  it("雜豆和那一格看得出差一點點;夾到雜豆才拿掉", () => {
    expect(box.strays.length).toBeGreaterThan(0);
    for (const stray of box.strays) {
      expect(stray.slot).toBeLessThan(BEADS_PER_CELL);
      expect(box.anchors).not.toContain(stray.pos);
      expect(gap(stray.hex, box.targets[stray.pos])).toBeGreaterThan(0.03);
    }
    const first = box.strays[0];
    const wrongSlot = Array.from({ length: BEADS_PER_CELL }, (_, i) => i).find(
      (slot) => !box.strays.some((s) => s.pos === first.pos && s.slot === slot)
    )!;
    expect(pickBead(box, first.pos, wrongSlot).hit).toBe(false);
    let current = box;
    for (const stray of box.strays) current = pickBead(current, stray.pos, stray.slot).box;
    expect(straysLeft(current)).toBe(0);
  });

  it("收進色盤:去掉重複、色號接著編、刪掉的號碼不重用、預設色索引不變", () => {
    const colors = rewardColors(box);
    expect(colors.length).toBeGreaterThan(10);
    let store = readBoxStore(null);
    store = addBoxPalette(store, box);
    expect(store.boxes[0].colors[0].code).toBe("B01");
    const last = store.lastCode;
    expect(last).toBe(colors.length);
    // 刪掉第一盒再收一盒:色號從上次用到的地方往下
    store = addBoxPalette({ ...store, boxes: [] }, box);
    expect(store.boxes[0].colors[0].code).toBe(`B${String(last + 1).padStart(2, "0")}`);
    const palette = extendedPalette(DEFAULT_PALETTE, store.boxes);
    expect(palette.slice(0, DEFAULT_PALETTE.length)).toEqual(DEFAULT_PALETTE);
    expect(palette).toHaveLength(DEFAULT_PALETTE.length + colors.length);
    // 存檔讀回來
    const reread = readBoxStore(JSON.parse(JSON.stringify(store)));
    expect(reread).toEqual(store);
    expect(readBoxStore({ boxes: [{ id: "x" }, "junk"], lastCode: "9" })).toEqual({ lastCode: 0, boxes: [] });
  });
});
