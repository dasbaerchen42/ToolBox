// 錄 GIF/影片用的「設計好的晃動路徑」。
//
// 玩的時候是真的物理,但物理不會剛好繞回原點,錄出來的循環會在接頭處跳一下。
// 所以錄製時改用這裡的路徑:每個量都是 t(0–1,一圈)的週期函式,最後一格自然接回第一格。
// 全部是純函式,不碰 canvas。

import type { Quad } from "./perspective";

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
