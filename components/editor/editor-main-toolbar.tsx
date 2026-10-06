"use client";

// 編輯區上方的一條工具列:按鈕都一樣大,手機上放不下就左右滑。
// 復原重做 ｜ 檢視 ｜ 尋找 ｜ 貼上、更多(Google Docs) ｜ 設定 ｜ 匯出成圖片

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import { IconRedo, IconSearch, IconUndo } from "./editor-icons";

export const TOOL_BUTTON = "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition disabled:opacity-30";

/** 工具列上的按鈕 + 點開的小視窗;點外面或按 Esc 就收起來 */
export function ToolPopover({
  label,
  title,
  children,
  theme,
  align = "left",
  width = "w-72",
}: {
  label: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
  theme: EditorThemeConfig;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        title={title}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${TOOL_BUTTON} ${open ? "border-(--accent) bg-(--accent) text-(--on-accent)" : `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}`}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className={`fixed inset-x-3 top-auto z-40 mt-2 max-h-[70vh] overflow-auto rounded-2xl border p-3 shadow-xl sm:absolute sm:inset-x-auto ${
            align === "right" ? "sm:right-0" : "sm:left-0"
          } ${width} max-w-none sm:max-w-[90vw] ${theme.border} ${theme.panelBg} ${theme.text}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

type Props = {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  findOpen: boolean;
  onToggleFind: () => void;
  /** 檢視切換(只有能渲染的文件才有) */
  viewToggle: ReactNode;
  onPaste: () => void;
  onPasteExport: () => void;
  /** 「更多」選單裡的 Google Docs 選項 */
  googleItems: ReactNode;
  settings: ReactNode;
  onExportImage: () => void;
  theme: EditorThemeConfig;
};

export default function EditorMainToolbar({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  findOpen,
  onToggleFind,
  viewToggle,
  onPaste,
  onPasteExport,
  googleItems,
  settings,
  onExportImage,
  theme,
}: Props) {
  const plain = `${TOOL_BUTTON} ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  const divider = <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: "var(--border-light)" }} aria-hidden />;
  const menuItem = "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition hover:bg-(--paper-bg-3)";

  return (
    <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible" role="toolbar" aria-label="編輯工具列">
      <button type="button" onClick={onUndo} disabled={!canUndo} title="還原（Ctrl+Z）" aria-label="還原" className={`${plain} px-2.5`}>
        <IconUndo />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} title="重做（Ctrl+Shift+Z）" aria-label="重做" className={`${plain} px-2.5`}>
        <IconRedo />
      </button>
      {divider}
      {viewToggle}
      {viewToggle && divider}
      <button
        type="button"
        onClick={onToggleFind}
        title="尋找與取代（Ctrl+F）"
        aria-pressed={findOpen}
        className={`${TOOL_BUTTON} ${findOpen ? "border-(--accent) bg-(--accent) text-(--on-accent)" : `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}`}
      >
        <IconSearch size={16} />
        尋找
      </button>
      <button type="button" onClick={onPaste} title="也可以直接按 ⌘V / Ctrl+V" className={plain}>
        貼上
      </button>
      <ToolPopover label="⋯ 更多" title="更多功能" theme={theme} width="w-60">
        {(close) => (
          <div className="flex flex-col" onClick={close}>
            <button type="button" role="menuitem" onClick={onPasteExport} className={menuItem}>
              貼上並匯出成圖片
            </button>
            <div className="my-1 h-px" style={{ background: "var(--border-light)" }} />
            {googleItems}
          </div>
        )}
      </ToolPopover>
      <ToolPopover label="⚙ 設定" title="字體、字級、行高……" theme={theme} align="right" width="w-80">
        {() => settings}
      </ToolPopover>
      <span className="min-w-2 flex-1" />
      {/* 手機上工具列要左右滑,匯出鈕改放在標題旁邊(在頁面那邊),這裡只給寬螢幕 */}
      <button type="button" onClick={onExportImage} className={`${TOOL_BUTTON} hidden border-(--accent) sm:flex ${theme.primaryButton} ${theme.primaryButtonText}`}>
        匯出成圖片
      </button>
    </div>
  );
}
