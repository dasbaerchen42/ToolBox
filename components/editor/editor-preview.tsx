"use client";

// Markdown / HTML 的渲染結果。內容一律先過 DOMPurify 才 innerHTML,
// 而且是打字後 debounce 才重新渲染,不跟著每個按鍵跑。

import { useEffect, useState } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import { type EditorPreferences } from "@/lib/preferences";
import { getFontFamily } from "@/lib/editor-font";
import { renderToSafeHtml, type RenderableMode } from "@/lib/markdown";

type EditorPreviewProps = {
  content: string;
  mode: RenderableMode;
  preferences: EditorPreferences;
  theme: EditorThemeConfig;
  className?: string;
};

const RENDER_DEBOUNCE_MS = 200;

export default function EditorPreview({
  content,
  mode,
  preferences,
  theme,
  className = "",
}: EditorPreviewProps) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      renderToSafeHtml(mode, content)
        .then((next) => {
          if (cancelled) return;
          setHtml(next);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error("渲染失敗：", err);
          setError("渲染失敗，請檢查內容格式。");
        });
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, mode]);

  return (
    <div className={`w-full ${className}`}>
      <div className={`rounded-3xl border p-4 shadow-sm ${theme.border} ${theme.textareaBg}`}>
        {error ? (
          <div className={`h-[70vh] text-sm ${theme.mutedText}`}>{error}</div>
        ) : (
          <div
            className="md-preview h-[70vh] overflow-auto"
            style={{
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight,
              letterSpacing: `${preferences.letterSpacing}px`,
              fontFamily: getFontFamily(preferences.fontFamily),
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
