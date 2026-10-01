"use client";

import { useState } from "react";
import type { BeadColor } from "@/lib/tools/beads/palette";
import type { ColorCount } from "@/lib/tools/beads/pattern";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  palette: BeadColor[];
  counts: ColorCount[];
  /** false = 只看顆數(動畫中、或已經落豆了),不能清色、換色、選色 */
  canEdit: boolean;
  t: ThemeClasses;
  /** 點色名:拿這個顏色來畫 */
  onPick: (index: number) => void;
  /** 整色清成空格(可以復原) */
  onClear: (index: number) => void;
  /** 色位換色:這一色的每一顆都換成另一色(可以復原) */
  onRecolor: (from: number, to: number) => void;
};

/**
 * 用到哪些顏色、各要幾顆。每一列也是一個「色位」:
 * 換一個色,整張圖用到這色的地方一起換,不必逐顆改。
 */
export default function ColorList({ palette, counts, canEdit, t, onPick, onClear, onRecolor }: Props) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const [recoloring, setRecoloring] = useState<number | null>(null);

  return (
    <div className={`border-t pt-4 ${t.divider}`}>
      <p className="mb-1 text-xs tracking-[0.08em]">
        用到 {counts.length} 色・共 {total} 顆
      </p>
      <p className={`mb-2 text-[11px] leading-5 ${t.muted}`}>
        每一色都是一個色位：按「換色」挑新顏色，整張圖用到這色的地方一起換。
      </p>

      <ul className="space-y-1">
        {counts.map(({ index, count }) => (
          <li key={index} className="text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPick(index)}
                disabled={!canEdit}
                title="拿這個顏色來畫"
                className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 rounded-full border border-(--border-light)"
                  style={{ background: palette[index].hex }}
                />
                <span className={`w-8 shrink-0 font-mono text-[11px] ${t.muted}`}>
                  {palette[index].code}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {palette[index].name}
                  <span className={`ml-1.5 text-[10px] ${t.muted}`}>{palette[index].reading}</span>
                </span>
              </button>
              <span className={`shrink-0 tabular-nums ${t.muted}`}>{count} 顆</span>
              <button
                type="button"
                onClick={() => setRecoloring(recoloring === index ? null : index)}
                disabled={!canEdit}
                aria-expanded={recoloring === index}
                className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${
                  recoloring === index ? t.selected : t.secondary
                }`}
                aria-label={`替「${palette[index].name}」換色`}
              >
                換色
              </button>
              <button
                type="button"
                onClick={() => onClear(index)}
                disabled={!canEdit}
                className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
                aria-label={`清掉「${palette[index].name}」`}
              >
                清掉
              </button>
            </div>

            {recoloring === index && canEdit && (
              <div
                role="group"
                aria-label={`「${palette[index].name}」要換成哪個顏色`}
                className="mt-1.5 mb-2 grid grid-cols-10 gap-1 rounded-xl border border-(--border-light) p-1.5"
              >
                {palette.map((item, target) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setRecoloring(null);
                      onRecolor(index, target);
                    }}
                    disabled={target === index}
                    aria-label={`換成${item.name}（${item.reading}）`}
                    title={`${item.code} ${item.name} ${item.reading}`}
                    className="aspect-square w-full rounded-full border border-(--border-light) transition hover:scale-110 disabled:opacity-30"
                    style={{ background: item.hex }}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
