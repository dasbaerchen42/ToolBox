// 照片放進框裡時的構圖:框跟照片比例不一樣就得裁,裁哪一塊由使用者決定。
//
// x、y 是「多出來的部分往哪邊讓」:0 = 貼齊左／上,0.5 = 置中,1 = 貼齊右／下。
// 用比例而不是像素記,預覽(縮小的圖)、輸出、批次的每一張都能套同一組。
// zoom ≥ 1:在剛好填滿框的大小上再放大。

export type Framing = { x: number; y: number; zoom: number };

export const DEFAULT_FRAMING: Framing = { x: 0.5, y: 0.5, zoom: 1 };
/** 頭像預設取中間偏上、放大一點:人像的臉通常在上半 */
export const DEFAULT_AVATAR_FRAMING: Framing = { x: 0.5, y: 0.35, zoom: 1.7 };

export const MAX_ZOOM = 4;

type Size = { width: number; height: number };
type Box = { x: number; y: number; width: number; height: number };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

/** 照片要畫在哪、畫多大,才能填滿 box 並照 framing 取景(超出 box 的部分由呼叫端剪掉) */
export function coverRect(from: Size, box: Box, framing: Framing = DEFAULT_FRAMING): Box {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(framing.zoom) ? framing.zoom : 1));
  const scale = Math.max(box.width / from.width, box.height / from.height) * zoom;
  const width = from.width * scale;
  const height = from.height * scale;
  return {
    x: box.x - (width - box.width) * clamp01(framing.x),
    y: box.y - (height - box.height) * clamp01(framing.y),
    width,
    height,
  };
}

/**
 * 在預覽上拖了 (dx, dy) 像素之後的新構圖。
 * 往右拖 = 照片往右移 = 看到更左邊的部分,所以 x 變小;那個方向沒有多出來的部分就不動。
 */
export function dragFraming(framing: Framing, from: Size, box: Box, dx: number, dy: number): Framing {
  const rect = coverRect(from, box, framing);
  const slackX = rect.width - box.width;
  const slackY = rect.height - box.height;
  return {
    ...framing,
    x: slackX > 0.5 ? clamp01(clamp01(framing.x) - dx / slackX) : clamp01(framing.x),
    y: slackY > 0.5 ? clamp01(clamp01(framing.y) - dy / slackY) : clamp01(framing.y),
  };
}

/** 照片在這個框裡有沒有被裁到(比例不同,或放大過) */
export function isCropped(from: Size, box: Box, framing: Framing = DEFAULT_FRAMING): boolean {
  const rect = coverRect(from, box, framing);
  return rect.width - box.width > 1 || rect.height - box.height > 1;
}
