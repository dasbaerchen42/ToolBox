"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ThemeClasses } from "@/lib/theme";
import { shade } from "@/lib/tools/beads/color";
import { drawLooseBead, type BeadShades } from "@/lib/tools/beads/draw";
import { DEFAULT_PALETTE } from "@/lib/tools/beads/palette";
import {
  BEADS_PER_CELL,
  BOX_LEVELS,
  BOX_SHAPES,
  isLocked,
  isSorted,
  MAX_BOX_PALETTES,
  newlyCorrect,
  newSortBox,
  pickBead,
  rewardColors,
  straysLeft,
  swapCells,
  type BoxLevel,
  type BoxShape,
  type BoxStore,
  type SortBox,
} from "@/lib/tools/beads/sortbox";
import { ActionButton, Field, Segmented, StationHint, Toggle } from "../../image/_components/controls";

/** 收納盒是實體的塑膠盒,不跟著網站主題換色 */
const TRAY = "#f6f4ef";
const WALL = "#dcd8ce";
const FLOOR = "#f1eee8";
/** 卡住的格子:底比較深、隔板比較深 */
const FLOOR_SUNK = "#e2ded4";
const WALL_SUNK = "#bdb6a7";
const SNAP_MS = 260;
/** 色條太窄(手機上一格不到這麼寬)就直著放 */
const MIN_STRIP_CELL = 34;

/** 每一格的左上角;色輪另外記圓心與半徑(畫圓環盒用) */
type Layout = {
  cell: number;
  width: number;
  height: number;
  origins: { x: number; y: number }[];
  ring: { cx: number; cy: number; r: number } | null;
};

function shadesOf(hex: string): BeadShades {
  return { base: hex, light: shade(hex, 0.45), dark: shade(hex, -0.35) };
}

/** 一格裡七顆豆子的位置(相對格子中心,以格寬為 1):中間一顆、旁邊六顆,每格轉一點角度才不會整齊得像印的 */
function beadSpots(pos: number): { x: number; y: number }[] {
  const turn = ((pos * 47) % 60) * (Math.PI / 180);
  const spots = [{ x: 0, y: 0 }];
  for (let k = 0; k < BEADS_PER_CELL - 1; k += 1) {
    const angle = turn + (k * Math.PI * 2) / (BEADS_PER_CELL - 1);
    const wobble = 0.255 + (((pos * 13 + k * 7) % 5) - 2) * 0.008;
    spots.push({ x: Math.cos(angle) * wobble, y: Math.sin(angle) * wobble });
  }
  return spots;
}

const BEAD_SIZE = 0.27;

const START_MESSAGES: Record<BoxShape, string> = {
  strip: "兩端的顏色固定住了，把中間排成順順的漸層。",
  three: "兩端和正中間固定住了，前半段往中間、後半段往另一端，排成兩段漸層。",
  box: "四個角固定住了，把中間排成順順的漸層。",
  big: "8×8 的大盒子，四個角固定住了，慢慢排。",
  wheel: "色輪繞一圈會回到原點。最上面相鄰的兩格固定住了，照那個方向把顏色排一圈。",
};

/** 「喀」一聲:很短的一下高頻,用 WebAudio 現做,不必載音檔 */
function useClick() {
  const audio = useRef<AudioContext | null>(null);
  return useCallback((pitch = 1) => {
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 1700 * pitch;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // 沒有聲音也能玩
    }
  }, []);
}

/**
 * 整理豆盒:打翻的分格收納盒,拖兩格互換(或點一格再點另一格),
 * 排對的格子「喀」一聲卡進去。整理好之後用鑷子挑出混進去的雜豆,
 * 最後整盒收進收藏冊,變成拼豆板上能用的一組新色盤。沒有計時、沒有分數。
 */
