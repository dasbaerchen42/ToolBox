// 收藏冊:作品存在使用者自己的瀏覽器(localStorage),可匯出/匯入 JSON 備份。
//
// 存檔不記色盤索引,而是記「這張圖用到哪些色號(連同色碼)」再用索引指過去——
// 之後色盤增減或重排,舊作品照色號找回來;色號不見了就拿色碼找最接近的豆子。

import { isOutline, type BoardOutline } from "./outline";
import { hexToRgb, labDistanceSq, rgbToOklab } from "./color";
import { allMatte, isMaterialId } from "./finish";
import { paletteLab, type BeadColor } from "./palette";
import type { BeadPattern } from "./pattern";

export const ALBUM_KEY = "toolbox-beads-album";
const FILE_TAG = "toolbox-beads";
const FILE_VERSION = 1;

/** 板子邊長的上限:大板 58,留一點餘裕給之後的多板拼接 */
const MAX_SIDE = 232;

/**
 * 作品:完整的一幅;素材:迷你板拼的小零件,之後給周邊工坊用;
 * 模板:自己拼的圖存成色位模板,套用時開一張新的,在色位清單換色重複使用。
 * (存檔本來就只記「用到哪幾色」加上每格指向第幾色,本身就是色位格式)
 */
export type AlbumKind = "work" | "material" | "template";

export const ALBUM_KIND_LABELS: Record<AlbumKind, string> = { work: "作品", material: "素材", template: "模板" };

export type SavedWork = {
  id: string;
  kind: AlbumKind;
  name: string;
  createdAt: string;
  updatedAt: string;
  cols: number;
  rows: number;
  colors: { code: string; hex: string }[];
  /** 指向 colors 的索引,-1 是空格 */
  cells: number[];
  /** 每格的材質;全部霧面時不存 */
  materials?: number[];
  /** 板子外形;方形時不存 */
  outline?: BoardOutline;
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 目前的格子資料 → 存檔。給了 existing 就是覆蓋那一筆(保留 id 與建立時間) */
export function toSavedWork(
  pattern: BeadPattern,
  palette: BeadColor[],
  name: string,
  existing?: Pick<SavedWork, "id" | "createdAt">,
  now = new Date().toISOString(),
  kind: AlbumKind = "work"
): SavedWork {
  const used = new Map<number, number>();
  const colors: SavedWork["colors"] = [];

  const cells = pattern.cells.map((cell) => {
    if (cell < 0) return -1;
    let local = used.get(cell);
    if (local === undefined) {
      local = colors.length;
      used.set(cell, local);
      colors.push({ code: palette[cell].code, hex: palette[cell].hex });
    }
    return local;
  });

  return {
    id: existing?.id ?? createId(),
    kind,
    name: name.trim() || "未命名作品",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    cols: pattern.cols,
    rows: pattern.rows,
    colors,
    cells,
    ...(allMatte(pattern.materials) ? {} : { materials: [...(pattern.materials as number[])] }),
    ...(pattern.outline && pattern.outline !== "rect" ? { outline: pattern.outline } : {}),
  };
}

/** 存檔 → 格子資料。色號找不到時用色碼找最接近的豆子 */
export function fromSavedWork(work: SavedWork, palette: BeadColor[]): BeadPattern {
  const labs = paletteLab(palette);

  const mapping = work.colors.map(({ code, hex }) => {
    const exact = palette.findIndex((color) => color.code === code);
    if (exact >= 0) return exact;

    const target = rgbToOklab(hexToRgb(hex));
    let best = 0;
    let bestDistance = Infinity;
    labs.forEach((lab, index) => {
      const distance = labDistanceSq(target, lab);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  });

  return {
    cols: work.cols,
    rows: work.rows,
    cells: work.cells.map((cell) => (cell < 0 ? -1 : mapping[cell])),
    ...(work.materials ? { materials: [...work.materials] } : {}),
    ...(work.outline ? { outline: work.outline } : {}),
  };
}

const isText = (value: unknown): value is string => typeof value === "string";
const isSide = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_SIDE;

/** 從不可信的來源(匯入檔、被改壞的 localStorage)讀一筆;格式不對就回傳 null */
function readWork(value: unknown): SavedWork | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (!isText(raw.id) || !isText(raw.name) || !isSide(raw.cols) || !isSide(raw.rows)) return null;
  if (!Array.isArray(raw.colors) || !Array.isArray(raw.cells)) return null;

  const colors = raw.colors.filter(
    (color): color is SavedWork["colors"][number] =>
      !!color &&
      isText((color as Record<string, unknown>).code) &&
      isText((color as Record<string, unknown>).hex) &&
      /^#[0-9a-f]{6}$/i.test((color as { hex: string }).hex)
  );
  if (colors.length !== raw.colors.length) return null;

  const size = raw.cols * raw.rows;
  if (raw.cells.length !== size) return null;
  const cellsOk = raw.cells.every(
    (cell) => Number.isInteger(cell) && cell >= -1 && cell < colors.length
  );
  if (!cellsOk) return null;

  // 材質壞掉就當作全部霧面,不為了材質丟掉整件作品
  const materials =
    Array.isArray(raw.materials) &&
    raw.materials.length === size &&
    raw.materials.every(isMaterialId)
      ? (raw.materials as number[])
      : undefined;

  const now = new Date().toISOString();
  return {
    id: raw.id,
    kind: raw.kind === "material" || raw.kind === "template" ? raw.kind : "work",
    name: raw.name.slice(0, 60),
    createdAt: isText(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isText(raw.updatedAt) ? raw.updatedAt : now,
    cols: raw.cols,
    rows: raw.rows,
    colors,
    cells: raw.cells as number[],
    ...(materials ? { materials } : {}),
    ...(isOutline(raw.outline) && raw.outline !== "rect" ? { outline: raw.outline } : {}),
  };
}

/** 讀匯入檔或 localStorage 的內容;壞掉的那幾筆略過,不讓一筆壞資料拖垮整本 */
export function parseAlbum(raw: string): { works: SavedWork[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { works: [], skipped: 0 };
  }

  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { works?: unknown }).works)
      ? (data as { works: unknown[] }).works
      : [];

  const works: SavedWork[] = [];
  for (const entry of list) {
    const work = readWork(entry);
    if (work) works.push(work);
  }
  return { works, skipped: list.length - works.length };
}

export function serializeAlbum(works: SavedWork[]): string {
  return JSON.stringify({ app: FILE_TAG, version: FILE_VERSION, works });
}

/** 匯入時合併:同一個 id 留比較新的那份;新的排前面 */
export function mergeAlbum(current: SavedWork[], incoming: SavedWork[]): SavedWork[] {
  const byId = new Map(current.map((work) => [work.id, work]));
  for (const work of incoming) {
    const existing = byId.get(work.id);
    if (!existing || work.updatedAt > existing.updatedAt) byId.set(work.id, work);
  }
  return sortAlbum([...byId.values()]);
}

export function sortAlbum(works: SavedWork[]): SavedWork[] {
  return [...works].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export function loadAlbum(): SavedWork[] {
  try {
    const raw = localStorage.getItem(ALBUM_KEY);
    return raw ? sortAlbum(parseAlbum(raw).works) : [];
  } catch {
    return [];
  }
}

/** 寫不進去(空間滿了、無痕模式)時回傳 false,讓畫面提示改用匯出 */
export function storeAlbum(works: SavedWork[]): boolean {
  try {
    localStorage.setItem(ALBUM_KEY, serializeAlbum(works));
    return true;
  } catch {
    return false;
  }
}
