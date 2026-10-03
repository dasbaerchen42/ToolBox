"use client";

import { useCallback, useEffect, useRef } from "react";
import { artKey, clampPlacement, DESIGN_SIZE, type CardDesign } from "@/lib/tools/merch/design";
import { cardArea, drawCard, type Art } from "@/lib/tools/merch/render";
import { drawSelection, hitPlaced } from "./PlacedControls";
import { useDesignCanvas } from "./useDesignCanvas";

const { width: W, height: H } = DESIGN_SIZE.card;

/**
 * 小卡套的畫面。滑鼠在卡上移動(或手機傾斜)時雷射彩虹跟著流動;
 * 點貼紙選取、拖曳移動。
 */
export default function CardStage({
  design,
  onChange,
  photo,
  arts,
  selected,
  onSelect,
  active,
}: {
  design: CardDesign;
  onChange: (design: CardDesign) => void;
  photo: ImageBitmap | null;
  arts: Map<string, Art>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  active: boolean;
}) {
  const { ref, paint, toDesign, style, size } = useDesignCanvas(W, H);
  const angle = useRef(0.7);
  const frame = useRef(0);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const draw = useCallback(() => {
    paint((ctx) => {
      drawCard(ctx, W, H, design, { photo, arts }, angle.current);
      const placed = design.stickers.find((item) => item.id === selected);
      const art = placed && arts.get(artKey(placed));
      if (placed && art) drawSelection(ctx, placed, art, cardArea(W, H));
    });
  }, [paint, design, photo, arts, selected]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    if (active) schedule();
    return () => cancelAnimationFrame(frame.current);
  }, [active, schedule, size]);

  // 手機傾斜:左右傾(gamma)與前後傾(beta)換成雷射的角度
  useEffect(() => {
    if (!active) return;
    const handle = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      angle.current = Math.atan2(event.beta - 45, event.gamma) + Math.PI;
      schedule();
    };
    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [active, schedule]);

  return (
    <canvas
      ref={ref}
      style={style}
      className="touch-none rounded-[18px]"
      aria-label="小卡套預覽：移動滑鼠看雷射膜，拖曳移動貼紙"
      onPointerDown={(event) => {
        const p = toDesign(event);
        const area = cardArea(W, H);
        const hit = hitPlaced(design.stickers, arts, area, p);
        onSelect(hit?.id ?? null);
        if (!hit) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          id: hit.id,
          dx: (p.x - area.x) / area.width - hit.x,
          dy: (p.y - area.y) / area.height - hit.y,
        };
      }}
      onPointerMove={(event) => {
        const p = toDesign(event);
        angle.current = Math.atan2(p.y - H / 2, p.x - W / 2) * 1.5;
        const current = drag.current;
        if (!current) {
          schedule();
          return;
        }
        const area = cardArea(W, H);
        const next = clampPlacement((p.x - area.x) / area.width - current.dx, (p.y - area.y) / area.height - current.dy);
        onChange({
          ...design,
          stickers: design.stickers.map((item) => (item.id === current.id ? { ...item, ...next } : item)),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
