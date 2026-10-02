// 魔術棒去背:點選背景色,容許值內相連的相近顏色一起清掉;
// 再用橡皮擦修邊,邊緣可以微微羽化。適合插畫與純色背景。
// 全部是純函式(吃 RGBA 像素、吐新的),拼豆工坊的周邊與影像工作檯共用。

export type Pixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/** RGB 最遠的距離(黑到白),容許值用它換算成 0–1 */
const MAX_DISTANCE = Math.sqrt(3 * 255 * 255);

/** 幾乎透明的像素:已經是背景了,魔術棒可以穿過去繼續選 */
const CLEAR_ALPHA = 8;

/**
 * 從 (x, y) 開始往上下左右擴散,顏色跟起點差在容許值(0–1)以內的相連像素都選進來。
 * 回傳每個像素選了沒有(1 = 選了)。點到透明的地方就只選透明的那一片。
 */
export function wandSelect(px: Pixels, x: number, y: number, tolerance: number): Uint8Array {
  const { width, height, data } = px;
  const mask = new Uint8Array(width * height);
  const sx = Math.round(x);
  const sy = Math.round(y);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return mask;

  const start = (sy * width + sx) * 4;
  const r0 = data[start];
  const g0 = data[start + 1];
  const b0 = data[start + 2];
  const seedClear = data[start + 3] < CLEAR_ALPHA;
  const limit = Math.max(0, tolerance) * MAX_DISTANCE;
  const limitSq = limit * limit;

  const matches = (i: number) => {
    const p = i * 4;
    const clear = data[p + 3] < CLEAR_ALPHA;
    if (seedClear || clear) return clear || seedClear === clear;
    const dr = data[p] - r0;
    const dg = data[p + 1] - g0;
    const db = data[p + 2] - b0;
    return dr * dr + dg * dg + db * db <= limitSq;
  };

  const stack = [sy * width + sx];
  mask[stack[0]] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const cx = i % width;
    if (cx > 0 && !mask[i - 1] && matches(i - 1)) {
      mask[i - 1] = 1;
      stack.push(i - 1);
    }
    if (cx < width - 1 && !mask[i + 1] && matches(i + 1)) {
      mask[i + 1] = 1;
      stack.push(i + 1);
    }
    if (i >= width && !mask[i - width] && matches(i - width)) {
      mask[i - width] = 1;
      stack.push(i - width);
    }
    if (i + width < mask.length && !mask[i + width] && matches(i + width)) {
      mask[i + width] = 1;
      stack.push(i + width);
    }
  }
  return mask;
}

/**
 * 把選到的像素清成透明。feather(像素)> 0 時,選區外緣這麼寬的一圈逐漸變透明,
 * 邊緣才不會鋸齒狀;距離用 BFS 一圈一圈往外量(棋盤距離,夠用)。
 */
export function eraseSelection(px: Pixels, mask: Uint8Array, feather: number): Uint8ClampedArray {
  const { width, height, data } = px;
  const out = new Uint8ClampedArray(data);
  const ring = Math.max(0, Math.floor(feather));

  // 距離選區幾格:0 = 選區內,1..ring = 外緣,其餘不動
  const distance = new Int16Array(width * height).fill(-1);
  let frontier: number[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    distance[i] = 0;
    out[i * 4 + 3] = 0;
    frontier.push(i);
  }

  for (let d = 1; d <= ring && frontier.length > 0; d += 1) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % width;
      const y = Math.floor(i / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (distance[n] !== -1) continue;
          distance[n] = d;
          next.push(n);
          // 越靠近選區越透明
          out[n * 4 + 3] = Math.round((data[n * 4 + 3] * d) / (ring + 1));
        }
      }
    }
    frontier = next;
  }
  return out;
}

/** 橡皮擦:圓形範圍內清成透明,邊緣留一個像素的柔邊。就地修改 */
export function eraseCircle(px: Pixels, cx: number, cy: number, radius: number): void {
  const { width, height, data } = px;
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius + 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius + 1));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= radius + 1) continue;
      const keep = d <= radius ? 0 : d - radius;
      const i = (y * width + x) * 4 + 3;
      data[i] = Math.round(data[i] * keep);
    }
  }
}

/** 不透明部分的外框;整張都透明時回傳 null。去背完裁掉多餘的透明邊用 */
export function opaqueBounds(px: Pixels): { x: number; y: number; width: number; height: number } | null {
  const { width, height, data } = px;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < CLEAR_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
