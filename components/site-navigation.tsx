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
  { href: "/gacha", label: "兒童節抽籤" },
];

export default function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-(--border-light) bg-(--surface) backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        {/* 左側:導覽列按鈕區塊 */}
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl border px-3 py-2 text-sm tracking-[0.04em] transition ${
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
        <div className="ml-auto flex items-center gap-3">
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
