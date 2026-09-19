"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, Ref } from "react";
import { toImagePoint } from "@/lib/tools/image/geometry";
import type { Point, Size, WorkImage } from "@/lib/tools/image/types";

/**
 * 把 pointer 事件換算成原圖像素座標。
 *
 * 所有互動都必須經過這裡:畫面上的圖是被 CSS 縮放過的,
 * 直接用 clientX/clientY 存下來的框在輸出成原解析度時會整個歪掉。
 */
export function pointFromEvent(
  element: HTMLElement,
  event: { clientX: number; clientY: number },
  image: Size
): Point {
  const bounds = element.getBoundingClientRect();

  return toImagePoint(
    { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
    { width: bounds.width, height: bounds.height },
    image
  );
}

/** 原圖座標 → CSS 百分比,疊加層就能跟著圖一起縮放 */
export function percent(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${(value / total) * 100}%`;
}

/** 一次拖曳需要的四個事件,由 useDragRect 產生後整包傳進來 */
export type StagePointerHandlers = {
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type Props = {
  image: WorkImage;
  children?: ReactNode;
  handlers?: StagePointerHandlers;
  cursor?: CSSProperties["cursor"];
  ref?: Ref<HTMLDivElement>;
};

/**
 * 預覽刻意用 <img> + 絕對定位的疊加層,而不是把圖畫進 canvas:
 * 疊加層用百分比定位,視窗怎麼縮都對得準,而且不必為了預覽重畫一次大圖。
 * canvas 只在真的要產生輸出檔時才出現(見 lib/tools/image/render.ts)。
 */
export default function ImageStage({
  image,
  children,
  handlers,
  cursor,
  ref,
}: Props) {
  return (
    // items-start 不能拿掉:這塊是 grid 的一欄,右邊的控制項比圖高時整欄會被拉長,
    // 預設的 align stretch 會把底下那個 relative 容器一起拉高。容器一高,
    // 疊加層的百分比定位與 pointer 座標換算就全部以錯的高度為基準,框會整個偏掉。
    <div className="flex items-start justify-center overflow-auto rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
      <div
        ref={ref}
        {...handlers}
        style={{ cursor, touchAction: "none", maxWidth: image.width }}
        className="relative w-full select-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 來源是 blob: URL,next/image 幫不上忙 */}
        <img
          src={image.url}
          alt={image.name}
          draggable={false}
          className="block w-full"
        />
        {children}
      </div>
    </div>
  );
}
