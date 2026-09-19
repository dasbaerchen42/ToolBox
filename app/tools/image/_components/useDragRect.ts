"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clampRect, rectFromPoints } from "@/lib/tools/image/geometry";
import type { Point, Rect, Size } from "@/lib/tools/image/types";
import { pointFromEvent } from "./ImageStage";
import type { StagePointerHandlers } from "./ImageStage";

type Options = {
  /** 原圖尺寸,拖出來的框會被壓在這個範圍內 */
  size: Size;
  enabled?: boolean;
  onComplete: (rect: Rect) => void;
  /** 只點一下沒有拖出面積時觸發(滴管、下刀都走這條) */
  onTap?: (point: Point) => void;
  /** 小於這個邊長就算「點一下」而不是拖曳;觸控比滑鼠容易晃,要放寬一點 */
  tapThreshold?: number;
};

/**
 * 在圖上拖出一個矩形。
 *
 * 用 setPointerCapture,所以拖到圖外面再放開也不會斷,
 * 框會被 clampRect 壓回圖片範圍內。
 */
export function useDragRect({
  size,
  enabled = true,
  onComplete,
  onTap,
  tapThreshold = 2,
}: Options) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<Point | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    const origin = start.current;
    start.current = null;
    setDraft(null);

    if (!element || !origin) return;
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    const current = pointFromEvent(element, event, size);
    const rect = clampRect(rectFromPoints(origin, current), size);

    // 沒拖出面積就當成單純點一下
    if (rect.width < tapThreshold && rect.height < tapThreshold) {
      onTap?.(clampPoint(origin, size));
      return;
    }

    onComplete(rect);
  };

  const handlers: StagePointerHandlers = {
    onPointerDown: (event) => {
      const element = ref.current;
      if (!enabled || !element || event.button !== 0) return;
      // 疊加層上的拖動(例如搬遮罩)由它自己處理,別在底下再開一個新框
      if (event.target !== element && event.target !== element.firstElementChild) {
        return;
      }

      element.setPointerCapture(event.pointerId);
      const point = pointFromEvent(element, event, size);
      start.current = point;
      setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
    },

    onPointerMove: (event) => {
      const element = ref.current;
      const origin = start.current;
      if (!element || !origin) return;

      const current = pointFromEvent(element, event, size);
      setDraft(clampRect(rectFromPoints(origin, current), size));
    },

    onPointerUp: finish,
    onPointerCancel: finish,
  };

  return { ref, handlers, draft };
}

function clampPoint(point: Point, size: Size): Point {
  return {
    x: Math.min(Math.max(point.x, 0), size.width),
    y: Math.min(Math.max(point.y, 0), size.height),
  };
}
