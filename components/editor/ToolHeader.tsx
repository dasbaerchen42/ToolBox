// components/editor/ToolHeader.tsx
import React from "react";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  title: string;
  description: string;
  preTitle?: string;
  t: ThemeClasses;
};

export default function ToolHeader({ title, description, preTitle, t }: Props) {
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
    </div>
  );
}
