"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首頁" },
  { href: "/editor", label: "通用編輯器" },
  { href: "/tools", label: "社群轉換區" },
  { href: "/tools/knife", label: "文字切割刀" },
  { href: "/tools/fullwidth", label: "標點置換所" },
  { href: "/gacha", label: "兒童節抽籤" },  // ← 加這行
];

export default function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-white/70 backdrop-blur dark:bg-zinc-900/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        
        {/* 左側：導覽列按鈕區塊 */}
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl border px-3 py-2 text-sm tracking-[0.04em] transition ${
                  isActive
                    ? "border-black bg-black text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* 右側：專屬小熊記號 (利用 ml-auto 推到最右邊) */}
        <div className="ml-auto hidden items-center text-[11px] tracking-[0.08em] text-gray-400 opacity-50 transition-opacity duration-500 hover:opacity-100 dark:text-zinc-500 md:flex">
          <a 
            href="https://dasbaerchen.vercel.app" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            A tired bear's project © 小熊寶 Das Baerchen
          </a>
        </div>

      </div>
    </nav>
  );
}
