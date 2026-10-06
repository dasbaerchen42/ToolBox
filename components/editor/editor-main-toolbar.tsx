"use client";

// 編輯區上方的一條工具列(捲動時固定在畫面頂端)。
// 最常用的格式按鈕排最前面,其次復原重做;尋找、「⋯」選單、匯出成圖片靠右。
// 不常用的(檢視切換、設定、從剪貼簿開新文件、Google Docs)都收進「⋯」。

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import { IconRedo, IconSearch, IconUndo } from "./editor-icons";

export const TOOL_BUTTON = "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-sm transition disabled:opacity-30";

/** 按下時不要把焦點從編輯區搶走:選取的字才會一直反白,知道自己在改哪幾個字 */
export const keepEditorFocus = (e: React.MouseEvent) => e.preventDefault();

/** 工具列上的按鈕 + 點開的小視窗;點外面或按 Esc 就收起來 */
export function ToolPopover({
  label,
  title,
  children,
  theme,
  align = "left",
  width = "w-72",
  keepFocus = false,
  buttonClassName,
}: {
  label: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
  theme: EditorThemeConfig;
  align?: "left" | "right";
  width?: string;
  /** 格式選單:點的時候不搶編輯區的焦點(選單裡有輸入框的不要開) */
  keepFocus?: boolean;
  /** 換掉按鈕外觀(例如分成兩半的字色按鈕) */
  buttonClassName?: (open: boolean) => string;
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

  const active = "border-(--accent) bg-(--accent) text-(--on-accent)";
  const idle = `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`;

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-haspopup="true"
        aria-expanded={open}
        onMouseDown={keepFocus ? keepEditorFocus : undefined}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName ? buttonClassName(open) : `${TOOL_BUTTON} ${open ? active : idle}`}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          onMouseDown={keepFocus ? keepEditorFocus : undefined}
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
  /** 文件編輯模式的格式按鈕(段落、粗斜體、字色、底色、對齊) */
  formatBar?: ReactNode;
  /** 沒有格式按鈕時放在最前面的東西:原始語法模式的「回到編輯」、HTML 的檢視切換 */
  modeControl?: ReactNode;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  findOpen: boolean;
  onToggleFind: () => void;
  /** 「⋯」選單最上面的檢視選項(文件:編輯/原始語法) */
  viewItems?: ReactNode;
  onPaste: () => void;
  onPasteExport: () => void;
  /** 「⋯」選單裡的 Google Docs 選項 */
  googleItems: ReactNode;
  settings: ReactNode;
  onExportImage: () => void;
  theme: EditorThemeConfig;
};

const MENU_ITEM = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-(--paper-bg-3)";

function MoreMenu({
  viewItems,
  onPaste,
  onPasteExport,
  googleItems,
  settings,
  close,
  theme,
}: Pick<Props, "viewItems" | "onPaste" | "onPasteExport" | "googleItems" | "settings" | "theme"> & { close: () => void }) {
  const [page, setPage] = useState<"menu" | "settings">("menu");
  const line = <div className="my-1 h-px" style={{ background: "var(--border-light)" }} />;

  if (page === "settings") {
    return (
      <div>
        <button type="button" onClick={() => setPage("menu")} className={`${MENU_ITEM} mb-2 ${theme.mutedText}`}>
          ← 設定
        </button>
        {settings}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {viewItems && (
        <>
          <div onClick={close}>{viewItems}</div>
          {line}
        </>
      )}
      <button type="button" role="menuitem" onClick={() => setPage("settings")} className={MENU_ITEM}>
        ⚙ 設定（字體、字級、行高……）
      </button>
      {line}
      <div className="flex flex-col" onClick={close}>
        <button type="button" role="menuitem" onClick={onPaste} className={MENU_ITEM} title="也可以在編輯區外按 ⌘V / Ctrl+V">
          用剪貼簿的內容開新文件
        </button>
        <button type="button" role="menuitem" onClick={onPasteExport} className={MENU_ITEM}>
          開新文件並匯出成圖片
        </button>
        {line}
        {googleItems}
      </div>
    </div>
  );
}

export default function EditorMainToolbar({
  formatBar,
  modeControl,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  findOpen,
  onToggleFind,
  viewItems,
  onPaste,
  onPasteExport,
  googleItems,
  settings,
  onExportImage,
  theme,
}: Props) {
  const plain = `${TOOL_BUTTON} ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  const divider = <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: "var(--border-light)" }} aria-hidden />;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible" role="toolbar" aria-label="編輯工具列">
      {formatBar ?? modeControl}
      {(formatBar || modeControl) && divider}
      <button type="button" onMouseDown={keepEditorFocus} onClick={onUndo} disabled={!canUndo} title="還原（Ctrl+Z）" aria-label="還原" className={`${plain} w-9 px-0`}>
        <IconUndo />
      </button>
      <button type="button" onMouseDown={keepEditorFocus} onClick={onRedo} disabled={!canRedo} title="重做（Ctrl+Shift+Z）" aria-label="重做" className={`${plain} w-9 px-0`}>
        <IconRedo />
      </button>
      <span className="min-w-2 flex-1" />
      <button
        type="button"
        onClick={onToggleFind}
        title="尋找與取代（Ctrl+F）"
        aria-label="尋找與取代"
        aria-pressed={findOpen}
        className={`${TOOL_BUTTON} w-9 px-0 ${findOpen ? "border-(--accent) bg-(--accent) text-(--on-accent)" : `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}`}
      >
        <IconSearch />
      </button>
      <ToolPopover label="⋯" title="更多：檢視、設定、開新文件、Google Docs" theme={theme} align="right" width="w-80" buttonClassName={(open) => `${TOOL_BUTTON} w-9 px-0 text-lg leading-none ${open ? "border-(--accent) bg-(--accent) text-(--on-accent)" : `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}`}>
        {(close) => (
          <MoreMenu viewItems={viewItems} onPaste={onPaste} onPasteExport={onPasteExport} googleItems={googleItems} settings={settings} close={close} theme={theme} />
        )}
      </ToolPopover>
      {/* 手機上匯出鈕放在標題旁邊(頁面那邊),這裡只給寬螢幕 */}
      <button type="button" onClick={onExportImage} className={`${TOOL_BUTTON} hidden border-(--accent) sm:flex ${theme.primaryButton} ${theme.primaryButtonText}`}>
        匯出成圖片
      </button>
    </div>
  );
}
