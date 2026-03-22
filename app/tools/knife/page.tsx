"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildKnifeZip,
  KnifeSection,
  sanitizeBasename,
  splitTextAndCount,
} from "@/lib/tools/knife";

import ToolHeader from "@/components/editor/ToolHeader";
import KnifeSettingsPanel from "./_components/KnifeSettingsPanel";
import KnifeSectionList from "./_components/KnifeSectionList";
import KnifePreviewPanel from "./_components/KnifePreviewPanel";
// 這裡引入我們剛剛做好的全域主題設定！
import { getThemeClasses, type ThemeMode } from "@/lib/theme";

type EncodingOption =
  | "utf-8"
  | "utf-16le"
  | "big5"
  | "gbk"
  | "shift_jis";

async function readFileWithEncoding(file: File, encoding: string) {
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function writeClipboardText(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

const encodingOptions: { value: EncodingOption; label: string }[] = [
  { value: "utf-8", label: "UTF-8" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "big5", label: "Big5" },
  { value: "gbk", label: "GBK" },
  { value: "shift_jis", label: "Shift_JIS" },
];

export default function KnifePage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [input, setInput] = useState("");
  const [targetChars, setTargetChars] = useState(100000);
  const [tolerancePct, setTolerancePct] = useState(5);
  const [paraPattern, setParaPattern] = useState(
    String.raw`^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]`
  );
  const [hardBreakLong, setHardBreakLong] = useState(false);
  const [encoding, setEncoding] = useState<EncodingOption>("utf-8");
  const [basename, setBasename] = useState("");
  const [chapterPrefix, setChapterPrefix] = useState("第");
  const [sections, setSections] = useState<KnifeSection[]>([]);
  const [sourceFilename, setSourceFilename] = useState("");
  const [readParagraphCount, setReadParagraphCount] = useState(0);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [notice, setNotice] = useState("");

  const noticeTimerRef = useRef<number | null>(null);

  // 這裡會自動去吃 lib/theme.ts 裡面的設定囉
  const t = getThemeClasses(theme);

  const totalChars = useMemo(() => input.length, [input]);

  const safeBase = useMemo(() => {
    return basename.trim()
      ? sanitizeBasename(basename)
      : sanitizeBasename(sourceFilename || "parts");
  }, [basename, sourceFilename]);

  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) ??
    sections[0] ??
    null;

  useEffect(() => {
    if (!selectedSection && sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSection]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function showNotice(message: string) {
    setNotice(message);

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
    }, 2200);
  }

  async function handleUpload(file: File | null) {
    if (!file) return;

    try {
      const text = await readFileWithEncoding(file, encoding);
      setInput(text);
      setSourceFilename(file.name);

      if (!basename.trim()) {
        setBasename(sanitizeBasename(file.name));
      }
    } catch (error) {
      console.error(error);
      alert("讀檔失敗，請確認編碼是否正確。");
    }
  }

  function handleSplit() {
    try {
      const result = splitTextAndCount({
        text: input,
        targetChars: Math.max(1, Number(targetChars)),
        tolerance: Math.max(0, Number(tolerancePct)) / 100,
        paraPattern,
        hardBreakLong,
        chapterPrefix,
      });

      setSections(result.sections);
      setReadParagraphCount(result.paragraphCount);
      setSelectedSectionId(result.sections[0]?.id ?? "");
      showNotice(`切割完成，已產生 ${result.sections.length} 個章節。`);
    } catch (error) {
      console.error(error);
      alert("切割失敗，請檢查段落起始正則是否有效。");
    }
  }

  async function handleDownloadZip() {
    if (sections.length === 0) {
      alert("目前沒有切割結果可以下載。");
      return;
    }

    const blob = await buildKnifeZip({
      sections,
      basename: safeBase,
    });

    await downloadBlob(blob, `${safeBase}.zip`);
    showNotice("ZIP 已開始下載。");
  }

  async function handleCopySection(text: string) {
    await writeClipboardText(text);
    showNotice("已複製本章內容。");
  }

  function updateSectionTitle(id: string, title: string) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, title } : section
      )
    );
  }

  function renameAllChapters() {
    setSections((prev) =>
      prev.map((section, index) => ({
        ...section,
        title: `${chapterPrefix}${index + 1}`,
      }))
    );
    showNotice("章節名稱已重新命名。");
  }

  function moveLastParagraphToNext(sectionId: string) {
    setSections((prev) => {
      const index = prev.findIndex((section) => section.id === sectionId);
      if (index < 0 || index >= prev.length - 1) return prev;

      const current = prev[index];
      const next = prev[index + 1];
      if (current.paragraphs.length <= 1) return prev;

      const moving = current.paragraphs[current.paragraphs.length - 1];
      const newCurrent = current.paragraphs.slice(0, -1);
      const newNext = [moving, ...next.paragraphs];

      return prev.map((section, i) => {
        if (i === index) return { ...section, paragraphs: newCurrent };
        if (i === index + 1) return { ...section, paragraphs: newNext };
        return section;
      });
    });
  }

  function moveFirstParagraphToPrev(sectionId: string) {
    setSections((prev) => {
      const index = prev.findIndex((section) => section.id === sectionId);
      if (index <= 0) return prev;

      const prevSection = prev[index - 1];
      const current = prev[index];
      if (current.paragraphs.length <= 1) return prev;

      const moving = current.paragraphs[0];
      const newPrev = [...prevSection.paragraphs, moving];
      const newCurrent = current.paragraphs.slice(1);

      return prev.map((section, i) => {
        if (i === index - 1) return { ...section, paragraphs: newPrev };
        if (i === index) return { ...section, paragraphs: newCurrent };
        return section;
      });
    });
  }

  return (
    <main className={`min-h-screen ${t.page}`}>
      {notice && (
        <div className="pointer-events-none fixed right-4 top-4 z-50">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm tracking-[0.04em] shadow-lg backdrop-blur ${t.panel}`}
          >
            {notice}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        
        <ToolHeader 
          title="文字切割刀"
          description="上傳 TXT、依規則切段、微調章節，再一次匯出為 ZIP。讓整理長文的過程保留一點呼吸。"
          theme={theme}
          setTheme={setTheme}
          t={t}
        />

        <KnifeSettingsPanel
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          t={t}
          encoding={encoding}
          setEncoding={setEncoding}
          encodingOptions={encodingOptions}
          handleUpload={handleUpload}
          targetChars={targetChars}
          setTargetChars={setTargetChars}
          tolerancePct={tolerancePct}
          setTolerancePct={setTolerancePct}
          paraPattern={paraPattern}
          setParaPattern={setParaPattern}
          basename={basename}
          setBasename={setBasename}
          chapterPrefix={chapterPrefix}
          setChapterPrefix={setChapterPrefix}
          renameAllChapters={renameAllChapters}
          hardBreakLong={hardBreakLong}
          setHardBreakLong={setHardBreakLong}
          handleSplit={handleSplit}
          totalChars={totalChars}
          sectionsLength={sections.length}
          readParagraphCount={readParagraphCount}
          safeBase={safeBase}
          input={input}
          setInput={setInput}
        />

        <section
          className={`mt-6 rounded-[28px] border p-4 shadow-sm backdrop-blur md:p-5 ${t.panel}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[0.08em]">
                輸出結果
              </h2>
              <p className={`mt-1 text-xs tracking-[0.04em] ${t.muted}`}>
                左側查看章節目錄，右側進行單章微調與預覽
              </p>
            </div>

            {sections.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadZip}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
              >
                下載 ZIP
              </button>
            )}
          </div>

          {sections.length === 0 ? (
            <div
              className={`mt-4 rounded-[24px] border px-5 py-8 text-sm leading-7 tracking-[0.04em] ${t.subPanel} ${t.muted}`}
            >
              目前還沒有切割結果。先輸入內容或上傳檔案，再按「開始切割」。
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_2.05fr]">
              <aside className="h-[620px] overflow-y-auto">
                <KnifeSectionList
                  sections={sections}
                  selectedSectionId={selectedSection?.id ?? ""}
                  setSelectedSectionId={setSelectedSectionId}
                  t={t}
                />
              </aside>

              <KnifePreviewPanel
                selectedSection={selectedSection}
                updateSectionTitle={updateSectionTitle}
                moveFirstParagraphToPrev={moveFirstParagraphToPrev}
                moveLastParagraphToNext={moveLastParagraphToNext}
                copyText={handleCopySection}
                t={t}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}