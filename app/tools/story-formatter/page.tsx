"use client";

import { useState, useEffect } from "react";
import ToolHeader from "@/components/editor/ToolHeader";
import { getThemeClasses } from "@/lib/theme";

const DEFAULT_CHARS = [
  { name: "SSR", slug: "ssr" },
  { name: "菅原仁", slug: "suga" },
  { name: "程枳", slug: "citrus" },
  { name: "楚硯珵", slug: "cyc" },
  { name: "喬裕川", slug: "breakfast" },
  { name: "灰檁", slug: "ascher" },
  { name: "敘延安", slug: "yenan" },
  { name: "恩佐", slug: "enzo" },
  { name: "林檎", slug: "apple" },
  { name: "伊空 Akasha", slug: "akasha" },
  { name: "師匠", slug: "fire" },
  { name: "漓光語", slug: "lightning" },
  { name: "沈岸", slug: "shore" },
  { name: "星宮雅治｜星宮清春", slug: "hoshimiya" },
  { name: "拉維・多布達拉", slug: "lavi" },
];

interface CharEntry { name: string; slug: string; }
interface StoryEntry { id: string; title: string; type: "main" | "extra"; }
interface StorageData { chars: CharEntry[]; stories: Record<string, StoryEntry[]>; }

const STORAGE_KEY = "story_formatter_data";

function loadData(): StorageData {
  if (typeof window === "undefined") return { chars: DEFAULT_CHARS, stories: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chars: DEFAULT_CHARS, stories: {} };
    return JSON.parse(raw);
  } catch {
    return { chars: DEFAULT_CHARS, stories: {} };
  }
}

function saveData(data: StorageData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function extractOrder(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1]) : 99;
}

