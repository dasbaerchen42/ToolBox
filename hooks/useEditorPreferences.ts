"use client";

import { useEffect, useState } from "react";
import {
  PREFERENCES_KEY,
  type EditorPreferences,
  defaultPreferences,
} from "@/lib/preferences";
import { migratePreferences } from "@/lib/preferences-migrate";
import { ensureWebFont } from "@/lib/web-fonts";

export function useEditorPreferences() {
  const [preferences, setPreferences] =
    useState<EditorPreferences>(defaultPreferences);
  // 載入完成前不寫回 localStorage,避免掛載瞬間用預設值蓋掉已存偏好
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        // 與預設值合併、舊版轉圖設定換成新的:舊資料缺新欄位(或留有已棄用欄位)都不會壞
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
        setPreferences(migratePreferences(JSON.parse(saved)));
      }
    } catch {
      localStorage.removeItem(PREFERENCES_KEY);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 反映這次同步寫入的結果
      setStorageError(null);
    } catch {
      setStorageError("編輯器設定無法儲存到瀏覽器，請確認不是無痕模式且仍有可用空間。");
    }
  }, [preferences, loaded]);

  // 中文網路字體是選到才載入的
  useEffect(() => {
    void ensureWebFont(preferences.fontFamily);
  }, [preferences.fontFamily]);

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

  return {
    preferences,
    setPreferences,
    adjustFontSize,
    adjustLineHeight,
    adjustLetterSpacing,
    storageError,
  };
}
