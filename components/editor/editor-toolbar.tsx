"use client";

// Google Docs 匯入/匯出:放在工具列「⋯ 更多」選單裡的兩個選項。

type EditorToolbarProps = {
  onExport: () => void;
  onImport: () => void;
  /** 沒設 NEXT_PUBLIC_GOOGLE_CLIENT_ID 時為 false:選項停用,編輯器其餘功能照常 */
  googleEnabled: boolean;
  theme: {
    mutedText: string;
    subtleText?: string;
  };
};

export const MENU_ITEM = "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition hover:bg-(--paper-bg-3) disabled:opacity-40";

export default function EditorToolbar({ onExport, onImport, googleEnabled, theme }: EditorToolbarProps) {
  return (
    <>
      <button type="button" role="menuitem" onClick={onImport} disabled={!googleEnabled} className={MENU_ITEM}>
        從 Google Docs 匯入
      </button>
      <button type="button" role="menuitem" onClick={onExport} disabled={!googleEnabled} className={MENU_ITEM}>
        匯出到 Google Docs
      </button>
      {!googleEnabled && <p className={`px-3 pb-1 text-xs ${theme.mutedText}`}>這個站沒有設定 Google Client ID，Google Docs 功能停用中。</p>}
    </>
  );
}
