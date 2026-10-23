"use client";

import { useState } from "react";
import { WritingDoc } from "@/lib/storage";
import { formatShortDateTime } from "@/lib/datetime";

type EditorSidebarProps = {
  docs: WritingDoc[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (docId: string) => void;
  theme: {
    border: string;
    sidebarBg: string;
    primaryButton: string;
    primaryButtonText: string;
    secondaryButton: string;
    secondaryButtonText: string;
    activeItem: string;
    inactiveItem: string;
    mutedText: string;
    subtleText: string;
  };
};

/** 側欄上每份文件標的模式名稱 */
const MODE_LABELS: Record<string, string> = {
  markdown: "文件",
  plain: "純文字",
  html: "HTML",
  yaml: "YAML",
  json: "JSON",
  css: "CSS",
  social: "Social",
};

/**
 * 文件列表。每份兩行:標題、模式與更新時間。
 * 手機上平常收成一行「我的文件(幾份)· 目前在寫哪一份」,點開才列出全部,選了就收起來。
 */
export default function EditorSidebar({
  docs,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  theme,
}: EditorSidebarProps) {
  const [open, setOpen] = useState(false);
  const active = docs.find((doc) => doc.id === activeDocId);

  return (
    <aside className={`border-b px-4 py-3 md:border-b-0 md:border-r md:p-4 ${theme.border} ${theme.sidebarBg}`}>
      <div className="flex items-center justify-between gap-2 md:mb-3">
        <h2 className="hidden text-lg font-semibold tracking-[0.08em] md:block">我的文件</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left md:hidden"
        >
          <span className="shrink-0 font-semibold tracking-[0.06em]">我的文件（{docs.length}）</span>
          <span className={`min-w-0 flex-1 truncate text-sm ${theme.mutedText}`}>· {active?.title || "未命名文件"}</span>
          <span aria-hidden className={`shrink-0 text-xs ${theme.subtleText}`}>
            {open ? "▴" : "▾"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            onCreateDoc();
            setOpen(false);
          }}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition md:py-2 ${theme.primaryButton} ${theme.primaryButtonText}`}
        >
          新增
        </button>
      </div>

      <div className={`mt-3 space-y-1.5 md:mt-0 md:block ${open ? "block" : "hidden"}`}>
        {docs.map((doc) => {
          const isActive = doc.id === activeDocId;
          const title = doc.title || "未命名文件";

          return (
            <div
              key={doc.id}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition ${
                isActive ? theme.activeItem : theme.inactiveItem
              }`}
              onClick={() => {
                onSelectDoc(doc.id);
                setOpen(false);
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium tracking-[0.04em]">{title}</p>
                <p className={`mt-0.5 truncate text-xs ${theme.subtleText}`}>
                  {MODE_LABELS[doc.mode] ?? doc.mode} · {formatShortDateTime(doc.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`刪除「${title}」`}
                title="刪除"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`刪除「${title}」？刪了就找不回來。`)) onDeleteDoc(doc.id);
                }}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none transition hover:bg-(--paper-bg-3) ${theme.subtleText}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
