"use client";

import Link from "next/link";
import { useState } from "react";
import { notFound } from "next/navigation";
import { getThemeClasses, type ThemeMode } from "@/lib/theme";
import { getCharacter } from "@/lib/stories";

interface Props {
  params: { slug: string; storyId: string };
}

// 故事內容目前用靜態方式管理
// 之後可以改成從 markdown 檔案讀取
import { storyContents } from "@/lib/storyContents";

export default function StoryPage({ params }: Props) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const t = getThemeClasses(theme);

  const char = getCharacter(params.slug);
  if (!char) notFound();

  const story = char.stories.find((s) => s.id === params.storyId);
  if (!story) notFound();

  const content = storyContents[`${params.slug}/${params.storyId}`];

  const allStories = [...char.stories].sort((a, b) => {
    if (a.type !== b.type) return a.type === "main" ? -1 : 1;
    return a.order - b.order;
  });
  const currentIndex = allStories.findIndex((s) => s.id === params.storyId);
  const prevStory = currentIndex > 0 ? allStories[currentIndex - 1] : null;
  const nextStory =
    currentIndex < allStories.length - 1 ? allStories[currentIndex + 1] : null;

  return (
    <main className={`min-h-screen flex flex-col ${t.page}`}>
      {/* 頂部導航 */}
      <nav
        className={`sticky top-0 z-10 border-b px-6 py-3 flex items-center justify-between text-xs tracking-[0.1em] backdrop-blur ${
          theme === "dark"
            ? "border-zinc-800 bg-zinc-950/80"
            : "border-stone-200 bg-white/80"
        }`}
      >
        <Link
          href={`/stories/${params.slug}`}
          className={`opacity-50 hover:opacity-100 transition ${t.muted}`}
        >
          ← {char.name}
        </Link>

        {/* 深淺切換 */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={`opacity-40 hover:opacity-80 transition text-xs ${t.muted}`}
        >
          {theme === "dark" ? "淺色" : "深色"}
        </button>
      </nav>

      {/* 文章主體 */}
      <article className="mx-auto w-full max-w-2xl px-6 py-12 flex-1">
        {/* 標題區 */}
        <header className="mb-10">
          <div
            className={`text-xs tracking-[0.15em] mb-3 opacity-40 ${t.muted}`}
          >
            {story.type === "main" ? "主線" : "番外"} · {char.name}
          </div>
          <h1 className="text-xl font-semibold tracking-[0.08em] leading-relaxed">
            {story.title}
          </h1>
        </header>

        {/* 故事內容 */}
        {content ? (
          <div
            className={`prose prose-sm max-w-none leading-[2.2] tracking-[0.06em] ${
              theme === "dark" ? "prose-invert" : ""
            }`}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {content}
          </div>
        ) : (
          <p className={`text-sm opacity-40 ${t.muted}`}>故事內容準備中。</p>
        )}

        {/* 文末分隔 */}
        <div
          className={`mt-16 mb-10 border-t ${
            theme === "dark" ? "border-zinc-800" : "border-stone-200"
          }`}
        />

        {/* 文末出口 */}
        <div className="flex flex-col gap-4">
          {/* 去找他聊聊 */}
          {char.chatLink && (
            <a
              href={char.chatLink}
              target="_blank"
              rel="noreferrer"
              className={`rounded-2xl border px-5 py-3 text-sm tracking-[0.1em] transition text-center ${
                theme === "dark"
                  ? "border-zinc-700 hover:bg-zinc-800"
                  : "border-stone-300 hover:bg-stone-50"
              }`}
            >
              去找他聊聊 →
            </a>
          )}

          {/* 上下篇導航 */}
          <div className="flex gap-3">
            {prevStory ? (
              <Link
                href={`/stories/${params.slug}/${prevStory.id}`}
                className={`flex-1 rounded-2xl border px-4 py-3 text-xs tracking-[0.08em] transition ${
                  theme === "dark"
                    ? "border-zinc-800 hover:bg-zinc-800/80"
                    : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <span className={`block opacity-40 mb-1 ${t.muted}`}>← 上一篇</span>
                <span className="text-sm">{prevStory.title}</span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}

            {nextStory ? (
              <Link
                href={`/stories/${params.slug}/${nextStory.id}`}
                className={`flex-1 rounded-2xl border px-4 py-3 text-xs tracking-[0.08em] transition text-right ${
                  theme === "dark"
                    ? "border-zinc-800 hover:bg-zinc-800/80"
                    : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <span className={`block opacity-40 mb-1 ${t.muted}`}>下一篇 →</span>
                <span className="text-sm">{nextStory.title}</span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </div>

          {/* 返回列表 */}
          <Link
            href={`/stories/${params.slug}`}
            className={`text-center text-xs tracking-[0.1em] opacity-40 hover:opacity-70 transition ${t.muted}`}
          >
            返回 {char.name} 的故事列表
          </Link>
        </div>
      </article>
    </main>
  );
}
