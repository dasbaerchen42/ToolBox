// 沖印所的逐像素效果。全部是純函式:吃一張 RGBA 像素、吐一張新的,
// 不碰 canvas,才能在測試裡用假資料驗證。
//
// 尺寸參數(網點大小、顆粒大小、套色偏移)一律是「像素」,
// 由呼叫端依圖的短邊換算——預覽縮小的圖與輸出的原圖看起來才會一樣。

export type Pixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 亮度(0–255),Rec. 709 權重 */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 固定種子的亂數:同一組設定預覽與輸出的雜點、碳粉痕位置才一樣 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 位置固定的雜湊亂數(0–1):不靠呼叫順序,圖切成幾塊處理結果都一樣 */
function noiseAt(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function blank(src: Pixels): Uint8ClampedArray {
  return new Uint8ClampedArray(src.data.length);
}

/** CMYK 四色網點的角度:錯開才不會疊出摩爾紋 */
const SCREEN_ANGLES = { c: 15, m: 75, y: 0, k: 45 } as const;

/** RGB → CMYK(0–1),最簡單的灰色成分替換 */
export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const c = 1 - r / 255;
  const m = 1 - g / 255;
  const y = 1 - b / 255;
  const k = Math.min(c, m, y);
  if (k >= 1) return [0, 0, 0, 1];
  return [(c - k) / (1 - k), (m - k) / (1 - k), (y - k) / (1 - k), k];
}

/**
 * 網點印刷:CMYK 四色網點疊在紙色上,像舊報紙。
 *
 * 每個色版各自轉一個角度(錯開才不會疊出摩爾紋),把像素轉進該色版的網格,
 * 取網格中心的濃度決定圓點大小——點的面積佔格子的比例就是濃度,
 * 所以亮處點小、暗處點大到連成一片。邊緣留半像素做反鋸齒。
 *
 * 大圖(4000×3000)一張就有一千兩百萬像素 × 四個色版,
 * 所以先把整張圖的 CMYK 算好一次,迴圈裡只查表、不呼叫函式、不開根號以外的運算。
 */
export function halftone(src: Pixels, cell: number, paper: Rgb): Uint8ClampedArray {
  const { width, height, data } = src;
  const out = blank(src);
  const size = Math.max(2, cell);
  const total = width * height;

  // 每個像素的 C、M、Y、K 濃度(透明的地方不上墨)
  const inks = [new Float32Array(total), new Float32Array(total), new Float32Array(total), new Float32Array(total)];
  for (let i = 0; i < total; i += 1) {
    const p = i * 4;
    if (data[p + 3] < 8) continue;
    const [c, m, y, k] = rgbToCmyk(data[p], data[p + 1], data[p + 2]);
    inks[0][i] = c;
    inks[1][i] = m;
    inks[2][i] = y;
    inks[3][i] = k;
  }

  const angles = [SCREEN_ANGLES.c, SCREEN_ANGLES.m, SCREEN_ANGLES.y, SCREEN_ANGLES.k].map(
    (deg) => (deg * Math.PI) / 180
  );
  const cos = angles.map(Math.cos);
  const sin = angles.map(Math.sin);
  const coverage = [0, 0, 0, 0];
  const invPi = 1 / Math.PI;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let ch = 0; ch < 4; ch += 1) {
        const co = cos[ch];
        const si = sin[ch];
        // 轉進網格座標,找這個像素所在格子的中心
        const u = x * co + y * si;
        const v = -x * si + y * co;
        const cu = (Math.floor(u / size) + 0.5) * size;
        const cv = (Math.floor(v / size) + 0.5) * size;
        // 格子中心轉回原圖座標去取濃度
        let ox = Math.round(cu * co - cv * si);
        let oy = Math.round(cu * si + cv * co);
        ox = ox < 0 ? 0 : ox >= width ? width - 1 : ox;
        oy = oy < 0 ? 0 : oy >= height ? height - 1 : oy;
        const density = inks[ch][oy * width + ox];
        if (density <= 0) {
          coverage[ch] = 0;
          continue;
        }
        const radius = size * Math.sqrt(density * invPi);
        const du = u - cu;
        const dv = v - cv;
        const edge = radius - Math.sqrt(du * du + dv * dv) + 0.5;
        coverage[ch] = edge <= 0 ? 0 : edge >= 1 ? 1 : edge;
      }

      const i = (y * width + x) * 4;
      const k = 1 - coverage[3];
      out[i] = paper.r * (1 - coverage[0]) * k;
      out[i + 1] = paper.g * (1 - coverage[1]) * k;
      out[i + 2] = paper.b * (1 - coverage[2]) * k;
      out[i + 3] = data[i + 3];
    }
  }
  return out;
}

