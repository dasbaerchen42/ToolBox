"use client";

import { useMemo, useState } from "react";
import {
  countPieces,
  cutsToSpans,
  equalCutPositions,
  normalizeCuts,
  ratioCutPositions,
  ratioPieceLength,
  type Span,
} from "@/lib/tools/image/slice";
import type { SlicePad } from "@/lib/tools/image/render";
import { isUsableRect, largestRatioRect } from "@/lib/tools/image/geometry";
import type { Ratio } from "@/lib/tools/image/frame";
import type { Axis, Rect, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import ImageStage, { percent } from "./ImageStage";
import { useDragRect } from "./useDragRect";
import { ToolPane } from "./WorkbenchLayout";
import { ActionButton, ColorField, Field, NumberField, RatioPicker, Segmented, StationHint, Toggle } from "./controls";

type Mode = "equal" | "ratio" | "free" | "crop";

/** 比例切剩下不夠長的最後一段:補背景到同比例,或維持原樣(比較短) */
type LastPiece = "pad" | "keep";

type Props = {
  image: WorkImage;
  busy: boolean;
  t: ThemeClasses;
  onSlice: (spans: Span[], axis: Axis, pad?: SlicePad) => void;
  onCrop: (rect: Rect) => void;
};

/**
 * 影像切割刀。
 *
 * 四種模式最後都收斂成同一件事:一組切點或一個框。
 * 等分、比例是算出來的切點,自由是點出來的切點,裁切是留一個框,
 * 所以底下只有一套資料結構要維護。
 */
export default function SliceTool({ image, busy, t, onSlice, onCrop }: Props) {
  const [mode, setMode] = useState<Mode>("equal");
  const [axis, setAxis] = useState<Axis>("y");
  const [parts, setParts] = useState(2);
  const [freeCuts, setFreeCuts] = useState<number[]>([]);
  const [crop, setCrop] = useState<Rect | null>(null);
  /** 框選裁切鎖定的比例;null 是不限 */
  const [cropRatio, setCropRatio] = useState<Ratio | null>(null);
  /** 比例切:每一張的比例,張數照圖的長度自己算(跟文轉圖的固定比例分頁一樣) */
  const [sliceRatio, setSliceRatio] = useState<Ratio>({ w: 4, h: 5 });
  const [lastPiece, setLastPiece] = useState<LastPiece>("pad");
  const [padTransparent, setPadTransparent] = useState(false);
  const [padColor, setPadColor] = useState("#ffffff");

  const total = axis === "y" ? image.height : image.width;
  const pieceLength = ratioPieceLength(image, axis, sliceRatio);

  const cuts = useMemo(() => {
    if (mode === "equal") return equalCutPositions(total, parts);
    if (mode === "ratio") return ratioCutPositions(total, pieceLength);
    return normalizeCuts(freeCuts, total);
  }, [mode, total, parts, pieceLength, freeCuts]);

  const spans = useMemo(() => cutsToSpans(cuts, total), [cuts, total]);

  // 比例切的最後一段多半不夠長:差多少、要不要補
  const shortBy = mode === "ratio" ? Math.max(0, pieceLength - (spans.at(-1)?.size ?? pieceLength)) : 0;
  const pad: SlicePad | undefined =
    mode === "ratio" && lastPiece === "pad" && shortBy > 0
      ? { length: pieceLength, background: padTransparent ? null : padColor }
      : undefined;
  const canSlice = cuts.length > 0 || !!pad;

  const changeMode = (next: Mode) => {
    setMode(next);
    // 進比例切時,方向先跟著圖走:比選的比例還長就上下切,比較寬就左右切
    if (next === "ratio") {
      setAxis(image.height * sliceRatio.w >= image.width * sliceRatio.h ? "y" : "x");
    }
  };

  const { ref, handlers, draft } = useDragRect({
    size: image,
    enabled: !busy,
    tapThreshold: 6,
    ratio: mode === "crop" && cropRatio ? cropRatio.w / cropRatio.h : null,
    onComplete: (rect) => {
      if (mode === "crop") setCrop(rect);
    },
    onTap: (point) => {
      if (mode !== "free") return;
      setFreeCuts((prev) => [...prev, Math.round(axis === "y" ? point.y : point.x)]);
    },
  });

  const previewRect = mode === "crop" ? (draft ?? crop) : null;
  const canCrop = !!crop && isUsableRect(crop);

  return (
    <ToolPane
      workspace={
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
      }
      controls={
        <>
          <StationHint t={t}>
            {mode === "equal" &&
              "填份數，刀會自己排好；除不盡時餘數分給前面幾段，不會留下一條一像素的尾巴。"}
            {mode === "ratio" &&
              "選一個比例，長圖會照這個比例一張一張切下來，張數自己算。長截圖要拆成 IG 輪播就用這個。"}
            {mode === "free" && "在圖上點一下就下一刀，點幾刀就切幾段。"}
            {mode === "crop" && "拖一個框，套用之後只留下框裡面那塊。選了比例，拖出來的框就固定是那個比例。"}
          </StationHint>

          <Field label="模式" t={t}>
            <Segmented
              value={mode}
              onChange={changeMode}
              t={t}
              options={[
                { value: "equal", label: "等分切" },
                { value: "ratio", label: "比例切" },
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

          {mode === "crop" && (
            <Field label="比例" t={t}>
              <RatioPicker
                value={cropRatio}
                allowFree
                onChange={(next) => {
                  setCropRatio(next);
                  // 選了比例就先擺一個最大、置中的框,不想調的話直接套用
                  if (next) setCrop(largestRatioRect(image, next.w / next.h));
                }}
                t={t}
              />
            </Field>
          )}

          {mode === "ratio" && (
            <>
              <Field label="每張的比例（寬:高）" t={t}>
                <RatioPicker value={sliceRatio} onChange={(next) => next && setSliceRatio(next)} t={t} />
              </Field>

              {shortBy > 0 && (
                <Field
                  label="最後一張不夠長"
                  hint={`最後一張差 ${shortBy} px 才到選的比例。${
                    lastPiece === "pad" ? "補背景的話原圖貼在開頭，不會被縮放。" : "留原樣的話這張就不是選的比例。"
                  }`}
                  t={t}
                >
                  <Segmented
                    value={lastPiece}
                    onChange={setLastPiece}
                    t={t}
                    options={[
                      { value: "pad", label: "補背景到同比例" },
                      { value: "keep", label: "留原樣" },
                    ]}
                  />
                </Field>
              )}

              {pad && (
                <div className="space-y-2">
                  <Toggle checked={padTransparent} onChange={setPadTransparent} label="補出來的區域保持透明" t={t} />
                  {!padTransparent && <ColorField value={padColor} onChange={setPadColor} t={t} />}
                </div>
              )}
            </>
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
                {spans.slice(0, 8).map((span, index) => {
                  const padded = !!pad && span.size < pad.length;
                  const along = padded ? pad.length : span.size;
                  return (
                    <li key={`${span.start}-${span.size}`}>
                      {index + 1}：
                      {axis === "y" ? `${image.width} × ${along}` : `${along} × ${image.height}`}
                      {padded && `（補 ${pad.length - span.size} px）`}
                    </li>
                  );
                })}
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
              onClick={() => onSlice(spans, axis, pad)}
              disabled={!canSlice || busy}
            >
              切成 {spans.length} 段
            </ActionButton>
          )}
        </>
      }
    />
  );
}
