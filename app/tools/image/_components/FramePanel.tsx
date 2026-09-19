"use client";

import { useMemo, useState } from "react";
import { borderLayout, ratioLayout, RATIO_PRESETS, type Ratio } from "@/lib/tools/image/frame";
import type { Align, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import {
  ActionButton,
  ColorField,
  Field,
  NumberField,
  Segmented,
  StationHint,
  Toggle,
} from "./controls";

export type FrameSettings = {
  border: boolean;
  borderWidth: number;
  borderColor: string;
  borderMode: "outset" | "inset";
  ratio: boolean;
  ratioValue: Ratio;
  alignX: Align;
  alignY: Align;
  background: string | null;
};

type Props = {
  images: WorkImage[];
  busy: boolean;
  t: ThemeClasses;
  onApply: (settings: FrameSettings) => void;
};

/**
 * 邊框比例區。
 *
 * 描邊與補比例是兩件事,參數各自獨立:
 * 描邊是沿著現有邊緣畫一圈,補比例是往外補背景把長寬比湊成指定值(絕不縮放或裁切原圖)。
 */
export default function FramePanel({ images, busy, t, onApply }: Props) {
  const [border, setBorder] = useState(true);
  const [borderWidth, setBorderWidth] = useState(12);
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [borderMode, setBorderMode] = useState<"outset" | "inset">("outset");

  const [ratio, setRatio] = useState(false);
  const [ratioValue, setRatioValue] = useState<Ratio>({ w: 1, h: 1 });
  const [alignX, setAlignX] = useState<Align>("center");
  const [alignY, setAlignY] = useState<Align>("center");
  const [transparent, setTransparent] = useState(false);
  const [background, setBackground] = useState("#ffffff");

  // 拿第一張當預覽的樣本,批次套用時其餘張的算法一樣
  const sample = images[0];

  const preview = useMemo(() => {
    if (!sample) return null;

    let size = { width: sample.width, height: sample.height };
    if (border) size = borderLayout(size, borderWidth, borderMode).canvas;
    if (ratio) {
      size = ratioLayout(size, ratioValue, { x: alignX, y: alignY }).canvas;
    }
    return size;
  }, [sample, border, borderWidth, borderMode, ratio, ratioValue, alignX, alignY]);

  if (images.length === 0) {
    return <StationHint t={t}>先在上面的清單選一張以上的圖。</StationHint>;
  }

  return (
    <div className="space-y-4">
      <StationHint t={t}>
        會套用到選取的 {images.length} 張。描邊是沿著邊緣畫一圈；補比例是往外補背景，
        原圖不會被縮放或裁掉。
      </StationHint>

      <div className="grid gap-5 md:grid-cols-2">
        <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
          <Toggle checked={border} onChange={setBorder} label="描邊" t={t} />

          {border && (
            <div className="space-y-3 pl-6">
              <Field label="粗細（px）" t={t}>
                <NumberField
                  value={borderWidth}
                  onChange={(value) => setBorderWidth(Math.max(0, Math.round(value)))}
                  min={0}
                  max={500}
                  label="描邊粗細"
                  t={t}
                />
              </Field>

              <Field label="顏色" t={t}>
                <ColorField value={borderColor} onChange={setBorderColor} t={t} />
              </Field>

              <Field
                label="畫在哪"
                hint={
                  borderMode === "outset"
                    ? "往外長一圈，圖會變大，內容一點都不會被蓋到"
                    : "壓在原本的邊緣上，尺寸不變，但最外圈的內容會被蓋掉"
                }
                t={t}
              >
                <Segmented
                  value={borderMode}
                  onChange={setBorderMode}
                  t={t}
                  options={[
                    { value: "outset", label: "往外長" },
                    { value: "inset", label: "壓在邊上" },
                  ]}
                />
              </Field>
            </div>
          )}
        </div>

        <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
          <Toggle checked={ratio} onChange={setRatio} label="補成指定比例" t={t} />

          {ratio && (
            <div className="space-y-3 pl-6">
              <Field label="比例" t={t}>
                <div className="flex flex-wrap gap-1.5">
                  {RATIO_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRatioValue(preset.ratio)}
                      className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                        ratioValue.w === preset.ratio.w && ratioValue.h === preset.ratio.h
                          ? t.selected
                          : t.unselected
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="flex items-end gap-2">
                <Field label="寬" t={t}>
                  <NumberField
                    value={ratioValue.w}
                    onChange={(value) =>
                      setRatioValue((prev) => ({ ...prev, w: Math.max(1, value) }))
                    }
                    min={1}
                    label="比例寬"
                    t={t}
                  />
                </Field>
                <span className={`pb-2 ${t.muted}`}>:</span>
                <Field label="高" t={t}>
                  <NumberField
                    value={ratioValue.h}
                    onChange={(value) =>
                      setRatioValue((prev) => ({ ...prev, h: Math.max(1, value) }))
                    }
                    min={1}
                    label="比例高"
                    t={t}
                  />
                </Field>
              </div>

              <Field label="原圖放在" t={t}>
                <div className="space-y-1.5">
                  <Segmented
                    value={alignX}
                    onChange={setAlignX}
                    t={t}
                    options={[
                      { value: "start", label: "靠左" },
                      { value: "center", label: "水平置中" },
                      { value: "end", label: "靠右" },
                    ]}
                  />
                  <Segmented
                    value={alignY}
                    onChange={setAlignY}
                    t={t}
                    options={[
                      { value: "start", label: "靠上" },
                      { value: "center", label: "垂直置中" },
                      { value: "end", label: "靠下" },
                    ]}
                  />
                </div>
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Toggle
          checked={transparent}
          onChange={setTransparent}
          label="補出來的區域保持透明"
          t={t}
        />
        {!transparent && (
          <ColorField value={background} onChange={setBackground} t={t} />
        )}
      </div>

      {preview && sample && (
        <p className={`text-xs ${t.muted}`}>
          以「{sample.name}」為例：{sample.width} × {sample.height} → {preview.width} ×{" "}
          {preview.height}
        </p>
      )}

      <ActionButton
        t={t}
        onClick={() =>
          onApply({
            border,
            borderWidth,
            borderColor,
            borderMode,
            ratio,
            ratioValue,
            alignX,
            alignY,
            background: transparent ? null : background,
          })
        }
        disabled={busy || (!border && !ratio)}
      >
        套用到 {images.length} 張
      </ActionButton>
    </div>
  );
}
