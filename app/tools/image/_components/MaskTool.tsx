"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { moveRectWithin } from "@/lib/tools/image/geometry";
import type { MaskRect, Point, WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import ImageStage, { percent, pointFromEvent } from "./ImageStage";
import { useDragRect } from "./useDragRect";
import { ToolPane } from "./WorkbenchLayout";
import { ActionButton, ColorField, Field, Segmented, StationHint } from "./controls";

type Mode = "draw" | "pick";

type Props = {
  image: WorkImage;
  busy: boolean;
  t: ThemeClasses;
  onApply: (masks: MaskRect[]) => void;
  onPickColor: (point: Point) => Promise<string>;
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 遮罩塗佈區。
 *
 * 編輯期間遮罩只是一組矩形資料,原圖完全沒動,所以可以隨便搬、隨便刪。
 * 按下「套用」才把色塊真的畫進像素裡——輸出檔裡原本的內容是真的不見了,
 * 不是蓋一層可以被撕掉的東西。
 */
export default function MaskTool({ image, busy, t, onApply, onPickColor }: Props) {
  const [masks, setMasks] = useState<MaskRect[]>([]);
  const [mode, setMode] = useState<Mode>("draw");
  const [color, setColor] = useState("#1f1f1f");
  const [activeId, setActiveId] = useState<string | null>(null);
  const moving = useRef<{ id: string; origin: Point; rect: MaskRect } | null>(null);

  const { ref, handlers, draft } = useDragRect({
    size: image,
    enabled: !busy,
    onComplete: (rect) => {
      if (mode === "pick") return;
      const mask = { ...rect, id: createId(), color };
      setMasks((prev) => [...prev, mask]);
      setActiveId(mask.id);
    },
    onTap: (point) => {
      if (mode !== "pick") {
        setActiveId(null);
        return;
      }
      void onPickColor(point).then(setColor);
    },
  });

  function startMove(event: ReactPointerEvent<HTMLDivElement>, mask: MaskRect) {
    if (busy || mode === "pick") return;
    const element = ref.current;
    if (!element) return;

    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setActiveId(mask.id);
    moving.current = {
      id: mask.id,
      origin: pointFromEvent(element, event, image),
      rect: mask,
    };
  }

  function onMove(event: ReactPointerEvent<HTMLDivElement>) {
    const element = ref.current;
    const state = moving.current;
    if (!element || !state) return;

    const current = pointFromEvent(element, event, image);
    const delta = {
      x: current.x - state.origin.x,
      y: current.y - state.origin.y,
    };

    setMasks((prev) =>
      prev.map((mask) =>
        mask.id === state.id
          ? { ...mask, ...moveRectWithin(state.rect, delta, image) }
          : mask
      )
    );
  }

  function endMove(event: ReactPointerEvent<HTMLDivElement>) {
    const element = event.currentTarget as HTMLElement;
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    moving.current = null;
  }

  const removeActive = () => {
    if (!activeId) return;
    setMasks((prev) => prev.filter((mask) => mask.id !== activeId));
    setActiveId(null);
  };

  return (
    <ToolPane
      workspace={
        <ImageStage
          image={image}
          ref={ref}
          handlers={handlers}
          cursor={mode === "pick" ? "crosshair" : "cell"}
        >
          {masks.map((mask) => (
            <div
              key={mask.id}
              onPointerDown={(event) => startMove(event, mask)}
              onPointerMove={onMove}
              onPointerUp={endMove}
              onPointerCancel={endMove}
              style={{
                position: "absolute",
                left: percent(mask.x, image.width),
                top: percent(mask.y, image.height),
                width: percent(mask.width, image.width),
                height: percent(mask.height, image.height),
                background: mask.color,
                touchAction: "none",
                cursor: mode === "pick" ? "crosshair" : "move",
                outline: mask.id === activeId ? "2px dashed var(--accent)" : "none",
                outlineOffset: "1px",
              }}
            />
          ))}

          {draft && mode === "draw" && (
            <div
              style={{
                position: "absolute",
                left: percent(draft.x, image.width),
                top: percent(draft.y, image.height),
                width: percent(draft.width, image.width),
                height: percent(draft.height, image.height),
                background: color,
                opacity: 0.7,
                pointerEvents: "none",
              }}
            />
          )}
        </ImageStage>
      }
      controls={
        <>
          <StationHint t={t}>
            在圖上拖一個框就是一塊遮罩，拖框裡面可以搬動它。按「套用」之前原圖都沒被改動；
            套用之後色塊是真的畫進像素裡的，蓋掉的內容不會留在檔案裡。
          </StationHint>

          <Field label="操作" t={t}>
            <Segmented
              value={mode}
              onChange={setMode}
              t={t}
              options={[
                { value: "draw", label: "畫遮罩" },
                { value: "pick", label: "滴管取色" },
              ]}
            />
          </Field>

          <Field
            label="遮罩顏色"
            hint="文字截圖用滴管吸一下底色，蓋起來會像原本就是空白的"
            t={t}
          >
            <ColorField value={color} onChange={setColor} t={t} />
          </Field>

          <div className={`rounded-xl border p-3 text-xs ${t.subPanel}`}>
            <p className="mb-2 tracking-[0.04em]">
              目前 {masks.length} 塊遮罩{activeId ? "（已選取 1 塊）" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="secondary"
                t={t}
                onClick={removeActive}
                disabled={!activeId || busy}
              >
                刪除選取
              </ActionButton>
              <ActionButton
                tone="secondary"
                t={t}
                onClick={() => {
                  setMasks([]);
                  setActiveId(null);
                }}
                disabled={masks.length === 0 || busy}
              >
                全部清掉
              </ActionButton>
            </div>
          </div>

          <ActionButton
            t={t}
            onClick={() => onApply(masks)}
            disabled={masks.length === 0 || busy}
          >
            套用遮罩
          </ActionButton>
        </>
      }
    />
  );
}
