type Props = {
  onPasteToInput: () => void | Promise<void>;
  onConvert: () => void;
  onCopyOutput: () => void | Promise<void>;
  onUseOutputAsInput: () => void;
  onClearAll: () => void;
  hasOutput: boolean;
  t: {
    primary: string;
    secondary: string;
  };
};

export default function FullwidthToolbar({
  onPasteToInput,
  onConvert,
  onCopyOutput,
  onUseOutputAsInput,
  onClearAll,
  hasOutput,
  t,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onPasteToInput}
        className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
      >
        貼上原文
      </button>

      <button
        type="button"
        onClick={onConvert}
        className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
      >
        執行轉換
      </button>

      <button
        type="button"
        onClick={onCopyOutput}
        disabled={!hasOutput}
        className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${
          hasOutput ? t.secondary : "cursor-not-allowed opacity-50"
        }`}
      >
        複製輸出
      </button>

      <button
        type="button"
        onClick={onUseOutputAsInput}
        disabled={!hasOutput}
        className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${
          hasOutput ? t.secondary : "cursor-not-allowed opacity-50"
        }`}
      >
        輸出區內容填回輸入
      </button>

      <button
        type="button"
        onClick={onClearAll}
        className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
      >
        清空內容
      </button>
    </div>
  );
}