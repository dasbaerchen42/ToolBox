"use client";

// 放字:像限時動態那樣在圖上放幾段字。
// 點圖片空白處新增一段;拖字移動;拖右下角圓點同時旋轉、縮放;右邊打字、改樣式。
// 字是畫在疊在圖上的 canvas,用的是跟套用時同一個 drawTextLayer,看到的就是輸出的。
// 按「把字壓到圖上」之前原圖都沒被改動。

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { FONT_OPTIONS } from "@/lib/editor-font";
import type { FontFamilyName } from "@/lib/preferences";
import { canvasFontFamily, ensureFancyFallback } from "@/lib/web-fonts";
import { convertFancy, getFontResults } from "@/app/tools/_lib/fancy-fonts";
import {
  dragHandle,
  drawTextLayer,
  fontString,
  handlePoint,
  hitTextLayer,
  layoutTextLayer,
  newTextLayer,
  type TextBackdrop,
  type TextBox,
  type TextLayer,
} from "@/lib/tools/image/text";
import type { Point, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import ImageStage, { percent, pointFromEvent } from "./ImageStage";
import { ToolPane } from "./WorkbenchLayout";
import { ActionButton, ColorField, Field, RangeField, Segmented, StationHint, Toggle } from "./controls";

/** 預覽 canvas 最寬畫到這麼寬,大圖不必整張原解析度重畫 */
const PREVIEW_MAX = 1600;

const SWATCHES = ["#ffffff", "#111111", "#e0574f", "#f2c94c", "#5cba8a", "#4a8fe0", "#e0679f", "#9372d8"];

type Drag =
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "handle"; id: string; start: Point; startLayer: Pick<TextLayer, "size" | "rotation"> };

type Props = {
  image: WorkImage;
  busy: boolean;
  t: ThemeClasses;
  onApply: (layers: TextLayer[], families: Record<string, string>) => void;
};

/** 畫的時候用的樣子:選了英文花體就先把字母換掉(打字的地方還是原本的字) */
function shown(layer: TextLayer): TextLayer {
  return layer.fancy ? { ...layer, text: convertFancy(layer.text, layer.fancy) } : layer;
}

/** 花體選單:用 Abc 當示範 */
const FANCY_OPTIONS = getFontResults("Abc 123").map((result) => ({ key: result.key, label: `${result.label}　${result.value}` }));

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== "undefined") measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

