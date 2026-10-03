// 整理豆盒:一個分格收納盒被打翻,顏色全亂了,要把它整理回漂亮的漸層。
//
// 漸層用 OKLab 內插(和照片轉換、找最接近的豆子同一套色彩空間),
// 排得對不對也用同一套距離判斷——兩格看起來一模一樣的顏色互換,一樣算對。
// 沒有計時、沒有分數、沒有紀錄;整理完就是整理完,整理好的豆盒變成一組新色盤。
//
// 全部是純函式;亂數由外面傳進來,測試才固定得住。

import { hexToRgb, labDistanceSq, oklabToRgb, rgbToHex, rgbToOklab, type Lab } from "./color";
import type { BeadColor } from "./palette";

/**
 * strip:一維色條(兩端固定);three:三色色條(兩端與正中間固定,中間轉個彎);
 * box:二維漸層盒(四角固定);big:8×8 大盒(四角固定);
 * wheel:色輪,一圈色相繞回原點(固定相鄰兩格,才知道是順時針還是逆時針)。
 */
export type BoxShape = "strip" | "three" | "box" | "big" | "wheel";
export type BoxLevel = "easy" | "medium" | "hard" | "extreme";

export const BOX_SHAPES: { value: BoxShape; label: string }[] = [
  { value: "strip", label: "一維色條" },
  { value: "three", label: "三色色條" },
  { value: "box", label: "漸層盒" },
  { value: "big", label: "8×8 大盒" },
  { value: "wheel", label: "色輪" },
];

export const BOX_LEVELS: { value: BoxLevel; label: string }[] = [
  { value: "easy", label: "輕鬆" },
  { value: "medium", label: "普通" },
  { value: "hard", label: "細膩" },
  { value: "extreme", label: "極細膩" },
];

/** 格數越多越難;相鄰兩格的色差越小越難。色輪的 cols 是一圈幾格 */
const SIZES: Record<BoxShape, Record<BoxLevel, { cols: number; rows: number }>> = {
  strip: { easy: { cols: 8, rows: 1 }, medium: { cols: 11, rows: 1 }, hard: { cols: 14, rows: 1 }, extreme: { cols: 16, rows: 1 } },
  three: { easy: { cols: 9, rows: 1 }, medium: { cols: 13, rows: 1 }, hard: { cols: 15, rows: 1 }, extreme: { cols: 17, rows: 1 } },
  box: { easy: { cols: 5, rows: 4 }, medium: { cols: 6, rows: 5 }, hard: { cols: 7, rows: 6 }, extreme: { cols: 8, rows: 7 } },
  big: { easy: { cols: 8, rows: 8 }, medium: { cols: 8, rows: 8 }, hard: { cols: 8, rows: 8 }, extreme: { cols: 8, rows: 8 } },
  wheel: { easy: { cols: 10, rows: 1 }, medium: { cols: 14, rows: 1 }, hard: { cols: 18, rows: 1 }, extreme: { cols: 22, rows: 1 } },
};

/** 相鄰兩格在 OKLab 裡差多少;人眼大約 0.02 開始分得出來,極細膩就貼著這條線 */
const STEP: Record<BoxLevel, number> = { easy: 0.065, medium: 0.045, hard: 0.032, extreme: 0.024 };

/** 雜豆和那一格差多少(越小越難挑) */
const STRAY_DELTA: Record<BoxLevel, number> = { easy: 0.1, medium: 0.07, hard: 0.05, extreme: 0.04 };
/** 幾格混了雜豆 */
const STRAY_CELLS: Record<BoxLevel, number> = { easy: 2, medium: 3, hard: 4, extreme: 5 };

/** 小於這個距離就當成同一色(和 JND 差不多,看起來一樣的就是一樣) */
export const SAME_COLOR = 0.012;

/** 每一格裡放幾顆豆子 */
export const BEADS_PER_CELL = 7;

export type Stray = { pos: number; slot: number; hex: string; picked: boolean };

export type SortBox = {
  shape: BoxShape;
  level: BoxLevel;
  cols: number;
  rows: number;
  /** 每個位置該是什麼顏色(排好的樣子) */
  targets: string[];
  /**
   * 看起來一樣的顏色分成同一組(連鎖也算:A 像 B、B 像 C,三個同一組)。
   * 對不對看「放進來的豆子和這一格同組」——「很像」不會遞移,直接比距離的話,
   * B 的豆子可能先卡進 A 的位置,剩下的格子就再也湊不齊,整盒卡死。
   */
  groups: number[];
  /** 固定不動的位置:色條的兩端、漸層盒的四個角 */
  anchors: number[];
  /** cells[位置] = 現在放在這裡的是哪一格的豆子(targets 的索引) */
  cells: number[];
  /** 整理好之後才看得到的雜豆 */
  strays: Stray[];
};

