"use client";

import { useEffect, useRef, useState } from "react";
import { loadBitmap } from "@/lib/tools/image/render";
import { drawPrint } from "@/lib/tools/image/print/compose";
import { switchLanguage, UI_LANGS } from "@/lib/tools/image/print/interface";
import {
  DEFAULT_AVATAR_FRAMING,
  DEFAULT_FRAMING,
  dragFraming,
  isCropped,
  MAX_ZOOM,
  type Framing,
} from "@/lib/tools/image/print/framing";
import {
  defaultPrintSettings,
  printLayout,
  POSTER_TEXT_STYLES,
  FRAMED_KINDS,
  isInterfaceKind,
  PRINT_GROUPS,
  THEME_COLORS,
  type PrintKind,
  type PrintSettings,
} from "@/lib/tools/image/print/settings";
import type { WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import { backgroundStyle } from "./checkerboard";
import { ToolPane, EmptyWorkspace } from "./WorkbenchLayout";
import {
  ActionButton,
  ColorField,
  Field,
  RangeField,
  Segmented,
  StationHint,
  Toggle,
} from "./controls";

type Props = {
  images: WorkImage[];
  busy: boolean;
  t: ThemeClasses;
  onApply: (settings: PrintSettings) => void;
};

/** 預覽畫布的長邊上限:逐像素效果每動一下就要重算,太大會卡 */
const PREVIEW_MAX = 1000;
const PREVIEW_MAX_VH = 75;
/** 拉桿停下來多久才重算預覽 */
const PREVIEW_DELAY = 120;
const DEVELOP_MS = 3200;

const SETTINGS_KEY = "toolbox-print-settings";

function readStored(): PrintSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;
    const base = defaultPrintSettings();
    // 逐組合併:之後新增欄位時,舊的存檔也能補上預設值;日期一律用今天
    return {
      ...base,
      ...parsed,
      grain: { ...base.grain, ...parsed.grain },
      halftone: { ...base.halftone, ...parsed.halftone },
      riso: { ...base.riso, ...parsed.riso },
      photocopy: { ...base.photocopy, ...parsed.photocopy },
      polaroid: { ...base.polaroid, ...parsed.polaroid },
      digicam: { ...base.digicam, ...parsed.digicam, date: base.digicam.date },
      stamp: { ...base.stamp, ...parsed.stamp, date: base.stamp.date },
      postcard: { ...base.postcard, ...parsed.postcard },
      ticket: { ...base.ticket, ...parsed.ticket },
      film: { ...base.film, ...parsed.film },
      poster: { ...base.poster, ...parsed.poster },
      framing: { ...base.framing, ...parsed.framing },
      avatarFraming: { ...base.avatarFraming, ...parsed.avatarFraming },
      ui: { ...base.ui, ...parsed.ui },
      player: { ...base.player, ...parsed.player },
      video: { ...base.video, ...parsed.video },
      social: { ...base.social, ...parsed.social },
      story: { ...base.story, ...parsed.story },
    };
  } catch {
    return null;
  }
}

function TextField({
  value,
  onChange,
  label,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  t: ThemeClasses;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={label}
      maxLength={40}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
    />
  );
}

/** 播放器的目前時間與全長;進度條照這兩個算 */
function ClockFields({
  current,
  total,
  onChange,
  t,
}: {
  current: string;
  total: string;
  onChange: (patch: { current?: string; total?: string }) => void;
  t: ThemeClasses;
}) {
  return (
    <Field label="時間" hint="寫成 1:24 這樣，進度條會跟著走" t={t}>
      <div className="flex items-center gap-2">
        <TextField label="目前時間" value={current} onChange={(value) => onChange({ current: value })} t={t} />
        <span className={t.muted}>/</span>
        <TextField label="全長" value={total} onChange={(value) => onChange({ total: value })} t={t} />
      </div>
    </Field>
  );
}

/** 預覽用的縮小尺寸 */
function previewScale(sample: { width: number; height: number }) {
  const scale = Math.min(1, PREVIEW_MAX / Math.max(sample.width, sample.height));
  return {
    scale,
    size: {
      width: Math.max(1, Math.round(sample.width * scale)),
      height: Math.max(1, Math.round(sample.height * scale)),
    },
  };
}

