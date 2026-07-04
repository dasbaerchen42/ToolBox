"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  async function handlePasteToInput() {
    try {
      const text = await navigator.clipboard.readText();
      setInput(normalizeLineBreaks(text));
      showNotice("已貼上到輸入區。");
    } catch (error) {
      console.error(error);
      alert("無法讀取剪貼簿，請確認瀏覽器權限。");
    }
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
          output={output}
          inputMeta={inputMeta}
          outputMeta={outputMeta}
          t={t}
        />
      </div>
    </main>
  );
}