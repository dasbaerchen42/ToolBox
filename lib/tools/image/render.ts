// 這一層是唯一碰 canvas 的地方,刻意寫薄:版面計算全部在 geometry / slice /
// merge / frame 那幾支純函式裡算完再傳進來,這裡只負責照著畫。
// (jest 的 testEnvironment 是 node,沒有 canvas,所以這支不寫測試。)
import { assertCanvasSize } from "@/lib/canvas-limits";
import type { FrameLayout } from "./frame";
import { baseNameOf, mimeFor, supportsAlpha } from "./format";
import { spanToRect, type Span } from "./slice";
import type { MergeLayout } from "./merge";
import {
  markScale,
  seededRandom,
  singleCenter,
  tileCenters,
  type NoiseSettings,
  type WatermarkSettings,
} from "./watermark";
import { canvasFontFamily } from "@/lib/web-fonts";
import type {
  Axis,
  MaskRect,
  OutputOptions,
  Point,
  Rect,
  Size,
  WorkImage,
} from "./types";

/** 解不開的圖(最常見是 iPhone 的 HEIC,Chrome 與 Firefox 都不支援) */
export class ImageDecodeError extends Error {
  constructor(readonly fileName: string) {
    super(`無法讀取「${fileName}」,瀏覽器不支援這個格式(HEIC 只有 Safari 解得開)`);
    this.name = "ImageDecodeError";
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 解碼一定要帶 imageOrientation: "from-image",
 * 否則手機拍的 JPEG 會照 EXIF 以外的方向畫出來,變成躺著的。
 */
async function decode(blob: Blob, fileName: string): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new ImageDecodeError(fileName);
  }
}

