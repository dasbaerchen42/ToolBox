import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { EditorPreferences } from "@/lib/preferences";
import { getFontFamily } from "@/lib/editor-font";

type EditorTextareaProps = {
  content: string;
  onChange: (value: string) => void;
  preferences: EditorPreferences;
  theme: {
    border: string;
    textareaBg: string;
    text: string;
  };
  className?: string;
};

/**
 * 原始語法、純文字、進階模式用的輸入框。
 * 不自己捲動:內容多長框就多高,整頁只有一條捲軸(工具列固定在頂端)。
 */
const EditorTextarea = forwardRef<HTMLTextAreaElement, EditorTextareaProps>(
  function EditorTextarea({ content, onChange, preferences, theme, className = "" }, ref) {
    const inner = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

    // 內容、字級、寬度變了就重新量高度
    useLayoutEffect(() => {
      const el = inner.current;
      if (!el) return;
      const fit = () => {
        // 先縮回 auto 再量,頁面可能一瞬間變短而跳動;量完把捲動位置放回去
        const scrollY = window.scrollY;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY });
      };
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(el.parentElement ?? el);
      return () => observer.disconnect();
    }, [content, preferences.fontSize, preferences.lineHeight, preferences.letterSpacing, preferences.fontFamily]);

    return (
      <div className={`w-full ${className}`}>
        <div className={`rounded-3xl border p-4 shadow-sm ${theme.border} ${theme.textareaBg}`}>
          <textarea
            ref={inner}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            style={{
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight,
              letterSpacing: `${preferences.letterSpacing}px`,
              fontFamily: getFontFamily(preferences.fontFamily),
            }}
            className={`block min-h-[60vh] w-full resize-none overflow-hidden bg-transparent outline-none ${theme.text}`}
            placeholder="在這裡開始寫字……"
          />
        </div>
      </div>
    );
  }
);

export default EditorTextarea;
