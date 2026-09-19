"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import {
  hasItalicMarkup,
  htmlToItalicText,
  readClipboard,
} from "@/lib/clipboard";
import { calcTextMeta, convertAll } from "./_lib/convert";
import {
  DEFAULT_CUSTOM_RULES,
  DEFAULT_FULLWIDTH_OPTIONS,
  type FullwidthCustomRule,
  type FullwidthOptions,
} from "./_lib/types";
import ToolHeader from "@/components/editor/ToolHeader"; 
import FullwidthToolbar from "./_components/FullwidthToolbar";
import FullwidthOptionsPanel from "./_components/FullwidthOptionsPanel";
import FullwidthEditorPanel from "./_components/FullwidthEditorPanel";
import { getThemeClasses } from "@/lib/theme";

const STORAGE_KEYS = {
  options: "fullwidth-options",
  customRules: "fullwidth-custom-rules",
} as const;

function normalizeLineBreaks(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * 剪貼簿裡同時有純文字與 HTML 時優先看 HTML:
 * 從已經排版好的頁面複製時,斜體是真的樣式,純文字版裡一個星號都沒有。
 * 不先接回來的話,「修正變成斜體的對話」永遠沒東西可修。
 */
function textFromClipboard(payload: { text: string; html: string | null }) {
  if (hasItalicMarkup(payload.html)) {
    const restored = htmlToItalicText(payload.html as string);
    if (restored) return { text: restored, restoredItalics: true };
  }
  return { text: payload.text, restoredItalics: false };
}

async function writeClipboardText(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

export default function FullwidthPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [options, setOptions] = useState<FullwidthOptions>(
    DEFAULT_FULLWIDTH_OPTIONS
  );
  const [customRules, setCustomRules] = useState<FullwidthCustomRule[]>(
    DEFAULT_CUSTOM_RULES
  );
  const [notice, setNotice] = useState("");

  const noticeTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = getThemeClasses();

  const inputMeta = useMemo(() => calcTextMeta(input), [input]);
  const outputMeta = useMemo(() => calcTextMeta(output), [output]);

  useEffect(() => {
    try {
      const savedOptions = localStorage.getItem(STORAGE_KEYS.options);
      const savedCustomRules = localStorage.getItem(STORAGE_KEYS.customRules);

      if (savedOptions) {
        const parsed = JSON.parse(savedOptions) as Partial<FullwidthOptions>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
        setOptions({
          ...DEFAULT_FULLWIDTH_OPTIONS,
          ...parsed,
        });
      }

      if (savedCustomRules) {
        const parsed = JSON.parse(savedCustomRules) as FullwidthCustomRule[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomRules(parsed);
        }
      }
    } catch (error) {
      console.error("讀取 fullwidth 設定失敗", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.options, JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.customRules,
      JSON.stringify(customRules)
    );
  }, [customRules]);

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

  function updateOption<K extends keyof FullwidthOptions>(
    key: K,
    value: FullwidthOptions[K]
  ) {
    setOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleConvert() {
    const result = convertAll(input, options, customRules);
    setOutput(result);
    showNotice("標點轉換完成。");
  }

  async function handleCopyOutput() {
    await writeClipboardText(output);
    showNotice("已複製輸出內容。");
  }

  /**
   * 主動讀剪貼簿在 Firefox 與部分 Safari 上會被擋(以前是直接跳 alert 了事)。
   * 現在讀不到就把游標送進輸入區,請使用者用鍵盤貼上——那條路走 paste 事件,
   * 不需要任何權限,而且同樣會還原斜體。
   */
  async function handlePasteToInput() {
    const payload = await readClipboard();

    if (!payload) {
      inputRef.current?.focus();
      showNotice("瀏覽器不讓網頁直接讀剪貼簿。游標已經移到輸入區，請按 Ctrl / ⌘ + V。");
      return;
    }

    const { text, restoredItalics } = textFromClipboard(payload);
    setInput(normalizeLineBreaks(text));
    showNotice(
      restoredItalics ? "已貼上，並把斜體還原成 *…*。" : "已貼上到輸入區。"
    );
  }

  /** 直接在輸入區按 Ctrl/⌘+V:同樣把斜體接回來 */
  function handleInputPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    if (!hasItalicMarkup(html)) return;

    const restored = htmlToItalicText(html);
    if (!restored) return;

    event.preventDefault();

    // 取代目前選取的範圍,而不是整個蓋掉——游標在中間貼上時才不會吃掉原稿
    const target = event.currentTarget;
    const start = target.selectionStart ?? input.length;
    const end = target.selectionEnd ?? start;
    const next = input.slice(0, start) + restored + input.slice(end);

    setInput(normalizeLineBreaks(next));
    showNotice("已貼上，並把斜體還原成 *…*。");
  }

  function handleUseOutputAsInput() {
    setInput(normalizeLineBreaks(output));
    showNotice("已將輸出區內容填回輸入。");
  }

  function handleClearAll() {
    setInput("");
    setOutput("");
    showNotice("內容已清空。");
  }

  function handleResetOptions() {
    setOptions(DEFAULT_FULLWIDTH_OPTIONS);
    setCustomRules(DEFAULT_CUSTOM_RULES);
    showNotice("選項已重設。");
  }

  return (
    <main className={`flex-1 ${t.page}`}>
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
        {/* 這裡換成我們新做的共用標題元件！ */}
        <ToolHeader
          title="標點置換所"
          description="在輸入區貼上原文 / 按下 [貼上到輸入區] → 勾選要轉換的標點符號 → 按下 [執行轉換]"
          t={t}
        />

        <FullwidthToolbar
          onPasteToInput={handlePasteToInput}
          onConvert={handleConvert}
          onCopyOutput={handleCopyOutput}
          onUseOutputAsInput={handleUseOutputAsInput}
          onClearAll={handleClearAll}
          hasOutput={output.length > 0}
          t={t}
        />

        <div className={`my-5 border-t ${t.divider}`} />

        <FullwidthOptionsPanel
          options={options}
          updateOption={updateOption}
          customRules={customRules}
          setCustomRules={setCustomRules}
          handleResetOptions={handleResetOptions}
          t={t}
        />

        <div className={`my-5 border-t ${t.divider}`} />

        <FullwidthEditorPanel
          input={input}
          setInput={(value) => setInput(normalizeLineBreaks(value))}
          inputRef={inputRef}
          onInputPaste={handleInputPaste}
          output={output}
          inputMeta={inputMeta}
          outputMeta={outputMeta}
          t={t}
        />
      </div>
    </main>
  );
}