/** 8×8 Bayer 矩陣:孔版那種一顆顆的顆粒感 */
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60,
  28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47,
  7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

/**
 * 每個像素要用多少每色墨(0–1):把「紙色 − 像素色」拆成各色墨「紙色 − 墨色」的組合,
 * 用最小平方法解。2–3 色墨對 RGB 三個方程式,解出來夾在 0–1 之間。
 *
 * 墨色固定,所以 (AᵀA)⁻¹Aᵀ 只要算一次;回傳的函式每個像素只做幾次乘法。
 */
export function inkSolver(paper: Rgb, inks: Rgb[]): (pixel: Rgb) => number[] {
  const n = inks.length;
  const columns = inks.map((ink) => [paper.r - ink.r, paper.g - ink.g, paper.b - ink.b]);

  // AᵀA(n×n),兩色太像時加一點點避免奇異
  const ata = columns.map((ci) => columns.map((cj) => ci[0] * cj[0] + ci[1] * cj[1] + ci[2] * cj[2]));
  for (let i = 0; i < n; i += 1) ata[i][i] += 1e-3;

  // 高斯–喬登求反矩陣
  const m = ata.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = m[col][col] || 1e-9;
    for (let k = 0; k < 2 * n; k += 1) m[col][k] /= p;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const f = m[row][col];
      for (let k = 0; k < 2 * n; k += 1) m[row][k] -= f * m[col][k];
    }
  }
  const inverse = m.map((row) => row.slice(n));

  // solve = (AᵀA)⁻¹ Aᵀ:n×3
  const solve = inverse.map((row) =>
    [0, 1, 2].map((c) => row.reduce((sum, value, j) => sum + value * columns[j][c], 0))
  );

  return (pixel) => {
    const br = paper.r - pixel.r;
    const bg = paper.g - pixel.g;
    const bb = paper.b - pixel.b;
    return solve.map(([a, b, c]) => {
      const d = a * br + b * bg + c * bb;
      return d < 0 ? 0 : d > 1 ? 1 : d;
    });
  };
}

export function inkDensities(pixel: Rgb, paper: Rgb, inks: Rgb[]): number[] {
  return inkSolver(paper, inks)(pixel);
}

/**
 * 孔版印刷:只用 2–3 色特色墨,每色各自用顆粒網點印,並刻意錯位(套色不準)。
 * offsets 是每一色版的偏移(像素),grain 是顆粒大小(像素)。
 */
export function riso(
  src: Pixels,
  inks: Rgb[],
  paper: Rgb,
  grain: number,
  offsets: { x: number; y: number }[]
): Uint8ClampedArray {
  const out = blank(src);
  const size = Math.max(1, grain);
  const { width, height } = src;

  // 先算每個像素每色的濃度,錯位時再去鄰近位置讀
  const solve = inkSolver(paper, inks);
  const densities = inks.map(() => new Float32Array(width * height));
  const pixel = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < width * height; i += 1) {
    const p = i * 4;
    if (src.data[p + 3] < 8) continue;
    pixel.r = src.data[p];
    pixel.g = src.data[p + 1];
    pixel.b = src.data[p + 2];
    const d = solve(pixel);
    for (let k = 0; k < d.length; k += 1) densities[k][i] = d[k];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const threshold = BAYER[(Math.floor(y / size) % 8) * 8 + (Math.floor(x / size) % 8)];
      let r = paper.r;
      let g = paper.g;
      let b = paper.b;

      for (let k = 0; k < inks.length; k += 1) {
        const sx = Math.min(width - 1, Math.max(0, Math.round(x - offsets[k].x)));
        const sy = Math.min(height - 1, Math.max(0, Math.round(y - offsets[k].y)));
        if (densities[k][sy * width + sx] <= threshold) continue;
        // 墨是疊印的:乘上墨色的透光率
        r *= inks[k].r / 255;
        g *= inks[k].g / 255;
        b *= inks[k].b / 255;
      }

      const i = (y * width + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = src.data[i + 3];
    }
  }
  return out;
}

/**
 * 影印機:轉灰、拉高反差(S 曲線往中間收)、灰底紙、碳粉痕(亮處零星黑點與淡淡的直條紋)。
 * contrast 0–1,toner 0–1。
 */
