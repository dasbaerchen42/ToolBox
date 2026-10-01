"use client";

import { useSyncExternalStore } from "react";

/** 頁面背景的相對亮度夠低就算暗色主題(七款主題裡有亮有暗,也有自訂配色) */
function isDark(): boolean {
  const color = getComputedStyle(document.body).backgroundColor;
  const match = color.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return false;
  const [r, g, b] = match.slice(0, 3).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

/** 主題切換是改 <html> 的 data-theme 或內聯變數,盯著它就知道什麼時候要重算 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "style", "class"],
  });
  return () => observer.disconnect();
}

/** 網站現在是不是暗色主題:夜光豆子只有在暗的背景上才發光 */
export function useDarkBackground(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false);
}
