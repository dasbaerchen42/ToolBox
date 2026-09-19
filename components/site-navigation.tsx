"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeMenu from "@/components/theme-menu";

const navItems = [
  { href: "/", label: "首頁" },
  { href: "/editor", label: "通用編輯器" },
  { href: "/tools", label: "社群轉換區" },
  { href: "/tools/knife", label: "文字切割刀" },
  { href: "/tools/fullwidth", label: "標點置換所" },
  { href: "/tools/image", label: "影像工作檯" },
];

export default function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-(--border-light) bg-(--surface) backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        {/*
          左側:導覽列按鈕區塊。
          窄畫面改成單行橫向捲動而不是換行——六個項目換行會變成三列,
          在手機上每一頁都先吃掉快五分之一個螢幕。
        */}
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto md:flex-wrap md:overflow-x-visible">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm tracking-[0.04em] transition ${
                  isActive
                    ? "border-(--accent) bg-(--accent) text-(--on-accent)"
                    : "border-(--border-light) text-(--ink-secondary) hover:bg-(--paper-bg-3)"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* 右側:專屬小熊記號 + 主題選擇 */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center text-[11px] tracking-[0.08em] text-(--ink-tertiary) opacity-50 transition-opacity duration-500 hover:opacity-100 md:flex">
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
