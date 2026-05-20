"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState, use } from "react";
import ToolHeader from "@/components/editor/ToolHeader";
import { getThemeClasses, type ThemeMode } from "@/lib/theme";
import { getCharacter } from "@/lib/stories";

interface Props {
  params: Promise<{ slug: string }>;
}

type StoryItem = {
  id: string;
  title: string;
  type: "main" | "extra";
  order: number;
  order_index?: number;
  excerpt: string;
};

type CharacterData = {
  slug: string;
  name: string;
  job: string;
  age: string;
  tagline: string;
  chatLink?: string;
  chat_link?: string | null;
  chatLinkAlt?: string;
  chat_link_alt?: string | null;
  stories: StoryItem[];
};

export default function CharacterStoriesPage({ params }: Props) {
  const { slug } = use(params);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const t = getThemeClasses(theme);

  const hardcodedChar = getCharacter(slug);

  const [char, setChar] = useState<CharacterData | null>(
    hardcodedChar
      ? {
          slug: hardcodedChar.slug,
          name: hardcodedChar.name,
          job: hardcodedChar.job,
          age: hardcodedChar.age,
          tagline: hardcodedChar.tagline,
          chatLink: hardcodedChar.chatLink,
          chatLinkAlt: hardcodedChar.chatLinkAlt,
          stories: hardcodedChar.stories.map((s) => ({
            id: s.id,
            title: s.title,
            type: s.type,
            order: s.order,
            excerpt: s.excerpt,
          })),
        }
      : null
  );
  const [loading, setLoading] = useState(!hardcodedChar);

  useEffect(() => {
    fetch(`/api/stories/${slug}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.slug) {
          setChar({
            ...data,
            stories: (data.stories ?? []).map((s: StoryItem) => ({
              ...s,
              order: s.order_index ?? s.order ?? 0,
            })),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className={`min-h-screen p-6 flex items-center justify-center ${getThemeClasses("light").page}`}>
        <p className="text-sm opacity-40">載入中…</p>
      </main>
    );
  }

  if (!char) return notFound();

  const mainStories = char.stories.filter((s) => s.type === "main");
  const extraStories = char.stories.filter((s) => s.type === "extra");
  const chatLink = char.chatLink ?? char.chat_link;
  const chatLinkAlt = char.chatLinkAlt ?? char.chat_link_alt;

  return (
    <main className={`min-h-screen p-6 flex flex-col ${t.page}`}>
      <div className="mx-auto w-full max-w-3xl flex-1">
        <ToolHeader
          title={char.name}
          description={char.tagline || char.job || ""}
          theme={theme}
          setTheme={setTheme}
          t={t}
        />

        <div className="mb-6">
          <Link
            href="/stories"
            className={`text-xs tracking-[0.1em] transition hover:opacity-100 opacity-50 ${t.muted}`}
          >
            ← 所有角色
          </Link>
        </div>

        {chatLink && (
          <div className="mb-8 flex gap-3 flex-wrap">
            <a
              href={chatLink}
              target="_blank"
              rel="noreferrer"
              className={`rounded-2xl border px-4 py-2 text-sm tracking-[0.08em] transition ${
                theme === "dark"
                  ? "border-zinc-700 hover:bg-zinc-800"
                  : "border-stone-300 hover:bg-stone-50"
              }`}
            >
              去找他聊聊 →
            </a>
            {chatLinkAlt && (
              <a
                href={chatLinkAlt}
                target="_blank"
                rel="noreferrer"
                className={`rounded-2xl border px-4 py-2 text-sm tracking-[0.08em] transition ${
                  theme === "dark"
                    ? "border-zinc-700 hover:bg-zinc-800"
                    : "border-stone-300 hover:bg-stone-50"
                }`}
              >
                去找他聊聊（其他平台）→
              </a>
            )}
          </div>
        )}

        {char.stories.length === 0 ? (
          <p className={`text-sm tracking-[0.08em] ${t.muted} opacity-50`}>
            故事準備中。
          </p>
        ) : (
          <>
            {mainStories.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xs tracking-[0.18em] mb-4 opacity-50">主線</h2>
                <div className="flex flex-col gap-3">
                  {mainStories
                    .sort((a, b) => a.order - b.order)
                    .map((story) => (
                      <StoryCard key={story.id} slug={slug} story={story} theme={theme} t={t} />
                    ))}
                </div>
              </section>
            )}

            {mainStories.length > 0 && extraStories.length > 0 && (
              <div className={`border-t mb-10 ${theme === "dark" ? "border-zinc-800" : "border-stone-200"}`} />
            )}

            {extraStories.length > 0 && (
              <section>
                <h2 className="text-xs tracking-[0.18em] mb-4 opacity-50">番外</h2>
                <div className="flex flex-col gap-3">
                  {extraStories
                    .sort((a, b) => a.order - b.order)
                    .map((story) => (
                      <StoryCard key={story.id} slug={slug} story={story} theme={theme} t={t} />
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <footer className="mt-20 pb-8 text-center px-4">
        <p className={`mx-auto max-w-lg text-xs font-light leading-relaxed tracking-[0.08em] ${t.muted} opacity-60 transition-opacity duration-500 hover:opacity-100 cursor-default`}>
          Once upon a time, a tired bear sat coding in the woods.
          <br className="hidden sm:block" />
          As a soft fog wrapped around the trees,
          <br className="hidden sm:block" />
          the bear wandered out to a silent lake just for breathing.
        </p>
      </footer>
    </main>
  );
}

function StoryCard({
  slug,
  story,
  theme,
  t,
}: {
  slug: string;
  story: StoryItem;
  theme: ThemeMode;
  t: ReturnType<typeof getThemeClasses>;
}) {
  return (
    <Link
      href={`/stories/${slug}/${story.id}`}
      className={`group rounded-2xl border p-4 transition flex flex-col gap-1 ${
        theme === "dark"
          ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80"
          : "border-stone-300 bg-white hover:bg-stone-50"
      }`}
    >
      <h3 className="text-sm font-medium tracking-[0.06em]">{story.title}</h3>
      {story.excerpt && (
        <p className={`text-xs leading-6 tracking-[0.04em] ${t.muted}`}>{story.excerpt}</p>
      )}
      <span className={`text-xs tracking-[0.1em] mt-1 opacity-0 group-hover:opacity-50 transition-opacity ${t.muted}`}>
        閱讀 →
      </span>
    </Link>
  );
}
