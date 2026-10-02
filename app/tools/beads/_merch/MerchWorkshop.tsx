"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { idbGet, idbSet } from "@/lib/idb";
import { MERCH_STORE_KEY, readStoredMerch, type StoredMerch } from "@/lib/tools/merch/persist";
import type { ThemeClasses } from "@/lib/theme";
import { downloadBlob, shareImages, type ExportedImage } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { canvasToPng } from "@/lib/tools/beads/draw";
import type { SavedWork } from "@/lib/tools/beads/album";
import type { BeadColor } from "@/lib/tools/beads/palette";
import { decodePhoto } from "@/lib/tools/beads/photo";
import { ImageDecodeError } from "@/lib/tools/image/render";
import {
  CHARM_CELL,
  DESIGN_SIZE,
  defaultDesigns,
  MERCH_KINDS,
  newId,
  placeSticker,
  type MerchDesigns,
  type MerchKind,
  type Placed,
} from "@/lib/tools/merch/design";
import type { Vec } from "@/lib/tools/merch/physics";
import {
  acrylicBoardSize,
  drawAcrylicBoard,
  drawAcrylicScene,
  drawCard,
  drawCharm,
  drawOmamori,
  type CharmPiece,
} from "@/lib/tools/merch/render";
import { ActionButton, ColorField, Field, RangeField, Segmented, StationHint, Toggle } from "../../image/_components/controls";
import { ToolPane } from "../../image/_components/WorkbenchLayout";
import AcrylicStage from "./AcrylicStage";
import ArtLibrary from "./ArtLibrary";
import { isPieceable, MAX_PIECE_SIDE, useArts, type Cutout } from "./arts";
import CardStage from "./CardStage";
import CharmStage from "./CharmStage";
import OmamoriStage from "./OmamoriStage";
import PlacedControls from "./PlacedControls";
import { needsMotionPermission, requestMotionPermission } from "./useDesignCanvas";
import WandDialog from "./WandDialog";

/** 輸出倍率:設計單位 × 2,小卡就是 1100×1700 */
const EXPORT_SCALE = 2;
const MAX_PIECES = 12;

const PATTERNS = [
  { value: "asanoha", label: "麻葉" },
  { value: "seigaiha", label: "青海波" },
  { value: "dots", label: "點點" },
  { value: "plain", label: "素面" },
] as const;

type Notice = { text: string; kind: "info" | "error" } | null;

/**
 * 周邊工坊:小卡套、搖搖吊飾、御守、透卡／打卡棒。
 * 素材來自內建模板、相簿(作品與素材)與魔術棒去背的圖片;一張「你的照片」四種周邊共用。
 */
