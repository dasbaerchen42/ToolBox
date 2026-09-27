"use client";

import Link from "next/link";
import { getThemeClasses } from "@/lib/theme";

/**
 * 每個工具一列,權重相同。
 *
 * 刻意不用卡片:六個有框有底的方塊就是六個視覺重量,框本身才是不清爽的來源。
 * 改成細線分隔的等寬列表,留白取代邊框,看起來像目錄而不是儀表板。
 */
const tools = [
  {
    title: "通用編輯器",
    href: "/editor",
    tags: ["文字編輯", "雲端匯入匯出", "文轉圖", "即時渲染"],
  },
  {
    title: "標點置換所",
    href: "/tools/fullwidth",
    tags: ["全形半形", "標點轉換", "自訂規則", "保護區段"],
  },
  {
    title: "文字切割刀",
    href: "/tools/knife",
    tags: ["依字數切段", "逐段預覽", "命名章節", "打包下載"],
  },
  {
    title: "社群轉換區",
    href: "/tools",
    tags: ["花式字體", "符號顏文字", "分隔線", "社群排版"],
  },
  {
    title: "影像工作檯",
    href: "/tools/image",
    tags: ["貼上即用", "塗遮罩", "切割拼貼", "全程本機"],
  },
];

const aside = {
  title: "發條驛站 · 恩佐的輓歌",
  note: "文字生存 Roguelike",
  href: "https://the-clockwork-station.vercel.app/",
};

export default function HomePage() {
  const t = getThemeClasses();

  return (
    <main className={`flex flex-1 flex-col ${t.page}`}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
        <header className="pt-10 pb-8 text-center md:pt-14 md:pb-10">
          <h1 className="text-2xl font-semibold tracking-[0.16em] md:text-3xl">
            創作區｜工具箱
          </h1>
          <p className={`mt-3 text-sm tracking-[0.08em] ${t.muted}`}>
            圓夢的地方：小工具，以及可能更多的未來。
          </p>
        </header>

        <nav aria-label="工具">
          <ul className={`border-t ${t.divider}`}>
            {tools.map((tool) => (
              <li key={tool.href} className={`border-b ${t.divider}`}>
                <Link
                  href={tool.href}
                  className="group flex items-center gap-4 py-4 transition-all duration-300 hover:pl-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg tracking-[0.1em]">
                      {tool.title}
                    </span>
                    <span
                      className={`mt-1.5 block text-xs leading-6 tracking-[0.04em] ${t.muted}`}
                    >
                      {tool.tags.map((tag, index) => (
                        <span key={tag}>
                          {index > 0 && <span className="opacity-30">｜</span>}
                          {tag}
                        </span>
                      ))}
                    </span>
                  </span>

                  {/* 平常不出現,滑過去才浮現:靜止時版面上一條多餘的線都沒有 */}
                  <span
                    aria-hidden
                    className="shrink-0 text-sm opacity-0 transition-opacity duration-300 group-hover:opacity-50"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className={`mt-8 text-center text-xs tracking-[0.08em] ${t.muted}`}>
          <a
            href={aside.href}
            target="_blank"
            rel="noreferrer"
            className="opacity-50 transition-opacity duration-300 hover:opacity-100"
          >
            {aside.title}
            <span className="mx-1.5 opacity-40">｜</span>
            {aside.note}
            <span className="ml-1.5 text-[10px]">↗</span>
          </a>
        </p>
      </div>

      {/* 這裡是專屬小熊的彩蛋頁尾 */}
      <footer className="space-y-3 px-4 pt-10 pb-6 text-center">
        <p
          className={`mx-auto max-w-lg text-xs leading-relaxed font-light tracking-[0.08em] ${t.muted} cursor-default opacity-60 transition-opacity duration-500 hover:opacity-100`}
        >
          Once upon a time, a tired bear sat coding in the woods.
          <br className="hidden sm:block" />
          As a soft fog wrapped around the trees, <br className="hidden sm:block" />
          the bear wandered out to a silent lake just for breathing.
        </p>
        <Link
          href="/privacy"
          className={`text-xs tracking-widest opacity-30 transition-opacity hover:opacity-60 ${t.muted}`}
        >
          隱私權政策
        </Link>
      </footer>
    </main>
  );
}
