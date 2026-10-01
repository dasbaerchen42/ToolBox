"use client";

import { useEffect, useRef, type PointerEvent } from "react";
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
import type { Symmetry } from "@/lib/tools/beads/edit";
import { dropOrder, type BeadPattern } from "@/lib/tools/beads/pattern";

/**
 * pattern:平的色塊,可以編輯
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
  /** 給了就可以在板子上拖曳編輯(只有底圖階段) */
  editing?: {
    symmetry: Symmetry;
    onStrokeStart: (index: number) => void;
    onStrokeMove: (index: number) => void;
    onStrokeEnd: () => void;
  };
};

/** 對稱軸:虛線畫在板子中央,提醒現在畫一邊另一邊會跟著長 */
function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  symmetry: Symmetry
) {
  if (symmetry === "none") return;
  ctx.save();
  ctx.strokeStyle = "rgba(200, 60, 60, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  if (symmetry === "x" || symmetry === "both") {
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
  }
  if (symmetry === "y" || symmetry === "both") {
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
  }
  ctx.stroke();
  ctx.restore();
}

export default function BeadCanvas({ pattern, palette, stage, cell, onSettled, editing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokingRef = useRef(false);
  const symmetry = editing?.symmetry ?? "none";
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
      drawSymmetryGuides(ctx, width, height, symmetry);
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
  }, [pattern, palette, stage, cell, symmetry]);

  const cellAt = (event: PointerEvent<HTMLCanvasElement>): number | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * pattern.cols);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * pattern.rows);
    if (col < 0 || row < 0 || col >= pattern.cols || row >= pattern.rows) return null;
    return row * pattern.cols + col;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(event) => {
        if (!editing || event.button !== 0) return;
        const index = cellAt(event);
        if (index === null) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        strokingRef.current = true;
        editing.onStrokeStart(index);
      }}
      onPointerMove={(event) => {
        if (!editing || !strokingRef.current) return;
        const index = cellAt(event);
        if (index !== null) editing.onStrokeMove(index);
      }}
      onPointerUp={() => {
        if (!editing || !strokingRef.current) return;
        strokingRef.current = false;
        editing.onStrokeEnd();
      }}
      onPointerCancel={() => {
        if (!editing || !strokingRef.current) return;
        strokingRef.current = false;
        editing.onStrokeEnd();
      }}
      // 編輯時關掉觸控捲動,手指在板子上拖才是畫畫而不是捲頁面
      className={`block h-auto w-full rounded-xl ${editing ? "cursor-crosshair touch-none" : ""}`}
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
