// 編輯器的字色、底色:用 class 存(tc-red、hl-yellow),顏色交給 CSS,
// 存起來的 Markdown 才短,換主題也不會出現看不見的字。

import { Mark } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { colorFromClass, highlightFromClass } from "@/lib/rich-text";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
    softHighlight: {
      setSoftHighlight: (color: string) => ReturnType;
      unsetSoftHighlight: () => ReturnType;
    };
  }
}

export const TextColor = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => colorFromClass(el.getAttribute("class")),
        renderHTML: (attrs) => (attrs.color ? { class: `tc-${attrs.color}` } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span", getAttrs: (el) => (colorFromClass((el as HTMLElement).getAttribute("class")) ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export const SoftHighlight = Mark.create({
  name: "softHighlight",
  addAttributes() {
    return {
      color: {
        default: "yellow",
        parseHTML: (el) => highlightFromClass(el.getAttribute("class")) ?? "yellow",
        renderHTML: (attrs) => ({ class: `hl-${attrs.color ?? "yellow"}` }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["mark", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setSoftHighlight:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetSoftHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export const RICH_EXTENSIONS = [
  StarterKit.configure({
    // 編輯時點連結不要跳走
    link: { openOnClick: false },
    codeBlock: false,
  }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
  TextColor,
  SoftHighlight,
];
