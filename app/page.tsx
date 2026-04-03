"use client";

import Link from "next/link";
import { useState } from "react";
// 引入我們做好的共用標題與主題
import ToolHeader from "@/components/editor/ToolHeader";
import { getThemeClasses, type ThemeMode } from "@/lib/theme";

const tools = [
  {
    title: "通用編輯器",
    desc: "寫作、雲端匯入匯出、格式檢查與美感排版",
    href: "/editor",
  },
  {
    title: "社群轉換區",
    desc: "社群排版與字體轉換工具",
    href: "/tools",
  },
  {
    title: "文字切割刀",
    desc: "依字數切段、預覽片段、命名章節",
    href: "/tools/knife",
  },
  {
    title: "標點置換所",
    desc: "全形、半形與標點處理",
    href: "/tools/fullwidth",
  },
  {
  title: "兒童節抽籤",
  desc: "抽一張卡，讓他們說一句只給你的話",
  href: "/gacha",
  },
];

export default function HomePage() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const t = getThemeClasses(theme);

  return (
    <main className={`min-h-screen p-6 flex flex-col ${t.page}`}>
      <div className="mx-auto w-full max-w-5xl flex-1">
        
        {/* 這裡換成乾淨俐落的共用標題元件 */}
        <ToolHeader 
          title="創作工具箱"
          description="寫作、排版、切割與轉換工具集合"
          theme={theme}
          setTheme={setTheme}
          t={t}
        />

        {/* 這裡的卡片為了保留你原本設計的 hover 滑動變色效果，我幫你用條件式加上去了 */}
        <div className="grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className={`rounded-3xl border p-5 transition ${
                theme === "dark" 
                  ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80" 
                  : "border-stone-300 bg-white hover:bg-stone-50"
              }`}
            >
              <h2 className="text-lg font-semibold tracking-[0.06em]">
                {tool.title}
              </h2>
              <p className={`mt-2 text-sm leading-7 tracking-[0.04em] ${t.muted}`}>
                {tool.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
      {/* 這裡是專屬小熊的彩蛋頁尾 */}
      <footer className="mt-20 pb-8 text-center px-4">
        <p className={`mx-auto max-w-lg text-xs font-light leading-relaxed tracking-[0.08em] ${t.muted} opacity-60 transition-opacity duration-500 hover:opacity-100 cursor-default`}>
          Once upon a time, a tired bear sat coding in the woods.<br className="hidden sm:block" />
          As a soft fog wrapped around the trees, <br className="hidden sm:block" />
          the bear wandered out to a silent lake just for breathing.
        </p>
      </footer>
    </main>
  );
}