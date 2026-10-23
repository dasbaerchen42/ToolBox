"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeMenu from "@/components/theme-menu";

const home = { href: "/", label: "首頁" };

const tools = [
  { href: "/editor", label: "通用編輯器" },
  { href: "/tools", label: "社群轉換區" },
  { href: "/tools/knife", label: "文字切割刀" },
  { href: "/tools/chat", label: "聊天室產生器" },
  { href: "/tools/fullwidth", label: "標點置換所" },
  { href: "/tools/image", label: "影像工作檯" },
  { href: "/tools/beads", label: "拼豆工坊" },
];

export default function SiteNavigation() {
  // 靜態輸出的網址尾巴有斜線(/tools/beads/),比對前先拿掉,目前這頁才標得出來
  const pathname = usePathname().replace(/(.)\/$/, "$1");

  return (
    // z-40:主題選單要蓋過編輯器那條固定在頂端的工具列(z-30)
    <nav className="relative z-40 border-b border-(--border-light) bg-(--surface) backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        {/*
          左側:首頁一顆膠囊,其他工具是用細線隔開的文字連結。
          一律單行,放不下就橫向捲動,不換行。
        */}
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none]">
          <Link
            href={home.href}
            aria-current={pathname === home.href ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm tracking-[0.04em] transition ${
              pathname === home.href
                ? "bg-(--accent-fill) text-(--on-accent)"
                : "bg-(--accent-soft) text-(--ink-primary) hover:brightness-95"
            }`}
          >
            {home.label}
          </Link>
          <div className="flex shrink-0 items-center">
            {tools.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <span key={item.href} className="flex items-center">
                  {index > 0 && <span className="mx-3 h-3.5 w-px bg-(--border-dark) opacity-60" aria-hidden />}
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`py-1.5 text-sm tracking-[0.04em] whitespace-nowrap transition ${
                      isActive
                        ? "font-semibold text-(--accent) underline decoration-2 underline-offset-[6px]"
                        : "text-(--ink-secondary) hover:text-(--ink-primary)"
                    }`}
                  >
                    {item.label}
                  </Link>
                </span>
              );
            })}
          </div>
        </div>

        {/* 右側:專屬小熊記號 + 主題選擇 */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center text-[11px] tracking-[0.08em] text-(--ink-tertiary) opacity-50 transition-opacity duration-500 hover:opacity-100 xl:flex">
            <a
              href="https://elsewhere.zeabur.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              A tired bear&apos;s project © 小熊寶 Das Baerchen
            </a>
          </div>
          <ThemeMenu />
        </div>
      </div>
    </nav>
  );
}
