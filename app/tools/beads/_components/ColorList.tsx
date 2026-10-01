"use client";

import type { BeadColor } from "@/lib/tools/beads/palette";
import type { ColorCount } from "@/lib/tools/beads/pattern";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  palette: BeadColor[];
  counts: ColorCount[];
  /** false = 只看顆數(動畫中、或已經落豆了),不能清色也不能選色 */
  canEdit: boolean;
  t: ThemeClasses;
  /** 點色名:拿這個顏色來畫 */
  onPick: (index: number) => void;
  /** 整色清成空格(可以復原) */
  onClear: (index: number) => void;
};

/** 用到哪些顏色、各要幾顆 */
export default function ColorList({ palette, counts, canEdit, t, onPick, onClear }: Props) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`border-t pt-4 ${t.divider}`}>
      <p className="mb-2 text-xs tracking-[0.08em]">
        用到 {counts.length} 色・共 {total} 顆
      </p>

      <ul className="space-y-1">
        {counts.map(({ index, count }) => (
          <li key={index} className="flex items-center gap-2 text-xs">
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
              onClick={() => onClear(index)}
              disabled={!canEdit}
              className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
              aria-label={`清掉「${palette[index].name}」`}
            >
              清掉
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