export type Rng = () => number;

/** 固定種子的亂數(mulberry32) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toLab = (hex: string) => rgbToOklab(hexToRgb(hex));
const toHex = (lab: Lab) => rgbToHex(oklabToRgb(lab));
const dist = (x: Lab, y: Lab) => Math.sqrt(labDistanceSq(x, y));
const lerp = (x: Lab, y: Lab, t: number): Lab => ({
  L: x.L + (y.L - x.L) * t,
  a: x.a + (y.a - x.a) * t,
  b: x.b + (y.b - x.b) * t,
});

/**
 * 挑端點:色條挑兩色、三色色條挑三色、漸層盒挑四個角。相鄰兩端點的距離要接近「步距 × 格數」,
 * 這樣中間每一格之間的色差剛好是這個難度要的步距。找不到就把範圍放寬一點再找。
 */
function pickCorners(shape: BoxShape, cols: number, rows: number, step: number, palette: BeadColor[], rng: Rng): Lab[] {
  const labs = palette.map((color) => toLab(color.hex));
  const pick = () => labs[Math.floor(rng() * labs.length)];
  const wantX = step * (shape === "three" ? (cols - 1) / 2 : cols - 1);
  const wantY = step * (rows - 1);
  for (let slack = 0.15; slack < 2; slack += 0.15) {
    const ok = (x: Lab, y: Lab, want: number) => Math.abs(dist(x, y) - want) <= want * slack;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const a = pick();
      const b = pick();
      if (!ok(a, b, wantX)) continue;
      if (shape === "strip") return [a, b];
      const c = pick();
      // 三色:a → b → c,c 不能繞回 a 附近(不然後半段看起來像在倒退)
      if (shape === "three") {
        if (ok(b, c, wantX) && dist(a, c) > wantX * 1.2) return [a, b, c];
        continue;
      }
      const d = pick();
      // 左上 a、右上 b、左下 c、右下 d。對角也要夠遠(像攤平的一張色紙),
      // 不然漸層會在中間折回來,一大片顏色看起來都一樣
      const diagonal = Math.hypot(wantX, wantY) * 0.85;
      if (ok(a, c, wantY) && ok(b, d, wantY) && ok(c, d, wantX) && dist(a, d) >= diagonal && dist(b, c) >= diagonal) {
        return [a, b, c, d];
      }
    }
  }
  const n = labs.length;
  return shape === "strip" ? [labs[0], labs[n - 1]] : shape === "three" ? [labs[0], labs[30], labs[n - 1]] : [labs[0], labs[1], labs[2], labs[3]];
}

/**
 * 色輪:OKLCH 裡固定亮度與彩度,色相繞一圈。彩度照「相鄰兩格要差多少」反推,
 * 太飽和換回 sRGB 會被夾掉,所以有上限(格子少時就會比要求的再難一點)。
 */
export function wheelTargets(count: number, step: number, rng: Rng): string[] {
  const L = 0.76 + (rng() - 0.5) * 0.08;
  const chroma = Math.min(0.12, step / (2 * Math.sin(Math.PI / count)));
  const start = rng() * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const h = start + (i * Math.PI * 2) / count;
    return toHex({ L, a: chroma * Math.cos(h), b: chroma * Math.sin(h) });
  });
}

/** 排好的樣子:色條是兩端之間內插,三色色條分兩段,漸層盒是四個角的雙線性內插 */
export function gradientTargets(shape: BoxShape, cols: number, rows: number, corners: Lab[]): string[] {
  const targets: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = cols === 1 ? 0 : col / (cols - 1);
      const v = rows === 1 ? 0 : row / (rows - 1);
      const lab =
        shape === "strip"
          ? lerp(corners[0], corners[1], u)
          : shape === "three"
            ? u <= 0.5
              ? lerp(corners[0], corners[1], u * 2)
              : lerp(corners[1], corners[2], u * 2 - 1)
            : lerp(lerp(corners[0], corners[1], u), lerp(corners[2], corners[3], u), v);
      targets.push(toHex(lab));
    }
  }
  return targets;
}

export function anchorPositions(shape: BoxShape, cols: number, rows: number): number[] {
  if (shape === "strip") return [0, cols - 1];
  if (shape === "three") return [0, (cols - 1) / 2, cols - 1];
  if (shape === "wheel") return [0, 1];
  return [0, cols - 1, (rows - 1) * cols, rows * cols - 1];
}

/** 把看起來一樣的顏色併成同一組(union-find),回傳每個位置的組號 */
export function lookAlikeGroups(targets: string[]): number[] {
  const labs = targets.map(toLab);
  const parent = targets.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < labs.length; i += 1) {
    for (let j = i + 1; j < labs.length; j += 1) {
      if (dist(labs[i], labs[j]) < SAME_COLOR) parent[find(i)] = find(j);
    }
  }
  return targets.map((_, i) => find(i));
}

