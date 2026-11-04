"use client";

import { useEffect } from "react";
import { getFontStyle, type FontOption } from "@/lib/editor-font";
import type { FontFamilyName } from "@/lib/preferences";
import { ensureWebFont } from "@/lib/web-fonts";

const GROUP_LABELS = { core: "中文與通用", latin: "英文", effect: "效果字" } as const;

export default function FontPicker({ value, options, onChange }: {
  value: FontFamilyName;
  options: FontOption[];
  onChange: (value: FontFamilyName) => void;
}) {
  useEffect(() => {
    void ensureWebFont(value);
    for (const option of options) void ensureWebFont(option.key);
  }, [options, value]);

  const groups = (["core", "latin", "effect"] as const)
    .map((group) => ({ group, items: options.filter((option) => option.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="max-h-[24rem] space-y-3 overflow-auto pr-1" role="radiogroup" aria-label="字體">
      {!options.some((option) => option.key === value) && (
        <p className="rounded-xl bg-(--paper-bg-2) px-3 py-2 text-xs text-(--ink-secondary)">目前是舊版字體設定；選一個新字體後會更新。</p>
      )}
      {groups.map(({ group, items }) => (
        <section key={group}>
          <p className="mb-1 px-1 text-[11px] tracking-[0.12em] text-(--ink-tertiary)">{GROUP_LABELS[group]}</p>
          <div className="grid gap-1.5">
            {items.map((option) => {
              const selected = value === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(option.key)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${selected ? "border-(--accent-fill) bg-(--accent-soft)" : "border-(--border-light) hover:bg-(--paper-bg-3)"}`}
                >
                  <span className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{option.label}</span>
                    {option.note && <span className="text-[10px] text-(--ink-tertiary)">{option.note}</span>}
                  </span>
                  <span className="mt-1 block truncate text-[15px]" style={getFontStyle(option.key)}>{option.sample}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
