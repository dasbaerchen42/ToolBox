// 瀏覽器對單張 canvas 有上限,iOS Safari 最嚴(總面積約 16.7M 裝置像素),
// 超過會直接吐出空白圖——不會報錯,所以一定要自己先擋。抓保守一點。
export const DEVICE_MAX_SIDE = 8192;
export const DEVICE_MAX_AREA = 16_000_000;

export type CanvasLimit =
  | { ok: true }
  | { ok: false; reason: "side" | "area"; width: number; height: number };

/** 這個尺寸的 canvas 畫得出來嗎?scale 是輸出像素密度(1 就是原尺寸) */
export function checkCanvasSize(
  width: number,
  height: number,
  scale = 1
): CanvasLimit {
  const w = Math.ceil(width * scale);
  const h = Math.ceil(height * scale);

  if (w > DEVICE_MAX_SIDE || h > DEVICE_MAX_SIDE) {
    return { ok: false, reason: "side", width: w, height: h };
  }
  if (w * h > DEVICE_MAX_AREA) {
    return { ok: false, reason: "area", width: w, height: h };
  }
  return { ok: true };
}

/** 超過上限時丟這個,UI 才知道要提示使用者先切小 */
export class CanvasTooLargeError extends Error {
  constructor(readonly limit: Extract<CanvasLimit, { ok: false }>) {
    super(
      limit.reason === "side"
        ? `圖片邊長 ${limit.width}×${limit.height} 超過瀏覽器上限 ${DEVICE_MAX_SIDE}px`
        : `圖片總面積 ${limit.width}×${limit.height} 超過瀏覽器上限`
    );
    this.name = "CanvasTooLargeError";
  }
}

/** 檢查不過就直接丟錯,呼叫端少寫一次 if */
export function assertCanvasSize(width: number, height: number, scale = 1): void {
  const result = checkCanvasSize(width, height, scale);
  if (!result.ok) throw new CanvasTooLargeError(result);
}

/**
 * 等比縮到畫得出來的最大尺寸;本來就畫得出來就原封不動。
 * 手機原相機動輒 2400 萬、4800 萬像素,不先縮的話每個工具都會撞上限。
 */
export function fitWithinCanvas(width: number, height: number): { width: number; height: number } {
  if (checkCanvasSize(width, height).ok) return { width, height };

  const scale = Math.min(
    DEVICE_MAX_SIDE / width,
    DEVICE_MAX_SIDE / height,
    Math.sqrt(DEVICE_MAX_AREA / (width * height))
  );
  let w = Math.max(1, Math.floor(width * scale));
  let h = Math.max(1, Math.floor(height * scale));
  // 取整之後還是可能剛好壓線超過一點點,再收一像素
  while (!checkCanvasSize(w, h).ok) {
    if (w >= h) w -= 1;
    else h -= 1;
  }
  return { width: w, height: h };
}