export default function SortBoxGame({
  store,
  onCollect,
  onRemove,
  active,
  t,
}: {
  store: BoxStore;
  onCollect: (box: SortBox) => void;
  onRemove: (id: string) => void;
  active: boolean;
  t: ThemeClasses;
}) {
  const [shape, setShape] = useState<BoxShape>("strip");
  const [level, setLevel] = useState<BoxLevel>("easy");
  const [withStrays, setWithStrays] = useState(true);
  const [sound, setSound] = useState(true);
  const [box, setBox] = useState<SortBox>(() => newSortBox("strip", "easy", DEFAULT_PALETTE));
  const [selected, setSelected] = useState<number | null>(null);
  const [collected, setCollected] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snaps = useRef(new Map<number, number>());
  const drag = useRef<{ from: number; x: number; y: number; moved: boolean } | null>(null);
  const frame = useRef(0);
  const click = useClick();

  const sorted = isSorted(box);
  const strays = withStrays ? straysLeft(box) : 0;
  const picking = sorted && strays > 0;
  const done = sorted && strays === 0;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo<Layout | null>(() => {
    if (width === 0) return null;
    const pad = 10;
    const n = box.cells.length;
    if (box.shape === "wheel") {
      // 色輪:一圈格子排在圓上。半徑與格子大小一起算,讓相鄰兩格剛好不重疊
      const size = Math.min(width, 440) - pad * 2;
      const k = 0.9 * Math.sin(Math.PI / n);
      const radius = size / 2 / (1 + k);
      const cell = Math.floor(Math.min(64, 2 * radius * k));
      const side = Math.ceil(radius * 2 + cell + pad * 2);
      const c = side / 2;
      const origins = Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
        return { x: c + Math.cos(a) * radius - cell / 2, y: c + Math.sin(a) * radius - cell / 2 };
      });
      return { cell, width: side, height: side, origins, ring: { cx: c, cy: c, r: radius } };
    }
    const linear = box.shape === "strip" || box.shape === "three";
    const vertical = linear && (width - pad * 2) / box.cols < MIN_STRIP_CELL;
    const across = vertical ? box.rows : box.cols;
    const down = vertical ? box.cols : box.rows;
    const room = (vertical ? Math.min(width, 120) : width) - pad * 2;
    // 直著放的色條很長,格子小一點才不會拉得太長
    const cell = Math.floor(Math.min(vertical ? 56 : 84, room / across));
    const origins = Array.from({ length: n }, (_, pos) => {
      const col = pos % box.cols;
      const row = Math.floor(pos / box.cols);
      const [x, y] = vertical ? [row, col] : [col, row];
      return { x: pad + x * cell, y: pad + y * cell };
    });
    return { cell, width: cell * across + pad * 2, height: cell * down + pad * 2, origins, ring: null };
  }, [width, box.shape, box.cols, box.rows, box.cells.length]);

  /** 位置 → 格子左上角(CSS px) */
  const cellOrigin = useCallback((pos: number) => layout?.origins[pos] ?? { x: 0, y: 0 }, [layout]);

  const cellAt = useCallback(
    (x: number, y: number): number | null => {
      if (!layout) return null;
      const index = layout.origins.findIndex((o) => x >= o.x && x < o.x + layout.cell && y >= o.y && y < o.y + layout.cell);
      return index < 0 ? null : index;
    },
    [layout]
  );

  const draw = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !layout) return false;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(layout.width * ratio);
      const ph = Math.round(layout.height * ratio);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, layout.width, layout.height);

      const { cell } = layout;
      // 盒子本體:方盒,或色輪的圓環盒
      ctx.fillStyle = TRAY;
      ctx.strokeStyle = WALL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (layout.ring) {
        const { cx, cy, r } = layout.ring;
        ctx.arc(cx, cy, r + cell * 0.78, 0, Math.PI * 2);
        ctx.arc(cx, cy, Math.max(4, r - cell * 0.78), 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.stroke();
      } else {
        ctx.roundRect(1, 1, layout.width - 2, layout.height - 2, 12);
        ctx.fill();
        ctx.stroke();
      }

      const bead = cell * BEAD_SIZE;
      let animating = false;
      const dragging = drag.current?.moved ? drag.current : null;

      /**
       * 一格。sunk = 已經卡住(端點或排對了):格子底比較深、內緣有陰影、
       * 豆子小一點暗一點,像壓進盒子裡;還能動的格子底比較亮、微微浮起。
       */
      const drawCell = (pos: number, x: number, y: number, lift: number, sunk: boolean) => {
        const inset = cell * 0.06;
        const fx = x + inset;
        const fy = y + inset;
        const fw = cell - inset * 2;
        const radius = cell * 0.14;
        ctx.save();
        if (lift > 0) {
          ctx.shadowColor = "rgba(40, 30, 20, 0.28)";
          ctx.shadowBlur = 10 * lift;
          ctx.shadowOffsetY = 4 * lift;
        } else if (!sunk) {
          ctx.shadowColor = "rgba(40, 30, 20, 0.14)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetY = 1.5;
        }
        ctx.fillStyle = sunk ? FLOOR_SUNK : FLOOR;
        ctx.beginPath();
        ctx.roundRect(fx, fy, fw, fw, radius);
        ctx.fill();
        ctx.restore();

        const hex = box.targets[box.cells[pos]];
        const shades = shadesOf(hex);
        const squeeze = sunk ? 0.92 : 1;
        const drop = sunk ? cell * 0.02 : 0;
        beadSpots(pos).forEach((spot, slot) => {
          const stray = withStrays && sorted ? box.strays.find((st) => st.pos === pos && st.slot === slot) : undefined;
          if (stray?.picked) return;
          drawLooseBead(
            ctx,
            x + cell / 2 + spot.x * cell * squeeze,
            y + cell / 2 + spot.y * cell * squeeze + drop,
            bead * squeeze,
            stray ? shadesOf(stray.hex) : shades,
            pos * 11 + slot
          );
        });

        if (sunk) {
          // 內緣陰影:上緣與左緣深一點,像格子往下凹;整格再蒙一層淡淡的暗
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(fx, fy, fw, fw, radius);
          ctx.clip();
          ctx.fillStyle = "rgba(70, 55, 35, 0.07)";
          ctx.fillRect(fx, fy, fw, fw);
          const shadow = ctx.createLinearGradient(fx, fy, fx + fw * 0.35, fy + fw * 0.35);
          shadow.addColorStop(0, "rgba(70, 55, 35, 0.32)");
          shadow.addColorStop(1, "rgba(70, 55, 35, 0)");
          ctx.strokeStyle = shadow;
          ctx.lineWidth = Math.max(3, cell * 0.09);
          ctx.beginPath();
          ctx.roundRect(fx, fy, fw, fw, radius);
          ctx.stroke();
          ctx.restore();
        }
      };

      for (let pos = 0; pos < box.cells.length; pos += 1) {
        if (dragging && dragging.from === pos) continue;
        const origin = cellOrigin(pos);
        const sunk = isLocked(box, pos);
        const snapStart = snaps.current.get(pos);
        let scale = 1;
        if (snapStart !== undefined) {
          // 卡進去:往下按一下再回到凹下去的位置
          const p = (now - snapStart) / SNAP_MS;
          if (p >= 1) snaps.current.delete(pos);
          else {
            scale = 1 - Math.sin(p * Math.PI) * 0.08;
            animating = true;
          }
        }
        ctx.save();
        ctx.translate(origin.x + cell / 2, origin.y + cell / 2);
        ctx.scale(scale, scale);
        ctx.translate(-origin.x - cell / 2, -origin.y - cell / 2);
        drawCell(pos, origin.x, origin.y, selected === pos ? 1 : 0, sunk);
        ctx.restore();

        // 隔板:卡住的格子是深一點的實線,還能動的是淡淡的細線
        ctx.strokeStyle = sunk ? WALL_SUNK : WALL;
        ctx.lineWidth = sunk ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.roundRect(origin.x + 1, origin.y + 1, cell - 2, cell - 2, layout.ring ? cell * 0.2 : 2);
        ctx.stroke();
        if (box.anchors.includes(pos)) {
          ctx.fillStyle = "#a59e8f";
          ctx.beginPath();
          ctx.arc(origin.x + cell * 0.13, origin.y + cell * 0.13, Math.max(2, cell * 0.04), 0, Math.PI * 2);
          ctx.fill();
        }
        if (selected === pos) {
          ctx.strokeStyle = "#8a6d3b";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(origin.x + 3, origin.y + 3, cell - 6, cell - 6);
          ctx.setLineDash([]);
        }
        if (showHint && picking && box.strays.some((st) => st.pos === pos && !st.picked)) {
          ctx.strokeStyle = "rgba(192, 87, 62, 0.85)";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(origin.x + 3, origin.y + 3, cell - 6, cell - 6);
        }
      }

      // 拖著的那一格浮在最上面,跟著手指走
      if (dragging) {
        drawCell(dragging.from, dragging.x - cell / 2, dragging.y - cell / 2, 1.2, false);
      }
      return animating;
    },
    [layout, box, cellOrigin, selected, sorted, withStrays, showHint, picking]
  );

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const loop = (now: number) => {
      if (draw(now)) frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, [draw]);

  useEffect(() => {
    if (active) schedule();
    return () => cancelAnimationFrame(frame.current);
  }, [active, schedule]);

  function startNew(nextShape = shape, nextLevel = level) {
    setBox(newSortBox(nextShape, nextLevel, DEFAULT_PALETTE));
    setSelected(null);
    setCollected(false);
    setShowHint(false);
    snaps.current.clear();
    setMessage(START_MESSAGES[nextShape]);
  }

  function trySwap(a: number, b: number) {
    const next = swapCells(box, a, b);
    if (next === box) {
      setMessage(isLocked(box, b) ? "那一格已經卡好了，換別格。" : null);
      return;
    }
    const snapped = newlyCorrect(box, next);
    const now = performance.now();
    snapped.forEach((pos) => snaps.current.set(pos, now));
    if (snapped.length > 0 && sound) click(1 + snapped.length * 0.08);
    setBox(next);
    if (isSorted(next)) {
      setMessage(
        withStrays && straysLeft(next) > 0
          ? `整理好了！不過有 ${new Set(next.strays.map((s) => s.pos)).size} 格混進了顏色差一點點的雜豆，用鑷子（點一下）把它們挑出來。`
          : "整理好了，整盒都是順順的漸層。"
      );
    } else setMessage(null);
  }

  function pointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handleDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const p = pointer(event);
    const pos = cellAt(p.x, p.y);
    if (pos === null || !layout) return;
    if (picking) {
      // 鑷子:找最近的那一顆豆子
      const origin = cellOrigin(pos);
      let best = { slot: -1, d: Infinity };
      beadSpots(pos).forEach((spot, slot) => {
        const d = Math.hypot(origin.x + layout.cell / 2 + spot.x * layout.cell - p.x, origin.y + layout.cell / 2 + spot.y * layout.cell - p.y);
        if (d < best.d) best = { slot, d };
      });
      if (best.d > Math.max(layout.cell * BEAD_SIZE * 0.8, 14)) return;
      const result = pickBead(box, pos, best.slot);
      if (result.hit) {
        if (sound) click(1.35);
        setBox(result.box);
        const left = straysLeft(result.box);
        setMessage(left > 0 ? `挑出一顆，還有 ${left} 顆。` : "雜豆都挑乾淨了。");
      } else setMessage("這顆是對的，再看仔細一點。");
      return;
    }
    if (sorted) return;
    if (selected !== null && selected !== pos) {
      trySwap(selected, pos);
      setSelected(null);
      return;
    }
    if (isLocked(box, pos)) {
      setMessage(box.anchors.includes(pos) ? "角落有圓釘的是固定的端點，不能動。" : "這一格已經卡好了。");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: pos, x: p.x, y: p.y, moved: false };
    setSelected(pos);
  }

  function handleMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const current = drag.current;
    if (!current) return;
    const p = pointer(event);
    if (!current.moved && Math.hypot(p.x - current.x, p.y - current.y) < 6) return;
    drag.current = { ...current, x: p.x, y: p.y, moved: true };
    schedule();
  }

  function handleUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (!current.moved) {
      // 只是點一下:選起來,等下一次點另一格
      schedule();
      return;
    }
    const p = pointer(event);
    const target = cellAt(p.x, p.y);
    setSelected(null);
    if (target !== null && target !== current.from) trySwap(current.from, target);
    else schedule();
  }

  const reward = done ? rewardColors(box) : [];
  const full = store.boxes.length >= MAX_BOX_PALETTES;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="flex min-w-0 flex-col gap-3">
        <div ref={wrapRef} className="flex justify-center rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
          <canvas
            ref={canvasRef}
            className={`touch-none ${picking ? "cursor-crosshair" : "cursor-grab"}`}
            data-phase={done ? "done" : picking ? "pick" : "sort"}
            data-locked={box.cells.map((_, pos) => (isLocked(box, pos) ? "1" : "0")).join("")}
            style={layout ? { width: layout.width, height: layout.height } : { width: "100%", height: 120 }}
            aria-label={picking ? "豆盒：點一下雜豆把它挑出來" : "豆盒：拖一格到另一格互換，或點一格再點另一格"}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={() => {
              drag.current = null;
              setSelected(null);
            }}
          />
        </div>
        <p aria-live="polite" className={`min-h-6 text-center text-xs leading-6 tracking-[0.04em] ${t.muted}`}>
          {message ?? (sorted ? "" : "拖一格到另一格互換，或點一格再點另一格。排對的會「喀」一聲卡住。")}
        </p>
        {picking && (
          <div className="flex justify-center">
            <ActionButton tone="secondary" t={t} onClick={() => setShowHint((value) => !value)}>
              {showHint ? "收起提示" : "看不出來，圈出是哪幾格"}
            </ActionButton>
          </div>
        )}
        {done && (
          <div className={`space-y-3 rounded-2xl border p-3 ${t.subPanel}`}>
            <p className="text-sm tracking-[0.06em]">整理好的豆盒：{reward.length} 個顏色</p>
            <div className="flex flex-wrap gap-1">
              {reward.map((hex) => (
                <span key={hex} className="h-6 w-6 rounded-full border border-black/10" style={{ background: hex }} title={hex} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                t={t}
                disabled={collected || full}
                onClick={() => {
                  onCollect(box);
                  setCollected(true);
                  setMessage("收進收藏冊了。回到「拼豆」，選色的最後面就有這組顏色（色號 B 開頭）。");
                }}
              >
                {collected ? "已收進收藏冊" : full ? `最多收 ${MAX_BOX_PALETTES} 盒` : "收進收藏冊當色盤"}
              </ActionButton>
              <ActionButton tone="secondary" t={t} onClick={() => startNew()}>
                再打翻一盒
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <StationHint t={t}>
          一個分格收納盒被打翻了。端點的顏色固定，把其他格子排回順順的漸層；沒有計時，也沒有分數，整理完就是整理完。
        </StationHint>
        <Field label="盒子" t={t}>
          <Segmented
            label="盒子"
            value={shape}
            onChange={(next) => {
              setShape(next);
              startNew(next, level);
            }}
            options={BOX_SHAPES}
            t={t}
          />
        </Field>
        <Field label="難度" hint="越難格子越多、相鄰兩格的顏色越接近。" t={t}>
          <Segmented
            label="難度"
            value={level}
            onChange={(next) => {
              setLevel(next);
              startNew(shape, next);
            }}
            options={BOX_LEVELS}
            t={t}
          />
        </Field>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Toggle label="整理完撿雜豆" checked={withStrays} onChange={setWithStrays} t={t} />
          <Toggle label="「喀」的聲音" checked={sound} onChange={setSound} t={t} />
        </div>
        <ActionButton tone="secondary" t={t} onClick={() => startNew()}>
          打翻一盒新的
        </ActionButton>

        <Field label={`收藏的色盤（${store.boxes.length}／${MAX_BOX_PALETTES}）`} hint="接在預設色盤後面，拼豆板選色時可以用；拿掉後，用過這些顏色的作品會換成最接近的顏色。" t={t}>
          {store.boxes.length === 0 ? (
            <p className={`text-xs leading-6 ${t.muted}`}>還沒有。整理好一盒就能收進來。</p>
          ) : (
            <ul className="space-y-2">
              {store.boxes.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs">{item.name}</span>
                  <span className="flex min-w-0 flex-1 overflow-hidden rounded-full border border-black/10">
                    {item.colors.map((color) => (
                      <span key={color.code} className="h-4 min-w-0 flex-1" style={{ background: color.hex }} title={`${color.code} ${color.hex}`} />
                    ))}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`拿掉「${item.name}」這組色盤？`)) onRemove(item.id);
                    }}
                    className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] ${t.secondary}`}
                  >
                    拿掉
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>
    </div>
  );
}
