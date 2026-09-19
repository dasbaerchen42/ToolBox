"use client";

import { useState } from "react";
import {
  buildDivider,
  DIVIDER_MAX,
  DIVIDER_MIN,
  DIVIDER_UNITS,
} from "../_lib/dividers";
import type { ThemeClasses } from "@/lib/theme";
import type { PickMode } from "./palette-parts";
import Segmented from "@/components/segmented";

type Props = {
  mode: PickMode;
  onMode: (mode: PickMode) => void;
  onPick: (value: string) => void;
  t: ThemeClasses;
};

/** 分隔線做成產生器:想要的長度取決於貼文寬度,不是我們能先決定的 */
export default function DividerPalette({ mode, onMode, onPick, t }: Props) {
  const [unitKey, setUnitKey] = useState(DIVIDER_UNITS[0].key);
  const [length, setLength] = useState(20);

  const unit = DIVIDER_UNITS.find((item) => item.key === unitKey) ?? DIVIDER_UNITS[0];
  const divider = buildDivider(unit, length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] tracking-[0.08em] ${t.muted}`}>點一下就</span>
        <Segmented
          value={mode}
          onChange={onMode}
          t={t}
          label="點擊行為"
          options={[
            { value: "insert", label: "插入游標" },
            { value: "copy", label: "複製" },
          ]}
        />
      </div>

      <div>
        <p className={`mb-1.5 text-[11px] tracking-[0.12em] ${t.muted}`}>樣式</p>
        <div className="flex flex-wrap gap-1.5">
          {DIVIDER_UNITS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setUnitKey(item.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                item.key === unitKey ? t.selected : t.unselected
              }`}
            >
              {item.label} {item.unit}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={`mb-1.5 block text-[11px] tracking-[0.12em] ${t.muted}`}>
          長度 {length}
        </span>
        <input
          type="range"
          min={DIVIDER_MIN}
          max={DIVIDER_MAX}
          value={length}
          onChange={(event) => setLength(Number(event.target.value))}
          className="w-full accent-(--accent)"
          aria-label="分隔線長度"
        />
      </label>

      <div className={`rounded-xl border p-3 ${t.subPanel}`}>
        <p className={`mb-1.5 text-[11px] tracking-[0.12em] ${t.muted}`}>預覽</p>
        <p className="break-all text-sm leading-7">{divider}</p>
      </div>

      <button
        type="button"
        onClick={() => onPick(divider)}
        className={`w-full rounded-xl border px-4 py-2 text-sm transition ${t.primary}`}
      >
        {mode === "insert" ? "插入這條分隔線" : "複製這條分隔線"}
      </button>
    </div>
  );
}
