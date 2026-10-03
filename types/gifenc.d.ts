// gifenc 沒有附型別;只宣告這裡用到的部分。
declare module "gifenc" {
  export type Palette = number[][];
  export type QuantizeOptions = { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean | number };
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: QuantizeOptions): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: "rgb565" | "rgb444" | "rgba4444"
  ): Uint8Array;
  export type FrameOptions = { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean; transparentIndex?: number };
  export type Encoder = {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): Encoder;
}
