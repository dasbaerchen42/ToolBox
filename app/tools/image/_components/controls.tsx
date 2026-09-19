"use client";

import type { ReactNode } from "react";
import type { ThemeClasses } from "@/lib/theme";

export function Field({
  label,
  hint,
  children,
  t,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  t: ThemeClasses;
}) {
  // 刻意不是 <label>:裡面常常放的是一排按鈕而不是單一表單控制項,
  // 用 label 包住會讓每個按鈕的無障礙名稱都變成整段標籤文字。
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs tracking-[0.08em]">{label}</span>
      {children}
      {hint && <span className={`text-[11px] leading-5 ${t.muted}`}>{hint}</span>}
    </div>
  );
}

/** 一排互斥的小按鈕,取代 select——選項少的時候一眼看得完 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  t,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  t: ThemeClasses;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl border px-3 py-1.5 text-xs tracking-[0.04em] transition ${
            value === option.value ? t.selected : t.unselected
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  t,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  t: ThemeClasses;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
    />
  );
}

/** 顏色選擇:色票 + 十六進位輸入,兩邊同步 */
export function ColorField({
  value,
  onChange,
  t,
  extra,
}: {
  value: string;
  onChange: (value: string) => void;
  t: ThemeClasses;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-12 cursor-pointer rounded-lg border border-(--border-light) bg-transparent p-1"
        aria-label="選擇顏色"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={`w-28 rounded-xl border px-3 py-2 font-mono text-xs ${t.input}`}
        aria-label="顏色色碼"
      />
      {extra}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  t,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  t: ThemeClasses;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm tracking-[0.04em]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-(--accent)"
      />
      <span className={checked ? "" : t.muted}>{label}</span>
    </label>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
  tone = "primary",
  t,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary";
  t: ThemeClasses;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-2 text-sm tracking-[0.04em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "primary" ? t.primary : t.secondary
      }`}
    >
      {children}
    </button>
  );
}

/** 每個工作站上方那句「現在需要幾張圖」的說明 */
export function StationHint({ children, t }: { children: ReactNode; t: ThemeClasses }) {
  return (
    <p className={`rounded-xl border border-dashed px-3 py-2 text-xs leading-6 ${t.divider} ${t.muted}`}>
      {children}
    </p>
  );
}
