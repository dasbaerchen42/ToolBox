"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * 設計畫布:畫的時候用設計單位,canvas 實際解析度跟著顯示大小與螢幕密度走。
 * paint 每次都重設變換再畫,動畫的每一格直接呼叫它。
 */
export function useDesignCanvas(width: number, height: number) {
  const ref = useRef<HTMLCanvasElement>(null);

  const paint = useCallback(
    (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = ref.current;
      if (!canvas) return;
      const shown = canvas.getBoundingClientRect().width || width;
      const ratio = Math.min(2, Math.max(0.5, (shown * (window.devicePixelRatio || 1)) / width));
      const pw = Math.round(width * ratio);
      const ph = Math.round(height * ratio);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.setTransform(pw / width, 0, 0, ph / height, 0, 0);
      draw(ctx);
    },
    [width, height]
  );

  /** 指標位置 → 設計單位;scale 是一個 CSS 像素等於幾個設計單位 */
  const toDesign = useCallback(
    (event: ReactPointerEvent | PointerEvent) => {
      const canvas = ref.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || rect.width === 0) return { x: 0, y: 0, scale: 1 };
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height,
        scale: width / rect.width,
      };
    },
    [width, height]
  );

  // 顯示大小變了(轉手機、拉視窗)要重畫一次,解析度才跟得上
  const [size, setSize] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const style = {
    aspectRatio: `${width} / ${height}`,
    width: `min(100%, calc(68vh * ${width / height}))`,
  };

  return { ref, paint, toDesign, style, size };
}

/** 手機傾斜:iOS 要使用者按一下才給權限,其他瀏覽器直接有 */
export function needsMotionPermission(): boolean {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return false;
  return typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
}

type Permissioned = { requestPermission?: () => Promise<string> };

export async function requestMotionPermission(): Promise<boolean> {
  // 要從類別本身呼叫,拆出來單獨呼叫會丟 Illegal invocation
  const orientation = DeviceOrientationEvent as unknown as Permissioned;
  const motion = (typeof DeviceMotionEvent !== "undefined" ? DeviceMotionEvent : {}) as unknown as Permissioned;
  try {
    const results = await Promise.all([orientation.requestPermission?.(), motion.requestPermission?.()]);
    return results.every((result) => result === undefined || result === "granted");
  } catch {
    return false;
  }
}
