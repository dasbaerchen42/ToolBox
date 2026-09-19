"use client";

import {
  formatBytes,
  OUTPUT_FORMATS,
  supportsAlpha,
  supportsQuality,
} from "@/lib/tools/image/format";
import type { OutputOptions, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import { ToolPane, EmptyWorkspace } from "./WorkbenchLayout";
import { ActionButton, ColorField, Field, Segmented, StationHint } from "./controls";

type Props = {
  images: WorkImage[];
  selected: WorkImage[];
  output: OutputOptions;
  busy: boolean;
  t: ThemeClasses;
  onChange: (output: OutputOptions) => void;
  onDownload: (images: WorkImage[]) => void;
};

export default function OutputTool({
  images,
  selected,
  output,
  busy,
  t,
  onChange,
  onDownload,
}: Props) {
  const update = <K extends keyof OutputOptions>(key: K, value: OutputOptions[K]) =>
    onChange({ ...output, [key]: value });

  const totalBytes = images.reduce((sum, image) => sum + image.blob.size, 0);
  const shown = selected.length > 0 ? selected : images;

  return (
    <ToolPane
      workspace={
        shown.length === 0 ? (
          <EmptyWorkspace t={t}>工作檯上還沒有圖。</EmptyWorkspace>
        ) : (
          <div className="rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((image) => (
                <li key={image.id} className="min-w-0">
                  <div className="overflow-hidden rounded-xl border border-(--border-light) bg-(--paper-bg)">
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL,next/image 幫不上忙 */}
                    <img
                      src={image.url}
                      alt={image.name}
                      className="block h-32 w-full object-contain"
                    />
                  </div>
                  <p className="mt-1 truncate text-[11px] tracking-[0.04em]">
                    {image.name}
                  </p>
                  <p className={`text-[10px] ${t.muted}`}>
                    {image.width}×{image.height}・{formatBytes(image.blob.size)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )
      }
      controls={
        <>
          <StationHint t={t}>
            處理過程中一律用無損的 PNG 暫存，格式只在按下下載的那一刻才套用——
            所以中間做幾道手續都不會累積壓縮雜訊。兩張以上會自動打包成 zip。
          </StationHint>

          <Field
            label="格式"
            hint={OUTPUT_FORMATS.find((item) => item.value === output.format)?.hint}
            t={t}
          >
            <Segmented
              value={output.format}
              onChange={(value) => update("format", value)}
              t={t}
              options={OUTPUT_FORMATS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
            />
          </Field>

          {supportsQuality(output.format) && (
            <Field label={`品質 ${Math.round(output.quality * 100)}`} t={t}>
              <input
                type="range"
                aria-label="輸出品質"
                min={0.3}
                max={1}
                step={0.05}
                value={output.quality}
                onChange={(event) => update("quality", Number(event.target.value))}
                className="w-full accent-(--accent)"
              />
            </Field>
          )}

          {!supportsAlpha(output.format) && (
            <Field
              label="透明區域墊什麼顏色"
              hint="JPEG 存不住透明，不墊底色的話透明會變成黑的"
              t={t}
            >
              <ColorField
                value={output.flattenColor}
                onChange={(value) => update("flattenColor", value)}
                t={t}
              />
            </Field>
          )}

          <div className="space-y-2">
            <ActionButton
              t={t}
              onClick={() => onDownload(selected)}
              disabled={selected.length === 0 || busy}
            >
              下載選取的 {selected.length} 張
            </ActionButton>
            <ActionButton
              tone="secondary"
              t={t}
              onClick={() => onDownload(images)}
              disabled={images.length === 0 || busy}
            >
              下載全部 {images.length} 張
            </ActionButton>
            <p className={`text-xs ${t.muted}`}>目前暫存 {formatBytes(totalBytes)}</p>
          </div>
        </>
      }
    />
  );
}
