"use client";

import { useEffect, useState } from "react";
import {
  PREFERENCES_KEY,
  type EditorPreferences,
  defaultPreferences,
} from "@/lib/preferences";

export function useEditorPreferences() {
  const [preferences, setPreferences] =
    useState<EditorPreferences>(defaultPreferences);
  // 載入完成前不寫回 localStorage,避免掛載瞬間用預設值蓋掉已存偏好
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        // 與預設值合併:舊資料缺新欄位(或留有已棄用欄位)都不會壞
        const parsed = JSON.parse(saved) as Partial<EditorPreferences>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch {
      localStorage.removeItem(PREFERENCES_KEY);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences, loaded]);

  function adjustFontSize(amount: number) {
    setPreferences((prev) => ({
      ...prev,
      fontSize: Math.min(24, Math.max(14, prev.fontSize + amount)),
    }));
  }

  function adjustLineHeight(amount: number) {
    setPreferences((prev) => ({
      ...prev,
      lineHeight: Math.min(
        2.4,
        Math.max(1.4, +(prev.lineHeight + amount).toFixed(1))
      ),
    }));
  }

  function adjustLetterSpacing(amount: number) {
    setPreferences((prev) => ({
      ...prev,
      letterSpacing: Math.min(
        4,
        Math.max(-1, +(prev.letterSpacing + amount).toFixed(1))
      ),
    }));
  }

  function getEditorWidthClass() {
    switch (preferences.editorWidth) {
      case "narrow":
        return "max-w-2xl";
      case "wide":
        return "max-w-6xl";
      case "medium":
      default:
        return "max-w-4xl";
    }
  }

  return {
    preferences,
    setPreferences,
    adjustFontSize,
    adjustLineHeight,
    adjustLetterSpacing,
    getEditorWidthClass,
  };
}
