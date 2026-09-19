"use client";

import type { ThemeClasses } from "@/lib/theme";

type Props<T extends string> = {
  value: T;
  options: { value: T; label: string; mdOnly?: boolean }[];
  onChange: (value: T) => void;
  t: ThemeClasses;
  /** 給螢幕閱讀器的群組名稱 */
  label?: string;
};

/**
 * 一排互斥的小按鈕,取代 select——選項少的時候一眼看得完。
 *
 * mdOnly 的選項在窄畫面不出現(並排檢視在手機上沒有意義)。
 */
export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  t,
  label,
}: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-xl border px-3 py-1.5 text-xs tracking-[0.04em] transition ${
            option.mdOnly ? "hidden md:block" : ""
          } ${value === option.value ? t.selected : t.unselected}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
