"use client";

import { useMemo, useState } from "react";
import { checkCanvasSize, DEVICE_MAX_SIDE } from "@/lib/canvas-limits";
import { layoutMerge, type MergeOptions } from "@/lib/tools/image/merge";
import type { WorkImage } from "@/lib/tools/image/types";
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

type Props = {
  images: WorkImage[];
  busy: boolean;
  t: ThemeClasses;
  onMove: (id: string, direction: -1 | 1) => void;
  onMerge: (options: MergeOptions, background: string | null) => void;
};

/** 圖片拼接台:把選取的圖照順序接成一張 */
export default function MergePanel({ images, busy, t, onMove, onMerge }: Props) {
  const [options, setOptions] = useState<MergeOptions>({
    axis: "y",
    align: "center",
    fit: "max",
    gap: 0,
  });
  const [transparent, setTransparent] = useState(false);
  const [background, setBackground] = useState("#ffffff");

  const layout = useMemo(() => layoutMerge(images, options), [images, options]);
  const limit = checkCanvasSize(layout.canvas.width, layout.canvas.height);

  const update = <K extends keyof MergeOptions>(key: K, value: MergeOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  if (images.length < 2) {
    return (
      <StationHint t={t}>
        拼接需要兩張以上。到上面的圖片清單按著選，選取的順序就是拼接的順序。
      </StationHint>
    );
  }

  return (
    <div className="space-y-4">
      <StationHint t={t}>
        目前會把 {images.length} 張接成一張，順序照清單由上而下。結果會新增一張，原本的圖留著。
      </StationHint>

      <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div className={`rounded-xl border p-3 ${t.subPanel}`}>
          <p className="mb-2 text-xs tracking-[0.08em]">拼接順序</p>
          <ol className="space-y-1.5">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="flex items-center gap-2 text-xs tracking-[0.04em]"
              >
                <span className={`w-5 shrink-0 ${t.muted}`}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate" title={image.name}>
                  {image.name}
                </span>
                <span className={`shrink-0 ${t.muted}`}>
                  {image.width}×{image.height}
                </span>
                <button
                  type="button"
                  onClick={() => onMove(image.id, -1)}
                  disabled={index === 0 || busy}
                  className={`rounded-lg border px-1.5 py-0.5 disabled:opacity-30 ${t.secondary}`}
                  aria-label="往前移"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(image.id, 1)}
                  disabled={index === images.length - 1 || busy}
                  className={`rounded-lg border px-1.5 py-0.5 disabled:opacity-30 ${t.secondary}`}
                  aria-label="往後移"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="方向" t={t}>
            <Segmented
              value={options.axis}
              onChange={(value) => update("axis", value)}
              t={t}
              options={[
                { value: "y", label: "直向（往下接）" },
                { value: "x", label: "橫向（往右接）" },
              ]}
            />
          </Field>

          <Field label="對齊" t={t}>
            <Segmented
              value={options.align}
              onChange={(value) => update("align", value)}
              t={t}
              options={[
                { value: "start", label: options.axis === "y" ? "靠左" : "靠上" },
                { value: "center", label: "置中" },
                { value: "end", label: options.axis === "y" ? "靠右" : "靠下" },
              ]}
            />
          </Field>

          <Field
            label={options.axis === "y" ? "寬度處理" : "高度處理"}
            hint="統一尺寸是等比縮放，不會把圖拉變形"
            t={t}
          >
            <Segmented
              value={options.fit}
              onChange={(value) => update("fit", value)}
              t={t}
              options={[
                { value: "none", label: "各自原尺寸" },
                { value: "min", label: "縮到最小那張" },
                { value: "max", label: "放到最大那張" },
              ]}
            />
          </Field>

          <Field label="圖與圖的間距（px）" t={t}>
            <NumberField
              value={options.gap}
              onChange={(value) => update("gap", Math.max(0, Math.round(value)))}
              min={0}
              max={500}
              label="圖與圖的間距"
              t={t}
            />
          </Field>

          <div className="sm:col-span-2 space-y-2">
            <Toggle
              checked={transparent}
              onChange={setTransparent}
              label="背景保持透明"
              t={t}
            />
            {!transparent && (
              <ColorField value={background} onChange={setBackground} t={t} />
            )}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <p className={`text-xs ${t.muted}`}>
              接出來是 {layout.canvas.width} × {layout.canvas.height}
            </p>

            {!limit.ok && (
              <p className="rounded-xl border border-(--border-dark) px-3 py-2 text-xs leading-6">
                {limit.reason === "side"
                  ? `太長了：邊長上限是 ${DEVICE_MAX_SIDE}px。超過的話 iOS Safari 會直接吐出一張空白圖，所以這裡先擋下來。`
                  : "總面積超過瀏覽器上限，接出來會是空白圖。請先縮小或分批接。"}
              </p>
            )}

            <ActionButton
              t={t}
              onClick={() => onMerge(options, transparent ? null : background)}
              disabled={busy || !limit.ok}
            >
              拼接成一張
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