/** 把一個檔案(或剪貼簿來的 blob)變成工作檯上的一張圖 */
export async function createWorkImage(
  blob: Blob,
  fileName: string
): Promise<WorkImage> {
  const bitmap = await decode(blob, fileName);

  try {
    return {
      id: createId(),
      name: baseNameOf(fileName),
      blob,
      url: URL.createObjectURL(blob),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/** 從畫完的 blob 再做一張 WorkImage,沿用指定的名字 */
async function toWorkImage(blob: Blob, name: string): Promise<WorkImage> {
  const image = await createWorkImage(blob, name);
  return { ...image, name };
}

type DrawOptions = {
  width: number;
  height: number;
  /** null = 不墊底色(輸出格式不支援透明時會自動改用 flattenColor) */
  background: string | null;
  output: OutputOptions;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

async function drawToBlob({
  width,
  height,
  background,
  output,
  draw,
}: DrawOptions): Promise<Blob> {
  assertCanvasSize(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立繪圖環境");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // JPEG 存不住透明,不先墊底色的話透明區域會變成黑的
  const fill =
    background ?? (supportsAlpha(output.format) ? null : output.flattenColor);

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  draw(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("無法產生圖片檔"));
      },
      mimeFor(output.format),
      output.quality
    );
  });
}

/** 遮罩:壓平成新圖,原本的像素在輸出檔裡是真的不見了,不是蓋一層而已 */
export async function applyMasks(
  image: WorkImage,
  masks: MaskRect[],
  output: OutputOptions
): Promise<WorkImage> {
  const bitmap = await decode(image.blob, image.name);

  try {
    const blob = await drawToBlob({
      width: image.width,
      height: image.height,
      background: null,
      output,
      draw: (ctx) => {
        ctx.drawImage(bitmap, 0, 0);
        for (const mask of masks) {
          ctx.fillStyle = mask.color;
          ctx.fillRect(mask.x, mask.y, mask.width, mask.height);
        }
      },
    });

    return toWorkImage(blob, image.name);
  } finally {
    bitmap.close();
  }
}

/** 裁切:只留下框內那塊 */
export async function cropImage(
  image: WorkImage,
  rect: Rect,
  output: OutputOptions
): Promise<WorkImage> {
  const bitmap = await decode(image.blob, image.name);

  try {
    const blob = await drawToBlob({
      width: rect.width,
      height: rect.height,
      background: null,
      output,
      draw: (ctx) => {
        ctx.drawImage(
          bitmap,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          rect.width,
          rect.height
        );
      },
    });

    return toWorkImage(blob, image.name);
  } finally {
    bitmap.close();
  }
}

/** 切割:一張變多張,名字補序號 */
export async function sliceImage(
  image: WorkImage,
  spans: Span[],
  axis: Axis,
  output: OutputOptions
): Promise<WorkImage[]> {
  const bitmap = await decode(image.blob, image.name);
  const width = String(spans.length).length;

  try {
    const pieces: WorkImage[] = [];

    for (const [index, span] of spans.entries()) {
      const rect = spanToRect(span, axis, image);

      const blob = await drawToBlob({
        width: rect.width,
        height: rect.height,
        background: null,
        output,
        draw: (ctx) => {
          ctx.drawImage(
            bitmap,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            0,
            0,
            rect.width,
            rect.height
          );
        },
      });

      const name = `${image.name}-${String(index + 1).padStart(width, "0")}`;
      pieces.push(await toWorkImage(blob, name));
    }

    return pieces;
  } finally {
    bitmap.close();
  }
}

/** 拼接:版面已經在 layoutMerge 算好了,這裡只是照著貼 */
export async function mergeImages(
  images: WorkImage[],
  layout: MergeLayout,
  background: string | null,
  output: OutputOptions,
  name: string
): Promise<WorkImage> {
  const bitmaps = await Promise.all(
    images.map((image) => decode(image.blob, image.name))
  );

  try {
    const blob = await drawToBlob({
      width: layout.canvas.width,
      height: layout.canvas.height,
      background,
      output,
      draw: (ctx) => {
        layout.placements.forEach((place, index) => {
          const bitmap = bitmaps[index];
          if (!bitmap) return;

          // 棋盤的「裁切填滿」會帶 source:從原圖裁一塊填滿整個格子,
          // 不這樣做的話照片會被拉成格子的長寬比
          if (place.source) {
            ctx.drawImage(
              bitmap,
              place.source.x,
              place.source.y,
              place.source.width,
              place.source.height,
              place.x,
              place.y,
              place.width,
              place.height
            );
            return;
          }

          ctx.drawImage(bitmap, place.x, place.y, place.width, place.height);
        });
      },
    });

    return toWorkImage(blob, name);
  } finally {
    for (const bitmap of bitmaps) bitmap.close();
  }
}

export type FrameStyle = {
  /** 沒有描邊就傳 0 */
  borderWidth: number;
  borderColor: string;
  /** 補比例時的底色;null = 保持透明 */
  background: string | null;
};

/** 描邊與補比例共用同一條路:版面算好 → 畫底 → 貼圖 → 描邊 */
export async function applyFrame(
  image: WorkImage,
  layout: FrameLayout,
  style: FrameStyle,
  output: OutputOptions
): Promise<WorkImage> {
  const bitmap = await decode(image.blob, image.name);
  const border = Math.max(0, Math.round(style.borderWidth));

  try {
    const blob = await drawToBlob({
      width: layout.canvas.width,
      height: layout.canvas.height,
      background: style.background,
      output,
      draw: (ctx) => {
        ctx.drawImage(
          bitmap,
          layout.draw.x,
          layout.draw.y,
          layout.draw.width,
          layout.draw.height
        );

        if (border <= 0) return;

        // strokeRect 的線是騎在路徑上的,往內縮半個線寬才會剛好貼齊邊界
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = border;
        ctx.strokeRect(
          border / 2,
          border / 2,
          layout.canvas.width - border,
          layout.canvas.height - border
        );
      },
    });

    return toWorkImage(blob, image.name);
  } finally {
    bitmap.close();
  }
}

/** 浮水印工具的預覽要自己畫,需要解碼後的圖 */
export function loadBitmap(image: WorkImage): Promise<ImageBitmap> {
  return decode(image.blob, image.name);
}

/**
 * 讀進使用者上傳的浮水印圖。
 * 去白底:接近純白的像素變透明,介於之間的依白的程度漸變,
 * 簽名、Logo 掃描或截圖來的白底才不會留下一圈鋸齒白邊。
 */
export async function loadWatermarkImage(
  blob: Blob,
  fileName: string,
  removeWhite: boolean
): Promise<ImageBitmap> {
  const bitmap = await decode(blob, fileName);
  if (!removeWhite) return bitmap;

  try {
    assertCanvasSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("無法建立繪圖環境");

    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const OPAQUE_BELOW = 215;
    const CLEAR_ABOVE = 245;
    for (let i = 0; i < px.length; i += 4) {
      const whiteness = Math.min(px[i], px[i + 1], px[i + 2]);
      if (whiteness <= OPAQUE_BELOW) continue;
      const keep =
        whiteness >= CLEAR_ABOVE
          ? 0
          : (CLEAR_ABOVE - whiteness) / (CLEAR_ABOVE - OPAQUE_BELOW);
      px[i + 3] = Math.round(px[i + 3] * keep);
    }
    ctx.putImageData(data, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    bitmap.close();
  }
}

export type WatermarkAssets = {
  /** 圖片浮水印;文字浮水印時是 null */
  logo: ImageBitmap | null;
  /** 已經換成真實字體名稱的 font-family(見 prepareWatermarkFont) */
  fontFamily: string;
};

const watermarkWeight = (settings: WatermarkSettings) => (settings.bold ? 700 : 400);

/** 畫文字浮水印前先把字體備好;回傳可以直接塞進 ctx.font 的字體名稱 */
export function prepareWatermarkFont(settings: WatermarkSettings): Promise<string> {
  return canvasFontFamily(settings.fontKey, settings.text, watermarkWeight(settings));
}

let noiseTiles: { color: boolean; tile: HTMLCanvasElement } | null = null;

/** 128×128 的雜訊磚,用固定種子,預覽與輸出的顆粒一模一樣 */
function noiseTile(color: boolean): HTMLCanvasElement {
  if (noiseTiles?.color === color) return noiseTiles.tile;

  const size = 128;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext("2d");
  if (!ctx) throw new Error("無法建立繪圖環境");

  const data = ctx.createImageData(size, size);
  const random = seededRandom(20260930);
  for (let i = 0; i < data.data.length; i += 4) {
    const gray = random() * 255;
    data.data[i] = color ? random() * 255 : gray;
    data.data[i + 1] = color ? random() * 255 : gray;
    data.data[i + 2] = color ? random() * 255 : gray;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);

  noiseTiles = { color, tile };
  return tile;
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  size: Size,
  source: CanvasImageSource,
  noise: NoiseSettings,
  grainScale: number
) {
  const layer = document.createElement("canvas");
  layer.width = Math.round(size.width);
  layer.height = Math.round(size.height);
  const lctx = layer.getContext("2d");
  if (!lctx) throw new Error("無法建立繪圖環境");

  const pattern = lctx.createPattern(noiseTile(noise.color), "repeat");
  if (!pattern) return;
  const grain = Math.max(0.25, noise.grain * grainScale);
  pattern.setTransform(new DOMMatrix().scale(grain));

  // 顆粒要銳利,放大時不要被抹成一團霧
  lctx.imageSmoothingEnabled = false;
  lctx.fillStyle = pattern;
  lctx.fillRect(0, 0, layer.width, layer.height);

  // 只留在原圖不透明的地方:透明背景的貼圖不會被灑出一片灰
  lctx.globalCompositeOperation = "destination-in";
  lctx.imageSmoothingEnabled = true;
  lctx.drawImage(source, 0, 0, layer.width, layer.height);

  ctx.save();
  ctx.globalAlpha = noise.opacity;
  ctx.globalCompositeOperation = noise.blend;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/** 在原點畫一個浮水印(中心對齊原點),回傳它的大小給版面計算用 */
function measureMark(
  ctx: CanvasRenderingContext2D,
  size: Size,
  settings: WatermarkSettings,
  assets: WatermarkAssets
): { mark: Size; draw: () => void } | null {
  const scale = markScale(
    size,
    settings.source === "image" ? settings.imageSize : settings.size
  );

  if (settings.source === "image") {
    const logo = assets.logo;
    if (!logo) return null;
    const width = scale;
    const height = (scale * logo.height) / logo.width;
    return {
      mark: { width, height },
      draw: () => ctx.drawImage(logo, -width / 2, -height / 2, width, height),
    };
  }

  const text = settings.text.trim();
  if (!text) return null;

  ctx.font = `${watermarkWeight(settings)} ${scale}px ${assets.fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  const pill = settings.frame === "pill";
  const padX = pill ? scale * 0.7 : 0;
  const padY = pill ? scale * 0.4 : scale * 0.1;
  const width = textWidth + padX * 2;
  const height = scale + padY * 2;
  const line = Math.max(1, scale * 0.08);

  return {
    mark: { width, height },
    draw: () => {
      ctx.fillStyle = settings.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, 0);
      if (!pill) return;
      ctx.strokeStyle = settings.color;
      ctx.lineWidth = line;
      ctx.beginPath();
      ctx.roundRect(
        -width / 2 + line / 2,
        -height / 2 + line / 2,
        width - line,
        height - line,
        (height - line) / 2
      );
      ctx.stroke();
    },
  };
}

function drawMarks(
  ctx: CanvasRenderingContext2D,
  size: Size,
  settings: WatermarkSettings,
  assets: WatermarkAssets
) {
  ctx.save();
  const measured = measureMark(ctx, size, settings, assets);
  if (!measured) {
    ctx.restore();
    return;
  }

  const { mark, draw } = measured;
  const rad = (settings.angle * Math.PI) / 180;
  ctx.globalAlpha = settings.opacity;

  if (settings.layout === "tile") {
    ctx.translate(size.width / 2, size.height / 2);
    ctx.rotate(rad);
    for (const point of tileCenters(size, mark, settings.spacing)) {
      ctx.save();
      ctx.translate(point.x, point.y);
      draw();
      ctx.restore();
    }
  } else {
    const center = singleCenter(size, mark, settings.angle, settings.anchor, settings.margin);
    ctx.translate(center.x, center.y);
    ctx.rotate(rad);
    draw();
  }

  ctx.restore();
}

/**
 * 原圖 → 雜訊 → 浮水印。預覽與輸出都走這一支,只差在畫布大小。
 * 大小都是相對短邊的比例,縮小的預覽畫出來就是等比例的樣子;
 * 只有雜訊顆粒是絕對像素,預覽要傳 grainScale 等比縮。
 */
export function drawWatermarkLayers(
  ctx: CanvasRenderingContext2D,
  size: Size,
  source: CanvasImageSource,
  watermark: WatermarkSettings,
  noise: NoiseSettings,
  assets: WatermarkAssets,
  grainScale = 1
) {
  ctx.drawImage(source, 0, 0, size.width, size.height);
  if (noise.enabled) drawNoise(ctx, size, source, noise, grainScale);
  if (watermark.enabled) drawMarks(ctx, size, watermark, assets);
}

/** 浮水印:壓平成新圖 */
export async function applyWatermark(
  image: WorkImage,
  watermark: WatermarkSettings,
  noise: NoiseSettings,
  assets: WatermarkAssets,
  output: OutputOptions
): Promise<WorkImage> {
  const bitmap = await decode(image.blob, image.name);

  try {
    const blob = await drawToBlob({
      width: image.width,
      height: image.height,
      background: null,
      output,
      draw: (ctx) =>
        drawWatermarkLayers(ctx, image, bitmap, watermark, noise, assets),
    });

    return toWorkImage(blob, image.name);
  } finally {
    bitmap.close();
  }
}

// 滴管每點一下都重新解碼整張圖太慢,留最後一張在手邊
let colorCache: { id: string; bitmap: ImageBitmap } | null = null;

export function clearColorCache(): void {
  colorCache?.bitmap.close();
  colorCache = null;
}

/** 滴管:讀原圖某一點的顏色,回 #rrggbb */
export async function pickColorAt(
  image: WorkImage,
  point: Point
): Promise<string> {
  if (colorCache?.id !== image.id) {
    clearColorCache();
    colorCache = { id: image.id, bitmap: await decode(image.blob, image.name) };
  }

  const x = Math.min(Math.max(Math.round(point.x), 0), image.width - 1);
  const y = Math.min(Math.max(Math.round(point.y), 0), image.height - 1);

  // 只畫 1×1,不用為了取一個顏色把整張圖鋪到 canvas 上
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立繪圖環境");

  ctx.drawImage(colorCache.bitmap, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 工作中的中間產物一律存 PNG。
 *
 * 每按一次「套用」都會重新編碼一次,如果中間就用 JPEG,
 * 遮罩→切割→拼接走下來會累積三代壓縮雜訊。格式只在下載那一刻才套用。
 */
export const WORKING_OUTPUT: OutputOptions = {
  format: "png",
  quality: 1,
  flattenColor: "#ffffff",
};

/** 下載前把工作用的 PNG 轉成使用者選的格式 */
export async function convertForOutput(
  image: WorkImage,
  output: OutputOptions
): Promise<Blob> {
  // 本來就是 PNG 又要輸出 PNG,再編一次只是白白多花時間
  if (output.format === "png" && image.blob.type === "image/png") {
    return image.blob;
  }

  const bitmap = await decode(image.blob, image.name);

  try {
    return await drawToBlob({
      width: image.width,
      height: image.height,
      background: null,
      output,
      draw: (ctx) => ctx.drawImage(bitmap, 0, 0),
    });
  } finally {
    bitmap.close();
  }
}
