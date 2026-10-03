"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { artKey, DESIGN_SIZE, type CharmDesign } from "@/lib/tools/merch/design";
import { bodyFromCells, kineticEnergy, step, type Container, type Vec } from "@/lib/tools/merch/physics";
import { charmGeometry, drawCharm, patternCentroid, type Art, type CharmPiece } from "@/lib/tools/merch/render";
import { useDesignCanvas } from "./useDesignCanvas";

const { width: W, height: H } = DESIGN_SIZE.charm;
const GRAVITY = 1800;
/** 拖動時整個吊飾跟著手走,放開後彈回來:彈簧與阻尼 */
const SPRING = 90;
const SPRING_DAMP = 9;
/** 吊飾被甩動時,零件感受到的慣性力上限(太大會穿出去) */
const MAX_SHAKE = 26000;
const STAGE_SCALE = 0.82;

/** 燙過的豆子比碰撞用的小圓大一圈,容器往內縮一點,零件才不會畫進白邊裡 */
const EDGE_MARGIN = 3;
function physicsBox(inner: Container): Container {
  return inner.kind === "circle"
    ? { ...inner, r: inner.r - EDGE_MARGIN }
    : { ...inner, hw: inner.hw - EDGE_MARGIN, hh: inner.hh - EDGE_MARGIN };
}

/**
 * 搖搖吊飾。零件是照有豆子的格子組成的剛體,在透明夾層裡碰撞翻滾。
 * 拖動整個吊飾(或晃手機)時,零件感受到反方向的慣性力;手機傾斜就改變重力方向。
 */
