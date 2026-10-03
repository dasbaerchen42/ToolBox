"use client";

import { useCallback, useEffect, useRef } from "react";
import { DESIGN_SIZE, type BeadCharmDesign } from "@/lib/tools/merch/design";
import { drawBeadCharm, type Art } from "@/lib/tools/merch/render";
import { useDesignCanvas } from "./useDesignCanvas";

const { width: W, height: H } = DESIGN_SIZE.beadcharm;

/**
 * 拼豆吊飾:掛在鑰匙圈(或吊繩)下面的單擺。
 * 手指橫著滑過去會推它一下;手機左右傾,重力方向跟著偏,它就斜斜地掛著。
 */
export default function BeadCharmStage({ design, art, active }: { design: BeadCharmDesign; art: Art | null; active: boolean }) {
  const { ref, paint, toDesign, style } = useDesignCanvas(W, H);
  const sway = useRef({ angle: 0.12, velocity: 0 });
  const tilt = useRef(0);
  const lastX = useRef<number | null>(null);

  const render = useCallback(() => {
    paint((ctx) => drawBeadCharm(ctx, W, H, design, art, sway.current.angle));
  }, [paint, design, art]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const s = sway.current;
      // 單擺:往重力方向回復 + 阻尼;一點點微風,停下來也不會完全死板
      const breeze = Math.sin(now / 1100) * 0.15;
      s.velocity += (-14 * Math.sin(s.angle - tilt.current) - 1.1 * s.velocity + breeze) * dt;
      s.angle = Math.max(-1.1, Math.min(1.1, s.angle + s.velocity * dt));
      render();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, render]);

  useEffect(() => {
    if (!active) return;
    const handle = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) return;
      // 手機往右傾,重力在畫面上偏向右下,吊飾往右邊斜
      tilt.current = Math.max(-0.6, Math.min(0.6, (-event.gamma * Math.PI) / 180));
    };
    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [active]);

  return (
    <canvas
      ref={ref}
      style={style}
      className="touch-none"
      aria-label="拼豆吊飾預覽：手指橫著滑過去會推它擺動"
      onPointerMove={(event) => {
        const p = toDesign(event);
        if (lastX.current !== null) sway.current.velocity += Math.max(-3, Math.min(3, (p.x - lastX.current) * 0.02));
        lastX.current = p.x;
      }}
      onPointerLeave={() => {
        lastX.current = null;
      }}
      onPointerDown={(event) => {
        lastX.current = toDesign(event).x;
      }}
    />
  );
}