export default function TextTool({ image, busy, t, onApply }: Props) {
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 每段字已經換成真實字體名稱的 font-family(字載好了才會有) */
  const [families, setFamilies] = useState<Record<string, string>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<Drag | null>(null);
  const counter = useRef(0);

  const selected = layers.find((layer) => layer.id === selectedId) ?? null;
  const scale = Math.min(1, PREVIEW_MAX / image.width);

  // 字體:每段字用到的字(含粗細)都先載好,才不會畫成備援字體
  const fontKey = layers.map((l) => `${l.id}|${l.font}|${l.bold}|${l.fancy ?? ""}|${l.text}`).join("\n");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void Promise.all(
        layers.map(async (layer) => {
          const text = shown(layer).text;
          let family = await canvasFontFamily(layer.font, text, layer.bold ? 700 : 400);
          // 花體字母不在一般字型裡,接上數學、符號字型補位
          if (layer.fancy) family = `${family}, ${await ensureFancyFallback(text)}`;
          return [layer.id, family] as const;
        })
      ).then((entries) => {
        if (!cancelled) setFamilies(Object.fromEntries(entries));
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontKey 已經涵蓋會影響字體的欄位
  }, [fontKey]);

  const familyOf = (layer: TextLayer) => families[layer.id] ?? "sans-serif";

  /** 每段字的大小(含底色內距),框選、點選、把手位置都用這個 */
  const boxes = useMemo(() => {
    const ctx = measurer();
    const map = new Map<string, TextBox>();
    if (!ctx) return map;
    for (const layer of layers) {
      ctx.font = fontString(layer, families[layer.id] ?? "sans-serif");
      map.set(layer.id, layoutTextLayer(shown(layer), (text) => ctx.measureText(text)));
    }
    return map;
  }, [layers, families]);

  // 預覽:疊在圖上的透明 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const layer of layers) drawTextLayer(ctx, shown(layer), families[layer.id] ?? "sans-serif", scale);
  }, [layers, families, image.width, image.height, scale]);

  function update(id: string, patch: Partial<TextLayer>) {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function addAt(point: Point) {
    counter.current += 1;
    const id = `text-${Date.now()}-${counter.current}`;
    // 新的一段沿用上一段的樣式(字體、顏色、底色),連續放字比較快
    const last = selected ?? layers[layers.length - 1];
    const base = last
      ? { font: last.font, bold: last.bold, color: last.color, align: last.align, backdrop: last.backdrop, backdropColor: last.backdropColor, stroke: last.stroke, strokeColor: last.strokeColor, shadow: last.shadow, size: last.size, fancy: last.fancy }
      : undefined;
    const layer = newTextLayer(id, point, image, base);
    setLayers((prev) => [...prev, layer]);
    setSelectedId(id);
    // 直接進入打字:把預設的提示字全選起來,一打就換掉
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.select();
    });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage || busy || event.button !== 0) return;
    const p = pointFromEvent(stage, event, image);
    const target = event.target as HTMLElement;

    if (target.dataset.handle && selected) {
      stage.setPointerCapture(event.pointerId);
      drag.current = { kind: "handle", id: selected.id, start: p, startLayer: { size: selected.size, rotation: selected.rotation } };
      return;
    }
    if (target.dataset.remove) return;

    // 從最上面那段往下找
    const hit = [...layers].reverse().find((layer) => {
      const box = boxes.get(layer.id);
      return box && hitTextLayer(layer, box, p);
    });
    if (hit) {
      setSelectedId(hit.id);
      stage.setPointerCapture(event.pointerId);
      drag.current = { kind: "move", id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y };
      return;
    }
    // 點空白處:有選著的就先取消選取,沒有才新增(避免手滑一直多出字)
    if (selected) setSelectedId(null);
    else addAt(p);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    const current = drag.current;
    if (!stage || !current) return;
    const p = pointFromEvent(stage, event, image);
    if (current.kind === "move") {
      update(current.id, {
        x: Math.round(Math.min(image.width, Math.max(0, p.x - current.dx))),
        y: Math.round(Math.min(image.height, Math.max(0, p.y - current.dy))),
      });
    } else {
      const layer = layers.find((l) => l.id === current.id);
      if (layer) update(current.id, dragHandle(layer, current.startLayer, current.start, p));
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null;
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  }

  function remove(id: string) {
    setLayers((prev) => prev.filter((layer) => layer.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicate(layer: TextLayer) {
    counter.current += 1;
    const id = `text-${Date.now()}-${counter.current}`;
    const offset = layer.size * 0.8;
    setLayers((prev) => [...prev, { ...layer, id, x: Math.min(image.width, layer.x + offset), y: Math.min(image.height, layer.y + offset) }]);
    setSelectedId(id);
  }

  const selectedBox = selected ? boxes.get(selected.id) : undefined;
  const handle = selected && selectedBox ? handlePoint(selected, selectedBox) : null;

  return (
    <ToolPane
      workspace={
        <ImageStage
          image={image}
          ref={stageRef}
          cursor="text"
          handlers={{ onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }}
        >
          <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />

          {/* 選取框:跟著字一起轉 */}
          {selected && selectedBox && (
            <div
              className="pointer-events-none absolute border-2 border-dashed"
              style={{
                left: percent(selected.x, image.width),
                top: percent(selected.y, image.height),
                width: percent(selectedBox.width + selected.size * 0.4, image.width),
                height: percent(selectedBox.height + selected.size * 0.3, image.height),
                transform: `translate(-50%, -50%) rotate(${selected.rotation}deg)`,
                borderColor: "var(--accent)",
              }}
            >
              <button
                type="button"
                data-remove="1"
                aria-label="刪掉這段字"
                onClick={() => remove(selected.id)}
                className="pointer-events-auto absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-(--accent) text-xs text-(--on-accent) shadow"
              >
                ✕
              </button>
            </div>
          )}
          {handle && (
            <div
              data-handle="1"
              title="拖這個圓點旋轉、縮放"
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-white bg-(--accent) shadow"
              style={{ left: percent(handle.x, image.width), top: percent(handle.y, image.height) }}
            />
          )}
        </ImageStage>
      }
      controls={
        <>
          <StationHint t={t}>
            點圖片空白處新增一段字；拖曳字可以移動，拖右下角的圓點旋轉、縮放。按「把字壓到圖上」之前原圖都不會變。
          </StationHint>

          {selected ? (
            <>
              <Field label="文字" hint="可以換行" t={t}>
                <textarea
                  ref={textRef}
                  value={selected.text}
                  onChange={(event) => update(selected.id, { text: event.target.value })}
                  rows={3}
                  className={`w-full resize-y rounded-xl border px-3 py-2 text-sm ${t.input}`}
                />
              </Field>

              <Field label="字體" t={t}>
                <div className="flex gap-2">
                  <select
                    value={selected.font}
                    onChange={(event) => update(selected.id, { font: event.target.value as FontFamilyName })}
                    aria-label="字體"
                    className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm ${t.input}`}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font.key} value={font.key}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                  <Toggle checked={selected.bold} onChange={(bold) => update(selected.id, { bold })} label="粗體" t={t} />
                </div>
              </Field>

              <Field label="英文花體" hint="只換英文字母和數字，中文不變；跟社群轉換區同一套" t={t}>
                <select
                  value={selected.fancy ?? ""}
                  onChange={(event) => update(selected.id, { fancy: event.target.value || null })}
                  aria-label="英文花體"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                >
                  <option value="">不轉換</option>
                  {FANCY_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="文字顏色" t={t}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`字色 ${color}`}
                      onClick={() => update(selected.id, { color })}
                      className="h-7 w-7 rounded-full border-2"
                      style={{ background: color, borderColor: selected.color === color ? "var(--accent)" : "rgba(128,128,128,0.4)" }}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <ColorField value={selected.color} onChange={(color) => update(selected.id, { color })} t={t} />
                </div>
              </Field>

              <Field label="對齊" t={t}>
                <Segmented
                  value={selected.align}
                  onChange={(align) => update(selected.id, { align })}
                  t={t}
                  label="對齊"
                  options={[
                    { value: "left", label: "靠左" },
                    { value: "center", label: "置中" },
                    { value: "right", label: "靠右" },
                  ]}
                />
              </Field>

              <Field label="文字底" t={t}>
                <Segmented
                  value={selected.backdrop}
                  onChange={(backdrop: TextBackdrop) => update(selected.id, { backdrop, ...(backdrop !== "none" ? { shadow: false } : {}) })}
                  t={t}
                  label="文字底"
                  options={[
                    { value: "none", label: "無" },
                    { value: "line", label: "每行色塊" },
                    { value: "block", label: "半透明底" },
                  ]}
                />
                {selected.backdrop !== "none" && (
                  <div className="mt-2">
                    <ColorField value={selected.backdropColor} onChange={(backdropColor) => update(selected.id, { backdropColor })} t={t} />
                  </div>
                )}
              </Field>

              <RangeField
                label="字級"
                display={`${selected.size}px`}
                value={selected.size}
                min={8}
                max={Math.max(64, Math.round(Math.min(image.width, image.height) * 0.4))}
                step={1}
                onChange={(size) => update(selected.id, { size })}
                t={t}
              />
              <RangeField
                label="旋轉"
                display={`${Math.round(selected.rotation)}°`}
                value={selected.rotation}
                min={-180}
                max={180}
                step={1}
                onChange={(rotation) => update(selected.id, { rotation })}
                t={t}
              />

              <div className={`space-y-3 rounded-xl border p-3 ${t.subPanel}`}>
                <RangeField
                  label="描邊"
                  display={selected.stroke > 0 ? `${Math.round(selected.stroke * 100)}%` : "不描"}
                  value={selected.stroke}
                  min={0}
                  max={0.25}
                  step={0.01}
                  onChange={(stroke) => update(selected.id, { stroke })}
                  t={t}
                />
                {selected.stroke > 0 && <ColorField value={selected.strokeColor} onChange={(strokeColor) => update(selected.id, { strokeColor })} t={t} />}
                <Toggle checked={selected.shadow} onChange={(shadow) => update(selected.id, { shadow })} label="陰影（淺色底上字比較清楚）" t={t} />
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton tone="secondary" t={t} onClick={() => duplicate(selected)}>
                  複製這段
                </ActionButton>
                <ActionButton tone="secondary" t={t} onClick={() => remove(selected.id)}>
                  刪掉這段
                </ActionButton>
              </div>
            </>
          ) : (
            <p className={`text-xs leading-6 ${t.muted}`}>
              {layers.length === 0 ? "還沒有字。點圖片上任何地方開始。" : `已經放了 ${layers.length} 段字。點字可以再改，點空白處新增一段。`}
            </p>
          )}

          {layers.length > 0 && (
            <ActionButton t={t} onClick={() => onApply(layers.map(shown), Object.fromEntries(layers.map((l) => [l.id, familyOf(l)])))} disabled={busy}>
              把字壓到圖上（{layers.length} 段）
            </ActionButton>
          )}
        </>
      }
    />
  );
}
