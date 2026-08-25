"use client";

import { useEffect } from "react";
import { readPasteEvent, type PastePayload } from "@/lib/clipboard";

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

/**
 * 整頁的貼上快捷:游標不在輸入框裡時按 ⌘V / Ctrl+V,
 * 直接把剪貼簿內容接進來。走 paste 事件所以不需要剪貼簿權限,
 * 也不會干擾在編輯區裡正常打字貼上。
 */
export function usePagePaste(onPaste: (payload: PastePayload) => void) {
  useEffect(() => {
    function handle(event: ClipboardEvent) {
      if (isEditable(event.target)) return;
      const payload = readPasteEvent(event);
      if (!payload) return;
      event.preventDefault();
      onPaste(payload);
    }

    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, [onPaste]);
}
