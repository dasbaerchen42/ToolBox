"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { artKey, clampPlacement, DESIGN_SIZE, type AcrylicDesign } from "@/lib/tools/merch/design";
import { applyHomography, homography, isConvex, rectQuad, type Quad } from "@/lib/tools/merch/perspective";
import { acrylicArea, acrylicBoardSize, drawAcrylicBoard, drawAcrylicScene, type Art } from "@/lib/tools/merch/render";
import { drawSelection, hitPlaced } from "./PlacedControls";
import { useDesignCanvas } from "./useDesignCanvas";

const { width: W, height: H } = DESIGN_SIZE.acrylic;
/** 角落把手的半徑(CSS 像素),手指也按得到 */
const HANDLE = 16;

type Drag = { kind: "corner"; index: number } | { kind: "sticker"; id: string; dx: number; dy: number };

/**
 * 透卡／打卡棒:照片當背景,拖四個角讓板子傾斜;
 * 點板子上的貼紙可以選取、拖曳(指標位置用反透視換回板子上的座標)。
 */
export default function AcrylicStage({
  design,
  onChange,
  photo,
  arts,
  selected,
  onSelect,
  active,
}: {
  design: AcrylicDesign;
  onChange: (design: AcrylicDesign) => void;
  photo: ImageBitmap | null;
  arts: Map<string, Art>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  active: boolean;
}) {
  const { ref, paint, toDesign, style, size } = useDesignCanvas(W, H);
  const drag = useRef<Drag | null>(null);

  // 板子攤平的樣子:選取框畫在板子上,跟著一起透視
  const board = useMemo(() => {
    const { width, height } = acrylicBoardSize(design);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawAcrylicBoard(ctx, design, arts);
      const placed = design.stickers.find((item) => item.id === selected);
      const art = placed && arts.get(artKey(placed));
      if (placed && art) drawSelection(ctx, placed, art, acrylicArea(design));
    }
    return canvas;
  }, [design, arts, selected]);

  const corners = useMemo(() => design.corners.map((p) => ({ x: p.x * W, y: p.y * H })) as Quad, [design.corners]);

  const draw = useCallback(() => {
    paint((ctx) => {
      drawAcrylicScene(ctx, W, H, design, photo, board);
      // 四個角的把手
      ctx.save();
      for (const p of corners) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
        ctx.stroke();
      }
      ctx.restore();
    });
  }, [paint, design, photo, board, corners]);

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [active, draw, size]);

  /** 畫面座標 → 板子攤平時的座標 */
  const toBoard = (p: { x: number; y: number }) => {
    const { width, boardHeight } = acrylicBoardSize(design);
    return applyHomography(homography(corners, rectQuad(0, 0, width, boardHeight)), p);
  };

  return (
    <canvas
      ref={ref}
      style={style}
      className="touch-none rounded-2xl"
      aria-label="透卡預覽：拖四個角讓板子傾斜，拖曳移動貼紙"
      onPointerDown={(event) => {
        const p = toDesign(event);
        const corner = corners.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) <= HANDLE * 1.6 * p.scale);
        if (corner >= 0) {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { kind: "corner", index: corner };
          return;
        }
        const q = toBoard(p);
        const area = acrylicArea(design);
        const hit = hitPlaced(design.stickers, arts, area, q);
        onSelect(hit?.id ?? null);
        if (!hit) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { kind: "sticker", id: hit.id, dx: q.x / area.width - hit.x, dy: q.y / area.height - hit.y };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const p = toDesign(event);
        if (current.kind === "corner") {
          const next = design.corners.map((c, i) =>
            i === current.index
              ? { x: Math.min(1, Math.max(0, p.x / W)), y: Math.min(1, Math.max(0, p.y / H)) }
              : c
          ) as Quad;
          // 拖成蝴蝶結或凹進去就不收,板子停在上一個合理的樣子
          if (isConvex(next)) onChange({ ...design, corners: next });
          return;
        }
        const q = toBoard(p);
        const area = acrylicArea(design);
        const next = clampPlacement(q.x / area.width - current.dx, q.y / area.height - current.dy);
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
