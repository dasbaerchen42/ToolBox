// app/tools/knife/_components/KnifeSettingsPanel.tsx
import type { ThemeClasses } from "@/lib/theme";
import CollapsibleSection from "@/components/ToolCollapsible";

type EncodingOption =
  | "utf-8"
  | "utf-16le"
  | "big5"
  | "gbk"
  | "shift_jis";

type Props = {
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: ThemeClasses;
  encoding: EncodingOption;
  setEncoding: (value: EncodingOption) => void;
  encodingOptions: { value: EncodingOption; label: string }[];
  handleUpload: (file: File | null) => void;
  targetChars: number;
  setTargetChars: (value: number) => void;
  tolerancePct: number;
  setTolerancePct: (value: number) => void;
  paraPattern: string;
  setParaPattern: (value: string) => void;
  basename: string;
  setBasename: (value: string) => void;
  chapterPrefix: string;
  setChapterPrefix: (value: string) => void;
  renameAllChapters: () => void;
  hardBreakLong: boolean;
  setHardBreakLong: (value: boolean) => void;
  handleSplit: () => void;
  totalChars: number;
  sectionsLength: number;
  readParagraphCount: number;
  safeBase: string;
  input: string;
  setInput: (value: string) => void;
};

export default function KnifeSettingsPanel({
  isSettingsOpen,
  setIsSettingsOpen,
  t,
  encoding,
  setEncoding,
  encodingOptions,
  handleUpload,
  targetChars,
  setTargetChars,
  tolerancePct,
  setTolerancePct,
  paraPattern,
  setParaPattern,
  basename,
  setBasename,
  chapterPrefix,
  setChapterPrefix,
  renameAllChapters,
  hardBreakLong,
  setHardBreakLong,
  handleSplit,
  totalChars,
  sectionsLength,
  readParagraphCount,
  safeBase,
  input,
  setInput,
}: Props) {
  return (
    // 這裡同樣套用共用元件！我們把毛玻璃特效放在 containerClassName 裡面傳進去
    <CollapsibleSection
      title="切割設定"
      description="設定匯入方式、切割規則與章節命名"
      isOpen={isSettingsOpen}
      onToggle={() => setIsSettingsOpen((prev) => !prev)}
      t={t}
      containerClassName={`rounded-[28px] border shadow-sm backdrop-blur ${t.panel}`}
      headerClassName="p-4 md:p-5"
      contentClassName="p-4 pt-0 md:p-5 md:pt-0"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            上傳檔案
          </label>
          <input
            type="file"
            accept=".txt"
            onChange={(e) => handleUpload(e.target.files?.[0] || null)}
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          />
        </div>

        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            編碼
          </label>
          <select
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as EncodingOption)}
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          >
            {encodingOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            目標字元數
          </label>
          <input
            type="number"
            value={targetChars}
            onChange={(e) => setTargetChars(Number(e.target.value))}
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          />
        </div>

        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            允許超出比例 %
          </label>
          <input
            type="number"
            value={tolerancePct}
            onChange={(e) => setTolerancePct(Number(e.target.value))}
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1.2fr_1fr_auto_auto_auto] items-end">
        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            段落起始正則
          </label>
          <input
            type="text"
            value={paraPattern}
            onChange={(e) => setParaPattern(e.target.value)}
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          />
        </div>

        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            輸出檔名基底
          </label>
          <input
            type="text"
            value={basename}
            onChange={(e) => setBasename(e.target.value)}
            placeholder="留空則使用原始檔名"
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          />
        </div>

        <div>
          <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
            章節前綴
          </label>
          <input
            type="text"
            value={chapterPrefix}
            onChange={(e) => setChapterPrefix(e.target.value)}
            placeholder="例：第"
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={renameAllChapters}
            className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition whitespace-nowrap ${t.secondary}`}
          >
            重新命名章節
          </button>
        </div>

        <label className="flex items-center gap-2 pb-3 text-sm tracking-[0.04em] whitespace-nowrap">
          <input
            type="checkbox"
            checked={hardBreakLong}
            onChange={(e) => setHardBreakLong(e.target.checked)}
          />
          單段超長硬切
        </label>

        <div>
          <button
            type="button"
            onClick={handleSplit}
            className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition whitespace-nowrap ${t.primary}`}
          >
            開始切割
          </button>
        </div>
      </div>

      <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-7 tracking-[0.04em] ${t.subPanel} ${t.muted}`}>
        總字數：{totalChars} ｜ 切割後章節數：{sectionsLength} ｜ 讀取段落數：
        {readParagraphCount} ｜ 檔名基底：{safeBase}
      </div>

      <div className="mt-5">
        <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
          原始內容
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="可以直接貼文字，也可以先上傳 TXT……"
          className={`h-[360px] w-full rounded-[28px] border p-4 text-sm leading-8 tracking-[0.04em] outline-none ${t.input}`}
        />
      </div>
    </CollapsibleSection>
  );
}