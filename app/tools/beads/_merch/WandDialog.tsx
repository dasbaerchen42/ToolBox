"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ThemeClasses } from "@/lib/theme";
import { eraseCircle, eraseSelection, opaqueBounds, wandSelect, type Pixels } from "@/lib/tools/image/wand";
import { CHECKERBOARD } from "../../image/_components/checkerboard";
import { ActionButton, RangeField, Segmented } from "../../image/_components/controls";

/** 去背圖的長邊上限:夠當貼紙,也不會讓魔術棒的擴散太慢 */
const MAX_SIDE = 1200;
const HISTORY = 20;

type Mode = "wand" | "eraser";

/**
 * 魔術棒去背:點背景清掉相連的相近色,容許值調範圍,橡皮擦修邊,羽化讓邊緣不鋸齒。
 * 完成時裁到剩下的部分,交回一張透明背景的 canvas。
 */
export default function WandDialog({
  image,
  name,
  onDone,
  onCancel,
  t,
}: {
  image: ImageBitmap;
  name: string;
  onDone: (canvas: HTMLCanvasElement) => void;
  onCancel: () => void;
  t: ThemeClasses;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("wand");
  const [tolerance, setTolerance] = useState(0.15);
  const [feather, setFeather] = useState(1);
  const [brush, setBrush] = useState(24);
  const pixels = useRef<Pixels | null>(null);
  const [history, setHistory] = useState<Uint8ClampedArray[]>([]);
  const erasing = useRef(false);
  const [empty, setEmpty] = useState(false);

  // 縮到上限內,畫進工作 canvas,取出像素
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pixels.current = { width: data.width, height: data.height, data: data.data };
  }, [image]);

  // Esc 關掉
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onCancel]);

  function paint() {
    const canvas = canvasRef.current;
    const px = pixels.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !px || !ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
    setEmpty(opaqueBounds(px) === null);
  }

  function remember() {
    const px = pixels.current;
    if (!px) return;
    const snapshot = new Uint8ClampedArray(px.data);
    setHistory((list) => [...list.slice(-(HISTORY - 1)), snapshot]);
  }

  function toImage(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      scale: canvas.width / rect.width,
    };
  }

  function erase(event: ReactPointerEvent<HTMLCanvasElement>) {
    const px = pixels.current;
    if (!px) return;
    const p = toImage(event);
    eraseCircle(px, p.x, p.y, (brush / 2) * p.scale);
    paint();
  }

  function handleDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const px = pixels.current;
    if (!px) return;
    remember();
    if (mode === "wand") {
      const p = toImage(event);
      const mask = wandSelect(px, p.x, p.y, tolerance);
      pixels.current = { ...px, data: eraseSelection(px, mask, feather) };
      paint();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    erasing.current = true;
    erase(event);
  }

  function undo() {
    const last = history.at(-1);
    const px = pixels.current;
    if (!last || !px) return;
    pixels.current = { ...px, data: last };
    setHistory((list) => list.slice(0, -1));
    paint();
  }

  function finish() {
    const px = pixels.current;
    const bounds = px && opaqueBounds(px);
    if (!px || !bounds) return;
    const full = document.createElement("canvas");
    full.width = px.width;
    full.height = px.height;
    full.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
    const out = document.createElement("canvas");
    out.width = bounds.width;
    out.height = bounds.height;
    out.getContext("2d")?.drawImage(full, -bounds.x, -bounds.y);
    onDone(out);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="魔術棒去背"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
    >
      <div className={`flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-auto rounded-2xl border p-4 ${t.page} ${t.divider}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold tracking-[0.06em]">魔術棒去背</h2>
          <span className={`truncate text-xs ${t.muted}`}>{name}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex min-w-0 justify-center rounded-xl border border-(--border-light) p-2" style={CHECKERBOARD}>
            <canvas
              ref={canvasRef}
              onPointerDown={handleDown}
              onPointerMove={(event) => {
                if (erasing.current) erase(event);
              }}
              onPointerUp={() => {
                erasing.current = false;
              }}
              onPointerCancel={() => {
                erasing.current = false;
              }}
              className="max-h-[60vh] max-w-full touch-none"
              style={{ cursor: mode === "wand" ? "crosshair" : "cell" }}
            />
          </div>

          <div className="flex flex-col gap-4">
            <Segmented
              label="去背工具"
              value={mode}
              onChange={setMode}
              options={[
                { value: "wand", label: "魔術棒" },
                { value: "eraser", label: "橡皮擦" },
              ]}
              t={t}
            />
            {mode === "wand" ? (
              <>
                <RangeField
                  label="容許值"
                  display={`${Math.round(tolerance * 100)}%`}
                  value={tolerance}
                  min={0}
                  max={0.5}
                  step={0.01}
                  onChange={setTolerance}
                  t={t}
                />
                <RangeField
                  label="羽化"
                  display={feather === 0 ? "不羽化" : `${feather} px`}
                  value={feather}
                  min={0}
                  max={4}
                  onChange={setFeather}
                  t={t}
                />
                <p className={`text-xs leading-6 ${t.muted}`}>點背景就清掉相連的相近色；清太多就按復原、把容許值調小再點。</p>
              </>
            ) : (
              <>
                <RangeField
                  label="筆刷大小"
                  display={`${brush} px`}
                  value={brush}
                  min={6}
                  max={80}
                  onChange={setBrush}
                  t={t}
                />
                <p className={`text-xs leading-6 ${t.muted}`}>在圖上拖動擦掉魔術棒沒清乾淨的邊。</p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="secondary" t={t} onClick={undo} disabled={history.length === 0}>
                復原
              </ActionButton>
            </div>
            {empty && <p className="text-xs leading-6">整張都清掉了，按復原找回來。</p>}
            <div className="mt-auto flex flex-wrap gap-2">
              <ActionButton t={t} onClick={finish} disabled={empty}>
                完成，加進素材
              </ActionButton>
              <ActionButton tone="secondary" t={t} onClick={onCancel}>
                取消
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