function paintPreview(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  sample: { width: number; height: number },
  settings: PrintSettings
) {
  const { scale, size } = previewScale(sample);
  const { canvas: out } = printLayout(size, settings.kind, settings);
  if (canvas.width !== out.width) canvas.width = out.width;
  if (canvas.height !== out.height) canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawPrint(ctx, size, source, settings, { scale });
}

/** 構圖的拉桿:左右、上下、縮放 */
function FramingFields({
  value,
  onChange,
  onReset,
  label,
  t,
}: {
  value: Framing;
  onChange: (patch: Partial<Framing>) => void;
  onReset: () => void;
  label: string;
  t: ThemeClasses;
}) {
  return (
    <>
      <RangeField
        label={`${label}縮放`}
        display={`${value.zoom.toFixed(2)}×`}
        value={value.zoom}
        min={1}
        max={MAX_ZOOM}
        step={0.05}
        onChange={(zoom) => onChange({ zoom })}
        t={t}
      />
      <RangeField
        label={`${label}左右`}
        display={`${Math.round(value.x * 100)}%`}
        value={value.x}
        min={0}
        max={1}
        step={0.01}
        onChange={(x) => onChange({ x })}
        t={t}
      />
      <RangeField
        label={`${label}上下`}
        display={`${Math.round(value.y * 100)}%`}
        value={value.y}
        min={0}
        max={1}
        step={0.01}
        onChange={(y) => onChange({ y })}
        t={t}
      />
      <ActionButton tone="secondary" t={t} onClick={onReset}>
        {label}回到預設
      </ActionButton>
    </>
  );
}

