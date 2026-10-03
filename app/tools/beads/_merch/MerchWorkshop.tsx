"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { idbGet, idbSet } from "@/lib/idb";
import { MERCH_STORE_KEY, readStoredMerch, type StoredMerch } from "@/lib/tools/merch/persist";
import type { ThemeClasses } from "@/lib/theme";
import { downloadBlob, shareImages, type ExportedImage } from "@/lib/download";
import { encodeGif, recordVideo, videoFormat, type LoopDrawer } from "@/lib/animate";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { canvasToPng } from "@/lib/tools/beads/draw";
import type { SavedWork } from "@/lib/tools/beads/album";
import type { BeadColor } from "@/lib/tools/beads/palette";
import { decodePhoto } from "@/lib/tools/beads/photo";
import { ImageDecodeError } from "@/lib/tools/image/render";
import {
  artKey,
  parseArtKey,
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
import type { Container, Vec } from "@/lib/tools/merch/physics";
import {
  acrylicWobble,
  cardLaserAngle,
  charmPieceOffsets,
  charmSwing,
  GIF_FPS,
  LOOP_SECONDS,
  beadCharmSwing,
  omamoriSway,
  VIDEO_FPS,
} from "@/lib/tools/merch/motion";
import {
  acrylicBoardSize,
  charmGeometry,
  drawAcrylicBoard,
  drawBeadCharm,
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
import BeadCharmStage from "./BeadCharmStage";
import CardStage from "./CardStage";
import CharmStage from "./CharmStage";
import OmamoriStage from "./OmamoriStage";
import PlacedControls, { RecolorControls } from "./PlacedControls";
import { needsMotionPermission, requestMotionPermission } from "./useDesignCanvas";
import WandDialog from "./WandDialog";

/** 輸出倍率:設計單位 × 2,小卡就是 1100×1700 */
const EXPORT_SCALE = 2;
const MAX_PIECES = 12;
/** 動態輸出:GIF 小一點(檔案才傳得動),影片長邊到 1080 */
const GIF_MAX_SIDE = 560;
const VIDEO_MAX_SIDE = 1080;
/** GIF 透明只有全有全無,邊緣會毛,所以鋪淡色底;影片也用同一個底 */
const LOOP_BACKGROUND = "#f4f1ea";
/** 錄的時候吊飾縮一點、從上緣往下掛,擺動時角不會出框 */
const CHARM_LOOP_SCALE = 0.88;

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
/** 從拼豆那邊「做成吊飾」送過來的:哪一份作品;nonce 每次按都不一樣 */
export type MerchRequest = { artId: string; nonce: number };

/** 把送過來的作品掛到拼豆吊飾上 */
const withCharmArt = (designs: MerchDesigns, artId: string): MerchDesigns => ({
  ...designs,
  beadcharm: { ...designs.beadcharm, artId, recolor: undefined },
});

export default function MerchWorkshop({
  album,
  palette,
  active,
  request,
  t,
}: {
  album: SavedWork[];
  palette: BeadColor[];
  active: boolean;
  request: MerchRequest | null;
  t: ThemeClasses;
}) {
  // 第一次掛上就帶著的請求:等讀回存檔之後再套,才不會被存檔蓋掉
  const [firstRequest] = useState(request);
  const [handledRequest, setHandledRequest] = useState(request?.nonce ?? null);
  const [kind, setKind] = useState<MerchKind>(request ? "beadcharm" : "card");
  const [designs, setDesigns] = useState<MerchDesigns>(() =>
    request ? withCharmArt(defaultDesigns(), request.artId) : defaultDesigns()
  );
  // 已經開著的時候又送一份過來:在這次渲染就換過去(React 建議的「依 props 調整 state」寫法)
  if (request && request.nonce !== handledRequest) {
    setHandledRequest(request.nonce);
    setKind("beadcharm");
    setDesigns((current) => withCharmArt(current, request.artId));
  }
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
  // 這個元件只在瀏覽器裡掛上,可以直接問能不能錄影
  const [video] = useState(() => videoFormat());

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
        setDesigns(firstRequest ? withCharmArt(stored.designs, firstRequest.artId) : stored.designs);
        setKind(firstRequest ? "beadcharm" : stored.kind);
        setCutouts(restoredCutouts);
        setPhoto(restoredPhoto);
        setPhotoBlob(restoredPhoto ? stored.photo : null);
      }
      if (!cancelled) setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [firstRequest]);

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
  const beadcharm = designs.beadcharm;

  const cardArts = useMemo(
    () => artMap([...card.stickers.map(artKey), ...(card.frame === "motif" ? [card.frameArt] : [])]),
    [artMap, card.stickers, card.frame, card.frameArt]
  );
  const charmArt = useMemo(() => getArt(artKey(beadcharm)), [getArt, beadcharm]);
  const charmArts = useMemo(() => artMap(charm.pieces.map(artKey)), [artMap, charm.pieces]);
  const acrylicArts = useMemo(() => artMap(acrylic.stickers.map(artKey)), [artMap, acrylic.stickers]);
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
    } else if (kind === "beadcharm") {
      update("beadcharm", { ...beadcharm, artId, recolor: undefined });
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
    else if (kind === "beadcharm") drawBeadCharm(ctx, width, height, beadcharm, charmArt, 0);
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

  const fileBase = () => `周邊-${MERCH_KINDS.find((item) => item.kind === kind)?.label.replace("／", "-") ?? "周邊"}`;

  async function buildPng(): Promise<ExportedImage> {
    return { name: `${fileBase()}.png`, blob: await canvasToPng(renderExport()) };
  }

  /** 錄 GIF/影片用的一圈:照 motion.ts 設計好的路徑畫,最後一格接回第一格(設計單位) */
  function loopDrawer(): LoopDrawer {
    const { width, height } = DESIGN_SIZE[kind];
    if (kind === "card") {
      return (ctx, t) => drawCard(ctx, width, height, card, { photo, arts: cardArts }, cardLaserAngle(t));
    }
    if (kind === "omamori") return (ctx, t) => drawOmamori(ctx, width, height, omamori, side, omamoriSway(t), bell);
    if (kind === "beadcharm") return (ctx, t) => drawBeadCharm(ctx, width, height, beadcharm, charmArt, beadCharmSwing(t));
    if (kind === "acrylic") {
      const size = acrylicBoardSize(acrylic);
      const board = document.createElement("canvas");
      board.width = size.width;
      board.height = size.height;
      const boardCtx = board.getContext("2d");
      if (boardCtx) drawAcrylicBoard(boardCtx, acrylic, acrylicArts);
      return (ctx, t) =>
        drawAcrylicScene(ctx, width, height, { ...acrylic, corners: acrylicWobble(acrylic.corners, t) }, photo, board);
    }
    // 吊飾:零件從現在停著的位置開始晃(跟畫面上看到的一樣)
    const pieces = charmPieces.current;
    const { inner } = charmGeometry(charm, width, height);
    const box: Container = inner.kind === "circle" ? { ...inner, r: inner.r - 3 } : { ...inner, hw: inner.hw - 3, hh: inner.hh - 3 };
    const bodies = pieces.map((piece) => piece.body);
    return (ctx, t) => {
      const offsets = charmPieceOffsets(bodies, box, t);
      const moved = pieces.map((piece, k) => ({
        ...piece,
        body: {
          ...piece.body,
          x: piece.body.x + offsets[k].dx,
          y: piece.body.y + offsets[k].dy,
          angle: piece.body.angle + offsets[k].dAngle,
        },
      }));
      ctx.translate(width / 2, height * 0.03);
      ctx.rotate(charmSwing(t));
      ctx.scale(CHARM_LOOP_SCALE, CHARM_LOOP_SCALE);
      ctx.translate(-width / 2, 0);
      drawCharm(ctx, width, height, charm, photo, moved);
    };
  }

  function loopSpec(maxSide: number, fps: number, label: string) {
    const { width, height } = DESIGN_SIZE[kind];
    const scale = maxSide / Math.max(width, height);
    const draw = loopDrawer();
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      background: LOOP_BACKGROUND,
      seconds: LOOP_SECONDS,
      fps,
      draw: ((ctx, t) => {
        ctx.scale(scale, scale);
        draw(ctx, t);
      }) as LoopDrawer,
      onProgress: (progress: number) => showNotice(`${label} ${Math.round(progress * 100)}%`),
    };
  }

  const handleGif = () =>
    run(async () => {
      const blob = await encodeGif(loopSpec(GIF_MAX_SIDE, GIF_FPS, "GIF 編碼中…"));
      downloadBlob({ name: `${fileBase()}.gif`, blob });
      return `已下載 GIF（${(blob.size / 1024 / 1024).toFixed(1)} MB）。`;
    });

  const handleVideo = () =>
    run(async () => {
      const { blob, ext } = await recordVideo({ ...loopSpec(VIDEO_MAX_SIDE, VIDEO_FPS, "錄影中…"), loops: 2 });
      downloadBlob({ name: `${fileBase()}.${ext}`, blob });
      return `已下載影片（${ext.toUpperCase()}，${(blob.size / 1024 / 1024).toFixed(1)} MB）。`;
    });

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
    ) : kind === "beadcharm" ? (
      <BeadCharmStage design={beadcharm} art={charmArt} active={active} />
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

  const usesPhoto = kind !== "omamori" && kind !== "beadcharm";

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
                      { value: "motif", label: "自己拼的框" },
                      { value: "none", label: "不加框" },
                    ]}
                    t={t}
                  />
                </Field>
                {card.frame === "motif" && (
                  <Field
                    label="框的圖樣"
                    hint="挑一份小拼豆，沿著四邊排一圈。用迷你板自己拼一個、收藏成「素材」或「模板」就會出現在這裡。"
                    t={t}
                  >
                    <ArtLibrary
                      entries={entries}
                      getArt={getArt}
                      onPick={(frameArt) => update("card", { ...card, frameArt })}
                      filter={isPieceable}
                      t={t}
                    />
                    <RecolorControls
                      key={card.frameArt.split("#")[0]}
                      placed={parseArtKey(card.frameArt)}
                      getArt={getArt}
                      palette={palette}
                      onChange={(recolor) =>
                        update("card", { ...card, frameArt: artKey({ artId: parseArtKey(card.frameArt).artId, recolor }) })
                      }
                      t={t}
                    />
                  </Field>
                )}
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

            {kind === "beadcharm" && (
              <>
                <Field label="掛在哪裡" t={t}>
                  <Segmented
                    label="掛在哪裡"
                    value={beadcharm.hardware}
                    onChange={(hardware) => update("beadcharm", { ...beadcharm, hardware })}
                    options={[
                      { value: "ring", label: "鑰匙圈" },
                      { value: "strap", label: "手機吊繩" },
                    ]}
                    t={t}
                  />
                </Field>
                <Field label={beadcharm.hardware === "ring" ? "金屬顏色" : "金屬與吊繩顏色"} t={t}>
                  <ColorField value={beadcharm.metal} onChange={(metal) => update("beadcharm", { ...beadcharm, metal })} t={t} />
                  {beadcharm.hardware === "strap" && (
                    <ColorField value={beadcharm.strap} onChange={(strap) => update("beadcharm", { ...beadcharm, strap })} t={t} />
                  )}
                </Field>
                <RecolorControls
                  key={beadcharm.artId}
                  placed={beadcharm}
                  getArt={getArt}
                  palette={palette}
                  onChange={(recolor) => update("beadcharm", { ...beadcharm, recolor })}
                  t={t}
                />
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
                <PlacedControls
                  stickers={stickers}
                  selected={selected}
                  onChange={setStickers}
                  onSelect={setSelected}
                  getArt={getArt}
                  palette={palette}
                  t={t}
                />
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
                kind === "charm" ? "加零件" : kind === "omamori" ? "拼豆小鈴鐺" : kind === "beadcharm" ? "掛哪一份作品" : "加貼紙"
              }
              hint={
                kind === "charm"
                  ? `只放得進 ${MAX_PIECE_SIDE}×${MAX_PIECE_SIDE} 以內的小拼豆；在拼豆工坊用迷你板拼好、收藏成「素材」就會出現在這裡。`
                  : kind === "omamori"
                    ? "點一個掛在繩結旁邊。"
                    : kind === "beadcharm"
                      ? "收藏冊裡的作品、素材、模板都可以；在拼豆那邊按「做成吊飾」會直接送過來。"
                      : "相簿裡的作品與素材都在這裡；也可以上傳圖片去背。"
              }
              t={t}
            >
              <ArtLibrary
                entries={entries}
                getArt={getArt}
                onPick={addSticker}
                filter={
                  kind === "charm" || kind === "omamori" ? isPieceable : kind === "beadcharm" ? (entry) => Boolean(entry.pattern) : undefined
                }
                onUpload={kind === "card" || kind === "acrylic" ? () => wandInput.current?.click() : undefined}
                t={t}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <ActionButton t={t} onClick={() => void handleDownload()} disabled={busy}>
                下載 PNG
              </ActionButton>
              <ActionButton tone="secondary" t={t} onClick={() => void handleGif()} disabled={busy}>
                下載 GIF
              </ActionButton>
              {video && (
                <ActionButton tone="secondary" t={t} onClick={() => void handleVideo()} disabled={busy}>
                  下載影片
                </ActionButton>
              )}
              {canShare && (
                <ActionButton tone="secondary" t={t} onClick={() => void handleShare()} disabled={busy}>
                  存到相簿／分享
                </ActionButton>
              )}
            </div>
            <p className={`text-[11px] leading-5 ${t.muted}`}>
              GIF 與影片是 {LOOP_SECONDS} 秒的循環：{kind === "card" ? "雷射膜來回流動" : kind === "charm" ? "吊飾擺動、零件跟著滑" : kind === "omamori" ? "繩結輕輕晃" : kind === "beadcharm" ? "吊飾左右擺" : "板子像拿在手上微微晃"}。GIF 最多 256 色，雷射與亮粉會有一點色帶；影片畫質完整，錄的時候要等 {LOOP_SECONDS * 2} 秒。
            </p>
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
