"use client";

import { useState } from "react";
import {
  buildDecoratedDivider,
  DIVIDER_CENTERS,
  DIVIDER_ENDPOINTS,
  DIVIDER_MAX,
  DIVIDER_MIN,
  DIVIDER_PRESET_GROUPS,
  DIVIDER_UNITS,
} from "../_lib/dividers";
import type { ReactNode } from "react";
import type { ThemeClasses } from "@/lib/theme";
import type { PickMode } from "./palette-parts";
import Segmented from "@/components/segmented";

type Props = {
  mode: PickMode;
  onMode: (mode: PickMode) => void;
  onPick: (value: string) => void;
  custom: ReactNode;
  t: ThemeClasses;
};

type DividerView = "presets" | "generator";

export default function DividerPalette({ mode, onMode, onPick, custom, t }: Props) {
  const [view, setView] = useState<DividerView>("presets");
  const [unitKey, setUnitKey] = useState(DIVIDER_UNITS[0].key);
  const [length, setLength] = useState(20);
  const [center, setCenter] = useState("");
  const [endpointIndex, setEndpointIndex] = useState(0);

  const unit = DIVIDER_UNITS.find((item) => item.key === unitKey) ?? DIVIDER_UNITS[0];
  const endpoints = DIVIDER_ENDPOINTS[endpointIndex] ?? DIVIDER_ENDPOINTS[0];
  const divider = buildDecoratedDivider(unit, length, { center, left: endpoints.left, right: endpoints.right });

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

      {custom}

      <Segmented
        value={view}
        onChange={setView}
        t={t}
        label="分隔線選擇方式"
        options={[
          { value: "presets", label: "預設造型" },
          { value: "generator", label: "進階產生器" },
        ]}
      />

      {view === "presets" ? (
        <div className="space-y-4">
          {DIVIDER_PRESET_GROUPS.map((group) => (
            <section key={group.key}>
              <p className={`mb-1.5 text-[11px] tracking-[0.12em] ${t.muted}`}>{group.label}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    title={item.label}
                    onClick={() => onPick(item.value)}
                    className={`min-w-0 overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition ${t.unselected}`}
                  >
                    <span className="block truncate">{item.value}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : <>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={`mb-1.5 block text-[11px] tracking-[0.12em] ${t.muted}`}>中央裝飾</span>
          <select value={center} onChange={(event) => setCenter(event.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}>
            {DIVIDER_CENTERS.map((value) => <option key={value || "none"} value={value}>{value || "無"}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={`mb-1.5 block text-[11px] tracking-[0.12em] ${t.muted}`}>兩端裝飾</span>
          <select value={endpointIndex} onChange={(event) => setEndpointIndex(Number(event.target.value))} className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}>
            {DIVIDER_ENDPOINTS.map((value, index) => <option key={value.label} value={index}>{value.label}</option>)}
          </select>
        </label>
      </div>

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
      </>}
    </div>
  );
}