/** 沖印所:把照片印成某種質感或裝進某種殼,批次套用到選取的圖 */
export default function PrintTool({ images, busy, t, onApply }: Props) {
  const [settings, setSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [restored, setRestored] = useState(false);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<{ id: string; bitmap: ImageBitmap } | null>(null);
  const developFrame = useRef(0);
  // 拖曳構圖:拖動中直接重畫(不等預覽的延遲),放開後再走一般的預覽流程
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef(settings);
  const dragFrame = useRef(0);

  const sample = images[0];

  useEffect(() => {
    const stored = readStored();
    /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage 水合 */
    if (stored) setSettings(stored);
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // 存不了就算了
    }
  }, [settings, restored]);

  // 預覽:跟輸出走同一支 drawPrint,畫在縮小的畫布上;拉桿停一下才算,免得每格都重跑逐像素效果
  useEffect(() => {
    if (!sample) return;
    let cancelled = false;
    cancelAnimationFrame(developFrame.current);

    const timer = setTimeout(() => {
      (async () => {
        setRendering(true);
        if (bitmapRef.current?.id !== sample.id) {
          bitmapRef.current?.bitmap.close();
          bitmapRef.current = { id: sample.id, bitmap: await loadBitmap(sample) };
        }
        const canvas = canvasRef.current;
        const source = bitmapRef.current?.bitmap;
        if (cancelled || !canvas || !source) return;

        paintPreview(canvas, source, sample, settings);

        // 留一份畫好的,拍立得顯影動畫要在上面疊白
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext("2d")?.drawImage(canvas, 0, 0);
        renderedRef.current = copy;
      })()
        .catch((error: unknown) => console.error("預覽失敗:", error))
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, PREVIEW_DELAY);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sample, settings]);

  useEffect(
    () => () => {
      cancelAnimationFrame(developFrame.current);
      bitmapRef.current?.bitmap.close();
      bitmapRef.current = null;
    },
    []
  );

  /** 拍立得顯影:畫好的圖上疊一層乳白,慢慢變透明 */
  function playDevelop() {
    const canvas = canvasRef.current;
    const rendered = renderedRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !rendered || !ctx || !sample) return;

    const scale = Math.min(1, PREVIEW_MAX / Math.max(sample.width, sample.height));
    const { photo } = printLayout(
      { width: Math.round(sample.width * scale), height: Math.round(sample.height * scale) },
      "polaroid"
    );
    const start = performance.now();
    cancelAnimationFrame(developFrame.current);

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DEVELOP_MS);
      // 先慢後快:剛拍完那幾秒幾乎看不到東西
      const shown = p * p * (3 - 2 * p);
      ctx.drawImage(rendered, 0, 0);
      ctx.fillStyle = `rgba(236, 233, 224, ${(1 - shown).toFixed(3)})`;
      ctx.fillRect(photo.x, photo.y, photo.width, photo.height);
      if (p < 1) developFrame.current = requestAnimationFrame(tick);
    };
    developFrame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    latest.current = settings;
  }, [settings]);
  const framed = FRAMED_KINDS.includes(settings.kind);

  /** 新構圖:存進設定,並在下一格直接重畫預覽 */
  const applyFraming = (framing: Framing) => {
    const next = { ...latest.current, framing };
    latest.current = next;
    setSettings(next);
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const source = bitmapRef.current?.bitmap;
      if (canvas && source && sample) paintPreview(canvas, source, sample, latest.current);
    });
  };

  /** 照片在預覽畫布上的框與來源大小(拖曳換算用) */
  const previewGeometry = (current: PrintSettings) => {
    if (!sample) return null;
    const { size } = previewScale(sample);
    const { photo } = printLayout(size, current.kind, current);
    return { size, photo };
  };

  // 滾輪縮放:要能 preventDefault,只好自己掛非 passive 的監聽
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !framed) return;
    const handle = (event: WheelEvent) => {
      event.preventDefault();
      const current = latest.current.framing;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, current.zoom * Math.exp(-event.deltaY * 0.0015)));
      applyFraming({ ...current, zoom });
    };
    canvas.addEventListener("wheel", handle, { passive: false });
    return () => canvas.removeEventListener("wheel", handle);
  });

  const update = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));
  const updateIn = <K extends keyof PrintSettings>(key: K, patch: Partial<PrintSettings[K]>) =>
    setSettings((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));

  if (!sample) {
    return (
      <ToolPane
        workspace={<EmptyWorkspace t={t}>先在左邊的清單選一張以上的圖。</EmptyWorkspace>}
        controls={<StationHint t={t}>選好圖之後，這裡會出現效果與即時預覽。</StationHint>}
      />
    );
  }

  const group = PRINT_GROUPS.find((g) => g.kinds.some((k) => k.kind === settings.kind)) ?? PRINT_GROUPS[0];
  const item = group.kinds.find((k) => k.kind === settings.kind) ?? group.kinds[0];
  const scale = Math.min(1, PREVIEW_MAX / Math.max(sample.width, sample.height));
  const outSize = printLayout(sample, settings.kind, settings).canvas;
  const previewSize = printLayout(
    { width: Math.round(sample.width * scale), height: Math.round(sample.height * scale) },
    settings.kind,
    settings
  ).canvas;
  const aspect = previewSize.width / previewSize.height;
  const s = settings;
  const geometry = previewGeometry(settings);
  const photoCropped = geometry ? isCropped(geometry.size, geometry.photo, s.framing) : false;

  return (
    <ToolPane
      workspace={
        <div className="space-y-2">
          <div className="flex justify-center overflow-hidden rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
            <canvas
              ref={canvasRef}
              aria-label="沖印所預覽"
              className={framed ? "cursor-grab touch-none active:cursor-grabbing" : undefined}
              onPointerDown={(event) => {
                if (!framed) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerMove={(event) => {
                const last = dragRef.current;
                const geometry = previewGeometry(latest.current);
                if (!last || !geometry) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const ratio = event.currentTarget.width / Math.max(1, rect.width);
                const dx = (event.clientX - last.x) * ratio;
                const dy = (event.clientY - last.y) * ratio;
                dragRef.current = { x: event.clientX, y: event.clientY };
                applyFraming(dragFraming(latest.current.framing, geometry.size, geometry.photo, dx, dy));
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              style={{
                aspectRatio: `${previewSize.width} / ${previewSize.height}`,
                width: "100%",
                maxWidth: `calc(${PREVIEW_MAX_VH}dvh * ${aspect})`,
                ...backgroundStyle(null),
              }}
            />
          </div>
          <p className={`text-center text-xs ${t.muted}`}>
            以「{sample.name}」為例・輸出 {outSize.width} × {outSize.height}
            {rendering ? "・預覽計算中……" : ""}
          </p>
          {framed && (
            <p className={`text-center text-xs ${t.muted}`}>在預覽上拖曳移動照片，滾輪或「縮放」拉桿放大。</p>
          )}
        </div>
      }
      controls={
        <>
          <StationHint t={t}>
            會套用到選取的 {images.length} 張，預覽是第一張。網點、顆粒、邊框都照每張圖自己的短邊算，
            尺寸不同的圖看起來一樣。
          </StationHint>

          <Field label="類別" t={t}>
            <Segmented
              value={group.key}
              onChange={(key) => {
                const next = PRINT_GROUPS.find((g) => g.key === key);
                if (next) update("kind", next.kinds[0].kind);
              }}
              t={t}
              label="類別"
              options={PRINT_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
            />
          </Field>

          {group.kinds.length > 1 && (
            <Field label="效果" t={t}>
              <Segmented
                value={settings.kind}
                onChange={(kind: PrintKind) => update("kind", kind)}
                t={t}
                label="效果"
                options={group.kinds.map((k) => ({ value: k.kind, label: k.label }))}
              />
            </Field>
          )}
          <p className={`text-[11px] leading-5 ${t.muted}`}>{item.hint}</p>

          {framed && (
            <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
              <p className={`text-[11px] leading-5 ${t.muted}`}>
                {photoCropped
                  ? "照片比例跟框不一樣，可以拖曳預覽或用拉桿決定要留哪一塊。批次的每一張都套同一組位置。"
                  : "照片剛好放得下；放大之後就能拖曳挑要留的部分。"}
              </p>
              <FramingFields
                label="照片"
                value={s.framing}
                onChange={(patch) => applyFraming({ ...s.framing, ...patch })}
                onReset={() => applyFraming({ ...DEFAULT_FRAMING })}
                t={t}
              />
              {(s.kind === "social" || s.kind === "story") && (
                <FramingFields
                  label="頭像"
                  value={s.avatarFraming}
                  onChange={(patch) => updateIn("avatarFraming", patch)}
                  onReset={() => update("avatarFraming", { ...DEFAULT_AVATAR_FRAMING })}
                  t={t}
                />
              )}
            </div>
          )}

          <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
            {s.kind === "halftone" && (
              <>
                <RangeField
                  label="網點大小"
                  display={s.halftone.dot.toFixed(1)}
                  value={s.halftone.dot}
                  min={0.4}
                  max={3}
                  step={0.1}
                  onChange={(dot) => updateIn("halftone", { dot })}
                  t={t}
                />
                <Field label="紙色" t={t}>
                  <ColorField value={s.halftone.paper} onChange={(paper) => updateIn("halftone", { paper })} t={t} />
                </Field>
              </>
            )}

            {s.kind === "riso" && (
              <>
                <Field label="幾色墨" t={t}>
                  <Segmented
                    value={String(s.riso.count)}
                    onChange={(value) => updateIn("riso", { count: Number(value) as 2 | 3 })}
                    t={t}
                    options={[
                      { value: "2", label: "兩色" },
                      { value: "3", label: "三色" },
                    ]}
                  />
                </Field>
                {s.riso.inks.slice(0, s.riso.count).map((ink, k) => (
                  <Field key={k} label={`第 ${k + 1} 色`} t={t}>
                    <ColorField
                      value={ink}
                      onChange={(value) =>
                        updateIn("riso", { inks: s.riso.inks.map((v, i) => (i === k ? value : v)) })
                      }
                      t={t}
                    />
                  </Field>
                ))}
                <RangeField
                  label="套色偏移"
                  display={s.riso.offset.toFixed(1)}
                  value={s.riso.offset}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(offset) => updateIn("riso", { offset })}
                  t={t}
                />
                <RangeField
                  label="顆粒大小"
                  display={s.riso.grain.toFixed(2)}
                  value={s.riso.grain}
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  onChange={(grain) => updateIn("riso", { grain })}
                  t={t}
                />
              </>
            )}

            {s.kind === "photocopy" && (
              <>
                <RangeField
                  label="反差"
                  display={`${Math.round(s.photocopy.contrast * 100)}`}
                  value={s.photocopy.contrast}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(contrast) => updateIn("photocopy", { contrast })}
                  t={t}
                />
                <RangeField
                  label="碳粉痕"
                  display={`${Math.round(s.photocopy.toner * 100)}`}
                  value={s.photocopy.toner}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(toner) => updateIn("photocopy", { toner })}
                  t={t}
                />
              </>
            )}

            {s.kind === "polaroid" && (
              <>
                <RangeField
                  label="冷暖"
                  display={s.polaroid.warmth > 0 ? "偏暖" : s.polaroid.warmth < 0 ? "偏冷" : "不偏"}
                  value={s.polaroid.warmth}
                  min={-1}
                  max={1}
                  step={0.05}
                  onChange={(warmth) => updateIn("polaroid", { warmth })}
                  t={t}
                />
                <RangeField
                  label="褪色"
                  display={`${Math.round(s.polaroid.fade * 100)}`}
                  value={s.polaroid.fade}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(fade) => updateIn("polaroid", { fade })}
                  t={t}
                />
                <RangeField
                  label="暗角"
                  display={`${Math.round(s.polaroid.vignette * 100)}`}
                  value={s.polaroid.vignette}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(vignette) => updateIn("polaroid", { vignette })}
                  t={t}
                />
                <ActionButton tone="secondary" t={t} onClick={playDevelop} disabled={rendering}>
                  看它顯影
                </ActionButton>
              </>
            )}

            {s.kind === "digicam" && (
              <>
                <RangeField
                  label="閃光"
                  display={`${Math.round(s.digicam.flash * 100)}`}
                  value={s.digicam.flash}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) => updateIn("digicam", { flash: value })}
                  t={t}
                />
                <Toggle
                  checked={s.digicam.lowRes}
                  onChange={(lowRes) => updateIn("digicam", { lowRes })}
                  label="低解析（當年的 30 萬畫素）"
                  t={t}
                />
                <Toggle
                  checked={s.digicam.showDate}
                  onChange={(showDate) => updateIn("digicam", { showDate })}
                  label="右下角印日期"
                  t={t}
                />
                {s.digicam.showDate && (
                  <TextField
                    label="日期"
                    value={s.digicam.date}
                    onChange={(date) => updateIn("digicam", { date })}
                    t={t}
                  />
                )}
              </>
            )}

            {s.kind === "stamp" && (
              <>
                <Field label="面額" t={t}>
                  <TextField label="面額" value={s.stamp.value} onChange={(value) => updateIn("stamp", { value })} t={t} />
                </Field>
                <Toggle
                  checked={s.stamp.postmark}
                  onChange={(postmark) => updateIn("stamp", { postmark })}
                  label="蓋郵戳"
                  t={t}
                />
                {s.stamp.postmark && (
                  <>
                    <Field label="地名" t={t}>
                      <TextField label="地名" value={s.stamp.place} onChange={(place) => updateIn("stamp", { place })} t={t} />
                    </Field>
                    <Field label="日期" t={t}>
                      <TextField label="日期" value={s.stamp.date} onChange={(date) => updateIn("stamp", { date })} t={t} />
                    </Field>
                  </>
                )}
              </>
            )}

            {s.kind === "postcard" && (
              <Field label="抬頭" t={t}>
                <TextField
                  label="抬頭"
                  value={s.postcard.heading}
                  onChange={(heading) => updateIn("postcard", { heading })}
                  t={t}
                />
              </Field>
            )}

            {s.kind === "ticket" && (
              <>
                <Field label="票根標題" t={t}>
                  <TextField label="票根標題" value={s.ticket.title} onChange={(title) => updateIn("ticket", { title })} t={t} />
                </Field>
                <Field label="號碼" t={t}>
                  <TextField label="號碼" value={s.ticket.number} onChange={(number) => updateIn("ticket", { number })} t={t} />
                </Field>
                <Field label="票紙顏色" t={t}>
                  <ColorField value={s.ticket.color} onChange={(color) => updateIn("ticket", { color })} t={t} />
                </Field>
              </>
            )}

            {s.kind === "film" && (
              <>
                <Field label="片邊文字" t={t}>
                  <TextField label="片邊文字" value={s.film.label} onChange={(label) => updateIn("film", { label })} t={t} />
                </Field>
                <RangeField
                  label="片號"
                  display={String(s.film.number)}
                  value={s.film.number}
                  min={1}
                  max={36}
                  onChange={(number) => updateIn("film", { number })}
                  t={t}
                />
              </>
            )}

            {s.kind === "poster" && (
              <>
                <Field label="主題色" hint="色塊、網點、剪貼字底色一起換" t={t}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {THEME_COLORS.map((theme) => (
                      <button
                        key={theme.hex}
                        type="button"
                        onClick={() => updateIn("poster", { color: theme.hex })}
                        aria-pressed={s.poster.color === theme.hex}
                        aria-label={theme.label}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          s.poster.color === theme.hex ? "border-(--ink-primary)" : "border-transparent"
                        }`}
                        style={{ background: theme.hex }}
                      />
                    ))}
                  </div>
                  <ColorField value={s.poster.color} onChange={(color) => updateIn("poster", { color })} t={t} />
                </Field>
                <Field label="色調" hint="人像用「四階」臉部比較清楚" t={t}>
                  <Segmented
                    value={String(s.poster.levels)}
                    onChange={(value) => updateIn("poster", { levels: Number(value) as 2 | 3 | 4 })}
                    t={t}
                    options={[
                      { value: "4", label: "四階" },
                      { value: "3", label: "白＋主題色＋黑" },
                      { value: "2", label: "主題色＋黑" },
                    ]}
                  />
                </Field>
                <Field label="主題色的質感" t={t}>
                  <Segmented
                    value={s.poster.texture}
                    onChange={(texture) => updateIn("poster", { texture })}
                    t={t}
                    options={[
                      { value: "solid", label: "平塗" },
                      { value: "dots", label: "網點" },
                      { value: "lines", label: "斜線" },
                    ]}
                  />
                </Field>
                {s.poster.texture !== "solid" && (
                  <RangeField
                    label={s.poster.texture === "dots" ? "網點大小" : "線距"}
                    display={s.poster.dotSize.toFixed(1)}
                    value={s.poster.dotSize}
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    onChange={(dotSize) => updateIn("poster", { dotSize })}
                    t={t}
                  />
                )}
                <RangeField
                  label="明暗"
                  display={s.poster.balance < 0.4 ? "偏亮" : s.poster.balance > 0.6 ? "偏暗" : "中間"}
                  value={s.poster.balance}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(balance) => updateIn("poster", { balance })}
                  t={t}
                />
                <Field label="背景" t={t}>
                  <Segmented
                    value={s.poster.background}
                    onChange={(background) => updateIn("poster", { background })}
                    t={t}
                    options={[
                      { value: "rays", label: "放射線" },
                      { value: "stripes", label: "斜條紋" },
                      { value: "plain", label: "素面" },
                    ]}
                  />
                </Field>
                <RangeField
                  label="照片傾斜"
                  display={`${s.poster.tilt}°`}
                  value={s.poster.tilt}
                  min={-15}
                  max={15}
                  onChange={(tilt) => updateIn("poster", { tilt })}
                  t={t}
                />
                <Field label="標語字" t={t}>
                  <TextField label="標語字" value={s.poster.text} onChange={(text) => updateIn("poster", { text })} t={t} />
                </Field>
                <Field
                  label="字的樣式"
                  hint={POSTER_TEXT_STYLES.find((style) => style.value === s.poster.textStyle)?.hint}
                  t={t}
                >
                  <Segmented
                    value={s.poster.textStyle}
                    onChange={(textStyle) => updateIn("poster", { textStyle })}
                    t={t}
                    options={POSTER_TEXT_STYLES.map(({ value, label }) => ({ value, label }))}
                  />
                </Field>
              </>
            )}

            {isInterfaceKind(s.kind) && (
              <Field label="介面文字" hint="按鈕與標籤的語言；還沒改過的範例內容也會跟著換" t={t}>
                <Segmented
                  value={s.ui.lang}
                  onChange={(lang) => setSettings((prev) => ({ ...prev, ...switchLanguage(prev, lang) }))}
                  t={t}
                  options={UI_LANGS}
                />
              </Field>
            )}

            {s.kind === "player" && (
              <>
                <Field label="歌名" t={t}>
                  <TextField label="歌名" value={s.player.title} onChange={(title) => updateIn("player", { title })} t={t} />
                </Field>
                <Field label="歌手" t={t}>
                  <TextField label="歌手" value={s.player.artist} onChange={(artist) => updateIn("player", { artist })} t={t} />
                </Field>
                <ClockFields
                  current={s.player.current}
                  total={s.player.total}
                  onChange={(patch) => updateIn("player", patch)}
                  t={t}
                />
                <Field label="底色" t={t}>
                  <Segmented
                    value={s.player.theme}
                    onChange={(theme) => updateIn("player", { theme })}
                    t={t}
                    options={[
                      { value: "paper", label: "紙感" },
                      { value: "blur", label: "照片暈色" },
                      { value: "light", label: "淺色" },
                      { value: "dark", label: "深色" },
                    ]}
                  />
                </Field>
                <Toggle checked={s.player.playing} onChange={(playing) => updateIn("player", { playing })} label="播放中" t={t} />
                <Toggle checked={s.player.liked} onChange={(liked) => updateIn("player", { liked })} label="已收藏（實心愛心）" t={t} />
              </>
            )}

            {s.kind === "video" && (
              <>
                <ClockFields
                  current={s.video.current}
                  total={s.video.total}
                  onChange={(patch) => updateIn("video", patch)}
                  t={t}
                />
                <Field label="進度條顏色" t={t}>
                  <ColorField value={s.video.accent} onChange={(accent) => updateIn("video", { accent })} t={t} />
                </Field>
                <Toggle checked={s.video.paused} onChange={(paused) => updateIn("video", { paused })} label="暫停中（中間顯示播放鍵）" t={t} />
                <Toggle checked={s.video.info} onChange={(info) => updateIn("video", { info })} label="下面接標題資訊區" t={t} />
                {s.video.info && (
                  <>
                    <Field label="標題" t={t}>
                      <TextField label="影片標題" value={s.video.title} onChange={(title) => updateIn("video", { title })} t={t} />
                    </Field>
                    <Field label="副標" t={t}>
                      <TextField label="影片副標" value={s.video.meta} onChange={(meta) => updateIn("video", { meta })} t={t} />
                    </Field>
                    <Field label="資訊區" t={t}>
                      <Segmented
                        value={s.video.theme}
                        onChange={(theme) => updateIn("video", { theme })}
                        t={t}
                        options={[
                          { value: "paper", label: "紙感" },
                          { value: "light", label: "淺色" },
                          { value: "dark", label: "深色" },
                        ]}
                      />
                    </Field>
                  </>
                )}
              </>
            )}

            {s.kind === "social" && (
              <>
                <Field label="版型" t={t}>
                  <Segmented
                    value={s.social.layout}
                    onChange={(layout) => updateIn("social", { layout })}
                    t={t}
                    options={[
                      { value: "photo", label: "照片為主" },
                      { value: "text", label: "文字為主" },
                    ]}
                  />
                </Field>
                <Field label="名字" t={t}>
                  <TextField label="帳號名字" value={s.social.name} onChange={(name) => updateIn("social", { name })} t={t} />
                </Field>
                <Field label="地點" hint="照片為主時顯示在照片下面；留空就不顯示" t={t}>
                  <TextField label="地點" value={s.social.place} onChange={(place) => updateIn("social", { place })} t={t} />
                </Field>
                <Field label="愛心／留言／轉發數" hint="留空就只顯示圖示" t={t}>
                  <div className="grid grid-cols-3 gap-2">
                    <TextField label="愛心數" value={s.social.likes} onChange={(likes) => updateIn("social", { likes })} t={t} />
                    <TextField label="留言數" value={s.social.comments} onChange={(comments) => updateIn("social", { comments })} t={t} />
                    <TextField label="轉發數" value={s.social.reposts} onChange={(reposts) => updateIn("social", { reposts })} t={t} />
                  </div>
                </Field>
                <Field label="內文" t={t}>
                  <textarea
                    value={s.social.caption}
                    aria-label="內文"
                    maxLength={120}
                    rows={3}
                    onChange={(event) => updateIn("social", { caption: event.target.value })}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                  />
                </Field>
                <Field label="時間" t={t}>
                  <TextField label="發文時間" value={s.social.time} onChange={(time) => updateIn("social", { time })} t={t} />
                </Field>
                <Field label="照片比例" t={t}>
                  <Segmented
                    value={s.social.ratio}
                    onChange={(ratio) => updateIn("social", { ratio })}
                    t={t}
                    options={[
                      { value: "1:1", label: "方形" },
                      { value: "4:5", label: "4:5 直式" },
                    ]}
                  />
                </Field>
                <Field label="底色" t={t}>
                  <Segmented
                    value={s.social.theme}
                    onChange={(theme) => updateIn("social", { theme })}
                    t={t}
                    options={[
                      { value: "paper", label: "紙感" },
                      { value: "light", label: "淺色" },
                      { value: "dark", label: "深色" },
                    ]}
                  />
                </Field>
                <Toggle checked={s.social.liked} onChange={(liked) => updateIn("social", { liked })} label="已按愛心（實心）" t={t} />
              </>
            )}

            {s.kind === "story" && (
              <>
                <Field label="名字" t={t}>
                  <TextField label="名字" value={s.story.name} onChange={(name) => updateIn("story", { name })} t={t} />
                </Field>
                <Field label="時間" t={t}>
                  <TextField label="時間" value={s.story.time} onChange={(time) => updateIn("story", { time })} t={t} />
                </Field>
                <RangeField
                  label="總共幾段"
                  display={String(s.story.segments)}
                  value={s.story.segments}
                  min={1}
                  max={10}
                  onChange={(segments) =>
                    updateIn("story", { segments, current: Math.min(segments, s.story.current) })
                  }
                  t={t}
                />
                <RangeField
                  label="現在第幾段"
                  display={String(s.story.current)}
                  value={s.story.current}
                  min={1}
                  max={s.story.segments}
                  onChange={(current) => updateIn("story", { current })}
                  t={t}
                />
                <Field label="底部" t={t}>
                  <Segmented
                    value={s.story.bottom}
                    onChange={(bottom) => updateIn("story", { bottom })}
                    t={t}
                    options={[
                      { value: "caption", label: "一行大字" },
                      { value: "reply", label: "回覆框" },
                      { value: "none", label: "不放" },
                    ]}
                  />
                </Field>
                {s.story.bottom === "caption" && (
                  <Field label="大字" t={t}>
                    <TextField label="限時動態大字" value={s.story.caption} onChange={(caption) => updateIn("story", { caption })} t={t} />
                  </Field>
                )}
                {s.story.bottom === "reply" && (
                  <Field label="回覆框文字" t={t}>
                    <TextField label="回覆框文字" value={s.story.reply} onChange={(reply) => updateIn("story", { reply })} t={t} />
                  </Field>
                )}
              </>
            )}

            {(s.kind === "photocopy" || (s.kind === "poster" && (s.poster.textStyle === "tiles" || s.poster.textStyle === "circles"))) && (
              <ActionButton
                tone="secondary"
                t={t}
                onClick={() => update("seed", 1 + Math.floor(Math.random() * 100000))}
              >
                換一組{s.kind === "poster" ? "字的擺法" : "碳粉痕"}
              </ActionButton>
            )}
          </div>

          <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
            <Toggle
              checked={s.grain.enabled}
              onChange={(enabled) => updateIn("grain", { enabled })}
              label="疊一層顆粒噪點"
              t={t}
            />
            {s.grain.enabled && (
              <>
                <RangeField
                  label="強度"
                  display={`${Math.round(s.grain.amount * 100)}`}
                  value={s.grain.amount}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(amount) => updateIn("grain", { amount })}
                  t={t}
                />
                <RangeField
                  label="粗細"
                  display={s.grain.size.toFixed(2)}
                  value={s.grain.size}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(size) => updateIn("grain", { size })}
                  t={t}
                />
              </>
            )}
          </div>

          <ActionButton t={t} onClick={() => onApply(settings)} disabled={busy}>
            套用到 {images.length} 張
          </ActionButton>
        </>
      }
    />
  );
}
