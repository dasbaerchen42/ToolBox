"use client";

import type { ReactNode } from "react";
import Segmented from "@/components/segmented";
import type { ThemeClasses } from "@/lib/theme";

/** 點一下符號是要插進去還是複製起來 */
export type PickMode = "insert" | "copy";

type FrameProps = {
  query: string;
  onQuery: (value: string) => void;
  mode: PickMode;
  onMode: (mode: PickMode) => void;
  recent: string[];
  onPick: (value: string) => void;
  children: ReactNode;
  placeholder: string;
  t: ThemeClasses;
};

/**
 * 符號類面板的共用外框:搜尋、點擊行為、最近用過。
 *
 * 點擊行為做成模式切換而不是「每格右上角放一顆複製鈕」:
 * 格子很密,每格多一顆鈕會糊成一片;也不用長按,
 * 長按在觸控上要自己做手勢判斷,容易跟捲動打架。
 */
export function PaletteFrame({
  query,
  onQuery,
  mode,
  onMode,
  recent,
  onPick,
  children,
  placeholder,
  t,
}: FrameProps) {
  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
        aria-label="搜尋"
      />

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

      {recent.length > 0 && (
        <div>
          <p className={`mb-1 text-[11px] tracking-[0.08em] ${t.muted}`}>最近用過</p>
          <div className="flex flex-wrap gap-1">
            {recent.map((item) => (
              <PickButton key={item} value={item} onPick={onPick} t={t} />
            ))}
          </div>
        </div>
      )}

      <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

export function PickButton({
  value,
  onPick,
  t,
  wide,
  title,
}: {
  value: string;
  onPick: (value: string) => void;
  t: ThemeClasses;
  /** 顏文字比較長,給它整行 */
  wide?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      title={title ?? value}
      className={`rounded-lg border transition ${t.listUnselected} ${
        wide
          ? "px-2 py-1.5 text-xs"
          : "flex h-9 w-9 items-center justify-center text-base"
      }`}
    >
      {value}
    </button>
  );
}

export function PaletteGroup({
  label,
  children,
  t,
}: {
  label: string;
  children: ReactNode;
  t: ThemeClasses;
}) {
  return (
    <section>
      <p className={`mb-1.5 text-[11px] tracking-[0.12em] ${t.muted}`}>{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  );
}

export function PaletteLoading({ t }: { t: ThemeClasses }) {
  return <p className={`py-6 text-center text-xs ${t.muted}`}>載入中……</p>;
}