/** 這個位置現在放的豆子對不對(和這一格同一組,也就是看起來一樣,就算對) */
export function isCorrect(box: SortBox, pos: number): boolean {
  return box.groups[box.cells[pos]] === box.groups[pos];
}

/** 固定的端點與已經排對的格子都卡住了,不能再拖 */
export function isLocked(box: SortBox, pos: number): boolean {
  return box.anchors.includes(pos) || isCorrect(box, pos);
}

export function isSorted(box: SortBox): boolean {
  return box.cells.every((_, pos) => isCorrect(box, pos));
}

export function correctCount(box: SortBox): number {
  return box.cells.filter((_, pos) => isCorrect(box, pos)).length;
}

/** 打亂:端點不動,其他打散;打散後還在原位的不超過一成,太容易就重洗 */
function shuffleCells(count: number, anchors: number[], rng: Rng, box: Omit<SortBox, "cells">): number[] {
  const free = Array.from({ length: count }, (_, i) => i).filter((i) => !anchors.includes(i));
  let best: number[] = [];
  let bestCorrect = Infinity;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const order = [...free];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const cells = Array.from({ length: count }, (_, i) => i);
    free.forEach((pos, k) => {
      cells[pos] = order[k];
    });
    const correct = free.filter((pos) => isCorrect({ ...box, cells }, pos)).length;
    if (correct < bestCorrect) {
      best = cells;
      bestCorrect = correct;
    }
    if (correct <= Math.floor(free.length * 0.1)) break;
  }
  return best;
}

/** 混雜豆:挑幾格(不挑端點),每格一到兩顆換成差一點點的顏色 */
function makeStrays(box: Omit<SortBox, "cells" | "strays">, rng: Rng): Stray[] {
  const candidates = box.targets.map((_, i) => i).filter((i) => !box.anchors.includes(i));
  const strays: Stray[] = [];
  const delta = STRAY_DELTA[box.level];
  const cells = Math.min(STRAY_CELLS[box.level], candidates.length);
  for (let k = 0; k < cells; k += 1) {
    const pos = candidates.splice(Math.floor(rng() * candidates.length), 1)[0];
    const base = toLab(box.targets[pos]);
    const howMany = rng() < 0.4 ? 2 : 1;
    const slots = new Set<number>();
    while (slots.size < howMany) slots.add(Math.floor(rng() * BEADS_PER_CELL));
    for (const slot of slots) {
      // 往一個隨機方向偏:有時偏亮暗、有時偏色相;換回 sRGB 時被夾掉的話就換個方向再試
      let hex = box.targets[pos];
      for (let tries = 0; tries < 12; tries += 1) {
        const angle = rng() * Math.PI * 2;
        const lift = rng() - 0.5;
        const shifted = {
          L: base.L + lift * delta * 0.9,
          a: base.a + Math.cos(angle) * delta * 0.7,
          b: base.b + Math.sin(angle) * delta * 0.7,
        };
        const candidate = toHex(shifted);
        const gap = dist(toLab(candidate), base);
        if (gap >= delta * 0.6) {
          hex = candidate;
          break;
        }
      }
      strays.push({ pos, slot, hex, picked: false });
    }
  }
  return strays;
}

/** 開一盒新的 */
export function newSortBox(shape: BoxShape, level: BoxLevel, palette: BeadColor[], rng: Rng = Math.random): SortBox {
  const { cols, rows } = SIZES[shape][level];
  // 開幾盒候選,留「看起來一樣的格子」最少的那一盒(多半第一盒就是 0)
  let targets: string[] = [];
  let merged = Infinity;
  for (let attempt = 0; attempt < 12 && merged > 0; attempt += 1) {
    const candidate =
      shape === "wheel"
        ? wheelTargets(cols, STEP[level], rng)
        : gradientTargets(shape, cols, rows, pickCorners(shape, cols, rows, STEP[level], palette, rng));
    const lost = candidate.length - new Set(lookAlikeGroups(candidate)).size;
    if (lost < merged) {
      targets = candidate;
      merged = lost;
    }
  }
  const anchors = anchorPositions(shape, cols, rows);
  const base = { shape, level, cols, rows, targets, groups: lookAlikeGroups(targets), anchors };
  return { ...base, cells: shuffleCells(targets.length, anchors, rng, { ...base, strays: [] }), strays: makeStrays(base, rng) };
}

/** 互換兩格;卡住的(端點、已經排對的)不動 */
export function swapCells(box: SortBox, a: number, b: number): SortBox {
  if (a === b || isLocked(box, a) || isLocked(box, b)) return box;
  const cells = [...box.cells];
  [cells[a], cells[b]] = [cells[b], cells[a]];
  return { ...box, cells };
}

