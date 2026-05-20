"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getThemeClasses, type ThemeMode } from "@/lib/theme";
import { getCharacter } from "@/lib/stories";
import { storyContents } from "@/lib/storyContents";
import { useState, use, useEffect } from "react";

interface Props {
  params: Promise<{ slug: string; storyId: string }>;
}

type StoryItem = {
  id: string;
  title: string;
  type: "main" | "extra";
  order: number;
  order_index?: number;
};

export default function StoryPage({ params }: Props) {
  const { slug, storyId } = use(params);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const t = getThemeClasses(theme);

  const hardcodedChar = getCharacter(slug);
  const hardcodedStory = hardcodedChar?.stories.find((s) => s.id === storyId);
  const hardcodedContent = storyContents[`${slug}/${storyId}`] ?? null;

  const [storyTitle, setStoryTitle] = useState(hardcodedStory?.title ?? "");
  const [storyType, setStoryType] = useState<"main" | "extra">(hardcodedStory?.type ?? "main");
  const [content, setContent] = useState<string | null>(hardcodedContent);
  const [charName, setCharName] = useState(hardcodedChar?.name ?? "");
  const [chatLink, setChatLink] = useState<string | null>(hardcodedChar?.chatLink ?? null);
  const [allStories, setAllStories] = useState<StoryItem[]>(
    hardcodedChar?.stories.map((s) => ({ id: s.id, title: s.title, type: s.type, order: s.order })) ?? []
  );
  const [loading, setLoading] = useState(!hardcodedStory);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    let finished = 0;
    const tryDone = () => {
      finished += 1;
      if (finished === 2) setLoading(false);
    };

    // 公開 API 讀取故事內容（只回傳已發布的）
    fetch(`/api/story/${storyId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.id) {
          setStoryTitle(data.title);
          setStoryType(data.type);
          setContent(data.content || null);
        } else if (!hardcodedStory) {
          setNotFoundState(true);
        }
      })
      .catch(() => {
        if (!hardcodedStory) setNotFoundState(true);
      })
      .finally(tryDone);

    // 取角色資料（含故事列表）
    fetch(`/api/stories/${slug}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.slug) {
          setCharName(data.name);
          setChatLink(data.chat_link ?? null);
          const stories: StoryItem[] = (data.stories ?? []).map((s: StoryItem) => ({
            id: s.id,
            title: s.title,
            type: s.type,
            order: s.order_index ?? s.order ?? 0,
          }));
          setAllStories(stories);
        }
      })
      .catch(() => {})
      .finally(tryDone);
  }, [slug, storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <main className={`min-h-screen flex items-center justify-center ${t.page}`}>
        <p className="text-sm opacity-40">載入中…</p>
      </main>
    );
  }

  if (notFoundState) return notFound();

  const sorted = [...allStories].sort((a, b) => {
    if (a.type !== b.type) return a.type === "main" ? -1 : 1;
    return a.order - b.order;
  });
  const currentIndex = sorted.findIndex((s) => s.id === storyId);
  const prevStory = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const nextStory = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  return (
    <main className={`min-h-screen flex flex-col ${t.page}`}>
      <nav
        className={`sticky top-0 z-10 border-b px-6 py-3 flex items-center justify-between text-xs tracking-[0.1em] backdrop-blur ${
          theme === "dark"
            ? "border-zinc-800 bg-zinc-950/80"
            : "border-stone-200 bg-white/80"
        }`}
      >
        <Link
          href={`/stories/${slug}`}
          className={`opacity-50 hover:opacity-100 transition ${t.muted}`}
        >
          ← {charName}
        </Link>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={`opacity-40 hover:opacity-80 transition text-xs ${t.muted}`}
        >
          {theme === "dark" ? "淺色" : "深色"}
        </button>
      </nav>

      <article className="mx-auto w-full max-w-2xl px-6 py-12 flex-1">
        <header className="mb-10">
          <div className={`text-xs tracking-[0.15em] mb-3 opacity-40 ${t.muted}`}>
            {storyType === "main" ? "主線" : "番外"} · {charName}
          </div>
          <h1 className="text-xl font-semibold tracking-[0.08em] leading-relaxed">
            {storyTitle}
          </h1>
        </header>

        {content ? (
          <div
            className={`text-sm max-w-none leading-[2.2] tracking-[0.06em] ${t.page}`}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {content}
          </div>
        ) : (
          <p className={`text-sm opacity-40 ${t.muted}`}>故事內容準備中。</p>
        )}

        <div className={`mt-16 mb-10 border-t ${theme === "dark" ? "border-zinc-800" : "border-stone-200"}`} />

        <div className="flex flex-col gap-4">
          {chatLink && (
            <a
              href={chatLink}
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

          <div className="flex gap-3">
            {prevStory ? (
              <Link
                href={`/stories/${slug}/${prevStory.id}`}
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
                href={`/stories/${slug}/${nextStory.id}`}
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

          <Link
            href={`/stories/${slug}`}
            className={`text-center text-xs tracking-[0.1em] opacity-40 hover:opacity-70 transition ${t.muted}`}
          >
            返回 {charName} 的故事列表
          </Link>
        </div>
      </article>
    </main>
  );
}
