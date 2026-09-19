"use client";

import type { ReactNode } from "react";
import type { ThemeClasses } from "@/lib/theme";

/**
 * 工作檯的兩層版面。
 *
 * 外層跟 app/editor 同一個 pattern(`md:grid-cols-[280px_1fr]`):
 * 側欄在桌面版靠左、手機版收成上方橫條。
 */
export function WorkbenchShell({
  sidebar,
  children,
  onDropFiles,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  onDropFiles: (files: File[]) => void;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files).filter((file) =>
          file.type.startsWith("image/")
        );
        if (files.length > 0) onDropFiles(files);
      }}
      className="mx-auto grid w-full flex-1 max-w-[1600px] grid-cols-1 md:grid-cols-[280px_1fr]"
    >
      {sidebar}
      <section className="min-w-0 p-4 md:p-6">{children}</section>
    </div>
  );
}

/**
 * 每個工具的內層版面:左邊工作區、右邊參數。
 *
 * 工作區在桌面版是 sticky 的——調右邊參數時圖不會跟著捲走,
 * 這是這次改版最主要的目的。
 */
export function ToolPane({
  workspace,
  controls,
}: {
  workspace: ReactNode;
  controls: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">{workspace}</div>
      <div className="min-w-0 space-y-4">{controls}</div>
    </div>
  );
}

/** 工作區沒東西可顯示時的佔位 */
export function EmptyWorkspace({
  children,
  t,
}: {
  children: ReactNode;
  t: ThemeClasses;
}) {
  return (
    <div
      className={`flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm leading-7 ${t.divider} ${t.muted}`}
    >
      {children}
    </div>
  );
}
