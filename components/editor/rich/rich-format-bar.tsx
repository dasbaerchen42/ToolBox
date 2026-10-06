"use client";

// 文件編輯模式的格式按鈕:段落樣式、粗體斜體底線刪除線、字色、底色、對齊。
// 按這些按鈕都不會把焦點從編輯區搶走,選起來的字一直反白。
// 字色、底色分成兩半:左邊直接套上次用的顏色,右邊 ▾ 打開色盤換色。

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { EditorThemeConfig } from "@/lib/theme";
import { HIGHLIGHTS, TEXT_COLORS } from "@/lib/rich-text";
import { keepEditorFocus, TOOL_BUTTON, ToolPopover } from "../editor-main-toolbar";

const BLOCKS = [
  { key: "p", label: "內文" },
  { key: "h1", label: "大標題" },
  { key: "h2", label: "中標題" },
  { key: "h3", label: "小標題" },
  { key: "quote", label: "引用" },
  { key: "ul", label: "項目清單" },
  { key: "ol", label: "編號清單" },
] as const;

/** 對齊的小圖示:幾條線排成靠左、置中、置右 */
function AlignIcon({ align }: { align: "left" | "center" | "right" }) {
  const rows = [16, 10, 14, 8];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      {rows.map((w, i) => {
        const x = align === "left" ? 0 : align === "right" ? 16 - w : (16 - w) / 2;
        return <rect key={i} x={x} y={1.5 + i * 3.8} width={w} height="1.8" rx="0.9" fill="currentColor" />;
      })}
    </svg>
  );
}

const ALIGNS = [
  { key: "left", label: "靠左" },
  { key: "center", label: "置中" },
  { key: "right", label: "置右" },
] as const;

