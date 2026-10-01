// 色彩換算:sRGB ↔ 線性 RGB ↔ OKLab。
// 找「最接近的豆子」要在人眼感知的色彩空間裡量距離,
// 直接拿 RGB 算的話膚色與陰影會被拉去奇怪的顏色。

export type Rgb = { r: number; g: number; b: number };
export type Lab = { L: number; a: number; b: number };

/** 0–255 的 sRGB 通道 → 0–1 的線性光 */
export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 0–1 的線性光 → 0–255 的 sRGB 通道(已四捨五入並夾在範圍內) */
export function linearToSrgb(value: number): number {
  const v = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(v * 255)));
}

/** 線性 RGB(0–1)→ OKLab */
export function linearToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function rgbToOklab({ r, g, b }: Rgb): Lab {
  return linearToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
}

/** 距離的平方就夠比大小了,省一次開根號 */
export function labDistanceSq(x: Lab, y: Lab): number {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return dL * dL + da * da + db * db;
}

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** 往白(amount > 0)或往黑(amount < 0)混,用來做豆子的亮面與暗面 */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return rgbToHex({ r: mix(r), g: mix(g), b: mix(b) });
}