export default function CharmStage({
  design,
  photo,
  arts,
  active,
  piecesRef,
  shakeRef,
}: {
  design: CharmDesign;
  photo: ImageBitmap | null;
  arts: Map<string, Art>;
  active: boolean;
  /** 零件的物理狀態放在外面,輸出圖片時照目前的位置畫 */
  piecesRef: MutableRefObject<CharmPiece[]>;
  /** 「搖一搖」按鈕:往這裡塞一下衝擊 */
  shakeRef: MutableRefObject<Vec | null>;
}) {
  const { ref, paint, toDesign, style } = useDesignCanvas(W, H);
  const gravity = useRef<Vec>({ x: 0, y: GRAVITY });
  const motion = useRef<Vec>({ x: 0, y: 0 });
  // 整個吊飾的位移(拖動中跟著手,放開後彈回)
  const offset = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const pointer = useRef<{ start: Vec; origin: Vec } | null>(null);
  const settled = useRef(0);
  // 上一格的外框速度:拖動時速度在指標事件裡改,加速度要跨格比
  const lastVelocity = useRef({ vx: 0, vy: 0 });

  // 設計裡的零件 → 剛體;已經在的保留位置,新加的從上面掉下來
  useEffect(() => {
    const { inner } = charmGeometry(design, W, H);
    const top = inner.kind === "circle" ? inner.cy - inner.r : inner.cy - inner.hh;
    const kept = new Map(piecesRef.current.map((piece) => [piece.id, piece]));
    const next: CharmPiece[] = [];
    design.pieces.forEach((spec, k) => {
      const art = arts.get(artKey(spec));
      const pattern = art?.pattern;
      if (!art || !pattern) return;
      const old = kept.get(spec.id);
      if (old && old.cell === spec.cell && old.art === art) {
        next.push(old);
        return;
      }
      const body = bodyFromCells(pattern.cells, pattern.cols, pattern.rows, spec.cell);
      if (!body) return;
      body.x = old?.body.x ?? W / 2 + ((k % 5) - 2) * spec.cell * 3;
      body.y = old?.body.y ?? top + body.radius + 10 + (k % 3) * 8;
      body.angle = old?.body.angle ?? k * 0.7;
      body.av = (k % 2 ? 1 : -1) * 2;
      next.push({ id: spec.id, body, art, cell: spec.cell, centroid: patternCentroid(pattern) });
    });
    piecesRef.current = next;
    settled.current = 0;
  }, [design, arts, piecesRef]);

  const render = useCallback(() => {
    const o = offset.current;
    paint((ctx) => {
      // 吊飾掛在上緣中間:位移讓它整個平移,再依左右位移稍微擺一下
      // 畫面上縮小一點,左右留空間給它晃
      ctx.translate(W / 2 + o.x, o.y + H * 0.06);
      ctx.rotate(-o.x * 0.0012);
      ctx.scale(STAGE_SCALE, STAGE_SCALE);
      ctx.translate(-W / 2, 0);
      drawCharm(ctx, W, H, design, photo, piecesRef.current);
    });
  }, [paint, design, photo, piecesRef]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const o = offset.current;
      if (!pointer.current) {
        o.vx += (-SPRING * o.x - SPRING_DAMP * o.vx) * dt;
        o.vy += (-SPRING * o.y - SPRING_DAMP * o.vy) * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
      } else {
        // 手停住不動時指標事件也停了,速度要自己慢慢歸零
        o.vx *= 0.7;
        o.vy *= 0.7;
      }
      // 外框加速 → 零件感受到反方向的慣性力
      const before = lastVelocity.current;
      const ax = dt > 0 ? (o.vx - before.vx) / dt : 0;
      const ay = dt > 0 ? (o.vy - before.vy) / dt : 0;
      lastVelocity.current = { vx: o.vx, vy: o.vy };
      const shake = { x: -ax + motion.current.x, y: -ay + motion.current.y };
      motion.current = { x: 0, y: 0 };
      if (shakeRef.current) {
        shake.x += shakeRef.current.x;
        shake.y += shakeRef.current.y;
        shakeRef.current = null;
      }
      const length = Math.hypot(shake.x, shake.y);
      if (length > MAX_SHAKE) {
        shake.x *= MAX_SHAKE / length;
        shake.y *= MAX_SHAKE / length;
      }

      const box = physicsBox(charmGeometry(design, W, H).inner);
      const moving = length > 1 || Math.abs(o.x) + Math.abs(o.y) > 0.3 || Math.hypot(o.vx, o.vy) > 1;
      const bodies = piecesRef.current.map((piece) => piece.body);
      // 靜止一陣子就不算也不畫,省電
      if (moving || settled.current < 90) {
        step(bodies, box, dt, { gravity: gravity.current, shake });
        settled.current = moving || kineticEnergy(bodies) > 400 ? 0 : settled.current + 1;
        render();
      }
      frame = requestAnimationFrame(loop);
    };
    render();
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, design, render, piecesRef, shakeRef]);

  // 手機:傾斜改重力方向,搖晃給衝擊
  useEffect(() => {
    if (!active) return;
    const orient = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      const gx = Math.sin((event.gamma * Math.PI) / 180);
      const gy = Math.sin((Math.min(90, Math.max(-90, event.beta)) * Math.PI) / 180);
      const length = Math.hypot(gx, gy);
      // 平放時重力幾乎垂直螢幕,零件還是往下沉一點,不要漂起來
      gravity.current =
        length < 0.25 ? { x: 0, y: GRAVITY * 0.35 } : { x: (gx / length) * GRAVITY, y: (gy / length) * GRAVITY };
      settled.current = 0;
    };
    const shake = (event: DeviceMotionEvent) => {
      const a = event.acceleration;
      if (!a || a.x === null || a.y === null) return;
      if (Math.hypot(a.x, a.y) < 2) return;
      motion.current = { x: -a.x * 900, y: a.y * 900 };
    };
    window.addEventListener("deviceorientation", orient);
    window.addEventListener("devicemotion", shake);
    return () => {
      window.removeEventListener("deviceorientation", orient);
      window.removeEventListener("devicemotion", shake);
    };
  }, [active]);

  return (
    <canvas
      ref={ref}
      style={style}
      className="cursor-grab touch-none active:cursor-grabbing"
      aria-label="搖搖吊飾預覽：拖動吊飾，裡面的零件會跟著翻滾"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const p = toDesign(event);
        pointer.current = { start: p, origin: { x: offset.current.x, y: offset.current.y } };
        settled.current = 0;
      }}
      onPointerMove={(event) => {
        const drag = pointer.current;
        if (!drag) return;
        const p = toDesign(event);
        const o = offset.current;
        // 只讓吊飾跟著手晃一小段,不會被拖出畫面
        const x = Math.max(-W * 0.07, Math.min(W * 0.07, drag.origin.x + p.x - drag.start.x));
        const y = Math.max(-H * 0.04, Math.min(H * 0.04, drag.origin.y + p.y - drag.start.y));
        // 速度用指標的移動算,迴圈裡才拿得到加速度
        const dt = 1 / 60;
        o.vx = o.vx * 0.5 + ((x - o.x) / dt) * 0.5;
        o.vy = o.vy * 0.5 + ((y - o.y) / dt) * 0.5;
        o.x = x;
        o.y = y;
      }}
      onPointerUp={() => {
        pointer.current = null;
      }}
      onPointerCancel={() => {
        pointer.current = null;
      }}
    />
  );
}