export function photocopy(
  src: Pixels,
  contrast: number,
  toner: number,
  seed: number,
  paper: Rgb
): Uint8ClampedArray {
  const out = blank(src);
  const { width, height } = src;
  const steep = 4 + contrast * 18;
  const paperLum = luminance(paper.r, paper.g, paper.b);

  // 直條紋:滾筒髒污,每張固定在幾個 x 位置
  const random = mulberry32(seed);
  const streaks = Array.from({ length: 3 }, () => ({
    x: random() * width,
    w: 0.5 + random() * 2,
    a: 0.08 + random() * 0.12 * toner,
  }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const l = luminance(src.data[i], src.data[i + 1], src.data[i + 2]) / 255;
      // S 曲線:中間調被推向黑或白
      let ink = 1 - 1 / (1 + Math.exp(-steep * (l - 0.5)));
      // 碳粉點:只撒在亮處,暗處本來就是黑的
      if (noiseAt(x, y, seed) < 0.004 * toner * (1 - ink)) ink = 0.85;
      for (const streak of streaks) {
        if (Math.abs(x - streak.x) < streak.w) ink = Math.max(ink, streak.a);
      }
      // 紙本身帶一點不均勻的灰
      const tone = paperLum * (1 - ink) * (0.97 + 0.03 * noiseAt(x >> 2, y >> 2, seed + 1));
      out[i] = clamp255((tone * paper.r) / paperLum);
      out[i + 1] = clamp255((tone * paper.g) / paperLum);
      out[i + 2] = clamp255((tone * paper.b) / paperLum);
      out[i + 3] = src.data[i + 3];
    }
  }
  return out;
}

/**
 * 顆粒:每 size×size 像素一顆,亮度往上或往下抖 amount(0–1)。就地修改。
 * 可以疊在任何效果上。
 */
export function addGrain(px: Pixels, amount: number, size: number, seed: number): void {
  if (amount <= 0) return;
  const step = Math.max(1, Math.round(size));
  const strength = amount * 90;
  for (let y = 0; y < px.height; y += 1) {
    for (let x = 0; x < px.width; x += 1) {
      const n = (noiseAt(Math.floor(x / step), Math.floor(y / step), seed) - 0.5) * 2 * strength;
      const i = (y * px.width + x) * 4;
      px.data[i] = clamp255(px.data[i] + n);
      px.data[i + 1] = clamp255(px.data[i + 1] + n);
      px.data[i + 2] = clamp255(px.data[i + 2] + n);
    }
  }
}

/**
 * 底片調色:暖色或冷色偏移、黑色提亮(褪色感)、四角暗角。拍立得用。
 * warmth -1(偏冷)– 1(偏暖),fade 0–1,vignette 0–1。
 */
export function filmGrade(
  src: Pixels,
  { warmth, fade, vignette }: { warmth: number; fade: number; vignette: number }
): Uint8ClampedArray {
  const out = blank(src);
  const { width, height } = src;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);
  const lift = fade * 50;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const d = Math.hypot(x - cx, y - cy) / maxDist;
      const dark = 1 - vignette * 0.55 * d * d;
      const r = (src.data[i] + warmth * 18) * dark;
      const g = (src.data[i + 1] + warmth * 4) * dark;
      const b = (src.data[i + 2] - warmth * 22) * dark;
      // 褪色:黑色往上提、白色稍微壓下來
      out[i] = clamp255(lift + (r * (255 - lift * 1.4)) / 255);
      out[i + 1] = clamp255(lift + (g * (255 - lift * 1.4)) / 255);
      out[i + 2] = clamp255(lift + (b * (255 - lift * 1.2)) / 255);
      out[i + 3] = src.data[i + 3];
    }
  }
  return out;
}

/**
 * 閃光燈:中間過曝、四周掉光、整體偏冷白、反差變硬。古早數位相機用。
 * strength 0–1。
 */
export function flash(src: Pixels, strength: number): Uint8ClampedArray {
  const out = blank(src);
  const { width, height } = src;
  const cx = width / 2;
  const cy = height * 0.45;
  const reach = Math.hypot(width, height) * 0.45;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const d = Math.min(1, Math.hypot(x - cx, y - cy) / reach);
      const gain = 1 + strength * (0.75 * (1 - d) ** 2 - 0.35 * d * d);
      const contrast = (v: number) => (v - 128) * (1 + strength * 0.35) + 128;
      out[i] = clamp255(contrast(src.data[i] * gain) - strength * 6);
      out[i + 1] = clamp255(contrast(src.data[i + 1] * gain));
      out[i + 2] = clamp255(contrast(src.data[i + 2] * gain) + strength * 10);
      out[i + 3] = src.data[i + 3];
    }
  }
  return out;
}

