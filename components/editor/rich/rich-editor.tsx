"use client";

// 「文件」的編輯模式:畫面上直接是排好的樣子(跟預覽、轉圖同一套 md-preview 排版),
// 打字停一下就轉回 Markdown 存起來。原始語法模式則是直接改那份 Markdown。

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import type { EditorThemeConfig } from "@/lib/theme";
import type { EditorPreferences } from "@/lib/preferences";
import { getFontFamily } from "@/lib/editor-font";
import { contentClassFor } from "@/lib/export-image";
import { renderToSafeHtml } from "@/lib/markdown";
import { htmlToMarkdown } from "@/lib/rich-text";
import { RICH_EXTENSIONS } from "./extensions";

/** 停止打字多久之後才轉回 Markdown 存檔 */
const SAVE_DELAY_MS = 250;

type Props = {
  content: string;
  onChange: (markdown: string) => void;
  /** 編輯器建好、或換掉時通知外面(工具列、尋找取代要用) */
  onReady: (editor: Editor | null) => void;
  preferences: EditorPreferences;
  theme: EditorThemeConfig;
  className?: string;
};

function Inner({ initialHtml, content, onChange, onReady, preferences, theme, className = "" }: Props & { initialHtml: string }) {
  const lastSaved = useRef(content);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [...RICH_EXTENSIONS, Placeholder.configure({ placeholder: "在這裡開始寫字……" })],
    content: initialHtml,
    immediatelyRender: false,
    editorProps: { attributes: { class: `${contentClassFor(preferences)} h-full`, "aria-label": "文件內容" } },
    onUpdate: ({ editor: current }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(current), SAVE_DELAY_MS);
    },
    onBlur: ({ editor: current }) => save(current),
  });

  function save(current: Editor) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const markdown = htmlToMarkdown(current.getHTML());
    if (markdown === lastSaved.current) return;
    lastSaved.current = markdown;
    onChangeRef.current(markdown);
  }

  useEffect(() => {
    onReady(editor);
    return () => {
      // 換檢視、換文件前,還沒存的那一點先存掉
      if (editor && timer.current) save(editor);
      onReady(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在編輯器換掉時通知
  }, [editor]);

  // 斜體改淡色正體之類的設定改了,編輯區的 class 跟著換
  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: { class: `${contentClassFor(preferences)} h-full`, "aria-label": "文件內容" } } });
  }, [editor, preferences]);

  return (
    <div className={`w-full ${className}`}>
      <div className={`rounded-3xl border p-4 shadow-sm ${theme.border} ${theme.textareaBg}`}>
        <EditorContent
          editor={editor}
          className="rich-editor h-[70vh] overflow-auto"
          style={{
            fontSize: `${preferences.fontSize}px`,
            lineHeight: preferences.lineHeight,
            letterSpacing: `${preferences.letterSpacing}px`,
            fontFamily: getFontFamily(preferences.fontFamily),
          }}
        />
      </div>
    </div>
  );
}

export default function RichEditor(props: Props) {
  // 先把 Markdown 排成 HTML 再建編輯器:一開始就是完整內容,復原不會退回空白
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const { content } = props;
  const [loadedFor] = useState(content);

  useEffect(() => {
    let cancelled = false;
    void renderToSafeHtml("markdown", loadedFor).then((html) => {
      if (!cancelled) setInitialHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [loadedFor]);

  if (initialHtml === null) {
    return (
      <div className={`w-full ${props.className ?? ""}`}>
        <div className={`h-[calc(70vh+2rem)] rounded-3xl border p-4 ${props.theme.border} ${props.theme.textareaBg}`} />
      </div>
    );
  }
  return <Inner {...props} initialHtml={initialHtml} />;
}
