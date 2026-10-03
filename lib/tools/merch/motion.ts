// 錄 GIF/影片用的「設計好的晃動路徑」。
//
// 玩的時候是真的物理,但物理不會剛好繞回原點,錄出來的循環會在接頭處跳一下。
// 所以錄製時改用這裡的路徑:每個量都是 t(0–1,一圈)的週期函式,最後一格自然接回第一格。
// 全部是純函式,不碰 canvas。

import type { Quad } from "./perspective";
import { containerDistance, partPosition, type Body, type Container } from "./physics";

/** 一圈幾秒、每秒幾格。GIF 固定 2–3 秒循環才不會太大 */
export const LOOP_SECONDS = 2.4;
export const GIF_FPS = 15;
export const VIDEO_FPS = 30;

export function frameCount(fps: number, seconds = LOOP_SECONDS): number {
  return Math.max(2, Math.round(fps * seconds));
}

/** 第 i 格在一圈裡的位置(不含 1,最後一格的下一格就是第 0 格) */
export function frameT(index: number, frames: number): number {
  return (index % frames) / frames;
}

const TAU = Math.PI * 2;

/** 小卡套:雷射角度在原本的位置左右來回掃,像拿著卡片輕輕轉 */
export function cardLaserAngle(t: number, base = 0.7): number {
  return base + 1.1 * Math.sin(TAU * t);
}

/** 御守:繩結的擺角,和緩的單擺 */
export function omamoriSway(t: number): number {
  return 0.24 * Math.sin(TAU * t);
}

/** 透卡:像拿在手上,板子繞中心微微轉、前後一點點縮放與上下晃(角是 0–1 的相對座標) */
export function acrylicWobble(corners: Quad, t: number): Quad {
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4;
  const angle = 0.045 * Math.sin(TAU * t);
  const scale = 1 + 0.025 * Math.sin(TAU * t + Math.PI / 2);
  const dy = 0.008 * Math.sin(TAU * 2 * t);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return corners.map((p, k) => {
    const x = (p.x - cx) * scale;
    // 左右兩邊前後交錯一點點,看起來是 3D 的傾斜而不只是平面旋轉
    const tilt = 1 + 0.02 * Math.sin(TAU * t) * (k === 0 || k === 3 ? 1 : -1);
    const y = (p.y - cy) * scale * tilt;
    return { x: cx + x * c - y * s, y: cy + x * s + y * c + dy };
  }) as Quad;
}

/** 搖搖吊飾整個掛著擺:繞吊繩頂端的角度(弧度) */
export function charmSwing(t: number): number {
  return 0.07 * Math.sin(TAU * t);
}

/** 一個零件在某一格的位置:x、y、angle 都是相對它停著的位置的偏移 */
export type PieceOffset = { dx: number; dy: number; dAngle: number };

/**
 * 零件在夾層裡晃:跟著吊飾擺動往低的那一側滑,再加一點各自不同相位的小晃動與自轉。
 * 振幅會先檢查——整圈任何一格只要有一顆豆子會穿出容器,就把這個零件的振幅縮小,
 * 縮到不會穿出去為止(縮到 0 就是不動)。
 */
export function charmPieceOffsets(bodies: Body[], container: Container, t: number): PieceOffset[] {
  return bodies.map((body, k) => {
    const amplitude = safeAmplitude(body, container, k);
    return pieceOffset(body, k, t, amplitude);
  });
}

function pieceOffset(body: Body, k: number, t: number, amplitude: number): PieceOffset {
  const phase = (k * 0.9) % TAU;
  const reach = body.radius * 0.5 * amplitude;
  return {
    // 吊飾擺到 charmSwing 的角度時,重力在吊飾自己的座標裡偏向 +x,零件往那邊滑
    dx: Math.sin(TAU * t) * reach * 1.4 + Math.sin(TAU * 2 * t + phase) * reach * 0.25,
    // 往兩邊滑時順著底部的弧線稍微抬起來;只往上不往下,躺在底上的零件才不會被壓進底邊
    dy: -(Math.abs(Math.sin(TAU * t)) * 0.5 + (1 + Math.cos(TAU * t + phase)) * 0.08) * reach,
    dAngle: (Math.sin(TAU * t + phase) * 0.35 + Math.sin(TAU * 2 * t) * 0.1) * amplitude,
  };
}

const SAMPLE_STEPS = 24;

function fits(body: Body, container: Container, offset: PieceOffset): boolean {
  const moved = { ...body, x: body.x + offset.dx, y: body.y + offset.dy, angle: body.angle + offset.dAngle };
  return moved.parts.every((part) => containerDistance(container, partPosition(moved, part)) + part.r <= 0.5);
}

function safeAmplitude(body: Body, container: Container, k: number): number {
  for (const amplitude of [1, 0.75, 0.5, 0.3, 0.15]) {
    let ok = true;
    for (let i = 0; i < SAMPLE_STEPS && ok; i += 1) {
      ok = fits(body, container, pieceOffset(body, k, i / SAMPLE_STEPS, amplitude));
    }
    if (ok) return amplitude;
  }
  return 0;
}
