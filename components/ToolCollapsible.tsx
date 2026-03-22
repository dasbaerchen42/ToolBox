// components/ToolCollapsible.tsx
import React from "react";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  t: ThemeClasses;
  extraAction?: React.ReactNode;
  containerClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
};

export default function ToolCollapsible({
  title,
  description,
  isOpen,
  onToggle,
  children,
  t,
  extraAction,
  containerClassName = "",
  contentClassName = "pt-4",
  headerClassName = "",
}: Props) {
  return (
    <div className={containerClassName}>
      <div className={`flex items-start justify-between gap-3 ${headerClassName}`}>
        <div>
          <h2 className="text-lg font-semibold tracking-[0.08em]">{title}</h2>
          {description && (
            <p className={`mt-1 text-xs tracking-[0.04em] ${t.muted}`}>
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {extraAction}
          <button
            type="button"
            onClick={onToggle}
            className={`flex h-8 items-center justify-center rounded-xl border px-3 text-sm transition ${t.secondary}`}
            aria-label={isOpen ? "收合" : "展開"}
            title={isOpen ? "收合" : "展開"}
          >
            <span className="mr-1">{isOpen ? "收合" : "展開"}</span>
            <span
              className={`inline-block text-xs transition-transform duration-300 ${
                isOpen ? "rotate-0" : "-rotate-90"
              }`}
            >
              ▾
            </span>
          </button>
        </div>
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className={contentClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
}