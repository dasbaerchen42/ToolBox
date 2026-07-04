"use client";

// 全站主題選擇面板:七款 preset、4 色自訂(含對比防呆)、隨機配色與最多 5 組收藏。
// 掛在 SiteNavigation 右側;顏色一律走 theme-core,不碰元件樣式。

import { useEffect, useRef, useState } from "react";
import {
  type BaseInput,
  PRESETS,
  applyTheme,
  applyCustomTheme,
  getCurrentThemeId,
  getCustomInput,
  generateRandomScheme,
  getSavedRandomSchemes,
  saveRandomScheme,
  deleteRandomScheme,
} from "@/lib/theme-core";

const DEFAULT_CUSTOM: BaseInput = PRESETS[0].input;

const FIELD_LABELS: { key: keyof BaseInput; label: string }[] = [
  { key: "bg", label: "背景" },
  { key: "bg2", label: "面板" },
  { key: "ink", label: "文字" },
  { key: "accent", label: "強調" },
];

function SwatchDots({ input }: { input: BaseInput }) {
  return (
    <span className="flex items-center gap-1">
      {[input.bg, input.bg2, input.ink, input.accent].map((c, i) => (
        <span
          key={i}
          className="inline-block h-3 w-3 rounded-full border border-(--border-dark)"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}

export default function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string>(PRESETS[0].id);
  const [custom, setCustom] = useState<BaseInput>(DEFAULT_CUSTOM);
  const [saved, setSaved] = useState<BaseInput[]>([]);
  const [lastRandom, setLastRandom] = useState<BaseInput | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // localStorage 只能在掛載後讀,避免 SSR/CSR 不一致
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
    setCurrentId(getCurrentThemeId());
    setCustom(getCustomInput() ?? DEFAULT_CUSTOM);
    setSaved(getSavedRandomSchemes());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pickPreset(id: string) {
    applyTheme(id);
    setCurrentId(id);
  }

  function updateCustom(key: keyof BaseInput, value: string) {
    const next = { ...custom, [key]: value };
    setCustom(next);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      applyCustomTheme(next);
      setCurrentId("custom");
    }
  }

  function rollRandom() {
    const scheme = generateRandomScheme();
    setLastRandom(scheme);
    setCustom(scheme);
    applyCustomTheme(scheme);
    setCurrentId("custom");
  }

  function keepRandom() {
    if (!lastRandom) return;
    setSaved(saveRandomScheme(lastRandom));
    setLastRandom(null);
  }

  function pickSaved(scheme: BaseInput) {
    setCustom(scheme);
    applyCustomTheme(scheme);
    setCurrentId("custom");
  }

  function removeSaved(i: number) {
    setSaved(deleteRandomScheme(i));
  }

  const currentPreset = PRESETS.find((p) => p.id === currentId);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="選擇主題"
        className="flex items-center gap-2 rounded-full border border-(--border-light) bg-(--paper-bg-2) px-3 py-2 text-sm tracking-[0.04em] text-(--ink-primary) transition hover:bg-(--paper-bg-3)"
      >
        <span aria-hidden>{currentPreset?.emoji ?? "🎨"}</span>
        <span className="hidden sm:inline">
          {currentId === "custom" ? "自訂" : currentPreset?.name ?? "主題"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-3xl border border-(--border-light) bg-(--paper-bg-2) p-4 shadow-xl">
          {/* preset 區 */}
          <p className="mb-2 text-xs tracking-[0.12em] text-(--ink-tertiary)">主題</p>
          <div className="flex flex-col gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p.id)}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm tracking-[0.04em] transition ${
                  currentId === p.id
                    ? "border-(--accent) bg-(--paper-bg-3)"
                    : "border-transparent hover:bg-(--paper-bg-3)"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>{p.emoji}</span>
                  {p.name}
                </span>
                <SwatchDots input={p.input} />
              </button>
            ))}
          </div>

          {/* 自訂區 */}
          <p className="mb-2 mt-4 text-xs tracking-[0.12em] text-(--ink-tertiary)">
            自訂(文字對比不足時會自動調整)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_LABELS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-2xl border border-(--border-light) bg-(--paper-bg) px-2.5 py-1.5 text-xs tracking-[0.04em]"
              >
                <input
                  type="color"
                  value={custom[key]}
                  onChange={(e) => updateCustom(key, e.target.value)}
                  className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-full border-none bg-transparent p-0"
                />
                {label}
              </label>
            ))}
          </div>

          {/* 隨機區 */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={rollRandom}
              className="flex-1 rounded-2xl border border-(--border-dark) px-3 py-2 text-sm tracking-[0.04em] transition hover:bg-(--paper-bg-3)"
            >
              🎲 隨機配色
            </button>
            <button
              type="button"
              onClick={keepRandom}
              disabled={!lastRandom}
              className="flex-1 rounded-2xl bg-(--accent) px-3 py-2 text-sm tracking-[0.04em] text-(--on-accent) transition hover:opacity-90 disabled:opacity-40"
            >
              保存這組
            </button>
          </div>

          {/* 已存隨機 */}
          {saved.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-xs tracking-[0.12em] text-(--ink-tertiary)">
                收藏的配色(最多 5 組,滿了會擠掉最舊)
              </p>
              <div className="flex flex-col gap-1.5">
                {saved.map((scheme, i) => (
                  <div
                    key={`${scheme.bg}-${scheme.accent}-${i}`}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => pickSaved(scheme)}
                      className="flex flex-1 items-center justify-between rounded-2xl border border-transparent px-3 py-2 transition hover:bg-(--paper-bg-3)"
                    >
                      <span className="text-xs tracking-[0.04em]">配色 {i + 1}</span>
                      <SwatchDots input={scheme} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSaved(i)}
                      aria-label={`刪除配色 ${i + 1}`}
                      className="rounded-full border border-(--border-light) px-2 py-1 text-xs text-(--ink-tertiary) transition hover:border-(--danger) hover:text-(--danger)"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
