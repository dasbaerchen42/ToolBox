"use client";

import { useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  theme: {
    border: string;
    panelBg: string;
    mutedText: string;
  };
};

export default function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  theme,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`mt-4 rounded-2xl border ${theme.border} ${theme.panelBg}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left tracking-[0.05em]"
      >
        <span className="text-sm font-semibold tracking-[0.08em]">{title}</span>
        <span className={`text-xs ${theme.mutedText}`}>{open ? "▾" : "▸"}</span>
      </button>

      {open ? <div className="border-t px-4 py-4">{children}</div> : null}
    </section>
  );
}