"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getThemeClasses } from "@/lib/theme";
import { downloadBlob, shareImages, zipImages, type ExportedImage } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { FONT_OPTIONS } from "@/lib/editor-font";
import { canvasFontFamily } from "@/lib/web-fonts";
import type { FontFamilyName } from "@/lib/preferences";
import {
  CHAT_WIDTHS,
  defaultChatSettings,
  moveMessage,
  newMessageId,
  nextSide,
  readChatRoom,
  sampleMessages,
  splitPasted,
  type ChatMessage,
  type ChatRoom,
  type ChatSettings,
  type ChatSide,
} from "@/lib/tools/chat/model";
import {
  CHAT_EXPORT_SCALE,
  chatFonts,
  chatMetrics,
  layoutMessages,
  maxBodyHeight,
  paginate,
  type ChatPage,
  type Measure,
} from "@/lib/tools/chat/layout";
import { drawChatPage, pageHeight } from "@/lib/tools/chat/render";
import { ActionButton, ColorField, Field, Segmented, Toggle } from "../image/_components/controls";

const STORAGE_KEY = "toolbox-chat-room";
/** 預覽裡一張一張之間空多少(CSS px) */
const PAGE_GAP = 16;

const SIDE_LABEL: Record<ChatSide, string> = { left: "◀ 左", right: "右 ▶", center: "置中" };

function TextInput({
  value,
  onChange,
  label,
  placeholder,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  t: ReturnType<typeof getThemeClasses>;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={label}
      placeholder={placeholder}
      maxLength={40}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
    />
  );
}

/**
 * 聊天室產生器:貼一段 → 選左邊或右邊送出 → 再貼下一段……
 * 上面的預覽就是轉出來的圖;點泡泡可以改字、換邊、移動、刪掉。
 */
