"use client";

import { useMemo, useState } from "react";
import {
  countPieces,
  cutsToSpans,
  equalCutPositions,
  normalizeCuts,
  type Span,
} from "@/lib/tools/image/slice";
import { isUsableRect } from "@/lib/tools/image/geometry";
import type { Axis, Rect, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import ImageStage, { percent } from "./ImageStage";
import { useDragRect } from "./useDragRect";
import { ActionButton, Field, NumberField, Segmented, StationHint } from "./controls";

type Mode = "equal" | "free" | "crop";

type Props = {
  image: WorkImage;
  busy: boolean;
  t: ThemeClasses;
  onSlice: (spans: Span[], axis: Axis) => void;
  onCrop: (rect: Rect) => void;
};

/**
 * 影像切割刀。
 *
 * 三種模式最後都收斂成同一件事:一組切點或一個框。
 * 等分是算出來的切點、自由是點出來的切點、裁切是留一個框,
 * 所以底下只有一套資料結構要維護。
 */
export default function SlicePanel({ image, busy, t, onSlice, onCrop }: Props) {
  const [mode, setMode] = useState<Mode>("equal");
  const [axis, setAxis] = useState<Axis>("y");
  const [parts, setParts] = useState(2);
  const [freeCuts, setFreeCuts] = useState<number[]>([]);
  const [crop, setCrop] = useState<Rect | null>(null);

  const total = axis === "y" ? image.height : image.width;

  const cuts = useMemo(
    () =>
      mode === "equal"
        ? equalCutPositions(total, parts)
        : normalizeCuts(freeCuts, total),
    [mode, total, parts, freeCuts]
  );

  const spans = useMemo(() => cutsToSpans(cuts, total), [cuts, total]);

  const { ref, handlers, draft } = useDragRect({
    size: image,
    enabled: !busy,
    tapThreshold: 6,
    onComplete: (rect) => {
      if (mode === "crop") setCrop(rect);
    },
    onTap: (point) => {
      if (mode !== "free") return;
      const position = Math.round(axis === "y" ? point.y : point.x);
      setFreeCuts((prev) => [...prev, position]);
    },
  });

  const previewRect = mode === "crop" ? (draft ?? crop) : null;
  const canCrop = !!crop && isUsableRect(crop);

  return (
    <div className="space-y-4">
      <StationHint t={t}>
        {mode === "equal" && "填份數，刀會自己排好；除不盡時餘數分給前面幾段，不會留下一條一像素的尾巴。"}
        {mode === "free" && "在圖上點一下就下一刀，點幾刀就切幾段。"}
        {mode === "crop" && "拖一個框，套用之後只留下框裡面那塊。"}
      </StationHint>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <ImageStage
          image={image}
          ref={ref}
          handlers={handlers}
          cursor={mode === "crop" ? "cell" : mode === "free" ? "crosshair" : "default"}
        >
          {mode !== "crop" &&
            cuts.map((cut) => (
              <div
                key={cut}
                style={{
                  position: "absolute",
                  background: "var(--accent)",
                  pointerEvents: "none",
                  ...(axis === "y"
                    ? {
                        left: 0,
                        right: 0,
                        top: percent(cut, image.height),
                        height: 2,
                        marginTop: -1,
                      }
                    : {
                        top: 0,
                        bottom: 0,
                        left: percent(cut, image.width),
                        width: 2,
                        marginLeft: -1,
                      }),
                }}
              />
            ))}

          {previewRect && (
            <div
              style={{
                position: "absolute",
                left: percent(previewRect.x, image.width),
                top: percent(previewRect.y, image.height),
                width: percent(previewRect.width, image.width),
                height: percent(previewRect.height, image.height),
                border: "2px dashed var(--accent)",
                // 框外壓暗,一眼看得出哪塊會被留下
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                pointerEvents: "none",
              }}
            />
          )}
        </ImageStage>

        <div className="space-y-4">
          <Field label="模式" t={t}>
            <Segmented
              value={mode}
              onChange={setMode}
              t={t}
              options={[
                { value: "equal", label: "等分切" },
                { value: "free", label: "自由下刀" },
                { value: "crop", label: "框選裁切" },
              ]}
            />
          </Field>

          {mode !== "crop" && (
            <Field label="方向" t={t}>
              <Segmented
                value={axis}
                onChange={(next) => {
                  setAxis(next);
                  setFreeCuts([]);
                }}
                t={t}
                options={[
                  { value: "y", label: "橫刀（分上下）" },
                  { value: "x", label: "直刀（分左右）" },
                ]}
              />
            </Field>
          )}

          {mode === "equal" && (
            <Field label="切成幾份" t={t}>
              <NumberField
                value={parts}
                onChange={(value) => setParts(Math.max(1, Math.round(value)))}
                min={1}
                max={50}
                label="切成幾份"
                t={t}
              />
            </Field>
          )}

          {mode === "free" && (
            <div className={`rounded-xl border p-3 text-xs ${t.subPanel}`}>
              <p className="mb-2 tracking-[0.04em]">
                已下 {cuts.length} 刀，會切成 {countPieces(cuts, total)} 段
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  tone="secondary"
                  t={t}
                  onClick={() => setFreeCuts((prev) => prev.slice(0, -1))}
                  disabled={freeCuts.length === 0 || busy}
                >
                  收回上一刀
                </ActionButton>
                <ActionButton
                  tone="secondary"
                  t={t}
                  onClick={() => setFreeCuts([])}
                  disabled={freeCuts.length === 0 || busy}
                >
                  全部收回
                </ActionButton>
              </div>
            </div>
          )}

          {mode !== "crop" && (
            <div className={`rounded-xl border p-3 text-xs leading-6 ${t.subPanel}`}>
              <p className="tracking-[0.04em]">切出來的尺寸</p>
              <ul className={`mt-1 space-y-0.5 ${t.muted}`}>
                {spans.slice(0, 8).map((span, index) => (
                  <li key={`${span.start}-${span.size}`}>
                    {index + 1}：
                    {axis === "y"
                      ? `${image.width} × ${span.size}`
                      : `${span.size} × ${image.height}`}
                  </li>
                ))}
                {spans.length > 8 && <li>……共 {spans.length} 段</li>}
              </ul>
            </div>
          )}

          {mode === "crop" ? (
            <>
              {crop && (
                <p className={`text-xs ${t.muted}`}>
                  會留下 {crop.width} × {crop.height}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  t={t}
                  onClick={() => crop && onCrop(crop)}
                  disabled={!canCrop || busy}
                >
                  裁切
                </ActionButton>
                <ActionButton
                  tone="secondary"
                  t={t}
                  onClick={() => setCrop(null)}
                  disabled={!crop || busy}
                >
                  清掉框
                </ActionButton>
              </div>
            </>
          ) : (
            <ActionButton
              t={t}
              onClick={() => onSlice(spans, axis)}
              disabled={cuts.length === 0 || busy}
            >
              切成 {spans.length} 段
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
