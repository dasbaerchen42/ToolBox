// 周邊工坊的存檔:四種周邊的設計、目前在做哪一種,加上「你的照片」與去背圖。
// 設計是純 JSON;照片與去背圖是 Blob,一起放進 IndexedDB(lib/idb.ts),重新整理或下次打開都還在。
//
// 讀回來的東西一律當作不可信(可能是舊版存的、被改壞的):
// 每一種周邊跟預設值逐欄合併,型別不對的欄位用預設值,不讓一筆壞資料把整頁弄壞。

import { defaultDesigns, MERCH_KINDS, type MerchDesigns, type MerchKind, type Placed, type Recolor } from "./design";

export const MERCH_STORE_KEY = "merch-workshop";

export type StoredCutout = { id: string; label: string; blob: Blob };

export type StoredMerch = {
  version: 1;
  kind: MerchKind;
  designs: MerchDesigns;
  photo: Blob | null;
  cutouts: StoredCutout[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** 每個欄位照預設值的型別檢查;陣列與巢狀物件交給下面各自處理 */
function mergeFlat<T extends Record<string, unknown>>(base: T, raw: unknown): T {
  if (!isRecord(raw)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(base)) {
    const incoming = raw[key];
    if (incoming === undefined) continue;
    // 預設是 null 的欄位(例如御守的鈴鐺)型別不定,交給各自的檢查
    if (value !== null && typeof value === typeof incoming) {
      if (Array.isArray(value) !== Array.isArray(incoming)) continue;
      out[key] = incoming;
    }
  }
  return out as T;
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** 換色表:色號 → 色號,都是短字串;不對的整張換色表丟掉(貼紙本身留著) */
function readRecolor(raw: unknown): Recolor | undefined {
  if (!isRecord(raw)) return undefined;
  const entries = Object.entries(raw).filter(
    ([from, to]) => from.length <= 12 && typeof to === "string" && to.length <= 12 && !/[#,>]/.test(from + to)
  );
  return entries.length > 0 ? (Object.fromEntries(entries) as Recolor) : undefined;
}

function withRecolor<T extends { recolor?: Recolor }>(item: T, raw: Record<string, unknown>): T {
  const recolor = readRecolor(raw.recolor);
  const { recolor: _dropped, ...rest } = item;
  void _dropped;
  return (recolor ? { ...rest, recolor } : rest) as T;
}

function readPlaced(raw: unknown): Placed[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Placed =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.artId === "string" &&
        isNumber(item.x) &&
        isNumber(item.y) &&
        isNumber(item.size) &&
        isNumber(item.rotation)
    )
    .map((item) => withRecolor(item, item as unknown as Record<string, unknown>));
}

/** 讀回來的設計 → 一定完整、型別正確的設計 */
export function sanitizeDesigns(raw: unknown): MerchDesigns {
  const base = defaultDesigns();
  if (!isRecord(raw)) return base;

  const card = mergeFlat(base.card, raw.card);
  card.stickers = isRecord(raw.card) ? readPlaced(raw.card.stickers) : base.card.stickers;

  const charm = mergeFlat(base.charm, raw.charm);
  charm.pieces =
    isRecord(raw.charm) && Array.isArray(raw.charm.pieces)
      ? raw.charm.pieces.filter(
          (piece): piece is MerchDesigns["charm"]["pieces"][number] =>
            isRecord(piece) && typeof piece.id === "string" && typeof piece.artId === "string" && isNumber(piece.cell)
        ).map((piece) => withRecolor(piece, piece as unknown as Record<string, unknown>))
      : base.charm.pieces;

  const omamori = mergeFlat(base.omamori, raw.omamori);
  if (isRecord(raw.omamori) && (raw.omamori.bell === null || typeof raw.omamori.bell === "string")) {
    omamori.bell = raw.omamori.bell as string | null;
  }

  const acrylic = mergeFlat(base.acrylic, raw.acrylic);
  acrylic.stickers = isRecord(raw.acrylic) ? readPlaced(raw.acrylic.stickers) : base.acrylic.stickers;
  const corners = isRecord(raw.acrylic) ? raw.acrylic.corners : null;
  acrylic.corners =
    Array.isArray(corners) && corners.length === 4 && corners.every((p) => isRecord(p) && isNumber(p.x) && isNumber(p.y))
      ? (corners as MerchDesigns["acrylic"]["corners"])
      : base.acrylic.corners;

  // 兩色欄位(tuple)要剛好兩個字串
  const pair = (value: unknown, fallback: [string, string]): [string, string] =>
    Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "string")
      ? (value as [string, string])
      : fallback;
  card.mosaic = pair(isRecord(raw.card) ? raw.card.mosaic : null, base.card.mosaic);
  card.frameColors = pair(isRecord(raw.card) ? raw.card.frameColors : null, base.card.frameColors);

  const beadcharm = withRecolor(mergeFlat(base.beadcharm, raw.beadcharm), isRecord(raw.beadcharm) ? raw.beadcharm : {});
  if (beadcharm.hardware !== "ring" && beadcharm.hardware !== "strap") beadcharm.hardware = base.beadcharm.hardware;
  if (!["none", "lace", "beads", "motif"].includes(card.frame)) card.frame = base.card.frame;

  return { card, charm, omamori, acrylic, beadcharm };
}

/** 讀回整份存檔;不是這個格式就回 null(當作第一次來) */
export function readStoredMerch(raw: unknown): StoredMerch | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const kind = MERCH_KINDS.some((item) => item.kind === raw.kind) ? (raw.kind as MerchKind) : "card";
  const isBlob = (value: unknown): value is Blob => typeof Blob !== "undefined" && value instanceof Blob;
  const cutouts = Array.isArray(raw.cutouts)
    ? raw.cutouts.filter(
        (item): item is StoredCutout =>
          isRecord(item) && typeof item.id === "string" && typeof item.label === "string" && isBlob(item.blob)
      )
    : [];
  return {
    version: 1,
    kind,
    designs: sanitizeDesigns(raw.designs),
    photo: isBlob(raw.photo) ? raw.photo : null,
    cutouts,
  };
}
