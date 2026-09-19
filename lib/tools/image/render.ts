// 這一層是唯一碰 canvas 的地方,刻意寫薄:版面計算全部在 geometry / slice /
// merge / frame 那幾支純函式裡算完再傳進來,這裡只負責照著畫。
// (jest 的 testEnvironment 是 node,沒有 canvas,所以這支不寫測試。)
import { assertCanvasSize } from "@/lib/canvas-limits";
import type { FrameLayout } from "./frame";
import { baseNameOf, mimeFor, supportsAlpha } from "./format";
import { spanToRect, type Span } from "./slice";
import type { MergeLayout } from "./merge";
import type {
  Axis,
  MaskRect,
  OutputOptions,
  Point,
  Rect,
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
