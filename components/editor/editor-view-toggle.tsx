"use client";

// 編輯區的三態切換:純文字 / 渲染 / 並排。並排在窄畫面沒有意義,只在 md 以上出現。

import type { EditorThemeConfig } from "@/lib/theme";
import { type EditorViewMode } from "@/lib/preferences";

type EditorViewToggleProps = {
  viewMode: EditorViewMode;
  onChange: (mode: EditorViewMode) => void;
  theme: EditorThemeConfig;
};

const OPTIONS: { value: EditorViewMode; label: string; mdOnly?: boolean }[] = [
  { value: "edit", label: "純文字" },
  { value: "preview", label: "渲染" },
  { value: "split", label: "並排", mdOnly: true },
];

export default function EditorViewToggle({
  viewMode,
  onChange,
  theme,
}: EditorViewToggleProps) {
  return (
    <div className={`inline-flex h-9 shrink-0 items-center rounded-full border p-0.5 ${theme.border} ${theme.panelBg}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`h-full rounded-full px-3 text-sm transition ${
            option.mdOnly ? "hidden md:block" : ""
          } ${
            viewMode === option.value
              ? `${theme.primaryButton} ${theme.primaryButtonText}`
              : `${theme.secondaryButtonText} hover:opacity-80`
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 文件的兩種編輯方式:直接看排好的樣子,或改 Markdown 原文 */
export function DocViewToggle({
  value,
  onChange,
  theme,
}: {
  value: "rich" | "source";
  onChange: (value: "rich" | "source") => void;
  theme: EditorViewToggleProps["theme"];
}) {
  const options = [
    { value: "rich" as const, label: "編輯", title: "直接看到排好的樣子，選字就能上色、對齊" },
    { value: "source" as const, label: "原始語法", title: "改 Markdown 原文" },
  ];
  return (
    <div className={`inline-flex h-9 shrink-0 items-center rounded-full border p-0.5 ${theme.border} ${theme.panelBg}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-full rounded-full px-3 text-sm transition ${
            value === option.value ? `${theme.primaryButton} ${theme.primaryButtonText}` : `${theme.secondaryButtonText} hover:opacity-80`
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
