"use client";

// 文件編輯模式的格式按鈕:段落樣式、粗體斜體底線、字色、底色、對齊。
// 放在主工具列裡,按鈕跟其他工具一樣大。

import { useEditorState, type Editor } from "@tiptap/react";
import type { EditorThemeConfig } from "@/lib/theme";
import { HIGHLIGHTS, TEXT_COLORS } from "@/lib/rich-text";
import { TOOL_BUTTON, ToolPopover } from "../editor-main-toolbar";

const BLOCKS = [
  { key: "p", label: "內文" },
  { key: "h1", label: "大標題" },
  { key: "h2", label: "中標題" },
  { key: "h3", label: "小標題" },
  { key: "quote", label: "引用" },
  { key: "ul", label: "項目清單" },
  { key: "ol", label: "編號清單" },
] as const;

const ALIGNS = [
  { key: "left", label: "靠左", icon: "⇤" },
  { key: "center", label: "置中", icon: "↔" },
  { key: "right", label: "置右", icon: "⇥" },
] as const;

export default function RichFormatBar({ editor, theme }: { editor: Editor; theme: EditorThemeConfig }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      color: (e.getAttributes("textColor").color as string | undefined) ?? null,
      highlight: e.isActive("softHighlight") ? ((e.getAttributes("softHighlight").color as string | undefined) ?? "yellow") : null,
      align: (["center", "right"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
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
  const toggle = (active: boolean) =>
    `${TOOL_BUTTON} min-w-9 justify-center px-2.5 ${active ? "border-(--accent) bg-(--accent) text-(--on-accent)" : `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}`;
  const item = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-(--paper-bg-3) ${active ? "font-semibold text-(--accent)" : ""}`;
  const swatch = "h-8 w-8 rounded-full border-2 transition";

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

  const color = TEXT_COLORS.find((c) => c.key === state.color);
  const highlight = HIGHLIGHTS.find((h) => h.key === state.highlight);
  const align = ALIGNS.find((a) => a.key === state.align) ?? ALIGNS[0];

  return (
    <>
      <ToolPopover label={`${BLOCKS.find((b) => b.key === state.block)?.label ?? "內文"} ▾`} title="段落樣式：標題、引用、清單" theme={theme} width="w-44">
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

      <button type="button" title="粗體（Ctrl+B）" aria-label="粗體" aria-pressed={state.bold} onClick={() => chain().toggleBold().run()} className={toggle(state.bold)}>
        <b>B</b>
      </button>
      <button type="button" title="斜體（Ctrl+I）" aria-label="斜體" aria-pressed={state.italic} onClick={() => chain().toggleItalic().run()} className={toggle(state.italic)}>
        <i className="font-serif">I</i>
      </button>
      <button type="button" title="底線（Ctrl+U）" aria-label="底線" aria-pressed={state.underline} onClick={() => chain().toggleUnderline().run()} className={toggle(state.underline)}>
        <u>U</u>
      </button>
      <button type="button" title="刪除線" aria-label="刪除線" aria-pressed={state.strike} onClick={() => chain().toggleStrike().run()} className={toggle(state.strike)}>
        <s>S</s>
      </button>

      <ToolPopover
        label={
          <>
            <span className="font-semibold" style={{ color: color?.color }}>
              A
            </span>
            字色
          </>
        }
        title="選取的字改顏色"
        theme={theme}
        width="w-64"
      >
        {(close) => (
          <div onClick={close}>
            <div className="flex flex-wrap gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={`${c.label}色字`}
                  aria-pressed={state.color === c.key}
                  onClick={() => chain().setTextColor(c.key).run()}
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

      <ToolPopover
        label={
          <>
            <span className="rounded px-1" style={{ background: highlight?.color ?? HIGHLIGHTS[0].color }}>
              底
            </span>
            底色
          </>
        }
        title="選取的字加底色"
        theme={theme}
        width="w-64"
      >
        {(close) => (
          <div onClick={close}>
            <div className="flex flex-wrap gap-2">
              {HIGHLIGHTS.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  aria-label={`${h.label}色底`}
                  aria-pressed={state.highlight === h.key}
                  onClick={() => chain().setSoftHighlight(h.key).run()}
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

      <ToolPopover label={`${align.icon} 對齊`} title="這一段靠左、置中、置右" theme={theme} width="w-36">
        {(close) => (
          <div className="flex flex-col" onClick={close}>
            {ALIGNS.map((a) => (
              <button key={a.key} type="button" role="menuitem" onClick={() => chain().setTextAlign(a.key).run()} className={item(state.align === a.key)}>
                <span className="w-4 text-center">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </ToolPopover>
    </>
  );
}
