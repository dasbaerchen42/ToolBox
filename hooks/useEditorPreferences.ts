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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) setPreferences(JSON.parse(saved) as EditorPreferences);
    } catch {
      localStorage.removeItem(PREFERENCES_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

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
