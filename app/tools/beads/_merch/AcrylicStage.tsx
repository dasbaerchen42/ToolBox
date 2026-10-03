"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { acrylicLayout, buildAcrylic, drawAcrylicScene, sceneQuad, sceneSize, type AcrylicPiece } from "@/lib/tools/merch/acrylic";
import { placementQuad, tiltFromCorner, type Point } from "@/lib/tools/merch/acrylic-shape";
import { isConvex } from "@/lib/tools/merch/perspective";
import { artKey, clampPlacement, type AcrylicDesign } from "@/lib/tools/merch/design";
import type { Art } from "@/lib/tools/merch/render";
import { drawSelection, hitPlaced } from "./PlacedControls";
import { useDesignCanvas } from "./useDesignCanvas";

/** 預覽用的解析度倍率;拖貼紙時外形每一步都要重算,先用粗一點的,放開再算清楚 */
const PREVIEW_SCALE = 0.75;
const DRAFT_SCALE = 0.4;
/** 角落把手的半徑(CSS 像素),手指也按得到 */
const HANDLE = 16;

export type AcrylicView = "edit" | "scene";

type Drag =
  | { kind: "corner"; index: number }
  | { kind: "move"; dx: number; dy: number }
  | { kind: "sticker"; id: string; dx: number; dy: number };

/** 點在凸四邊形裡面嗎(四條邊同一側) */
function insideQuad(q: Point[], p: Point): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** 淡淡的棋盤格:看得出哪裡是透明的 */
function drawChecker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#eceae4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e0ddd5";
  const s = 24;
  for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s : 0; x < w; x += s * 2) ctx.fillRect(x, y, s, s);
}

/**
 * 透卡／打卡棒。
 * edit:壓克力攤平,拖貼紙排版(外形跟著圖案即時重算);
 * scene:放到照片上,拖板子移動、拖四個角傾斜,透明的地方看得到後面的照片。
 */
export default function AcrylicStage({
  design,
  onChange,
  photo,
  arts,
  selected,
  onSelect,
  view,
  active,
}: {
  design: AcrylicDesign;
  onChange: (design: AcrylicDesign) => void;
  photo: ImageBitmap | null;
  arts: Map<string, Art>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  view: AcrylicView;
  active: boolean;
}) {
  const [draft, setDraft] = useState(false);
  const piece = useMemo<AcrylicPiece>(() => buildAcrylic(design, arts, draft ? DRAFT_SCALE : PREVIEW_SCALE), [design, arts, draft]);
  const scene = sceneSize(photo);
  // 攤平編輯時畫布就是整片(未裁切)的大小;照設計算,不照畫出來的圖,換解析度時畫面才不會跳
  const layout = acrylicLayout(design);
  const area = layout.area;
  const W = view === "edit" ? layout.width : scene.width;
  const H = view === "edit" ? layout.height : scene.height;
  const { ref, paint, toDesign, style, size } = useDesignCanvas(W, H);
  const drag = useRef<Drag | null>(null);
  const endDrag = () => {
    drag.current = null;
    setDraft(false);
  };
  const quad = useMemo(() => sceneQuad(piece, design.place, scene.width, scene.height), [piece, design.place, scene.width, scene.height]);
  const aspect = piece.canvas.width / piece.canvas.height;

  const draw = useCallback(() => {
    paint((ctx) => {
      if (view === "edit") {
        drawChecker(ctx, W, H);
        ctx.drawImage(piece.full, 0, 0, W, H);
        const placed = design.stickers.find((item) => item.id === selected);
        const art = placed && arts.get(artKey(placed));
        if (placed && art) drawSelection(ctx, placed, art, area);
        return;
      }
      drawAcrylicScene(ctx, W, H, photo, piece, quad, design.clarity);
      ctx.save();
      for (const p of quad) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.stroke();
      }
      ctx.restore();
    });
  }, [paint, view, W, H, piece, design.stickers, design.clarity, selected, arts, area, photo, quad]);

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [active, draw, size]);

  return (
    <canvas
      ref={ref}
      style={style}
      className="touch-none rounded-2xl"
      aria-label={view === "edit" ? "壓克力攤平編輯：拖曳移動圖案" : "放到照片上：拖曳移動，拖四個角傾斜"}
      onPointerDown={(event) => {
        const p = toDesign(event);
        if (view === "edit") {
          const hit = hitPlaced(design.stickers, arts, area, p);
          onSelect(hit?.id ?? null);
          if (!hit) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { kind: "sticker", id: hit.id, dx: (p.x - area.x) / area.width - hit.x, dy: (p.y - area.y) / area.height - hit.y };
          setDraft(true);
          return;
        }
        const corner = quad.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) <= HANDLE * 1.6 * p.scale);
        if (corner >= 0) {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { kind: "corner", index: corner };
          return;
        }
        if (insideQuad(quad, p)) {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { kind: "move", dx: p.x / W - design.place.x, dy: p.y / H - design.place.y };
        }
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const p = toDesign(event);
        if (current.kind === "sticker") {
          const next = clampPlacement((p.x - area.x) / area.width - current.dx, (p.y - area.y) / area.height - current.dy);
          onChange({ ...design, stickers: design.stickers.map((item) => (item.id === current.id ? { ...item, ...next } : item)) });
        } else if (current.kind === "move") {
          const x = Math.min(1.1, Math.max(-0.1, p.x / W - current.dx));
          const y = Math.min(1.1, Math.max(-0.1, p.y / H - current.dy));
          onChange({ ...design, place: { ...design.place, x, y } });
        } else {
          const tilt = tiltFromCorner(design.place, aspect, W, H, current.index, p);
          // 拖成蝴蝶結或凹進去就不收,板子停在上一個合理的樣子
          const next = { ...design.place, tilt };
          if (isConvex(placementQuad(next, aspect, W, H))) onChange({ ...design, place: next });
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
