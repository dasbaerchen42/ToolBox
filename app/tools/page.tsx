"use client";

import { useMemo, useState } from "react";
// 引入我們剛做好的共用標題與主題！
import ToolHeader from "@/components/editor/ToolHeader";
import { getThemeClasses } from "@/lib/theme";
import { getFontResults } from "./_lib/fancy-fonts";
import { convertSocialText } from "./_lib/social";

async function copyText(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

export default function ToolsPage() {
  const t = getThemeClasses();

  return (
    <main className={`min-h-screen ${t.page}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* 這裡換成共用標題元件！ */}
        <ToolHeader
          title="Tools"
          description="社群排版與字體轉換工具"
          t={t}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <FontTool />
          <SocialTool />
        </div>
      </div>
    </main>
  );
}

function FontTool() {
  const t = getThemeClasses();
  const [input, setInput] = useState("");
  const [selectedFont, setSelectedFont] = useState("squared");

  const results = useMemo(() => getFontResults(input), [input]);

  const selectedResult =
    results.find((item) => item.key === selectedFont) ?? results[0];

  return (
    <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-[0.08em]">字體轉換</h2>
        <p className={`mt-1 text-sm tracking-[0.04em] ${t.muted}`}>
          中文會維持原樣，英文與數字可轉換成不同 Unicode 樣式
        </p>
      </div>

      <div className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入要轉換的文字……"
          className={`h-40 w-full rounded-3xl border p-4 text-sm leading-7 tracking-[0.04em] outline-none transition ${t.input}`}
        />

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {results.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedFont(item.key)}
              className={`rounded-2xl border px-3 py-3 text-left text-sm font-medium tracking-[0.04em] transition ${
                selectedFont === item.key ? t.selected : t.unselected
              }`}
            >
              <div className="text-xs opacity-80">{item.label}</div>
              <div className="mt-1 truncate">{item.preview}</div>
            </button>
          ))}
        </div>

        <div className={`rounded-3xl border p-4 ${t.subPanel}`}>
          <div className={`mb-2 text-xs tracking-[0.06em] ${t.muted}`}>
            轉換結果｜{selectedResult.label}
          </div>

          <textarea
            value={selectedResult.value}
            readOnly
            className={`h-40 w-full resize-none rounded-2xl border p-4 text-sm leading-7 tracking-[0.05em] outline-none ${t.input}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => copyText(selectedResult.value)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
          >
            複製
          </button>

          <button
            type="button"
            onClick={() => {
              setInput("");
              setSelectedFont("squared");
            }}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
          >
            清空
          </button>
        </div>
      </div>
    </section>
  );
}

function SocialTool() {
  const t = getThemeClasses();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  return (
    <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-[0.08em]">社群排版</h2>
        <p className={`mt-1 text-sm tracking-[0.04em] ${t.muted}`}>
          保留你原本輸入的空白、空行、縮排，按下轉換後補上隱形字元。
        </p>
      </div>

      <div className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="先把貼文內容、空白行、縮排都整理好……"
          className={`h-40 w-full rounded-3xl border p-4 text-sm leading-7 tracking-[0.04em] outline-none transition ${t.input}`}
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setOutput(convertSocialText(input))}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
          >
            轉換
          </button>

          <button
            type="button"
            onClick={() => copyText(output)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
          >
            複製
          </button>

          <button
            type="button"
            onClick={() => {
              setInput("");
              setOutput("");
            }}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
          >
            清空
          </button>
        </div>

        <div className={`rounded-3xl border p-4 ${t.subPanel}`}>
          <div className={`mb-2 text-xs tracking-[0.06em] ${t.muted}`}>
            轉換結果
          </div>

          <textarea
            value={output}
            readOnly
            className={`h-40 w-full resize-none rounded-2xl border p-4 text-sm leading-7 tracking-[0.05em] outline-none ${t.input}`}
          />
        </div>
      </div>
    </section>
  );
}
