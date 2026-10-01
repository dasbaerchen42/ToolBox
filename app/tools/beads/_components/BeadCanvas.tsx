"use client";

import { useEffect, useRef } from "react";
import {
  beadShades,
  drawBeads,
  drawBoard,
  drawFallingBead,
  drawFlat,
  drawIron,
  smoothstep,
} from "@/lib/tools/beads/draw";
import type { BeadColor } from "@/lib/tools/beads/palette";
import { dropOrder, type BeadPattern } from "@/lib/tools/beads/pattern";

/**
 * pattern:只看轉換結果(平的色塊)
 * dropping → placed:豆子一顆顆落進板子
 * ironing → ironed:熨斗推過去,洞縮小、豆子黏起來
 */
export type Stage = "pattern" | "dropping" | "placed" | "ironing" | "ironed";

/** 一顆豆子從出現到落進柱子要多久 */
const FALL_MS = 280;
const IRON_MS = 2400;

/** 落豆總長:豆子越多越久,但不要久到讓人想走開 */
function dropDuration(count: number): number {
  return Math.min(5000, Math.max(1500, count * 4));
}

type Props = {
  pattern: BeadPattern;
  palette: BeadColor[];
  stage: Stage;
  /** 畫面上每格幾 CSS 像素 */
  cell: number;
  /** 動畫播完(或被略過)時通知:dropping → placed、ironing → ironed */
  onSettled: (stage: "placed" | "ironed") => void;
  /** 只有底圖階段可以點;回傳點到哪一格 */
  onPickCell?: (index: number) => void;
};

export default function BeadCanvas({ pattern, palette, stage, cell, onSettled, onPickCell }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 動畫跑到一半時父層重繪不該讓它從頭開始,所以 onSettled 走 ref
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { cols, rows } = pattern;
    const width = cols * cell;
    const height = rows * cell;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const shades = beadShades(palette);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paintStatic = (melt: number | null) => {
      ctx.clearRect(0, 0, width, height);
      drawBoard(ctx, cols, rows, cell);
      if (melt === null) drawFlat(ctx, pattern, palette, cell);
      else drawBeads(ctx, pattern, shades, cell, () => melt);
    };

    if (stage === "pattern") {
      paintStatic(null);
      return;
    }
    if (stage === "placed") {
      paintStatic(0);
      return;
    }
    if (stage === "ironed") {
      paintStatic(1);
      return;
    }

    if (reduceMotion) {
      settledRef.current(stage === "dropping" ? "placed" : "ironed");
      return;
    }

    let frame = 0;
    const start = performance.now();

    if (stage === "dropping") {
      const order = dropOrder(pattern.cells, cols * 1000 + rows);
      const span = dropDuration(order.length) - FALL_MS;
      const startOf = (i: number) => (order.length <= 1 ? 0 : (i / (order.length - 1)) * span);

      // 落地的豆子畫進另一張 canvas 累積起來,每一格只要重畫還在空中的那幾顆
      const layer = document.createElement("canvas");
      layer.width = canvas.width;
      layer.height = canvas.height;
      const layerCtx = layer.getContext("2d");
      if (!layerCtx) return;
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBoard(layerCtx, cols, rows, cell);

      let landed = 0;

      const tick = (now: number) => {
        const elapsed = now - start;

        const newlyLanded: number[] = [];
        while (landed < order.length && startOf(landed) + FALL_MS <= elapsed) {
          newlyLanded.push(order[landed]);
          landed += 1;
        }
        if (newlyLanded.length > 0) drawBeads(layerCtx, pattern, shades, cell, () => 0, newlyLanded);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(layer, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        for (let i = landed; i < order.length && startOf(i) <= elapsed; i += 1) {
          drawFallingBead(ctx, pattern, shades, cell, order[i], (elapsed - startOf(i)) / FALL_MS);
        }

        if (landed >= order.length) settledRef.current("placed");
        else frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
    } else {
      // 熨斗:尖端從板子左邊外面推到右邊外面(連機身一起離開畫面)
      const ironLength = Math.max(cell * 7, height * 0.42);
      const travel = width + ironLength;
      // 尖端經過之後約五格的距離才燙到定
      const meltSpan = cell * 5;

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / IRON_MS);
        const tipX = t * travel;

        ctx.clearRect(0, 0, width, height);
        drawBoard(ctx, cols, rows, cell);
        drawBeads(ctx, pattern, shades, cell, (col) =>
          smoothstep((tipX - (col + 0.5) * cell) / meltSpan)
        );
        if (t < 1) drawIron(ctx, tipX, height, cell);

        if (t >= 1) settledRef.current("ironed");
        else frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frame);
  }, [pattern, palette, stage, cell]);

  return (
    <canvas
      ref={canvasRef}
      onClick={(event) => {
        if (!onPickCell) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const col = Math.floor(((event.clientX - rect.left) / rect.width) * pattern.cols);
        const row = Math.floor(((event.clientY - rect.top) / rect.height) * pattern.rows);
        if (col < 0 || row < 0 || col >= pattern.cols || row >= pattern.rows) return;
        onPickCell(row * pattern.cols + col);
      }}
      className={`block h-auto w-full rounded-xl ${onPickCell ? "cursor-crosshair" : ""}`}
      style={{ maxWidth: pattern.cols * cell, aspectRatio: `${pattern.cols} / ${pattern.rows}` }}
      role="img"
      aria-label={
        stage === "pattern"
          ? "拼豆底圖"
          : stage === "ironed"
            ? "燙好的拼豆作品"
            : "板子上的拼豆"
      }
    />
  );
}
