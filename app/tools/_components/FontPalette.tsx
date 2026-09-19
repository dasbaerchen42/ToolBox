"use client";

import { useMemo } from "react";
import { getFontResults } from "../_lib/fancy-fonts";
import { gapsFor, hasNonAscii } from "../_lib/font-notes";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  /** 會被套用的那段文字(選取範圍,沒選取就是整篇) */
  sample: string;
  scope: "selection" | "all";
  onApply: (styleKey: string) => void;
  t: ThemeClasses;
};

const FALLBACK = "fancy 2026";
const PREVIEW_LIMIT = 12;

/**
 * 字體面板。
 *
 * 每顆按鈕顯示的是「你圈起來的那段字」在該樣式下的樣子,不是固定的示範字——
 * 因為有七八種樣式沒有數字對映(哥德字、手寫字、斜體……),
 * 中文也一律維持原樣,不先看到的話按下去才發現只轉了一半。
 */
export default function FontPalette({ sample, scope, onApply, t }: Props) {
  const preview = (sample || FALLBACK).slice(0, PREVIEW_LIMIT);
  const results = useMemo(() => getFontResults(preview), [preview]);

  const hasDigits = /[0-9]/.test(preview);
  const nonAscii = hasNonAscii(sample);

  return (
    <div className="space-y-3">
      <p className={`text-[11px] leading-5 ${t.muted}`}>
        {scope === "selection"
          ? "會套用在你選取的那一段。"
          : "沒有選取任何文字，會套用在整篇。先圈起來再按，就只會換那一段。"}
      </p>

      <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
        {results.map((item) => {
          const noDigits = hasDigits && gapsFor(item.key).digits;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onApply(item.key)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${t.listUnselected}`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-[10px] tracking-[0.08em] ${t.muted}`}>
                  {item.label}
                  {noDigits && <span className="ml-1 text-(--accent)">數字不變</span>}
                </span>
                <span className="mt-0.5 block truncate text-sm">
                  {item.value || item.preview}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {nonAscii && (
        <p className={`text-[11px] leading-5 ${t.muted}`}>
          中文與其他非英數字元一律維持原樣，這是 Unicode 沒有對應變體，不是壞掉。
        </p>
      )}
    </div>
  );
}
