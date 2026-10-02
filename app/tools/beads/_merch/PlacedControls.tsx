"use client";

import type { ThemeClasses } from "@/lib/theme";
import type { Placed } from "@/lib/tools/merch/design";
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
    const art = arts.get(placed.artId);
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

/** 選到的貼紙:大小、旋轉、移到最上面、拿掉 */
export default function PlacedControls({
  stickers,
  selected,
  onChange,
  onSelect,
  t,
}: {
  stickers: Placed[];
  selected: string | null;
  onChange: (stickers: Placed[]) => void;
  onSelect: (id: string | null) => void;
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
