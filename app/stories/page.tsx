"use client";

import Link from "next/link";
import { useState } from "react";
import ToolHeader from "@/components/editor/ToolHeader";
import { getThemeClasses, type ThemeMode } from "@/lib/theme";
import { characters } from "@/lib/stories";

export default function StoriesPage() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const t = getThemeClasses(theme);

  return (
    <main className={`min-h-screen p-6 flex flex-col ${t.page}`}>
      <div className="mx-auto w-full max-w-5xl flex-1">
        <ToolHeader
          title="故事館"
          description="相遇之前，他們各自走過的路。"
          theme={theme}
          setTheme={setTheme}
          t={t}
        />

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {characters.map((char) => (
            <Link
              key={char.slug}
              href={`/stories/${char.slug}`}
              className={`group rounded-3xl border p-5 transition flex flex-col gap-2 ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80"
                  : "border-stone-300 bg-white hover:bg-stone-50"
              }`}
            >
              {/* 圖片佔位區，之後放圖片 */}
              <div
                className={`w-full aspect-[3/4] rounded-2xl mb-1 flex items-center justify-center text-xs tracking-widest ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-600"
                    : "bg-stone-100 text-stone-300"
                }`}
              >
                圖
              </div>

              <h2 className="text-base font-semibold tracking-[0.06em]">
                {char.name}
              </h2>

              {char.job && (
                <p className={`text-xs tracking-[0.05em] ${t.muted}`}>
                  {char.job}
                  {char.age ? `・${char.age}歲` : ""}
                </p>
              )}

              {char.tagline && (
                <p className={`text-xs leading-6 tracking-[0.04em] ${t.muted}`}>
                  {char.tagline}
                </p>
              )}

              {char.comingSoon && (
                <span
                  className={`text-xs tracking-widest mt-auto ${t.muted} opacity-50`}
                >
                  即將開放
                </span>
              )}

              <span
                className={`text-xs tracking-[0.1em] mt-auto opacity-0 group-hover:opacity-60 transition-opacity ${t.muted}`}
              >
                閱讀故事 →
              </span>
            </Link>
          ))}
        </div>
      </div>

      <footer className="mt-20 pb-8 text-center px-4">
        <p
          className={`mx-auto max-w-lg text-xs font-light leading-relaxed tracking-[0.08em] ${t.muted} opacity-60 transition-opacity duration-500 hover:opacity-100 cursor-default`}
        >
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