export default function ChatPage() {
  const t = getThemeClasses();
  const canShare = useCanShareImages();
  const [room, setRoom] = useState<ChatRoom>(() => ({ settings: defaultChatSettings(), messages: [] }));
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [family, setFamily] = useState("system-ui, sans-serif");
  const [showSettings, setShowSettings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null);

  const { settings, messages } = room;

  // 讀回上次的聊天室;第一次來放一段範例對話
  useEffect(() => {
    let stored: ChatRoom | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      stored = raw ? readChatRoom(JSON.parse(raw)) : null;
    } catch {
      stored = null;
    }
    setRoom(stored ?? { settings: defaultChatSettings(), messages: sampleMessages() });
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
      } catch {
        // 存不了就算了
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [room, restored]);

  // 字型:canvas 吃不到 CSS 變數,換成真正的字體名稱,也先把要用到的字抓下來
  const allText = useMemo(
    () =>
      [settings.title, settings.subtitle, settings.leftName, settings.rightName, settings.typingText, "正在輸入…輸入訊息"]
        .concat(messages.map((message) => message.text))
        .join(""),
    [settings.title, settings.subtitle, settings.leftName, settings.rightName, settings.typingText, messages]
  );
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canvasFontFamily(settings.font, allText, 400),
      canvasFontFamily(settings.font, allText, 700),
    ]).then(([resolved]) => {
      if (!cancelled) setFamily(`${resolved}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.font, allText]);

  const measure = useCallback<Measure>((text, font) => {
    if (!measureCtx.current) measureCtx.current = document.createElement("canvas").getContext("2d");
    const ctx = measureCtx.current;
    if (!ctx) return text.length * 14;
    ctx.font = font;
    return ctx.measureText(text).width;
  }, []);

  const fonts = useMemo(() => chatFonts(family, settings), [family, settings]);

  const pages = useMemo<ChatPage[]>(() => {
    if (!restored) return [];
    const layout = layoutMessages(messages, settings, fonts, measure);
    const maxBody = maxBodyHeight(settings);
    const result = paginate(layout, maxBody);
    // 手機畫面模式:每一張都是一樣高的一個畫面
    return settings.pages === "screen" ? result.map((page) => ({ ...page, bodyHeight: Math.max(page.bodyHeight, maxBody) })) : result;
  }, [restored, messages, settings, fonts, measure]);

  const pageTops = useMemo(() => {
    const tops: number[] = [];
    let y = 0;
    for (const page of pages) {
      tops.push(y);
      y += pageHeight(page, settings) + PAGE_GAP;
    }
    return { tops, total: Math.max(0, y - PAGE_GAP) };
  }, [pages, settings]);

  // 預覽:一張一張疊起來畫,中間留一點空
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pages.length === 0) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = settings.width;
    const height = Math.min(pageTops.total, 16000);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.aspectRatio = `${width} / ${height}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pages.forEach((page, index) => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, pageTops.tops[index] * ratio);
      drawChatPage(ctx, page, settings, fonts, selected);
    });
  }, [pages, pageTops, settings, fonts, selected]);

  const updateSettings = (patch: Partial<ChatSettings>) =>
    setRoom((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const setMessages = (update: (messages: ChatMessage[]) => ChatMessage[]) =>
    setRoom((current) => ({ ...current, messages: update(current.messages) }));

  function send(side: ChatSide) {
    const parts = side === "center" ? [draft.trim()].filter(Boolean) : splitPasted(draft);
    if (parts.length === 0) {
      setNotice("先在輸入框貼上或打一段字。");
      return;
    }
    setMessages((list) => [...list, ...parts.map((text) => ({ id: newMessageId(), side, text }))]);
    setDraft("");
    setNotice(parts.length > 1 ? `分成 ${parts.length} 顆泡泡（空一行就是下一顆）。` : null);
  }

  function selectMessage(id: string | null) {
    setSelected(id);
    setEditing(id);
    if (id) {
      requestAnimationFrame(() =>
        listRef.current?.querySelector(`[data-message="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
      );
    }
  }

  // 點預覽裡的泡泡:選起來、在下面的清單打開編輯
  function handlePreviewClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = settings.width / rect.width;
    const x = (event.clientX - rect.left) * scale;
    const y = (event.clientY - rect.top) * scale;
    const index = pageTops.tops.findLastIndex((top) => top <= y);
    const page = pages[index];
    if (!page) return;
    const localY = y - pageTops.tops[index] - chatMetrics(settings).header;
    const hit = page.items.find(
      (item) => item.kind !== "typing" && x >= item.x && x <= item.x + item.w && localY >= item.y && localY <= item.y + item.h
    );
    selectMessage(hit && hit.kind !== "typing" ? hit.id : null);
  }

  async function buildImages(): Promise<ExportedImage[]> {
    const images: ExportedImage[] = [];
    for (const [index, page] of pages.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(settings.width * CHAT_EXPORT_SCALE);
      canvas.height = Math.round(pageHeight(page, settings) * CHAT_EXPORT_SCALE);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("無法建立繪圖環境");
      ctx.scale(CHAT_EXPORT_SCALE, CHAT_EXPORT_SCALE);
      drawChatPage(ctx, page, settings, fonts);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("無法產生圖片檔"))), "image/png")
      );
      const base = settings.title.trim() || "聊天室";
      images.push({ name: pages.length > 1 ? `${base}-${String(index + 1).padStart(2, "0")}.png` : `${base}.png`, blob });
    }
    return images;
  }

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    try {
      setNotice(await task());
    } catch (error) {
      console.error(error);
      setNotice("轉圖失敗，請再試一次。");
    } finally {
      setBusy(false);
    }
  }

  const handleDownload = () =>
    run(async () => {
      const images = await buildImages();
      if (images.length === 1) downloadBlob(images[0]);
      else downloadBlob(await zipImages(images, settings.title || "聊天室"));
      return images.length > 1 ? `已打包 ${images.length} 張成 zip。` : "已下載。";
    });

  const handleShare = () =>
    run(async () => {
      try {
        const result = await shareImages(await buildImages());
        return result === "shared" ? "已交給分享選單。" : result === "needs-tap" ? "圖準備好了，再按一次分享。" : null;
      } catch {
        return "這個瀏覽器沒辦法分享圖片，請改用下載。";
      }
    });

  return (
    <main className={`flex flex-1 flex-col ${t.page}`}>
      <section className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h1 className="text-xl font-semibold tracking-[0.08em]">聊天室產生器</h1>
            <p className={`mt-0.5 text-xs tracking-[0.04em] ${t.muted}`}>
              貼一段、選左邊或右邊送出，一則一則排成聊天畫面再轉成圖・全部在你的瀏覽器裡完成
            </p>
          </div>
          <p aria-live="polite" className={`text-xs leading-6 ${t.muted}`}>
            {busy ? "處理中……" : (notice ?? "")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* 預覽:就是轉出來的圖 */}
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <div className="flex max-h-[75vh] justify-center overflow-auto rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
              <canvas
                ref={canvasRef}
                onClick={handlePreviewClick}
                aria-label="聊天室預覽，點泡泡可以編輯"
                className="h-auto cursor-pointer rounded-xl"
                style={{ width: `min(100%, ${settings.width}px)` }}
              />
            </div>
            <p className={`mt-2 text-center text-xs ${t.muted}`}>
              點預覽裡的泡泡可以修改・{pages.length > 1 ? `會輸出 ${pages.length} 張` : "會輸出 1 張"}・
              {settings.width * CHAT_EXPORT_SCALE} px 寬
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            {/* 輸入列:貼一段 → 選邊送出 */}
            <div className={`space-y-2 rounded-2xl border p-3 ${t.subPanel}`}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                aria-label="要送出的訊息"
                placeholder={"貼上或打一段字，再按下面選誰說的。\n空一行會分成下一顆泡泡；開頭的 > 會自動拿掉。"}
                className={`w-full resize-y rounded-xl border px-3 py-2 text-sm leading-6 ${t.input}`}
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => send("left")}
                  className={`rounded-xl border px-2 py-2.5 text-sm ${t.secondary}`}
                >
                  ◀ {settings.leftName.trim() || "左邊"}說
                </button>
                <button
                  type="button"
                  onClick={() => send("center")}
                  className={`rounded-xl border px-2 py-2.5 text-xs ${t.secondary}`}
                >
                  置中小字
                </button>
                <button
                  type="button"
                  onClick={() => send("right")}
                  className={`rounded-xl border px-2 py-2.5 text-sm ${t.primary}`}
                >
                  {settings.rightName.trim() || "右邊"}說 ▶
                </button>
              </div>
            </div>

            {/* 訊息清單:改字、換邊、移動、刪掉 */}
            <div ref={listRef} className={`space-y-1.5 rounded-2xl border p-3 ${t.subPanel}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="tracking-[0.08em]">訊息（{messages.length}）</span>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("清空全部訊息？")) {
                        setMessages(() => []);
                        selectMessage(null);
                      }
                    }}
                    className={`rounded-lg border px-2 py-0.5 text-[11px] ${t.secondary}`}
                  >
                    清空
                  </button>
                )}
              </div>
              {messages.length === 0 && <p className={`text-xs leading-6 ${t.muted}`}>還沒有訊息，從上面貼第一段吧。</p>}
              <div className="max-h-[45vh] space-y-1.5 overflow-auto">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    data-message={message.id}
                    className={`rounded-xl border px-2 py-1.5 ${
                      selected === message.id ? "border-(--accent)" : "border-(--border-light)"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMessages((list) =>
                            list.map((item) => (item.id === message.id ? { ...item, side: nextSide(item.side) } : item))
                          )
                        }
                        aria-label={`第 ${index + 1} 則：${SIDE_LABEL[message.side]}，按一下換邊`}
                        className={`w-14 shrink-0 rounded-lg border px-1 py-1 text-[11px] ${
                          message.side === "right" ? t.primary : t.secondary
                        }`}
                      >
                        {SIDE_LABEL[message.side]}
                      </button>
                      {editing === message.id ? (
                        <textarea
                          value={message.text}
                          autoFocus
                          rows={Math.min(8, message.text.split("\n").length + 1)}
                          aria-label={`第 ${index + 1} 則的內容`}
                          onChange={(event) =>
                            setMessages((list) =>
                              list.map((item) => (item.id === message.id ? { ...item, text: event.target.value } : item))
                            )
                          }
                          className={`min-w-0 flex-1 resize-y rounded-lg border px-2 py-1 text-sm leading-6 ${t.input}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectMessage(message.id)}
                          className="min-w-0 flex-1 truncate py-1 text-left text-sm"
                          title="點一下修改"
                        >
                          {message.text.split("\n")[0] || "（空白）"}
                          {message.text.includes("\n") && <span className={t.muted}> …</span>}
                        </button>
                      )}
                    </div>
                    {editing === message.id && (
                      <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMessages((list) => moveMessage(list, message.id, -1))}
                          disabled={index === 0}
                          className={`rounded-lg border px-2 py-1 text-xs disabled:opacity-40 ${t.secondary}`}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessages((list) => moveMessage(list, message.id, 1))}
                          disabled={index === messages.length - 1}
                          className={`rounded-lg border px-2 py-1 text-xs disabled:opacity-40 ${t.secondary}`}
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMessages((list) => list.filter((item) => item.id !== message.id));
                            selectMessage(null);
                          }}
                          className={`rounded-lg border px-2 py-1 text-xs ${t.secondary}`}
                        >
                          刪掉
                        </button>
                        <button
                          type="button"
                          onClick={() => selectMessage(null)}
                          className={`rounded-lg border px-2 py-1 text-xs ${t.primary}`}
                        >
                          完成
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton t={t} onClick={() => void handleDownload()} disabled={busy || messages.length === 0}>
                {pages.length > 1 ? `下載 ${pages.length} 張` : "下載 PNG"}
              </ActionButton>
              {canShare && (
                <ActionButton tone="secondary" t={t} onClick={() => void handleShare()} disabled={busy || messages.length === 0}>
                  存到相簿／分享
                </ActionButton>
              )}
            </div>

            {/* 聊天室設定 */}
            <div className={`space-y-4 rounded-2xl border p-3 ${t.subPanel}`}>
              <button
                type="button"
                onClick={() => setShowSettings((value) => !value)}
                aria-expanded={showSettings}
                className="flex w-full items-center justify-between text-left text-xs tracking-[0.08em]"
              >
                <span>聊天室設定</span>
                <span className={t.muted}>{showSettings ? "收起" : "展開"}</span>
              </button>
              {showSettings && (
                <>
                  <Field label="聊天室名稱與副標" t={t}>
                    <TextInput label="聊天室名稱" value={settings.title} onChange={(title) => updateSettings({ title })} t={t} />
                    <TextInput
                      label="副標"
                      placeholder="例如：上線中（可空）"
                      value={settings.subtitle}
                      onChange={(subtitle) => updateSettings({ subtitle })}
                      t={t}
                    />
                  </Field>
                  <Field label="兩邊的名字" hint="左邊的名字會用在頭像與「正在輸入」" t={t}>
                    <div className="grid grid-cols-2 gap-2">
                      <TextInput label="左邊的名字" value={settings.leftName} onChange={(leftName) => updateSettings({ leftName })} t={t} />
                      <TextInput label="右邊的名字" value={settings.rightName} onChange={(rightName) => updateSettings({ rightName })} t={t} />
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <Toggle checked={settings.showAvatars} onChange={(showAvatars) => updateSettings({ showAvatars })} label="左邊顯示頭像" t={t} />
                    <Toggle checked={settings.showNames} onChange={(showNames) => updateSettings({ showNames })} label="左邊顯示名字" t={t} />
                    <Toggle checked={settings.inputBar} onChange={(inputBar) => updateSettings({ inputBar })} label="底部輸入列" t={t} />
                  </div>
                  <Toggle
                    checked={settings.typing}
                    onChange={(typing) => updateSettings({ typing })}
                    label="最下面「正在輸入…」"
                    t={t}
                  />
                  {settings.typing && (
                    <div className="space-y-2">
                      <Segmented
                        label="誰正在輸入"
                        value={settings.typingSide}
                        onChange={(typingSide) => updateSettings({ typingSide })}
                        options={[
                          { value: "left", label: `${settings.leftName.trim() || "左邊"}` },
                          { value: "right", label: `${settings.rightName.trim() || "右邊"}` },
                        ]}
                        t={t}
                      />
                      <TextInput
                        label="正在輸入的文字"
                        placeholder="空著就是「名字 正在輸入…」，也可以寫 Kanon is typing…"
                        value={settings.typingText}
                        onChange={(typingText) => updateSettings({ typingText })}
                        t={t}
                      />
                    </div>
                  )}
                  <Field label="配色" t={t}>
                    <Segmented
                      label="配色"
                      value={settings.theme}
                      onChange={(theme) => updateSettings({ theme })}
                      options={[
                        { value: "paper", label: "紙感" },
                        { value: "light", label: "淺色" },
                        { value: "dark", label: "深色" },
                      ]}
                      t={t}
                    />
                  </Field>
                  <Field label="右邊泡泡顏色" t={t}>
                    <ColorField value={settings.accent} onChange={(accent) => updateSettings({ accent })} t={t} />
                  </Field>
                  <Field label="字體" t={t}>
                    <select
                      value={settings.font}
                      onChange={(event) => updateSettings({ font: event.target.value as FontFamilyName })}
                      aria-label="字體"
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.key} value={font.key}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="尺寸" t={t}>
                    <Segmented
                      label="寬度"
                      value={String(settings.width) as "390" | "600"}
                      onChange={(value) => updateSettings({ width: Number(value) as ChatSettings["width"] })}
                      options={CHAT_WIDTHS.map((item) => ({ value: String(item.value) as "390" | "600", label: item.label }))}
                      t={t}
                    />
                    <Segmented
                      label="分張"
                      value={settings.pages}
                      onChange={(pagesMode) => updateSettings({ pages: pagesMode })}
                      options={[
                        { value: "long", label: "一張長圖" },
                        { value: "screen", label: "照手機畫面分張" },
                      ]}
                      t={t}
                    />
                  </Field>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