export default function StoryFormatterPage() {
  const t = getThemeClasses();

  const [data, setData] = useState<StorageData>({ chars: DEFAULT_CHARS, stories: {} });
  const [selectedSlug, setSelectedSlug] = useState("");
  const [storyId, setStoryId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"main" | "extra">("main");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");

  // new char form
  const [showAddChar, setShowAddChar] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [newCharSlug, setNewCharSlug] = useState("");

  // output
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
    setData(loadData());
  }, []);

  const currentChar = data.chars.find((c) => c.slug === selectedSlug);
  const existingStories = selectedSlug ? (data.stories[selectedSlug] || []) : [];

  // ID conflict check
  const idConflict = !!existingStories.find((s) => s.id === storyId);

  function addChar() {
    if (!newCharName.trim() || !newCharSlug.trim()) return;
    const next: StorageData = {
      ...data,
      chars: [...data.chars, { name: newCharName.trim(), slug: newCharSlug.trim() }],
    };
    setData(next);
    saveData(next);
    setNewCharName("");
    setNewCharSlug("");
    setShowAddChar(false);
  }

  function registerStory() {
    if (!selectedSlug || !storyId || !title) return;
    const existing = data.stories[selectedSlug] || [];
    if (existing.find((s) => s.id === storyId)) return;
    const next: StorageData = {
      ...data,
      stories: {
        ...data.stories,
        [selectedSlug]: [...existing, { id: storyId, title, type }],
      },
    };
    setData(next);
    saveData(next);
  }

  // outputs
  const orderNum = extractOrder(storyId);

  const output1 = storyId && content
    ? `  // ${currentChar?.name || selectedSlug} — ${title}\n  "${selectedSlug}/${storyId}": \`${content.replace(/`/g, "\\`")}\`,`
    : "";

  const output2 = storyId && title
    ? `  {\n    id: "${storyId}",\n    title: "${title}",\n    type: "${type}",\n    order: ${orderNum},\n    excerpt: "${excerpt}",\n  },`
    : "";

  function copy(text: string, which: 1 | 2) {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 1) { setCopied1(true); setTimeout(() => setCopied1(false), 2000); }
      else { setCopied2(true); setTimeout(() => setCopied2(false), 2000); }
    });
  }

  const inputClass = `w-full rounded-xl border px-3 py-2 text-sm tracking-[0.04em] outline-none transition focus:ring-1 focus:ring-(--border-dark) focus:border-(--border-dark) ${t.input}`;

  const labelClass = `text-xs tracking-[0.1em] mb-1.5 block ${t.muted}`;

  const outputClass = `w-full rounded-xl border p-4 text-xs font-mono leading-relaxed tracking-normal whitespace-pre-wrap break-all min-h-[80px] border-(--border-light) bg-(--paper-bg) text-(--ink-secondary)`;

  const btnClass = `rounded-xl border px-4 py-2 text-xs tracking-[0.08em] transition ${t.secondary}`;

  const btnPrimaryClass = `rounded-xl px-4 py-2 text-xs tracking-[0.08em] transition font-medium bg-(--accent) text-(--on-accent) hover:opacity-90`;

  return (
    <main className={`min-h-screen p-6 flex flex-col ${t.page}`}>
      <div className="mx-auto w-full max-w-3xl flex-1">
        <ToolHeader
          title="故事格式轉換器"
          description="填入故事資料，產生可直接貼入程式碼的格式。"
          t={t}
        />

        <div className="flex flex-col gap-6">

          {/* ── 角色選擇 ── */}
          <section className={`rounded-2xl border p-5 flex flex-col gap-4 ${t.panel}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-[0.06em]">角色</h2>
              <button className={btnClass} onClick={() => setShowAddChar(!showAddChar)}>
                {showAddChar ? "取消" : "+ 新增角色"}
              </button>
            </div>

            {showAddChar && (
              <div className={`rounded-xl border p-4 flex flex-col gap-3 ${t.subPanel}`}>
                <p className={`text-xs tracking-[0.08em] ${t.muted}`}>新角色資料</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>名字</label>
                    <input className={inputClass} value={newCharName} onChange={(e) => setNewCharName(e.target.value)} placeholder="例：新角色" />
                  </div>
                  <div>
                    <label className={labelClass}>Slug（網址用）</label>
                    <input className={inputClass} value={newCharSlug} onChange={(e) => setNewCharSlug(e.target.value)} placeholder="例：newchar" />
                  </div>
                </div>
                <button className={btnPrimaryClass} style={{ alignSelf: "flex-end" }} onClick={addChar}>
                  新增
                </button>
              </div>
            )}

            <div>
              <label className={labelClass}>選擇角色</label>
              <select
                className={inputClass}
                value={selectedSlug}
                onChange={(e) => { setSelectedSlug(e.target.value); setStoryId(""); }}
              >
                <option value="">— 請選擇 —</option>
                {data.chars.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}（{c.slug}）</option>
                ))}
              </select>
            </div>

            {/* 現有故事列表 */}
            {selectedSlug && (
              <div>
                <p className={`${labelClass} mb-2`}>已記錄的故事</p>
                {existingStories.length === 0 ? (
                  <p className={`text-xs tracking-[0.06em] opacity-40 ${t.muted}`}>尚無記錄</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {[...existingStories]
                      .sort((a, b) => {
                        if (a.type !== b.type) return a.type === "main" ? -1 : 1;
                        return extractOrder(a.id) - extractOrder(b.id);
                      })
                      .map((s) => (
                        <div key={s.id} className={`flex items-center gap-3 text-xs tracking-[0.04em] px-3 py-1.5 rounded-lg bg-(--paper-bg-3)`}>
                          <span className={`opacity-40 font-mono ${t.muted}`}>{s.id}</span>
                          <span className={`opacity-40 text-[10px] tracking-widest ${t.muted}`}>
                            {s.type === "main" ? "主線" : "番外"}
                          </span>
                          <span>{s.title}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── 故事資料 ── */}
          <section className={`rounded-2xl border p-5 flex flex-col gap-4 ${t.panel}`}>
            <h2 className="text-sm font-medium tracking-[0.06em]">故事資料</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Story ID</label>
                <input
                  className={`${inputClass} ${idConflict ? "border-red-400 focus:ring-red-400" : ""}`}
                  value={storyId}
                  onChange={(e) => setStoryId(e.target.value)}
                  placeholder="例：main-01"
                />
                {idConflict && (
                  <p className="text-[11px] text-red-400 mt-1 tracking-[0.04em]">⚠ 這個 ID 已存在</p>
                )}
                {storyId && !idConflict && (
                  <p className={`text-[11px] mt-1 tracking-[0.04em] opacity-40 ${t.muted}`}>
                    排序將自動設為 {extractOrder(storyId)}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>類型</label>
                <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as "main" | "extra")}>
                  <option value="main">主線</option>
                  <option value="extra">番外</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>標題</label>
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="故事標題" />
            </div>

            <div>
              <label className={labelClass}>摘要（顯示在列表上，一兩句話）</label>
              <input className={inputClass} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="一兩句話的故事摘要" />
            </div>

            <div>
              <label className={labelClass}>故事內容（從 Google Doc 貼入）</label>
              <textarea
                className={`${inputClass} min-h-[240px] resize-y leading-relaxed`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="把故事全文貼在這裡..."
              />
            </div>
          </section>

          {/* ── 輸出 ── */}
          <section className={`rounded-2xl border p-5 flex flex-col gap-5 ${t.panel}`}>
            <h2 className="text-sm font-medium tracking-[0.06em]">輸出</h2>

            {/* storyContents.ts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + " mb-0"}>貼入 storyContents.ts</label>
                <button
                  className={btnPrimaryClass}
                  onClick={() => { copy(output1, 1); registerStory(); }}
                  disabled={!output1}
                >
                  {copied1 ? "✓ 已複製" : "複製"}
                </button>
              </div>
              <div className={outputClass}>{output1 || "填完上方欄位後這裡會出現結果"}</div>
            </div>

            {/* stories.ts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + " mb-0"}>貼入 stories.ts 的 stories 陣列</label>
                <button
                  className={btnPrimaryClass}
                  onClick={() => copy(output2, 2)}
                  disabled={!output2}
                >
                  {copied2 ? "✓ 已複製" : "複製"}
                </button>
              </div>
              <div className={outputClass}>{output2 || "填完上方欄位後這裡會出現結果"}</div>
            </div>

            <p className={`text-xs tracking-[0.06em] opacity-40 ${t.muted}`}>
              複製 storyContents 時會自動記錄這篇故事，之後在角色的已記錄列表裡看得到。
            </p>
          </section>

        </div>
      </div>

      <footer className="mt-20 pb-8 text-center px-4">
        <p className={`mx-auto max-w-lg text-xs font-light leading-relaxed tracking-[0.08em] ${t.muted} opacity-60 transition-opacity duration-500 hover:opacity-100 cursor-default`}>
          Once upon a time, a tired bear sat coding in the woods.<br className="hidden sm:block" />
          As a soft fog wrapped around the trees,{" "}
          <br className="hidden sm:block" />
          the bear wandered out to a silent lake just for breathing.
        </p>
      </footer>
    </main>
  );
}
