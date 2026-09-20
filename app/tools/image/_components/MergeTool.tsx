"use client";

import { useMemo, useState } from "react";
import { checkCanvasSize, DEVICE_MAX_SIDE } from "@/lib/canvas-limits";
import { RATIO_PRESETS, type Ratio } from "@/lib/tools/image/frame";
import {
  layoutGrid,
  layoutMerge,
  suggestCellWidth,
  type GridFit,
  type MergeLayout,
  type MergeOptions,
} from "@/lib/tools/image/merge";
import type { Align, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import CanvasPreview, { type Placement } from "./CanvasPreview";
import { ToolPane, EmptyWorkspace } from "./WorkbenchLayout";
import {
  ActionButton,
  ColorField,
  Field,
  NumberField,
  Segmented,
  StationHint,
  Toggle,
} from "./controls";

type Mode = "linear" | "grid";

type Props = {
  images: WorkImage[];
  busy: boolean;
  t: ThemeClasses;
  onMove: (id: string, direction: -1 | 1) => void;
  onMerge: (layout: MergeLayout, background: string | null) => void;
};

/**
 * 圖片拼接台。
 *
 * 兩種排列方式的差別不只是方向:
 * 單軸是「格子跟著圖走」——每張保持自己的尺寸,沿著一個方向接下去;
 * 棋盤是「圖去配合格子」——格子先固定成一樣大,照片才排得出整齊的方格。
 */
export default function MergeTool({ images, busy, t, onMove, onMerge }: Props) {
  const [mode, setMode] = useState<Mode>("linear");

  const [options, setOptions] = useState<MergeOptions>({
    axis: "y",
    align: "center",
    fit: "max",
    gap: 0,
  });

  const [columns, setColumns] = useState(3);
  const [ratio, setRatio] = useState<Ratio>({ w: 1, h: 1 });
  const [gridFit, setGridFit] = useState<GridFit>("cover");
  const [lastRow, setLastRow] = useState<Align>("center");
  // null = 跟著選取的圖自動決定;使用者改過就固定下來
  const [cellWidth, setCellWidth] = useState<number | null>(null);

  const autoCellWidth = useMemo(() => suggestCellWidth(images), [images]);
  const effectiveCellWidth = cellWidth ?? autoCellWidth;

  const layout = useMemo(
    () =>
      mode === "linear"
        ? layoutMerge(images, options)
        : layoutGrid(images, {
            columns,
            cellWidth: effectiveCellWidth,
            ratio,
            fit: gridFit,
            gap: options.gap,
            lastRow,
          }),
    [mode, images, options, columns, effectiveCellWidth, ratio, gridFit, lastRow]
  );

  const [transparent, setTransparent] = useState(false);
  const [background, setBackground] = useState("#ffffff");

  const limit = checkCanvasSize(layout.canvas.width, layout.canvas.height);

  const placements: Placement[] = useMemo(
    () => layout.placements.map((rect, index) => ({ image: images[index], rect })),
    [layout, images]
  );

  const update = <K extends keyof MergeOptions>(key: K, value: MergeOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const rows = Math.ceil(images.length / Math.max(1, columns));
  const remainder = images.length % Math.max(1, columns);

  if (images.length < 2) {
    return (
      <ToolPane
        workspace={
          <EmptyWorkspace t={t}>
            拼接需要兩張以上。
            <br />
            到左邊的圖片清單按住 Ctrl / ⌘ 多選，選取的順序就是拼接的順序。
          </EmptyWorkspace>
        }
        controls={
          <StationHint t={t}>
            目前選了 {images.length} 張。選滿兩張以上，這裡就會出現參數與即時預覽。
          </StationHint>
        }
      />
    );
  }

  return (
    <ToolPane
      workspace={
        <CanvasPreview
          canvas={layout.canvas}
          placements={placements}
          background={transparent ? null : background}
          caption={
            mode === "grid"
              ? `${columns} × ${rows} 格，接出來是 ${layout.canvas.width} × ${layout.canvas.height}`
              : `接出來是 ${layout.canvas.width} × ${layout.canvas.height}`
          }
          t={t}
        />
      }
      controls={
        <>
          <StationHint t={t}>
            預覽是即時的，改參數馬上看得到。結果會新增一張，原本那幾張留著。
          </StationHint>

          <Field
            label="排列方式"
            hint={
              mode === "linear"
                ? "每張保持自己的尺寸，沿著一個方向接下去"
                : "格子先固定成一樣大，照片去配合格子"
            }
            t={t}
          >
            <Segmented
              value={mode}
              onChange={setMode}
              t={t}
              options={[
                { value: "linear", label: "單向接圖" },
                { value: "grid", label: "棋盤拼貼" },
              ]}
            />
          </Field>

          {mode === "linear" ? (
            <>
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
            </>
          ) : (
            <>
              <Field label={`每列幾格（目前 ${columns} × ${rows}）`} t={t}>
                <NumberField
                  value={columns}
                  onChange={(value) => setColumns(Math.max(1, Math.min(10, Math.round(value))))}
                  min={1}
                  max={10}
                  label="每列幾格"
                  t={t}
                />
              </Field>

              <Field label="格子比例" t={t}>
                <div className="flex flex-wrap gap-1.5">
                  {RATIO_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRatio(preset.ratio)}
                      className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                        ratio.w === preset.ratio.w && ratio.h === preset.ratio.h
                          ? t.selected
                          : t.unselected
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="格子裡的照片"
                hint={
                  gridFit === "cover"
                    ? "塞滿格子，超出格子的部分會被裁掉——拼貼要的就是這個，但照片邊緣會不見"
                    : "整張塞進格子，空出來的地方留背景色，一點都不裁"
                }
                t={t}
              >
                <Segmented
                  value={gridFit}
                  onChange={setGridFit}
                  t={t}
                  options={[
                    { value: "cover", label: "裁切填滿" },
                    { value: "contain", label: "完整留白" },
                  ]}
                />
              </Field>

              {remainder !== 0 && (
                <Field label={`最後一列（只有 ${remainder} 格）`} t={t}>
                  <Segmented
                    value={lastRow}
                    onChange={setLastRow}
                    t={t}
                    options={[
                      { value: "start", label: "靠左" },
                      { value: "center", label: "置中" },
                      { value: "end", label: "靠右" },
                    ]}
                  />
                </Field>
              )}

              <Field
                label="格子寬度（px）"
                hint={
                  cellWidth === null
                    ? `自動：取最寬那張的 ${autoCellWidth}px，不會把圖放大到糊掉`
                    : `自動值是 ${autoCellWidth}px`
                }
                t={t}
              >
                <div className="flex gap-1.5">
                  <NumberField
                    value={effectiveCellWidth}
                    onChange={(value) => setCellWidth(Math.max(1, Math.round(value)))}
                    min={1}
                    max={4000}
                    label="格子寬度"
                    t={t}
                  />
                  {cellWidth !== null && (
                    <button
                      type="button"
                      onClick={() => setCellWidth(null)}
                      className={`shrink-0 rounded-xl border px-2.5 text-xs transition ${t.secondary}`}
                    >
                      自動
                    </button>
                  )}
                </div>
              </Field>
            </>
          )}

          <Field label={mode === "grid" ? "格子之間的間距（px）" : "圖與圖的間距（px）"} t={t}>
            <NumberField
              value={options.gap}
              onChange={(value) => update("gap", Math.max(0, Math.round(value)))}
              min={0}
              max={500}
              label="間距"
              t={t}
            />
          </Field>

          <div className="space-y-2">
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

          <div className={`rounded-xl border p-3 ${t.subPanel}`}>
            <p className="mb-2 text-xs tracking-[0.08em]">
              {mode === "grid" ? "排列順序（左上到右下）" : "拼接順序"}
            </p>
            <ol className="space-y-1.5">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className="flex items-center gap-2 text-xs tracking-[0.04em]"
                >
                  <span className={`w-4 shrink-0 ${t.muted}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate" title={image.name}>
                    {image.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onMove(image.id, -1)}
                    disabled={index === 0 || busy}
                    className={`rounded-lg border px-1.5 py-0.5 disabled:opacity-30 ${t.secondary}`}
                    aria-label={`把 ${image.name} 往前移`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(image.id, 1)}
                    disabled={index === images.length - 1 || busy}
                    className={`rounded-lg border px-1.5 py-0.5 disabled:opacity-30 ${t.secondary}`}
                    aria-label={`把 ${image.name} 往後移`}
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {!limit.ok && (
            <p className="rounded-xl border border-(--border-dark) px-3 py-2 text-xs leading-6">
              {limit.reason === "side"
                ? `太大了：邊長上限是 ${DEVICE_MAX_SIDE}px。超過的話 iOS Safari 會直接吐出一張空白圖，所以這裡先擋下來。${
                    mode === "grid" ? "把格子寬度調小就可以了。" : ""
                  }`
                : `總面積超過瀏覽器上限，接出來會是空白圖。${
                    mode === "grid" ? "請把格子寬度調小。" : "請先縮小或分批接。"
                  }`}
            </p>
          )}

          <ActionButton
            t={t}
            onClick={() => onMerge(layout, transparent ? null : background)}
            disabled={busy || !limit.ok}
          >
            {mode === "grid" ? "排成棋盤" : "拼接成一張"}
          </ActionButton>
        </>
      }
    />
  );
}
