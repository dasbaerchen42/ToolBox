"use client";

import type { ReactNode } from "react";
import type { Rect, Size, WorkImage } from "@/lib/tools/image/types";
import type { Placement as MergePlacement } from "@/lib/tools/image/merge";
import type { ThemeClasses } from "@/lib/theme";
import { percent } from "./ImageStage";
import { backgroundStyle } from "./checkerboard";

/** 預覽最高就這麼高,不然拼一張 400×8000 的長圖會把整個版面撐爆 */
const MAX_HEIGHT = 460;

export type Placement = { image: WorkImage; rect: MergePlacement };

type Props = {
  canvas: Size;
  placements: Placement[];
  background: string | null;
  /**
   * 描邊:width 與 rect 都是原圖像素,這裡照比例縮。
   * rect 是邊框所在的那個方框——補過比例之後它不在畫布邊緣上,而是包著原圖。
   */
  border?: { width: number; color: string; rect: Rect } | null;
  caption?: ReactNode;
  t: ThemeClasses;
};

/**
 * 純 CSS 的版面預覽:不碰 canvas、不重新編碼,改參數就即時跟著動。
 *
 * 座標全部換成百分比,所以預覽縮到多小都對得準——跟遮罩疊加層同一套做法。
 * 它是版面預覽不是成品證明,接縫處的次像素不必當真。
 */
export default function CanvasPreview({
  canvas,
  placements,
  background,
  border,
  caption,
  t,
}: Props) {
  if (canvas.width <= 0 || canvas.height <= 0) return null;

  // 先算出「高度剛好到上限」時的寬度,當成 maxWidth。
  // 配上 aspect-ratio,寬度就會自己取 min(欄寬, 這個值),高度永遠不超過上限。
  const maxWidth = (MAX_HEIGHT * canvas.width) / canvas.height;
  const bar = border && border.width > 0 ? border : null;

  return (
    <div className="space-y-2">
      <div className="flex justify-center overflow-hidden rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
        <div
          style={{
            aspectRatio: `${canvas.width} / ${canvas.height}`,
            width: "100%",
            maxWidth,
            ...backgroundStyle(background),
          }}
          className="relative"
        >
          {placements.map(({ image, rect }, index) => (
            /* eslint-disable-next-line @next/next/no-img-element -- blob: URL,next/image 幫不上忙 */
            <img
              key={`${image.id}-${index}`}
              src={image.url}
              alt=""
              className="absolute block"
              style={{
                left: percent(rect.x, canvas.width),
                top: percent(rect.y, canvas.height),
                width: percent(rect.width, canvas.width),
                height: percent(rect.height, canvas.height),
                // 帶 source 表示這格要裁切填滿。CSS 的 cover 跟 coverRect
                // 是同一個算法(等比蓋住、從中間取),所以預覽跟輸出會一致。
                objectFit: rect.source ? "cover" : undefined,
              }}
            />
          ))}

          {bar &&
            // 描邊用四條 div 而不是 CSS border:border-width 不吃百分比,
            // 給固定 px 的話預覽一縮放粗細就不對了
            borderBars(bar.rect, bar.width).map((box, index) => (
              <div
                key={index}
                className="absolute"
                style={{
                  left: percent(box.x, canvas.width),
                  top: percent(box.y, canvas.height),
                  width: percent(box.width, canvas.width),
                  height: percent(box.height, canvas.height),
                  background: bar.color,
                }}
              />
            ))}
        </div>
      </div>

      <p className={`text-center text-xs ${t.muted}`}>
        {caption ?? `${canvas.width} × ${canvas.height}`}
      </p>
    </div>
  );
}

/** 一個方框的四條邊,全部是原圖像素座標 */
function borderBars(rect: Rect, width: number): Rect[] {
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: width },
    { x: rect.x, y: rect.y + rect.height - width, width: rect.width, height: width },
    { x: rect.x, y: rect.y, width, height: rect.height },
    { x: rect.x + rect.width - width, y: rect.y, width, height: rect.height },
  ];
}