/**
 * 明暗(0–1)先做一次小範圍的方框模糊:分階前把照片雜訊與髮絲的細碎抹平,
 * 不然切點附近會冒出一堆黑白小斑點,人像的臉就花了。分兩趟(橫、直)做,大圖也快。
 */
export function smoothLuminance(src: Pixels, radius: number): Float32Array {
  const { width, height, data } = src;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i += 1) lum[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
  if (radius <= 0) return lum;
  const pass = (from: Float32Array, horizontal: boolean) => {
    const to = new Float32Array(from.length);
    const lines = horizontal ? height : width;
    const length = horizontal ? width : height;
    for (let line = 0; line < lines; line += 1) {
      const at = (k: number) => (horizontal ? line * width + k : k * width + line);
      let sum = 0;
      let count = 0;
      for (let k = 0; k < Math.min(radius, length); k += 1) {
        sum += from[at(k)];
        count += 1;
      }
      for (let k = 0; k < length; k += 1) {
        const add = k + radius;
        if (add < length) {
          sum += from[at(add)];
          count += 1;
        }
        const drop = k - radius - 1;
        if (drop >= 0) {
          sum -= from[at(drop)];
          count -= 1;
        }
        to[at(k)] = sum / count;
      }
    }
    return to;
  };
  return pass(pass(lum, true), false);
}

/**
 * 單色高反差:照片轉明暗後分階——亮部白、暗部黑、中間是主題色。
 * levels 2 = 只有黑與主題色;3 = 白、主題色、黑;4 = 再多一階淡主題色(人像的臉不會糊成一片)。
 * pattern > 0 時主題色那一階改成網點或斜線(texture),pattern 是格子大小(像素)。
 */
export function posterTone(
  src: Pixels,
  color: Rgb,
  levels: 2 | 3 | 4,
  pattern: number,
  balance = 0.5,
  texture: "dots" | "lines" = "dots"
): Uint8ClampedArray {
  const out = blank(src);
  const { width, height } = src;
  const paper: Rgb = { r: 250, g: 248, b: 242 };
  const ink: Rgb = { r: 20, g: 18, b: 18 };
  // 淡主題色:主題色與紙白各半
  const tint: Rgb = {
    r: Math.round((color.r + paper.r) / 2),
    g: Math.round((color.g + paper.g) / 2),
    b: Math.round((color.b + paper.b) / 2),
  };
  // 切點:balance 往上移,整張圖變暗;四階時每一階窄一點
  const low = (levels === 4 ? 0.14 : 0.18) + balance * 0.3;
  const step = levels === 4 ? 0.2 : 0.3;
  const mid = low + step;
  const high = levels === 4 ? mid + step : mid;
  const cell = Math.max(2, pattern);
  const cos = Math.cos(Math.PI / 4);
  const sin = Math.sin(Math.PI / 4);
  const light = smoothLuminance(src, Math.max(1, Math.round(Math.min(width, height) / 400)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const l = light[y * width + x];
      let rgb: Rgb;

      if (l < low) rgb = ink;
      else if (levels !== 2 && l >= high) rgb = paper;
      else if (levels === 4 && l >= mid) rgb = tint;
      else if (pattern > 0) {
        // 主題色那一階:越暗網點越大、線越粗,空的地方露出下一階的顏色
        const top = levels === 2 ? 1 : mid;
        const t = (top - l) / (top - low);
        const back = levels === 4 ? tint : paper;
        const u = x * cos + y * sin;
        const v = -x * sin + y * cos;
        const amount = Math.max(0.05, Math.min(1, t));
        let inside: boolean;
        if (texture === "lines") {
          const frac = v / cell - Math.floor(v / cell);
          inside = Math.abs(frac - 0.5) * 2 < amount;
        } else {
          const du = u - (Math.floor(u / cell) + 0.5) * cell;
          const dv = v - (Math.floor(v / cell) + 0.5) * cell;
          inside = Math.hypot(du, dv) < cell * Math.sqrt(amount / Math.PI) * 1.1;
        }
        rgb = inside ? color : back;
      } else rgb = color;

      out[i] = rgb.r;
      out[i + 1] = rgb.g;
      out[i + 2] = rgb.b;
      out[i + 3] = src.data[i + 3];
    }
  }
  return out;
}
