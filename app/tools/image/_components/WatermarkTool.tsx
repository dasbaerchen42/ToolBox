"use client";

import { useEffect, useRef, useState } from "react";
import { FONT_OPTIONS } from "@/lib/editor-font";
import type { FontFamilyName } from "@/lib/preferences";
import {
  drawWatermarkLayers,
  loadBitmap,
  loadWatermarkImage,
  prepareWatermarkFont,
} from "@/lib/tools/image/render";
import {
  DEFAULT_NOISE,
  DEFAULT_WATERMARK,
  type Anchor,
  type NoiseBlend,
  type NoiseSettings,
  type WatermarkSettings,
} from "@/lib/tools/image/watermark";
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

export type WatermarkJob = {
  watermark: WatermarkSettings;
  noise: NoiseSettings;
  logo: ImageBitmap | null;
};

type Props = {
  images: WorkImage[];
  busy: boolean;
  t: ThemeClasses;
  onApply: (job: WatermarkJob) => void;
};

/** 預覽畫布的長邊上限:夠看清楚顆粒與間距,又不至於每動一下拉桿都重畫一張大圖 */
const PREVIEW_MAX = 900;
const PREVIEW_MAX_HEIGHT = 460;

// 設定與上傳過的浮水印圖都記在這台瀏覽器,下次打開不用重設
const SETTINGS_KEY = "toolbox-watermark-settings";
const LOGO_KEY = "toolbox-watermark-logo";
/** localStorage 大約只有 5MB,太大的圖就不記了 */
const LOGO_STORE_LIMIT = 1_500_000;

const BLEND_OPTIONS: { value: NoiseBlend; label: string }[] = [
  { value: "overlay", label: "覆蓋" },
  { value: "soft-light", label: "柔光" },
  { value: "multiply", label: "色彩增值" },
  { value: "screen", label: "濾色" },
];

const ANCHORS: Anchor[] = ([0, 0.5, 1] as const).flatMap((y) =>
  ([0, 0.5, 1] as const).map((x) => ({ x, y }))
);

type Stored = { watermark: WatermarkSettings; noise: NoiseSettings; removeWhite: boolean };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      watermark: { ...DEFAULT_WATERMARK, ...parsed.watermark },
      noise: { ...DEFAULT_NOISE, ...parsed.noise },
      removeWhite: parsed.removeWhite ?? true,
    };
  } catch {
    return null;
  }
}

function readStoredLogo(): Blob | null {
  try {
    const dataUrl = localStorage.getItem(LOGO_KEY);
    if (!dataUrl) return null;
    const [head, body] = dataUrl.split(",");
    const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type });
  } catch {
    return null;
  }
}

function storeLogo(blob: Blob) {
  if (blob.size > LOGO_STORE_LIMIT) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      localStorage.setItem(LOGO_KEY, String(reader.result));
    } catch {
      // 空間不夠就不記,這次照樣能用
    }
  };
  reader.readAsDataURL(blob);
}

