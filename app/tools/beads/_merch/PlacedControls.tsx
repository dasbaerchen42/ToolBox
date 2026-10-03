"use client";

import { useState } from "react";
import type { ThemeClasses } from "@/lib/theme";
import type { BeadColor } from "@/lib/tools/beads/palette";
import { artKey, type Placed, type Recolor } from "@/lib/tools/merch/design";
import type { Art } from "@/lib/tools/merch/render";
import { ActionButton, RangeField } from "../../image/_components/controls";

/** 點到最上面那張:由後往前找(後畫的在上面) */
export function hitPlaced(
  stickers: Placed[],
  arts: Map<string, Art>,
  area: { x: number; y: number; width: number; height: number },
  p: { x: number; y: number }
): Placed | null {
  for (let i = stickers.length - 1; i >= 0; i -= 1) {
    const placed = stickers[i];
    const art = arts.get(artKey(placed));
    if (!art) continue;
    // 轉回貼紙自己的座標再比,旋轉過的貼紙也點得準
    const cx = area.x + placed.x * area.width;
    const cy = area.y + placed.y * area.height;
    const a = (-placed.rotation * Math.PI) / 180;
    const dx = (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a);
    const dy = (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a);
    const w = placed.size * area.width;
    const h = (w * art.height) / art.width;
    if (Math.abs(dx) <= w / 2 && Math.abs(dy) <= h / 2) return placed;
  }
  return null;
}

/** 選取框:虛線框住目前選的貼紙 */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  placed: Placed,
  art: Art,
  area: { x: number; y: number; width: number; height: number }
) {
  const w = placed.size * area.width;
  const h = (w * art.height) / art.width;
  ctx.save();
  ctx.translate(area.x + placed.x * area.width, area.y + placed.y * area.height);
  ctx.rotate((placed.rotation * Math.PI) / 180);
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
  ctx.lineDashOffset = 7;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
  ctx.restore();
}

/**
 * 拼豆貼紙換色:列出這張素材用到的每一色,點一色再從色盤挑新的。
 * 換法記在貼紙上(色號 → 色號),素材本身不變,同一份素材可以在不同周邊上是不同顏色。
 */
export function RecolorControls({
  placed,
  getArt,
  palette,
  onChange,
  t,
}: {
  /** 貼紙、吊飾……任何「一份圖 + 換色表」 */
  placed: { artId: string; recolor?: Recolor };
  getArt: (key: string) => Art | null;
  palette: BeadColor[];
  onChange: (recolor: Recolor | undefined) => void;
  t: ThemeClasses;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const base = getArt(placed.artId)?.pattern;
  if (!base) return null;
  const used = [...new Set(base.cells.filter((cell) => cell >= 0))].map((index) => palette[index]).filter(Boolean);
  const recolor = placed.recolor ?? {};
  const byCode = new Map(palette.map((color) => [color.code, color]));
  const changed = Object.keys(recolor).length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-[0.06em]">換色</span>
        {changed && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setEditing(null);
            }}
            className={`rounded-lg border px-2 py-0.5 text-[11px] ${t.secondary}`}
          >
            還原顏色
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {used.map((color) => {
          const now = byCode.get(recolor[color.code] ?? color.code) ?? color;
          return (
            <button
              key={color.code}
              type="button"
              onClick={() => setEditing(editing === color.code ? null : color.code)}
              aria-label={`換掉「${color.name}」，現在是「${now.name}」`}
              aria-pressed={editing === color.code}
              className={`flex items-center gap-0.5 rounded-full border p-0.5 ${editing === color.code ? "border-(--accent)" : "border-(--border-light)"}`}
            >
              <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: color.hex }} />
              {now !== color && (
                <>
                  <span className={`text-[10px] ${t.muted}`}>→</span>
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: now.hex }} />
                </>
              )}
            </button>
          );
        })}
      </div>
      {editing && (
        <div role="group" aria-label="換成哪一色" className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-1">
          {palette.map((color) => (
            <button
              key={color.code}
              type="button"
              title={`${color.code} ${color.name}`}
              aria-label={`換成「${color.name}」`}
              onClick={() => {
                const next = { ...recolor };
                if (color.code === editing) delete next[editing];
                else next[editing] = color.code;
                onChange(Object.keys(next).length > 0 ? next : undefined);
                setEditing(null);
              }}
              className="aspect-square rounded-full border border-black/10"
              style={{ background: color.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 選到的貼紙:大小、旋轉、換色、移到最上面、拿掉 */
export default function PlacedControls({
  stickers,
  selected,
  onChange,
  onSelect,
  getArt,
  palette,
  t,
}: {
  stickers: Placed[];
  selected: string | null;
  onChange: (stickers: Placed[]) => void;
  onSelect: (id: string | null) => void;
  getArt: (key: string) => Art | null;
  palette: BeadColor[];
  t: ThemeClasses;
}) {
  const placed = stickers.find((item) => item.id === selected);
  if (!placed) {
    return (
      <p className={`text-xs leading-6 ${t.muted}`}>
        {stickers.length === 0 ? "從下面的素材點一個加上去。" : "點畫面上的貼紙選取，拖曳移動。"}
      </p>
    );
  }
  const update = (patch: Partial<Placed>) =>
    onChange(stickers.map((item) => (item.id === placed.id ? { ...item, ...patch } : item)));

  return (
    <div className="flex flex-col gap-3">
      <RangeField
        label="貼紙大小"
        display={`${Math.round(placed.size * 100)}%`}
        value={placed.size}
        min={0.08}
        max={1}
        step={0.01}
        onChange={(size) => update({ size })}
        t={t}
      />
      <RangeField
        label="旋轉"
        display={`${placed.rotation}°`}
        value={placed.rotation}
        min={-180}
        max={180}
        onChange={(rotation) => update({ rotation })}
        t={t}
      />
      <RecolorControls
        key={placed.id}
        placed={placed}
        getArt={getArt}
        palette={palette}
        onChange={(recolor) => update({ recolor })}
        t={t}
      />
      <div className="flex flex-wrap gap-2">
        <ActionButton
          tone="secondary"
          t={t}
          onClick={() => onChange([...stickers.filter((item) => item.id !== placed.id), placed])}
        >
          移到最上面
        </ActionButton>
        <ActionButton
          tone="secondary"
          t={t}
          onClick={() => {
            onChange(stickers.filter((item) => item.id !== placed.id));
            onSelect(null);
          }}
        >
          拿掉這張
        </ActionButton>
      </div>
    </div>
  );
}
