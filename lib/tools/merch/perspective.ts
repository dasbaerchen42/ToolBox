// 透卡傾斜:拖動四個角,壓克力板像拿在鏡頭前一樣有透視。
//
// canvas 2D 只會仿射變形(平行線還是平行),做不出透視,
// 所以把板子切成網格三角形,每個三角形用仿射貼過去——格子夠細就看不出接縫。
// 對應關係用單應矩陣(homography):四個角對四個角就決定了整張的變形。

export type Point = { x: number; y: number };
/** 左上、右上、右下、左下 */
export type Quad = [Point, Point, Point, Point];

/** 解 8×8 線性方程(高斯消去,部分主元) */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = m[col][col] || 1e-12;
    for (let k = col; k <= n; k += 1) m[col][k] /= p;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const f = m[row][col];
      if (f === 0) continue;
      for (let k = col; k <= n; k += 1) m[row][k] -= f * m[col][k];
    }
  }
  return m.map((row) => row[n]);
}

/** src 四個點對到 dst 四個點的單應矩陣(3×3,h33 = 1,依列展開成 9 個數) */
export function homography(src: Quad, dst: Quad): number[] {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(a, b), 1];
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** 四邊形是不是凸的(順序一致):拖成蝴蝶結或凹進去時不要畫,會亂掉 */
export function isConvex(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export function rectQuad(x: number, y: number, width: number, height: number): Quad {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/** 三角形 (s0,s1,s2) → (d0,d1,d2) 的仿射矩陣,給 ctx.transform(a,b,c,d,e,f) 用 */
export function triangleAffine(
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point
): [number, number, number, number, number, number] {
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y) || 1e-12;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;
  return [a, b, c, d, e, f];
}

/**
 * 把一張 width×height 的圖透視貼到 dst 四邊形上。
 * 切成 grid×grid 格,每格兩個三角形;每個三角形先剪裁再用仿射畫,
 * 剪裁範圍往外多半像素,相鄰三角形之間才不會露出細縫。
 */
export function drawPerspective(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  dst: Quad,
  grid = 14
): void {
  if (!isConvex(dst)) return;
  const h = homography(rectQuad(0, 0, width, height), dst);
  const src = (i: number, j: number): Point => ({ x: (i / grid) * width, y: (j / grid) * height });

  const triangle = (s: Point[], d: Point[]) => {
    const cx = (d[0].x + d[1].x + d[2].x) / 3;
    const cy = (d[0].y + d[1].y + d[2].y) / 3;
    const grow = (p: Point) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * 0.6, y: p.y + (dy / len) * 0.6 };
    };
    ctx.save();
    ctx.beginPath();
    const [g0, g1, g2] = d.map(grow);
    ctx.moveTo(g0.x, g0.y);
    ctx.lineTo(g1.x, g1.y);
    ctx.lineTo(g2.x, g2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(...triangleAffine(s[0], s[1], s[2], d[0], d[1], d[2]));
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();
  };

  for (let j = 0; j < grid; j += 1) {
    for (let i = 0; i < grid; i += 1) {
      const s00 = src(i, j);
      const s10 = src(i + 1, j);
      const s11 = src(i + 1, j + 1);
      const s01 = src(i, j + 1);
      const [d00, d10, d11, d01] = [s00, s10, s11, s01].map((p) => applyHomography(h, p));
      triangle([s00, s10, s11], [d00, d10, d11]);
      triangle([s00, s11, s01], [d00, d11, d01]);
    }
  }
}
