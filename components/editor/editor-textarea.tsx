import { forwardRef } from "react";
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

const EditorTextarea = forwardRef<HTMLTextAreaElement, EditorTextareaProps>(
  function EditorTextarea({ content, onChange, preferences, theme, className = "" }, ref) {
    return (
      <div className={`w-full ${className}`}>
        <div
          className={`rounded-3xl border p-4 shadow-sm ${theme.border} ${theme.textareaBg}`}
        >
          <textarea
            ref={ref}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            style={{
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight,
              letterSpacing: `${preferences.letterSpacing}px`,
              fontFamily: getFontFamily(preferences.fontFamily),
            }}
            className={`h-[70vh] w-full resize-none bg-transparent outline-none ${theme.text}`}
            placeholder="在這裡開始寫字……"
          />
        </div>
      </div>
    );
  }
);

export default EditorTextarea;
