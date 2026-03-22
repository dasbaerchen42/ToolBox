// components/editor/ToolHeader.tsx
import React from "react";
// 加上這行引入共用的型別
import type { ThemeMode, ThemeClasses } from "@/lib/theme";

type Props = {
  title: string;
  description: string;
  preTitle?: string;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  t: ThemeClasses;
};

export default function ToolHeader({ title, description, preTitle, theme, setTheme, t }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {preTitle && (
          <p className={`mb-2 text-xs tracking-[0.22em] uppercase ${t.muted}`}>
            {preTitle}
          </p>
        )}
        
        <h1 className="text-2xl font-semibold tracking-[0.08em] md:text-3xl">
          {title}
        </h1>
        
        <p className={`mt-2 text-sm leading-7 tracking-[0.04em] ${t.muted}`}>
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${
            theme === "light" ? t.selected : t.unselected
          }`}
        >
          淺色
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${
            theme === "dark" ? t.selected : t.unselected
          }`}
        >
          深色
        </button>
      </div>
    </div>
  );
}