// 把一段循環動畫編成 GIF 或影片,全部在瀏覽器裡做,不上傳。
//
// draw(ctx, t) 畫出一圈裡 t(0–1)那一格;這裡只負責一格一格叫它畫、再編碼。
// GIF:每格最多 256 色、透明只有全有全無,所以一律鋪淡色底;
// 影片:用 MediaRecorder 即時錄 canvas,能錄 MP4 就錄 MP4(手機相簿比較吃),不行才 WebM。

import { applyPalette, GIFEncoder, quantize } from "gifenc";

export type LoopDrawer = (ctx: CanvasRenderingContext2D, t: number) => void;

export type LoopSpec = {
  /** 輸出的像素大小 */
  width: number;
  height: number;
  /** 畫每一格前鋪的底色 */
  background: string;
  draw: LoopDrawer;
  /** 一圈幾秒 */
  seconds: number;
  fps: number;
  /** 進度 0–1 */
  onProgress?: (progress: number) => void;
};

/** 讓瀏覽器喘口氣:畫面不會卡住、進度字才更新得出來 */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

function frameCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("無法建立繪圖環境");
  return { canvas, ctx };
}

function paintFrame(ctx: CanvasRenderingContext2D, spec: LoopSpec, t: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = spec.background;
  ctx.fillRect(0, 0, spec.width, spec.height);
  ctx.restore();
  ctx.save();
  spec.draw(ctx, t);
  ctx.restore();
}

/** 一圈 → 無限循環的 GIF。每格各自算 256 色的色表,漸層比較不會一階一階 */
export async function encodeGif(spec: LoopSpec): Promise<Blob> {
  const { ctx } = frameCanvas(spec.width, spec.height);
  const frames = Math.max(2, Math.round(spec.fps * spec.seconds));
  // GIF 的延遲以 10ms 為單位,算好再交出去,總長才不會越錄越偏
  const delay = Math.round(100 / spec.fps) * 10;
  const gif = GIFEncoder();
  for (let i = 0; i < frames; i += 1) {
    paintFrame(ctx, spec, i / frames);
    const { data } = ctx.getImageData(0, 0, spec.width, spec.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, spec.width, spec.height, { palette, delay, repeat: 0 });
    spec.onProgress?.((i + 1) / frames);
    await breathe();
  }
  gif.finish();
  return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
}

// 先找 H.264 的 MP4(iPhone 相簿、LINE 都吃);沒有就 WebM。
// 只寫「video/mp4」不指定編碼時,有些 Chromium 會把 VP9 塞進 MP4,iPhone 播不了,所以放最後(給只會 MP4 的 Safari)。
const VIDEO_TYPES: { mime: string; ext: "mp4" | "webm" }[] = [
  { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
  { mime: "video/mp4;codecs=avc1", ext: "mp4" },
  { mime: "video/webm;codecs=vp9", ext: "webm" },
  { mime: "video/webm;codecs=vp8", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
  { mime: "video/mp4", ext: "mp4" },
];

/** 這個瀏覽器能錄哪一種影片;都不行就是 null(按鈕不顯示) */
export function videoFormat(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined") return null;
  if (!("captureStream" in HTMLCanvasElement.prototype)) return null;
  return VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type.mime)) ?? null;
}

/**
 * 即時錄影:照真實時間播 loops 圈,錄下來。要花跟影片一樣長的時間。
 * 寬高取偶數,有些編碼器遇到奇數會失敗。
 */
export async function recordVideo(spec: LoopSpec & { loops: number }): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const format = videoFormat();
  if (!format) throw new Error("這個瀏覽器不能錄影片");
  const width = spec.width - (spec.width % 2);
  const height = spec.height - (spec.height % 2);
  const { canvas, ctx } = frameCanvas(width, height);
  // Safari 不在畫面上的 canvas 有時錄不到東西:掛上去、但看不到也點不到
  canvas.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
  document.body.appendChild(canvas);

  const sized = { ...spec, width, height };
  paintFrame(ctx, sized, 0);
  const stream = canvas.captureStream(spec.fps);
  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const total = spec.seconds * spec.loops * 1000;
  try {
    recorder.start(250);
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= total) {
          resolve();
          return;
        }
        paintFrame(ctx, sized, (elapsed / (spec.seconds * 1000)) % 1);
        spec.onProgress?.(elapsed / total);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    paintFrame(ctx, sized, 0);
    recorder.stop();
    await stopped;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    canvas.remove();
  }
  spec.onProgress?.(1);
  return { blob: new Blob(chunks, { type: format.mime.split(";")[0] }), ext: format.ext };
}
