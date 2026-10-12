"use client";

import { useState, type ReactNode } from "react";
import type { ThemeClasses } from "@/lib/theme";
import { RATIO_PRESETS, type Ratio } from "@/lib/tools/image/frame";
import Segmented from "@/components/segmented";

// Segmented 已經提到 components/ 給社群轉換區共用,這裡轉出去讓既有的匯入不用改
export { Segmented };

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

/**
 * 比例選擇:常用比例一排按鈕 + 「自訂」(自己填寬:高)。
 * 尺寸邊框、棋盤拼貼、框選裁切共用;allowFree 時多一個「不限」(value 是 null)。
 */
export function RatioPicker({
  value,
  onChange,
  allowFree = false,
  t,
}: {
  value: Ratio | null;
  onChange: (value: Ratio | null) => void;
  allowFree?: boolean;
  t: ThemeClasses;
}) {
  const preset = value ? RATIO_PRESETS.find((p) => p.ratio.w === value.w && p.ratio.h === value.h) : null;
  const [custom, setCustom] = useState(() => !!value && !preset);
  const showCustom = custom || (!!value && !preset);
  const chip = (active: boolean) => `rounded-xl border px-3 py-1.5 text-xs transition ${active ? t.selected : t.unselected}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {allowFree && (
          <button type="button" onClick={() => { setCustom(false); onChange(null); }} className={chip(value === null)}>
            不限
          </button>
        )}
        {RATIO_PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => { setCustom(false); onChange(p.ratio); }} className={chip(!showCustom && preset === p)}>
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            if (!value) onChange({ w: 7, h: 5 });
          }}
          className={chip(showCustom)}
        >
          自訂
        </button>
      </div>
      {showCustom && value && (
        <div className="flex items-center gap-2">
          <NumberField value={value.w} onChange={(w) => onChange({ ...value, w: Math.max(1, w) })} min={1} max={100} label="比例寬" t={t} />
          <span className={t.muted}>:</span>
          <NumberField value={value.h} onChange={(h) => onChange({ ...value, h: Math.max(1, h) })} min={1} max={100} label="比例高" t={t} />
        </div>
      )}
    </div>
  );
}

/**
 * 收起來的一組設定(預設收起):不常調的參數放這裡,面板才不會一路長下去。
 */
export function Collapse({
  title,
  children,
  defaultOpen = false,
  t,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  t: ThemeClasses;
}) {
  return (
    <details open={defaultOpen} className={`group rounded-xl border ${t.subPanel}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm tracking-[0.04em] [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className={`text-xs transition group-open:rotate-180 ${t.muted}`} aria-hidden>
          ▾
        </span>
      </summary>
      <div className="space-y-3 px-3 pb-3">{children}</div>
    </details>
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

/** 拉桿:標籤右邊直接顯示目前的值 */
export function RangeField({
  label,
  display,
  value,
  min,
  max,
  step = 1,
  onChange,
  t,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  t: ThemeClasses;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs tracking-[0.08em]">
        <span>{label}</span>
        <span className={t.muted}>{display}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-(--accent)"
      />
    </div>
  );
}
