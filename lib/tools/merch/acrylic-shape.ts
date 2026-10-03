// 虛擬壓克力的外形計算(純函式,不碰 canvas,才能測)。
//
// 打卡棒的板子是沿著圖案外緣多留一圈邊切下來的:先算每個像素離圖案多遠
// (距離轉換),距離在留邊寬度以內的都是壓克力,再把被包在裡面的洞補滿
// ——真的雷射切割只切外圈,圖案中間的空隙還是壓克力。
// 邊緣用距離做出半個像素的漸層,放大縮小都不會鋸齒。

/** 兩趟掃描的距離轉換(3-4 chamfer,誤差幾 %):每個像素到最近「實心」像素的距離 */
export function distanceToSolid(solid: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i += 1) d[i] = solid[i] ? 0 : INF;
  const a = 1;
  const b = Math.SQRT2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a);
      if (y > 0) {
        v = Math.min(v, d[i - w] + a);
        if (x > 0) v = Math.min(v, d[i - w - 1] + b);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + b);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + a);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + a);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + b);
        if (x > 0) v = Math.min(v, d[i + w - 1] + b);
      }
      d[i] = v;
    }
  }
  return d;
}

/** 從四邊往裡淹:淹得到的是外面,其他(包在裡面的洞)都算裡面 */
export function fillHoles(inside: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!inside[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x += 1) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i += 1) out[i] = outside[i] ? 0 : 1;
  return out;
}

/**
 * 圖案的 alpha → 壓克力外形的 alpha(0–255)。
 * margin 是留邊寬度(像素);threshold 以上的 alpha 才算圖案(半透明的陰影不算)。
 */
export function contourAlpha(alpha: Uint8ClampedArray | Uint8Array, w: number, h: number, margin: number, threshold = 60): Uint8ClampedArray {
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < solid.length; i += 1) solid[i] = alpha[i] >= threshold ? 1 : 0;
  const dist = distanceToSolid(solid, w, h);
  const grown = new Uint8Array(w * h);
  for (let i = 0; i < grown.length; i += 1) grown[i] = dist[i] <= margin + 0.5 ? 1 : 0;
  const filled = fillHoles(grown, w, h);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i += 1) {
    if (!filled[i]) continue;
    // 邊上那一圈照距離做半透明,邊緣才平滑
    out[i] = Math.round(255 * Math.min(1, Math.max(0, margin + 0.5 - dist[i] + 0.5)));
    if (dist[i] <= margin - 0.5 || grown[i] === 0) out[i] = 255;
  }
  return out;
}

/**
 * 外形的內緣一圈(從邊往裡 width 像素),越靠邊越亮:壓克力邊的那道亮線。
 * 輸入是外形的 alpha,輸出 0–255。
 */
export function edgeBand(shape: Uint8ClampedArray | Uint8Array, w: number, h: number, width: number): Uint8ClampedArray {
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < outside.length; i += 1) outside[i] = shape[i] < 128 ? 1 : 0;
  const dist = distanceToSolid(outside, w, h);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i += 1) {
    if (shape[i] === 0) continue;
    const t = 1 - (dist[i] - 0.5) / width;
    if (t > 0) out[i] = Math.round(255 * Math.min(1, t) * (shape[i] / 255));
  }
  return out;
}

/** alpha 大於 0 的範圍(沒有東西就回 null) */
export function alphaBounds(alpha: Uint8ClampedArray | Uint8Array, w: number, h: number) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (alpha[y * w + x] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** 外形最下面、靠近 cx 的那一點(打卡棒的卡榫接在這裡) */
export function lowestNear(shape: Uint8ClampedArray | Uint8Array, w: number, h: number, cx: number, halfWidth: number): number | null {
  const from = Math.max(0, Math.round(cx - halfWidth));
  const to = Math.min(w - 1, Math.round(cx + halfWidth));
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = from; x <= to; x += 1) if (shape[y * w + x] >= 128) return y;
  }
  return null;
}

// ---- 放在照片上的位置:平移、大小、旋轉,再加四個角各自的微調(透視傾斜) ----

export type Point = { x: number; y: number };
export type Tilt = [Point, Point, Point, Point];

export type Placement = {
  /** 中心點(0–1,相對照片) */
  x: number;
  y: number;
  /** 寬度佔照片寬的比例 */
  size: number;
  /** 旋轉(度) */
  rotation: number;
  /** 四個角(左上、右上、右下、左下)的偏移,以壓克力自己的寬高為單位 */
  tilt: Tilt;
};

export const NO_TILT: Tilt = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

export function defaultPlacement(): Placement {
  return { x: 0.5, y: 0.52, size: 0.46, rotation: -4, tilt: [{ x: 0.02, y: 0.015 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0.015, y: -0.01 }] };
}

const BASE: Point[] = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
];

/** 位置 → 照片上的四個角(像素)。aspect 是壓克力的寬/高,照片寬高是 sw、sh */
export function placementQuad(place: Placement, aspect: number, sw: number, sh: number): [Point, Point, Point, Point] {
  const w = place.size * sw;
  const h = w / aspect;
  const a = (place.rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cx = place.x * sw;
  const cy = place.y * sh;
  return BASE.map((p, i) => {
    const lx = (p.x + place.tilt[i].x) * w;
    const ly = (p.y + place.tilt[i].y) * h;
    return { x: cx + lx * c - ly * s, y: cy + lx * s + ly * c };
  }) as [Point, Point, Point, Point];
}

/** 拖一個角到 p(照片像素):反推那個角的偏移 */
export function tiltFromCorner(place: Placement, aspect: number, sw: number, sh: number, index: number, p: Point): Tilt {
  const w = place.size * sw;
  const h = w / aspect;
  const a = (-place.rotation * Math.PI) / 180;
  const dx = p.x - place.x * sw;
  const dy = p.y - place.y * sh;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  // 一個角最多拉出去半個寬高,太誇張的透視看起來就不像拿在手上
  const clamp = (v: number) => Math.max(-0.45, Math.min(0.45, v));
  return place.tilt.map((t, i) => (i === index ? { x: clamp(lx / w - BASE[i].x), y: clamp(ly / h - BASE[i].y) } : t)) as Tilt;
}
