"use client";

type EditorToolbarProps = {
  onExport: () => void;
  onImport: () => void;
  theme: {
    border: string;
    panelBg: string;
    mutedText: string;
    secondaryButton: string;
    secondaryButtonText: string;
    primaryButton: string;
    primaryButtonText: string;
  };
};

export default function EditorToolbar({
  onExport,
  onImport,
  theme,
}: EditorToolbarProps) {
  return (
    <div className="flex w-full gap-2">
      <button
        onClick={onImport}
        className={`flex-1 rounded-2xl border px-3 py-3 text-sm font-medium tracking-[0.06em] transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
      >
        匯入
      </button>

      <button
        onClick={onExport}
        className={`flex-1 rounded-2xl px-3 py-3 text-sm font-medium tracking-[0.06em] transition ${theme.primaryButton} ${theme.primaryButtonText}`}
      >
        匯出
      </button>
    </div>
  );
}