/** 浮水印壓印台:文字或圖片浮水印 + 雜訊,批次套用到選取的圖 */
export default function WatermarkTool({ images, busy, t, onApply }: Props) {
  const [watermark, setWatermark] = useState<WatermarkSettings>(DEFAULT_WATERMARK);
  const [noise, setNoise] = useState<NoiseSettings>(DEFAULT_NOISE);
  const [logoFile, setLogoFile] = useState<Blob | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [logo, setLogo] = useState<ImageBitmap | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bitmapRef = useRef<{ id: string; bitmap: ImageBitmap } | null>(null);

  const sample = images[0];

  // localStorage 只在瀏覽器讀得到,掛載後才還原
  useEffect(() => {
    const stored = readStored();
    /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage 水合 */
    if (stored) {
      setWatermark(stored.watermark);
      setNoise(stored.noise);
      setRemoveWhite(stored.removeWhite);
    }
    setLogoFile(readStoredLogo());
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ watermark, noise, removeWhite }));
    } catch {
      // 存不了就算了,不影響這次使用
    }
  }, [watermark, noise, removeWhite, restored]);

  // 上傳的圖或「去白底」一變就重新處理一次
  useEffect(() => {
    if (!logoFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 清掉上一張處理過的圖
      setLogo(null);
      return;
    }
    let cancelled = false;
    let made: ImageBitmap | null = null;
    loadWatermarkImage(logoFile, "浮水印", removeWhite)
      .then((bitmap) => {
        made = bitmap;
        if (cancelled) {
          bitmap.close();
          return;
        }
        setLogo(bitmap);
        setLogoError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLogo(null);
        setLogoError(error instanceof Error ? error.message : "讀不到這張圖");
      });
    return () => {
      cancelled = true;
      made?.close();
    };
  }, [logoFile, removeWhite]);

  // 預覽:跟輸出走同一支 drawWatermarkLayers,只是畫在縮小的畫布上
  useEffect(() => {
    if (!sample) return;
    let cancelled = false;

    (async () => {
      if (bitmapRef.current?.id !== sample.id) {
        bitmapRef.current?.bitmap.close();
        bitmapRef.current = { id: sample.id, bitmap: await loadBitmap(sample) };
      }
      const fontFamily =
        watermark.source === "text" ? await prepareWatermarkFont(watermark) : "sans-serif";
      const canvas = canvasRef.current;
      const source = bitmapRef.current?.bitmap;
      if (cancelled || !canvas || !source) return;

      const scale = Math.min(1, PREVIEW_MAX / Math.max(sample.width, sample.height));
      const size = {
        width: Math.max(1, Math.round(sample.width * scale)),
        height: Math.max(1, Math.round(sample.height * scale)),
      };
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, size.width, size.height);
      drawWatermarkLayers(ctx, size, source, watermark, noise, { logo, fontFamily }, scale);
    })().catch((error: unknown) => console.error("預覽失敗:", error));

    return () => {
      cancelled = true;
    };
  }, [sample, watermark, noise, logo]);

  useEffect(
    () => () => {
      bitmapRef.current?.bitmap.close();
      bitmapRef.current = null;
    },
    []
  );

  const updateMark = <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) =>
    setWatermark((prev) => ({ ...prev, [key]: value }));
  const updateNoise = <K extends keyof NoiseSettings>(key: K, value: NoiseSettings[K]) =>
    setNoise((prev) => ({ ...prev, [key]: value }));

  if (!sample) {
    return (
      <ToolPane
        workspace={<EmptyWorkspace t={t}>先在左邊的清單選一張以上的圖。</EmptyWorkspace>}
        controls={<StationHint t={t}>選好圖之後，這裡會出現參數與即時預覽。</StationHint>}
      />
    );
  }

  const markReady =
    watermark.source === "text" ? watermark.text.trim().length > 0 : logo !== null;
  const canApply = (watermark.enabled && markReady) || noise.enabled;
  const aspect = sample.width / sample.height;

  return (
    <ToolPane
      workspace={
        <div className="space-y-2">
          <div className="flex justify-center overflow-hidden rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
            <canvas
              ref={canvasRef}
              aria-label="浮水印預覽"
              style={{
                aspectRatio: `${sample.width} / ${sample.height}`,
                width: "100%",
                maxWidth: PREVIEW_MAX_HEIGHT * aspect,
                ...backgroundStyle(null),
              }}
            />
          </div>
          <p className={`text-center text-xs ${t.muted}`}>
            以「{sample.name}」為例：{sample.width} × {sample.height}
          </p>
        </div>
      }
      controls={
        <>
          <StationHint t={t}>
            會套用到選取的 {images.length} 張，預覽是第一張。大小與位置都照每張圖自己的短邊算，
            尺寸不同的圖看起來也一樣密。
          </StationHint>

          <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
            <Toggle
              checked={watermark.enabled}
              onChange={(value) => updateMark("enabled", value)}
              label="浮水印"
              t={t}
            />

            {watermark.enabled && (
              <div className="space-y-3">
                <Field label="來源" t={t}>
                  <Segmented
                    value={watermark.source}
                    onChange={(value) => updateMark("source", value)}
                    t={t}
                    options={[
                      { value: "text", label: "文字" },
                      { value: "image", label: "圖片" },
                    ]}
                  />
                </Field>

                {watermark.source === "text" ? (
                  <>
                    <Field label="文字" t={t}>
                      <input
                        type="text"
                        value={watermark.text}
                        onChange={(event) => updateMark("text", event.target.value)}
                        placeholder="@你的帳號"
                        aria-label="浮水印文字"
                        className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                      />
                    </Field>

                    <Field label="字體" t={t}>
                      <select
                        value={watermark.fontKey}
                        onChange={(event) =>
                          updateMark("fontKey", event.target.value as FontFamilyName)
                        }
                        aria-label="浮水印字體"
                        className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font.key} value={font.key}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Toggle
                      checked={watermark.bold}
                      onChange={(value) => updateMark("bold", value)}
                      label="粗體"
                      t={t}
                    />

                    <Field label="樣式" t={t}>
                      <Segmented
                        value={watermark.frame}
                        onChange={(value) => updateMark("frame", value)}
                        t={t}
                        options={[
                          { value: "pill", label: "圓角外框" },
                          { value: "none", label: "純文字" },
                        ]}
                      />
                    </Field>

                    <Field label="顏色" t={t}>
                      <ColorField
                        value={watermark.color}
                        onChange={(value) => updateMark("color", value)}
                        t={t}
                      />
                    </Field>
                  </>
                ) : (
                  <Field
                    label="浮水印圖"
                    hint="簽名、Logo 都可以。上傳過的會記在這台瀏覽器，下次打開自動帶入。"
                    t={t}
                  >
                    <div className="flex items-center gap-2">
                      <ActionButton
                        tone="secondary"
                        t={t}
                        onClick={() => logoInput.current?.click()}
                      >
                        {logoFile ? "換一張" : "上傳圖片"}
                      </ActionButton>
                      {logoFile && (
                        <ActionButton
                          tone="secondary"
                          t={t}
                          onClick={() => {
                            setLogoFile(null);
                            try {
                              localStorage.removeItem(LOGO_KEY);
                            } catch {
                              // 忽略
                            }
                          }}
                        >
                          移除
                        </ActionButton>
                      )}
                    </div>
                    <input
                      ref={logoInput}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        setLogoFile(file);
                        storeLogo(file);
                      }}
                    />
                    {logoError && <span className="text-xs">{logoError}</span>}
                    <Toggle
                      checked={removeWhite}
                      onChange={setRemoveWhite}
                      label="去除白色背景"
                      t={t}
                    />
                  </Field>
                )}

                <RangeField
                  label="透明度"
                  display={`${Math.round(watermark.opacity * 100)}%`}
                  value={watermark.opacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(value) => updateMark("opacity", value)}
                  t={t}
                />
                {watermark.source === "text" ? (
                  <RangeField
                    label="大小"
                    display={`${watermark.size}%`}
                    value={watermark.size}
                    min={1}
                    max={20}
                    onChange={(value) => updateMark("size", value)}
                    t={t}
                  />
                ) : (
                  <RangeField
                    label="大小"
                    display={`${watermark.imageSize}%`}
                    value={watermark.imageSize}
                    min={2}
                    max={80}
                    onChange={(value) => updateMark("imageSize", value)}
                    t={t}
                  />
                )}
                <RangeField
                  label="角度"
                  display={`${watermark.angle}°`}
                  value={watermark.angle}
                  min={-90}
                  max={90}
                  onChange={(value) => updateMark("angle", value)}
                  t={t}
                />

                <Field label="擺放方式" t={t}>
                  <Segmented
                    value={watermark.layout}
                    onChange={(value) => updateMark("layout", value)}
                    t={t}
                    options={[
                      { value: "tile", label: "滿版平鋪" },
                      { value: "single", label: "單個擺放" },
                    ]}
                  />
                </Field>

                {watermark.layout === "tile" ? (
                  <RangeField
                    label="間距"
                    display={`${watermark.spacing}%`}
                    value={watermark.spacing}
                    min={0}
                    max={300}
                    step={10}
                    onChange={(value) => updateMark("spacing", value)}
                    t={t}
                  />
                ) : (
                  <>
                    <Field label="位置" t={t}>
                      <div className="grid w-28 grid-cols-3 gap-1">
                        {ANCHORS.map((anchor) => {
                          const on =
                            watermark.anchor.x === anchor.x && watermark.anchor.y === anchor.y;
                          return (
                            <button
                              key={`${anchor.x}-${anchor.y}`}
                              type="button"
                              aria-label={`位置 ${anchor.x}, ${anchor.y}`}
                              aria-pressed={on}
                              onClick={() => updateMark("anchor", anchor)}
                              className={`h-8 rounded-lg border transition ${
                                on ? t.selected : t.unselected
                              }`}
                            />
                          );
                        })}
                      </div>
                    </Field>
                    <RangeField
                      label="離邊緣"
                      display={`${watermark.margin}%`}
                      value={watermark.margin}
                      min={0}
                      max={20}
                      onChange={(value) => updateMark("margin", value)}
                      t={t}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
            <Toggle
              checked={noise.enabled}
              onChange={(value) => updateNoise("enabled", value)}
              label="雜訊覆蓋"
              t={t}
            />

            {noise.enabled && (
              <div className="space-y-3">
                <Field label="顆粒" t={t}>
                  <Segmented
                    value={noise.color ? "color" : "mono"}
                    onChange={(value) => updateNoise("color", value === "color")}
                    t={t}
                    options={[
                      { value: "mono", label: "單色" },
                      { value: "color", label: "彩色" },
                    ]}
                  />
                </Field>
                <Field label="混合模式" t={t}>
                  <Segmented
                    value={noise.blend}
                    onChange={(value) => updateNoise("blend", value)}
                    t={t}
                    options={BLEND_OPTIONS}
                  />
                </Field>
                <RangeField
                  label="強度"
                  display={`${Math.round(noise.opacity * 100)}%`}
                  value={noise.opacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(value) => updateNoise("opacity", value)}
                  t={t}
                />
                <RangeField
                  label="顆粒大小"
                  display={`${noise.grain}px`}
                  value={noise.grain}
                  min={1}
                  max={6}
                  onChange={(value) => updateNoise("grain", value)}
                  t={t}
                />
              </div>
            )}
          </div>

          <ActionButton
            t={t}
            onClick={() => onApply({ watermark, noise, logo })}
            disabled={busy || !canApply}
          >
            套用到 {images.length} 張
          </ActionButton>
        </>
      }
    />
  );
}
