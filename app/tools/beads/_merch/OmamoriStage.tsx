"use client";

import { useCallback, useEffect, useRef } from "react";
import { DESIGN_SIZE, type OmamoriDesign } from "@/lib/tools/merch/design";
import { drawOmamori, type Art } from "@/lib/tools/merch/render";
import { useDesignCanvas } from "./useDesignCanvas";

const { width: W, height: H } = DESIGN_SIZE.omamori;
const FLIP_MS = 520;

/**
 * 御守。繩結一直輕輕晃,滑過去會被撥動;點一下袋子翻面(或按「翻面」)。
 * 翻面是把寬度從 1 縮到 0 再展開,過半時換成另一面。
 */
export default function OmamoriStage({
  design,
  bell,
  side,
  onFlip,
  active,
}: {
  design: OmamoriDesign;
  bell: Art | null;
  side: "front" | "back";
  onFlip: () => void;
  active: boolean;
}) {
  const { ref, paint, toDesign, style } = useDesignCanvas(W, H);
  const sway = useRef({ angle: 0, velocity: 0 });
  const flip = useRef<{ start: number; from: "front" | "back" } | null>(null);
  const shown = useRef(side);
  const press = useRef<{ x: number; y: number } | null>(null);
  const lastX = useRef<number | null>(null);

  // 外面切換正反面時開始翻轉動畫
  useEffect(() => {
    if (shown.current === side) return;
    flip.current = { start: performance.now(), from: shown.current };
    shown.current = side;
  }, [side]);

  const render = useCallback(
    (now: number) => {
      let face = shown.current;
      let squeeze = 1;
      const f = flip.current;
      if (f) {
        const p = Math.min(1, (now - f.start) / FLIP_MS);
        squeeze = Math.abs(Math.cos(p * Math.PI));
        face = p < 0.5 ? f.from : shown.current;
        if (p >= 1) flip.current = null;
      }
      paint((ctx) => {
        ctx.translate(W / 2, 0);
        ctx.scale(Math.max(0.02, squeeze), 1);
        ctx.translate(-W / 2, 0);
        drawOmamori(ctx, W, H, design, face, sway.current.angle, bell);
      });
    },
    [paint, design, bell]
  );

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const s = sway.current;
      // 單擺:回復力 + 阻尼 + 一點點一直在的微風,才會「輕輕晃」
      const breeze = Math.sin(now / 900) * 0.6 + Math.sin(now / 370) * 0.25;
      s.velocity += (-22 * s.angle - 1.6 * s.velocity + breeze) * dt;
      s.angle = Math.max(-0.7, Math.min(0.7, s.angle + s.velocity * dt));
      render(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, render]);

  return (
    <canvas
      ref={ref}
      style={style}
      className="cursor-pointer touch-none"
      aria-label="御守預覽：點一下翻面，滑過繩結會晃動"
      onPointerDown={(event) => {
        press.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        // 滑過去撥一下:指標橫向速度推動繩結
        const p = toDesign(event);
        if (lastX.current !== null && p.y < H * 0.4) {
          sway.current.velocity += Math.max(-4, Math.min(4, (p.x - lastX.current) * 0.04));
        }
        lastX.current = p.x;
      }}
      onPointerLeave={() => {
        lastX.current = null;
      }}
      onPointerUp={(event) => {
        const start = press.current;
        press.current = null;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) onFlip();
      }}
    />
  );
}