/** 這一次互換讓哪些格子剛好排對(要「喀」一聲的) */
export function newlyCorrect(before: SortBox, after: SortBox): number[] {
  return after.cells.map((_, pos) => pos).filter((pos) => isCorrect(after, pos) && !isCorrect(before, pos));
}

/** 用鑷子夾一顆:是雜豆就拿掉,不是就什麼都不做 */
export function pickBead(box: SortBox, pos: number, slot: number): { box: SortBox; hit: boolean } {
  const index = box.strays.findIndex((stray) => stray.pos === pos && stray.slot === slot && !stray.picked);
  if (index < 0) return { box, hit: false };
  const strays = box.strays.map((stray, i) => (i === index ? { ...stray, picked: true } : stray));
  return { box: { ...box, strays }, hit: true };
}

export function straysLeft(box: SortBox): number {
  return box.strays.filter((stray) => !stray.picked).length;
}

/** 整理好的豆盒:看起來一樣的(同一組)只留第一個,照位置順序 */
export function rewardColors(box: SortBox): string[] {
  const seen = new Set<number>();
  return box.targets.filter((_, i) => {
    if (seen.has(box.groups[i])) return false;
    seen.add(box.groups[i]);
    return true;
  });
}

// ---- 獎勵色盤:整理好的豆盒收進收藏冊,接在預設色盤後面,拼豆板上可以用 ----

export const BOX_PALETTES_KEY = "toolbox-beads-boxes";
/** 最多收幾盒(色盤太長,選色會找不到) */
export const MAX_BOX_PALETTES = 12;

export type BoxPalette = { id: string; name: string; createdAt: string; colors: { code: string; hex: string }[] };

/** 新的色號接著已經用過的最大號往下編:B01、B02……(刪掉的號碼不重用,舊作品才不會認錯色) */
export function nextBoxCodes(existing: BoxPalette[], count: number, used = 0): string[] {
  const start = Math.max(used, maxCode(existing)) + 1;
  return Array.from({ length: count }, (_, k) => `B${String(start + k).padStart(2, "0")}`);
}

export function makeBoxPalette(box: SortBox, existing: BoxPalette[], used = 0, now = new Date()): BoxPalette {
  const colors = rewardColors(box);
  const codes = nextBoxCodes(existing, colors.length, used);
  const number = existing.length + 1;
  return {
    id: `box-${now.getTime().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: `豆盒 ${number}`,
    createdAt: now.toISOString(),
    colors: colors.map((hex, k) => ({ code: codes[k], hex })),
  };
}

/** 預設色盤 + 每一盒的顏色(接在後面,預設色的索引不會變) */
export function extendedPalette(base: BeadColor[], boxes: BoxPalette[]): BeadColor[] {
  return [
    ...base,
    ...boxes.flatMap((box) =>
      box.colors.map((color, k) => ({ code: color.code, name: `${box.name}・${k + 1}`, reading: color.code, hex: color.hex }))
    ),
  ];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** 存檔:收進來的每一盒,加上用過的最大色號(刪掉的號碼不重用) */
export type BoxStore = { lastCode: number; boxes: BoxPalette[] };

function maxCode(boxes: BoxPalette[]): number {
  const numbers = boxes.flatMap((box) => box.colors.map((color) => Number(color.code.replace(/^B/, ""))));
  return Math.max(0, ...numbers.filter(Number.isFinite));
}

/** 讀回存檔:壞掉的那一盒略過;舊的或壞的 lastCode 至少要比現有的色號大 */
export function readBoxStore(raw: unknown): BoxStore {
  const list = isRecord(raw) && Array.isArray(raw.boxes) ? raw.boxes : [];
  const boxes = list
    .filter(
      (item): item is BoxPalette =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.createdAt === "string" &&
        Array.isArray(item.colors) &&
        item.colors.length > 0 &&
        item.colors.every(
          (color) => isRecord(color) && typeof color.code === "string" && /^#[0-9a-f]{6}$/i.test(String(color.hex))
        )
    )
    .slice(0, MAX_BOX_PALETTES);
  const stored = isRecord(raw) && typeof raw.lastCode === "number" && Number.isFinite(raw.lastCode) ? raw.lastCode : 0;
  return { lastCode: Math.max(stored, maxCode(boxes)), boxes };
}

/** 收一盒進來:色號從 lastCode 往下編 */
export function addBoxPalette(store: BoxStore, box: SortBox, now = new Date()): BoxStore {
  const palette = makeBoxPalette(box, store.boxes, store.lastCode, now);
  return { lastCode: Math.max(store.lastCode, maxCode([palette])), boxes: [...store.boxes, palette] };
}