export default function MerchWorkshop({
  album,
  palette,
  active,
  t,
}: {
  album: SavedWork[];
  palette: BeadColor[];
  active: boolean;
  t: ThemeClasses;
}) {
  const [kind, setKind] = useState<MerchKind>("card");
  const [designs, setDesigns] = useState<MerchDesigns>(defaultDesigns);
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  /** 照片的原始檔:存檔用(ImageBitmap 存不進去) */
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  /** 上次的進度讀回來之前不要存,免得把存檔蓋成預設值 */
  const [restored, setRestored] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [wand, setWand] = useState<{ image: ImageBitmap; name: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");
  // 這個元件只在切到「周邊」後才掛上去,不會在伺服器端渲染,可以直接問瀏覽器
  const [motion, setMotion] = useState<"needs" | "on">(() => (needsMotionPermission() ? "needs" : "on"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const canShare = useCanShareImages();

  const photoInput = useRef<HTMLInputElement>(null);
  const wandInput = useRef<HTMLInputElement>(null);
  const charmPieces = useRef<CharmPiece[]>([]);
  const shake = useRef<Vec | null>(null);

  const { entries, getArt, artMap } = useArts(album, cutouts, palette);

  // 讀回上次的進度:設計、正在做哪一種、你的照片、去背圖
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readStoredMerch(await idbGet<unknown>(MERCH_STORE_KEY));
      if (stored && !cancelled) {
        const restoredCutouts: Cutout[] = [];
        for (const item of stored.cutouts) {
          try {
            const bitmap = await createImageBitmap(item.blob);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
            bitmap.close();
            restoredCutouts.push({ id: item.id, label: item.label, canvas, blob: item.blob });
          } catch {
            // 讀不出來的去背圖就略過,貼著它的貼紙會自動不畫
          }
        }
        let restoredPhoto: ImageBitmap | null = null;
        if (stored.photo) {
          try {
            restoredPhoto = await decodePhoto(stored.photo, "photo");
          } catch {
            restoredPhoto = null;
          }
        }
        if (cancelled) return;
        setDesigns(stored.designs);
        setKind(stored.kind);
        setCutouts(restoredCutouts);
        setPhoto(restoredPhoto);
        setPhotoBlob(restoredPhoto ? stored.photo : null);
      }
      if (!cancelled) setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 自動存檔:停下來 0.5 秒才寫,拖貼紙時不會每一格都存
  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => {
      const data: StoredMerch = {
        version: 1,
        kind,
        designs,
        photo: photoBlob,
        cutouts: cutouts.map(({ id, label, blob }) => ({ id, label, blob })),
      };
      void idbSet(MERCH_STORE_KEY, data).then((ok) => setSaveFailed(!ok));
    }, 500);
    return () => clearTimeout(timer);
  }, [restored, kind, designs, photoBlob, cutouts]);

  function resetAll() {
    if (!window.confirm("四種周邊都回到預設的樣子，照片與去背圖也會拿掉。要繼續嗎？")) return;
    setDesigns(defaultDesigns());
    setPhoto(null);
    setPhotoBlob(null);
    setCutouts([]);
    setSelected(null);
    showNotice("全部回到預設了。");
  }

  const update = useCallback(<K extends MerchKind>(key: K, value: MerchDesigns[K]) => {
    setDesigns((current) => ({ ...current, [key]: value }));
  }, []);

  const card = designs.card;
  const charm = designs.charm;
  const omamori = designs.omamori;
  const acrylic = designs.acrylic;

  const cardArts = useMemo(() => artMap(card.stickers.map((item) => item.artId)), [artMap, card.stickers]);
  const charmArts = useMemo(() => artMap(charm.pieces.map((item) => item.artId)), [artMap, charm.pieces]);
  const acrylicArts = useMemo(() => artMap(acrylic.stickers.map((item) => item.artId)), [artMap, acrylic.stickers]);
  const bell = useMemo(() => (omamori.bell ? getArt(omamori.bell) : null), [getArt, omamori.bell]);

  const showNotice = (text: string, noticeKind: "info" | "error" = "info") => setNotice({ text, kind: noticeKind });

  async function loadImage(file: File): Promise<ImageBitmap | null> {
    try {
      return await decodePhoto(file, file.name);
    } catch (error) {
      showNotice(error instanceof ImageDecodeError ? error.message : "讀不到這張圖。", "error");
      return null;
    }
  }

  function switchKind(next: MerchKind) {
    setKind(next);
    setSelected(null);
    setNotice(null);
  }

  function addSticker(artId: string) {
    if (kind === "card") {
      const placed = placeSticker(card.stickers, artId);
      update("card", { ...card, stickers: [...card.stickers, placed] });
      setSelected(placed.id);
    } else if (kind === "acrylic") {
      const placed = placeSticker(acrylic.stickers, artId, 0.34);
      update("acrylic", { ...acrylic, stickers: [...acrylic.stickers, placed] });
      setSelected(placed.id);
    } else if (kind === "charm") {
      if (charm.pieces.length >= MAX_PIECES) {
        showNotice(`吊飾裡最多放 ${MAX_PIECES} 個零件。`, "error");
        return;
      }
      const cell = charm.pieces[0]?.cell ?? CHARM_CELL;
      update("charm", { ...charm, pieces: [...charm.pieces, { id: newId("piece"), artId, cell }] });
    } else {
      update("omamori", { ...omamori, bell: artId });
    }
  }

  // ---- 輸出 ----

  function renderExport(): HTMLCanvasElement {
    const { width, height } = DESIGN_SIZE[kind];
    const canvas = document.createElement("canvas");
    canvas.width = width * EXPORT_SCALE;
    canvas.height = height * EXPORT_SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
    if (kind === "card") drawCard(ctx, width, height, card, { photo, arts: cardArts }, 0.7);
    else if (kind === "charm") drawCharm(ctx, width, height, charm, photo, charmPieces.current);
    else if (kind === "omamori") drawOmamori(ctx, width, height, omamori, side, 0, bell);
    else {
      const size = acrylicBoardSize(acrylic);
      const board = document.createElement("canvas");
      board.width = size.width;
      board.height = size.height;
      const boardCtx = board.getContext("2d");
      if (boardCtx) drawAcrylicBoard(boardCtx, acrylic, acrylicArts);
      drawAcrylicScene(ctx, width, height, acrylic, photo, board);
    }
    return canvas;
  }

  async function buildPng(): Promise<ExportedImage> {
    const label = MERCH_KINDS.find((item) => item.kind === kind)?.label.replace("／", "-") ?? "周邊";
    return { name: `周邊-${label}.png`, blob: await canvasToPng(renderExport()) };
  }

  async function run(task: () => Promise<string | undefined>) {
    setBusy(true);
    try {
      const message = await task();
      if (message) showNotice(message);
    } catch (error) {
      console.error(error);
      showNotice("輸出失敗，請再試一次。", "error");
    } finally {
      setBusy(false);
    }
  }

  const handleDownload = () =>
    run(async () => {
      downloadBlob(await buildPng());
      return "已下載。";
    });

  const handleShare = () =>
    run(async () => {
      try {
        const result = await shareImages([await buildPng()]);
        if (result === "needs-tap") return "圖準備好了，再按一次「存到相簿／分享」。";
        return result === "shared" ? "已交給分享選單。" : undefined;
      } catch {
        return "這個瀏覽器沒辦法分享圖片，請改用下載。";
      }
    });

  // ---- 畫面 ----

  const hint = MERCH_KINDS.find((item) => item.kind === kind)?.hint;
  const stickers: Placed[] | null = kind === "card" ? card.stickers : kind === "acrylic" ? acrylic.stickers : null;
  const setStickers = (next: Placed[]) => {
    if (kind === "card") update("card", { ...card, stickers: next });
    else if (kind === "acrylic") update("acrylic", { ...acrylic, stickers: next });
  };

  const stage =
    kind === "card" ? (
      <CardStage
        design={card}
        onChange={(next) => update("card", next)}
        photo={photo}
        arts={cardArts}
        selected={selected}
        onSelect={setSelected}
        active={active}
      />
    ) : kind === "charm" ? (
      <CharmStage design={charm} photo={photo} arts={charmArts} active={active} piecesRef={charmPieces} shakeRef={shake} />
    ) : kind === "omamori" ? (
      <OmamoriStage
        design={omamori}
        bell={bell}
        side={side}
        onFlip={() => setSide((current) => (current === "front" ? "back" : "front"))}
        active={active}
      />
    ) : (
      <AcrylicStage
        design={acrylic}
        onChange={(next) => update("acrylic", next)}
        photo={photo}
        arts={acrylicArts}
        selected={selected}
        onSelect={setSelected}
        active={active}
      />
    );

  const usesPhoto = kind !== "omamori";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="周邊種類"
          value={kind}
          onChange={switchKind}
          options={MERCH_KINDS.map((item) => ({ value: item.kind, label: item.label }))}
          t={t}
        />
        <p
          aria-live="polite"
          className={`text-xs leading-6 tracking-[0.04em] ${notice?.kind === "error" ? "" : t.muted}`}
        >
          {busy ? "處理中……" : (notice?.text ?? "")}
        </p>
      </div>

      <ToolPane
        workspace={
          <div className="flex flex-col gap-3">
            <div
              data-testid="merch-stage"
              className="flex justify-center overflow-hidden rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-4"
            >
              {stage}
            </div>
            {hint && <StationHint t={t}>{hint}</StationHint>}
          </div>
        }
        controls={
          <>
            {usesPhoto && (
              <Field
                label="你的照片"
                hint={
                  kind === "card"
                    ? "底選「照片」時放在框裡。"
                    : kind === "charm"
                      ? "後層選「照片」時放在吊飾裡。"
                      : "透卡疊在照片前面，像拿在鏡頭前拍。"
                }
                t={t}
              >
                <div className="flex flex-wrap gap-2">
                  <ActionButton tone="secondary" t={t} onClick={() => photoInput.current?.click()}>
                    {photo ? "換一張" : "選照片"}
                  </ActionButton>
                  {photo && (
                    <ActionButton
                      tone="secondary"
                      t={t}
                      onClick={() => {
                        setPhoto(null);
                        setPhotoBlob(null);
                      }}
                    >
                      拿掉照片
                    </ActionButton>
                  )}
                </div>
              </Field>
            )}

            {kind === "card" && (
              <>
                <Field label="底" t={t}>
                  <Segmented
                    label="底"
                    value={card.background}
                    onChange={(background) => update("card", { ...card, background })}
                    options={[
                      { value: "mosaic", label: "馬賽克" },
                      { value: "color", label: "純色" },
                      { value: "photo", label: "照片" },
                    ]}
                    t={t}
                  />
                </Field>
                {card.background === "mosaic" ? (
                  <Field label="馬賽克兩色" t={t}>
                    <ColorField value={card.mosaic[0]} onChange={(c) => update("card", { ...card, mosaic: [c, card.mosaic[1]] })} t={t} />
                    <ColorField value={card.mosaic[1]} onChange={(c) => update("card", { ...card, mosaic: [card.mosaic[0], c] })} t={t} />
                  </Field>
                ) : (
                  <Field label="底色" t={t}>
                    <ColorField value={card.color} onChange={(color) => update("card", { ...card, color })} t={t} />
                  </Field>
                )}
                <Field label="框" t={t}>
                  <Segmented
                    label="框"
                    value={card.frame}
                    onChange={(frame) => update("card", { ...card, frame })}
                    options={[
                      { value: "lace", label: "蕾絲邊" },
                      { value: "beads", label: "拼豆框" },
                      { value: "none", label: "不加框" },
                    ]}
                    t={t}
                  />
                </Field>
                {card.frame === "beads" && (
                  <Field label="拼豆框兩色" t={t}>
                    <ColorField
                      value={card.frameColors[0]}
                      onChange={(c) => update("card", { ...card, frameColors: [c, card.frameColors[1]] })}
                      t={t}
                    />
                    <ColorField
                      value={card.frameColors[1]}
                      onChange={(c) => update("card", { ...card, frameColors: [card.frameColors[0], c] })}
                      t={t}
                    />
                  </Field>
                )}
                <Field label="卡套材質" t={t}>
                  <Toggle label="雷射膜" checked={card.laser} onChange={(laser) => update("card", { ...card, laser })} t={t} />
                  <Toggle label="亮面" checked={card.gloss} onChange={(gloss) => update("card", { ...card, gloss })} t={t} />
                </Field>
              </>
            )}

            {kind === "charm" && (
              <>
                <Field label="外形" t={t}>
                  <Segmented
                    label="外形"
                    value={charm.shape}
                    onChange={(shape) => update("charm", { ...charm, shape })}
                    options={[
                      { value: "rounded", label: "圓角方形" },
                      { value: "circle", label: "圓形" },
                    ]}
                    t={t}
                  />
                </Field>
                <Field label="後層" t={t}>
                  <Segmented
                    label="後層"
                    value={charm.background}
                    onChange={(background) => update("charm", { ...charm, background })}
                    options={[
                      { value: "color", label: "底色" },
                      { value: "photo", label: "照片" },
                    ]}
                    t={t}
                  />
                  <ColorField value={charm.color} onChange={(color) => update("charm", { ...charm, color })} t={t} />
                </Field>
                <Field label="金屬環" t={t}>
                  <ColorField value={charm.ring} onChange={(ring) => update("charm", { ...charm, ring })} t={t} />
                </Field>
                <RangeField
                  label="零件大小"
                  display={`${charm.pieces[0]?.cell ?? CHARM_CELL}`}
                  value={charm.pieces[0]?.cell ?? CHARM_CELL}
                  min={10}
                  max={24}
                  onChange={(cell) =>
                    update("charm", { ...charm, pieces: charm.pieces.map((piece) => ({ ...piece, cell })) })
                  }
                  t={t}
                />
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    tone="secondary"
                    t={t}
                    onClick={() => {
                      shake.current = { x: (Math.random() - 0.5) * 30000, y: -26000 };
                    }}
                  >
                    搖一搖
                  </ActionButton>
                  <ActionButton
                    tone="secondary"
                    t={t}
                    onClick={() => update("charm", { ...charm, pieces: charm.pieces.slice(0, -1) })}
                    disabled={charm.pieces.length === 0}
                  >
                    拿掉最後一個
                  </ActionButton>
                  <ActionButton
                    tone="secondary"
                    t={t}
                    onClick={() => update("charm", { ...charm, pieces: [] })}
                    disabled={charm.pieces.length === 0}
                  >
                    清空
                  </ActionButton>
                </div>
              </>
            )}

            {kind === "omamori" && (
              <>
                <Field label="正面繡字" hint="直書，最多 8 個字" t={t}>
                  <input
                    type="text"
                    value={omamori.front}
                    maxLength={8}
                    onChange={(event) => update("omamori", { ...omamori, front: event.target.value })}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    aria-label="正面繡字"
                  />
                </Field>
                <Field label="背面小字" t={t}>
                  <input
                    type="text"
                    value={omamori.back}
                    maxLength={10}
                    onChange={(event) => update("omamori", { ...omamori, back: event.target.value })}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    aria-label="背面小字"
                  />
                </Field>
                <Field label="花紋" t={t}>
                  <Segmented
                    label="花紋"
                    value={omamori.pattern}
                    onChange={(pattern) => update("omamori", { ...omamori, pattern })}
                    options={[...PATTERNS]}
                    t={t}
                  />
                </Field>
                <Field label="布料" t={t}>
                  <ColorField value={omamori.fabric} onChange={(fabric) => update("omamori", { ...omamori, fabric })} t={t} />
                </Field>
                <Field label="繡線與滾邊" t={t}>
                  <ColorField value={omamori.thread} onChange={(thread) => update("omamori", { ...omamori, thread })} t={t} />
                  <ColorField value={omamori.trim} onChange={(trim) => update("omamori", { ...omamori, trim })} t={t} />
                </Field>
                <Field label="繩結" t={t}>
                  <ColorField value={omamori.knot} onChange={(knot) => update("omamori", { ...omamori, knot })} t={t} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <ActionButton tone="secondary" t={t} onClick={() => setSide((s) => (s === "front" ? "back" : "front"))}>
                    翻面（現在是{side === "front" ? "正面" : "背面"}）
                  </ActionButton>
                  {omamori.bell && (
                    <ActionButton tone="secondary" t={t} onClick={() => update("omamori", { ...omamori, bell: null })}>
                      拿掉鈴鐺
                    </ActionButton>
                  )}
                </div>
              </>
            )}

            {kind === "acrylic" && (
              <>
                <Field label="款式" t={t}>
                  <Segmented
                    label="款式"
                    value={acrylic.mode}
                    onChange={(mode) => update("acrylic", { ...acrylic, mode })}
                    options={[
                      { value: "card", label: "透卡" },
                      { value: "stick", label: "打卡棒" },
                    ]}
                    t={t}
                  />
                </Field>
                <Field label="板子形狀" t={t}>
                  <Segmented
                    label="板子形狀"
                    value={acrylic.shape}
                    onChange={(shape) => update("acrylic", { ...acrylic, shape })}
                    options={[
                      { value: "rect", label: "圓角方形" },
                      { value: "circle", label: "圓形" },
                    ]}
                    t={t}
                  />
                </Field>
                <Toggle
                  label="壓克力邊"
                  checked={acrylic.edge}
                  onChange={(edge) => update("acrylic", { ...acrylic, edge })}
                  t={t}
                />
                <ActionButton
                  tone="secondary"
                  t={t}
                  onClick={() => update("acrylic", { ...acrylic, corners: defaultDesigns().acrylic.corners })}
                >
                  角度歸位
                </ActionButton>
              </>
            )}

            {stickers && (
              <Field label="貼紙" t={t}>
                <PlacedControls stickers={stickers} selected={selected} onChange={setStickers} onSelect={setSelected} t={t} />
              </Field>
            )}

            {motion === "needs" && kind !== "acrylic" && (
              <ActionButton
                tone="secondary"
                t={t}
                onClick={() =>
                  void requestMotionPermission().then((granted) => {
                    setMotion(granted ? "on" : "needs");
                    if (!granted) showNotice("沒有拿到動作感測的權限，還是可以用手指拖。", "error");
                  })
                }
              >
                啟用手機傾斜
              </ActionButton>
            )}

            <Field
              label={
                kind === "charm" ? "加零件" : kind === "omamori" ? "拼豆小鈴鐺" : "加貼紙"
              }
              hint={
                kind === "charm"
                  ? `只放得進 ${MAX_PIECE_SIDE}×${MAX_PIECE_SIDE} 以內的小拼豆；在拼豆工坊用迷你板拼好、收藏成「素材」就會出現在這裡。`
                  : kind === "omamori"
                    ? "點一個掛在繩結旁邊。"
                    : "相簿裡的作品與素材都在這裡；也可以上傳圖片去背。"
              }
              t={t}
            >
              <ArtLibrary
                entries={entries}
                getArt={getArt}
                onPick={addSticker}
                filter={kind === "charm" || kind === "omamori" ? isPieceable : undefined}
                onUpload={kind === "card" || kind === "acrylic" ? () => wandInput.current?.click() : undefined}
                t={t}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <ActionButton t={t} onClick={() => void handleDownload()} disabled={busy}>
                下載 PNG
              </ActionButton>
              {canShare && (
                <ActionButton tone="secondary" t={t} onClick={() => void handleShare()} disabled={busy}>
                  存到相簿／分享
                </ActionButton>
              )}
            </div>
            <p className={`text-[11px] leading-5 ${t.muted}`}>
              {saveFailed
                ? "這個瀏覽器存不了進度（可能是無痕模式），關掉頁面前記得先下載。"
                : "設計、照片與去背圖會自動存在這台裝置的瀏覽器裡，下次打開還在。"}
            </p>
            <ActionButton tone="secondary" t={t} onClick={resetAll}>
              全部重來
            </ActionButton>
          </>
        }
      />

      <input
        ref={photoInput}
        type="file"
        aria-label="選擇周邊用的照片"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const image = await loadImage(file);
          if (!image) return;
          setPhoto(image);
          setPhotoBlob(file);
          if (kind === "card") update("card", { ...card, background: "photo" });
          if (kind === "charm") update("charm", { ...charm, background: "photo" });
        }}
      />
      <input
        ref={wandInput}
        type="file"
        aria-label="選擇要去背的圖片"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const image = await loadImage(file);
          if (image) setWand({ image, name: file.name });
        }}
      />

      {wand && (
        <WandDialog
          image={wand.image}
          name={wand.name}
          t={t}
          onCancel={() => setWand(null)}
          onDone={async (canvas) => {
            const id = newId("cut");
            const label = wand.name.replace(/\.[^.]+$/, "") || "去背圖";
            const blob = await canvasToPng(canvas);
            // 去背圖最多留 20 張,太舊的拿掉,存檔才不會無限長大
            setCutouts((list) => [...list, { id, label, canvas, blob }].slice(-20));
            setWand(null);
            addSticker(id);
            showNotice("去背好了，已經貼上去。");
          }}
        />
      )}
    </div>
  );
}