export default function RichFormatBar({ editor, theme }: { editor: Editor; theme: EditorThemeConfig }) {
  const [lastColor, setLastColor] = useState<string>("red");
  const [lastHighlight, setLastHighlight] = useState<string>("yellow");

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      color: (e.getAttributes("textColor").color as string | undefined) ?? null,
      highlight: e.isActive("softHighlight") ? ((e.getAttributes("softHighlight").color as string | undefined) ?? "yellow") : null,
      align: (["center", "right"] as const).find((a) => e.isActive({ textAlign: a })) ?? ("left" as const),
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : e.isActive("blockquote")
              ? "quote"
              : e.isActive("bulletList")
                ? "ul"
                : e.isActive("orderedList")
                  ? "ol"
                  : "p",
    }),
  });

  const chain = () => editor.chain().focus();
  const on = "border-(--accent) bg-(--accent) text-(--on-accent)";
  const off = `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  const square = (active: boolean) => `${TOOL_BUTTON} w-9 px-0 ${active ? on : off}`;
  const item = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-(--paper-bg-3) ${active ? "font-semibold text-(--accent)" : ""}`;
  const swatch = "h-8 w-8 rounded-full border-2 transition";
  // 分成兩半的按鈕:左半套用、右半打開色盤
  const leftHalf = `${TOOL_BUTTON} rounded-r-none border-r-0 pl-3 pr-2 ${off}`;
  const rightHalf = (open: boolean) => `${TOOL_BUTTON} w-7 rounded-l-none px-0 text-xs ${open ? on : off}`;

  function setBlock(key: (typeof BLOCKS)[number]["key"]) {
    const c = chain();
    if (key === "p") c.setParagraph().run();
    else if (key === "h1") c.setHeading({ level: 1 }).run();
    else if (key === "h2") c.setHeading({ level: 2 }).run();
    else if (key === "h3") c.setHeading({ level: 3 }).run();
    else if (key === "quote") c.toggleBlockquote().run();
    else if (key === "ul") c.toggleBulletList().run();
    else c.toggleOrderedList().run();
  }

  const colorOf = (key: string) => TEXT_COLORS.find((c) => c.key === key)?.color;
  const highlightOf = (key: string) => HIGHLIGHTS.find((h) => h.key === key)?.color;

  return (
    <>
      <ToolPopover
        label={`${BLOCKS.find((b) => b.key === state.block)?.label ?? "內文"} ▾`}
        title="段落樣式：標題、引用、清單"
        theme={theme}
        width="w-44"
        keepFocus
      >
        {(close) => (
          <div className="flex flex-col" onClick={close}>
            {BLOCKS.map((block) => (
              <button key={block.key} type="button" role="menuitem" onClick={() => setBlock(block.key)} className={item(state.block === block.key)}>
                {block.label}
              </button>
            ))}
            <div className="my-1 h-px" style={{ background: "var(--border-light)" }} />
            <button type="button" role="menuitem" onClick={() => chain().setHorizontalRule().run()} className={item(false)}>
              插入分隔線
            </button>
          </div>
        )}
      </ToolPopover>

      <button type="button" title="粗體（Ctrl+B）" aria-label="粗體" aria-pressed={state.bold} onMouseDown={keepEditorFocus} onClick={() => chain().toggleBold().run()} className={square(state.bold)}>
        <b>B</b>
      </button>
      <button type="button" title="斜體（Ctrl+I）" aria-label="斜體" aria-pressed={state.italic} onMouseDown={keepEditorFocus} onClick={() => chain().toggleItalic().run()} className={square(state.italic)}>
        <i className="font-serif">I</i>
      </button>
      <button type="button" title="底線（Ctrl+U）" aria-label="底線" aria-pressed={state.underline} onMouseDown={keepEditorFocus} onClick={() => chain().toggleUnderline().run()} className={square(state.underline)}>
        <u>U</u>
      </button>
      <button type="button" title="刪除線" aria-label="刪除線" aria-pressed={state.strike} onMouseDown={keepEditorFocus} onClick={() => chain().toggleStrike().run()} className={square(state.strike)}>
        <s>S</s>
      </button>

      {/* 字色:左半直接套上次的顏色 */}
      <div className="flex shrink-0">
        <button
          type="button"
          title="套用字色（右邊 ▾ 換顏色）"
          aria-label="套用字色"
          onMouseDown={keepEditorFocus}
          onClick={() => chain().setTextColor(lastColor).run()}
          className={leftHalf}
        >
          <span className="flex flex-col items-center leading-none">
            <span className="text-[15px] font-semibold">A</span>
            <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: colorOf(lastColor) }} />
          </span>
        </button>
        <ToolPopover label="▾" title="選字色" theme={theme} width="w-64" keepFocus buttonClassName={rightHalf}>
          {(close) => (
            <div onClick={close}>
              <div className="flex flex-wrap gap-2">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={`${c.label}色字`}
                    aria-pressed={state.color === c.key}
                    onClick={() => {
                      setLastColor(c.key);
                      chain().setTextColor(c.key).run();
                    }}
                    className={swatch}
                    style={{ background: c.color, borderColor: state.color === c.key ? "var(--ink-primary)" : "transparent" }}
                  />
                ))}
              </div>
              <button type="button" onClick={() => chain().unsetTextColor().run()} className={`mt-2 ${item(false)}`}>
                恢復原本的字色
              </button>
            </div>
          )}
        </ToolPopover>
      </div>

      {/* 底色:左半直接套上次的底色 */}
      <div className="flex shrink-0">
        <button
          type="button"
          title="套用底色（右邊 ▾ 換顏色）"
          aria-label="套用底色"
          onMouseDown={keepEditorFocus}
          onClick={() => chain().setSoftHighlight(lastHighlight).run()}
          className={leftHalf}
        >
          <span className="rounded px-1 text-[13px] leading-5" style={{ background: highlightOf(lastHighlight) }}>
            底
          </span>
        </button>
        <ToolPopover label="▾" title="選底色" theme={theme} width="w-64" keepFocus buttonClassName={rightHalf}>
          {(close) => (
            <div onClick={close}>
              <div className="flex flex-wrap gap-2">
                {HIGHLIGHTS.map((h) => (
                  <button
                    key={h.key}
                    type="button"
                    aria-label={`${h.label}色底`}
                    aria-pressed={state.highlight === h.key}
                    onClick={() => {
                      setLastHighlight(h.key);
                      chain().setSoftHighlight(h.key).run();
                    }}
                    className={swatch}
                    style={{ background: h.color, borderColor: state.highlight === h.key ? "var(--ink-primary)" : "transparent" }}
                  />
                ))}
              </div>
              <button type="button" onClick={() => chain().unsetSoftHighlight().run()} className={`mt-2 ${item(false)}`}>
                拿掉底色
              </button>
            </div>
          )}
        </ToolPopover>
      </div>

      <ToolPopover
        label={
          <>
            <AlignIcon align={state.align} />
            <span className="text-xs">▾</span>
          </>
        }
        title="這一段靠左、置中、置右"
        theme={theme}
        width="w-36"
        keepFocus
      >
        {(close) => (
          <div className="flex flex-col" onClick={close}>
            {ALIGNS.map((a) => (
              <button key={a.key} type="button" role="menuitem" onClick={() => chain().setTextAlign(a.key).run()} className={item(state.align === a.key)}>
                <AlignIcon align={a.key} />
                {a.label}
              </button>
            ))}
          </div>
        )}
      </ToolPopover>
    </>
  );
}
