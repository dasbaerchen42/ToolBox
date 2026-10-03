"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getThemeClasses } from "@/lib/theme";
import { downloadBlob, downloadEach, shareImages, zipImages, type ExportedImage } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { FONT_OPTIONS } from "@/lib/editor-font";
import { canvasFontFamily } from "@/lib/web-fonts";
import type { FontFamilyName } from "@/lib/preferences";
import {
  CHAT_WIDTHS,
  defaultChatSettings,
  moveMessage,
  newMessageId,
  PASTE_SPLITS,
  readChatRoom,
  sampleMessages,
  splitPasted,
  type ChatMessage,
  type ChatRoom,
  type ChatSettings,
  type ChatSide,
  type PasteSplit,
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
import { drawChatPage, pageHeight, type ChatAvatars } from "@/lib/tools/chat/render";
import { ActionButton, ColorField, Field, Segmented, Toggle } from "../image/_components/controls";

const STORAGE_KEY = "toolbox-chat-room";
/** 預覽裡一張一張之間空多少(CSS px) */
const PAGE_GAP = 16;

const SIDE_OPTIONS: { value: ChatSide; label: string }[] = [
  { value: "left", label: "◀ 左" },
  { value: "center", label: "置中" },
  { value: "right", label: "右 ▶" },
];

/** 上傳的頭像縮成 160px 的正方形(從中間裁),存成 data URL 才放得進 localStorage */
async function readAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立繪圖環境");
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

/** data URL → 圖;載完才畫得出來,所以由 onLoad 通知重畫 */
function loadAvatar(src: string, onLoad: () => void): HTMLImageElement | null {
  if (!src || typeof window === "undefined") return null;
  const image = new Image();
  image.onload = onLoad;
  image.src = src;
  return image;
}

const readyImage = (image: HTMLImageElement | null) => (image && image.complete && image.naturalWidth > 0 ? image : null);

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

/** 一邊的人:名字、顯示頭像｜顯示名字、上傳頭像 */
function PersonFields({
  label,
  name,
  showAvatar,
  showName,
  avatar,
  onChange,
  onUpload,
  t,
}: {
  label: string;
  name: string;
  showAvatar: boolean;
  showName: boolean;
  avatar: string;
  onChange: (patch: { name?: string; showAvatar?: boolean; showName?: boolean; avatar?: string }) => void;
  onUpload: (file: File) => void;
  t: ReturnType<typeof getThemeClasses>;
}) {
  return (
    <Field label={label} t={t}>
      <TextInput label={label} value={name} onChange={(value) => onChange({ name: value })} t={t} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Toggle checked={showAvatar} onChange={(value) => onChange({ showAvatar: value })} label="顯示頭像" t={t} />
        <Toggle checked={showName} onChange={(value) => onChange({ showName: value })} label="顯示名字" t={t} />
      </div>
      <div className="flex items-center gap-2">
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element -- 使用者上傳的 data URL
          <img src={avatar} alt="" className="h-9 w-9 rounded-full border border-(--border-light) object-cover" />
        )}
        <label className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs ${t.secondary}`}>
          {avatar ? "換頭像" : "上傳頭像"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
        {avatar && (
          <button
            type="button"
            onClick={() => onChange({ avatar: "" })}
            className={`rounded-xl border px-3 py-1.5 text-xs ${t.secondary}`}
          >
            拿掉
          </button>
        )}
      </div>
    </Field>
  );
}

/**
 * 聊天室產生器:預覽框下面就是輸入列——貼一段、選誰說,一則一則排起來再轉成圖。
 * 點預覽裡的泡泡,輸入列變成那一則的編輯:改字、換邊、移動、刪掉。
 */
export default function ChatPage() {
  const t = getThemeClasses();
  const canShare = useCanShareImages();
  const [room, setRoom] = useState<ChatRoom>(() => ({ settings: defaultChatSettings(), messages: [] }));
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [family, setFamily] = useState("system-ui, sans-serif");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatarTick, setAvatarTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null);

  const { settings, messages } = room;
  const selectedIndex = messages.findIndex((message) => message.id === selected);
  const selectedMessage = selectedIndex >= 0 ? messages[selectedIndex] : null;

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
      [settings.title, settings.subtitle, settings.leftName, settings.rightName, settings.typingText, "is typing…輸入訊息"]
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

  // 上傳的頭像:載完再重畫一次
  const bumpAvatars = useCallback(() => setAvatarTick((tick) => tick + 1), []);
  const leftImage = useMemo(() => loadAvatar(settings.leftAvatar, bumpAvatars), [settings.leftAvatar, bumpAvatars]);
  const rightImage = useMemo(() => loadAvatar(settings.rightAvatar, bumpAvatars), [settings.rightAvatar, bumpAvatars]);
  const avatars = useMemo<ChatAvatars>(
    // avatarTick:圖載完時換一個新物件,預覽才會重畫
    () => ({ left: readyImage(leftImage), right: readyImage(rightImage) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leftImage, rightImage, avatarTick]
  );

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

  // 預覽:一張一張疊起來畫,中間留一點空。畫布照聊天室的寬度與真正的高度,不壓扁,太長就在框裡捲
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pages.length === 0) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = settings.width;
    const height = Math.min(pageTops.total, 16000);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pages.forEach((page, index) => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, pageTops.tops[index] * ratio);
      drawChatPage(ctx, page, settings, fonts, selected, avatars);
    });
  }, [pages, pageTops, settings, fonts, selected, avatars]);

  const updateSettings = (patch: Partial<ChatSettings>) =>
    setRoom((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const setMessages = (update: (messages: ChatMessage[]) => ChatMessage[]) =>
    setRoom((current) => ({ ...current, messages: update(current.messages) }));
  const updateMessage = (id: string, patch: Partial<ChatMessage>) =>
    setMessages((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const scrollPreviewToEnd = () =>
    setTimeout(() => {
      const box = scrollRef.current;
      if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    }, 60);

  function send(side: ChatSide) {
    const parts = splitPasted(draft, side === "center" ? "whole" : settings.pasteSplit);
    if (parts.length === 0) {
      setNotice("先在輸入框貼上或打一段字。");
      return;
    }
    setMessages((list) => [...list, ...parts.map((text) => ({ id: newMessageId(), side, text }))]);
    setDraft("");
    setNotice(parts.length > 1 ? `分成 ${parts.length} 顆泡泡。` : null);
    scrollPreviewToEnd();
  }

  // 點預覽裡的泡泡:選起來,下面的輸入列變成編輯這一則
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
    setSelected(hit && hit.kind !== "typing" ? hit.id : null);
  }

  async function uploadAvatar(side: "left" | "right", file: File) {
    try {
      const data = await readAvatar(file);
      updateSettings(side === "left" ? { leftAvatar: data, leftShowAvatar: true } : { rightAvatar: data, rightShowAvatar: true });
    } catch (error) {
      console.error(error);
      setNotice("這張圖讀不進來，換一張試試。");
    }
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
      drawChatPage(ctx, page, settings, fonts, null, avatars);
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

  const handleDownload = (mode: "each" | "zip") =>
    run(async () => {
      const images = await buildImages();
      if (images.length === 1) {
        downloadBlob(images[0]);
        return "已下載。";
      }
      if (mode === "each") {
        await downloadEach(images);
        return `已逐張下載 ${images.length} 張。`;
      }
      downloadBlob(await zipImages(images, settings.title || "聊天室"));
      return `已打包 ${images.length} 張成 zip。`;
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

  const leftLabel = settings.leftName.trim() || "左邊";
  const rightLabel = settings.rightName.trim() || "右邊";
  const typingName = settings.typingSide === "left" ? leftLabel : rightLabel;
  const empty = messages.length === 0;
  const smallButton = `rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-40 ${t.secondary}`;

  return (
    <main className={`flex flex-1 flex-col ${t.page}`}>
      <section className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold tracking-[0.08em]">聊天室產生器</h1>
          <p className={`mt-0.5 text-xs tracking-[0.04em] ${t.muted}`}>
            在預覽下面貼一段、選誰說的，一則一則排成聊天畫面再轉成圖・全部在你的瀏覽器裡完成
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          {/* 預覽框:上面下載,中間是轉出來的圖,下面是輸入列 */}
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <div className={`overflow-hidden rounded-2xl border ${t.subPanel}`}>
              <div className="flex flex-wrap items-center gap-2 border-b border-(--border-light) p-2.5">
                <p aria-live="polite" className={`mr-auto text-xs leading-5 ${t.muted}`}>
                  {busy
                    ? "處理中……"
                    : (notice ?? `${pages.length > 1 ? `${pages.length} 張` : "1 張"}・${settings.width * CHAT_EXPORT_SCALE} px 寬`)}
                </p>
                {pages.length > 1 ? (
                  <>
                    <ActionButton t={t} onClick={() => void handleDownload("each")} disabled={busy || empty}>
                      逐張下載 {pages.length} 張
                    </ActionButton>
                    <ActionButton tone="secondary" t={t} onClick={() => void handleDownload("zip")} disabled={busy || empty}>
                      打包 ZIP
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton t={t} onClick={() => void handleDownload("each")} disabled={busy || empty}>
                    下載 PNG
                  </ActionButton>
                )}
                {canShare && (
                  <ActionButton tone="secondary" t={t} onClick={() => void handleShare()} disabled={busy || empty}>
                    存到相簿／分享
                  </ActionButton>
                )}
              </div>

              <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto bg-(--paper-bg-3) p-3">
                <canvas
                  ref={canvasRef}
                  onClick={handlePreviewClick}
                  aria-label="聊天室預覽，點泡泡可以編輯"
                  className="mx-auto block h-auto w-full cursor-pointer rounded-xl"
                  style={{ maxWidth: settings.width }}
                />
              </div>

              {/* 輸入列:平常是送出新訊息;點了泡泡就變成改那一則 */}
              <div className="space-y-2 border-t border-(--border-light) p-2.5">
                {selectedMessage ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="tracking-[0.06em]">修改第 {selectedIndex + 1} 則</span>
                      <Segmented
                        label="誰說的"
                        value={selectedMessage.side}
                        onChange={(side) => updateMessage(selectedMessage.id, { side })}
                        options={SIDE_OPTIONS}
                        t={t}
                      />
                    </div>
                    <textarea
                      value={selectedMessage.text}
                      autoFocus
                      rows={Math.min(6, Math.max(2, selectedMessage.text.split("\n").length))}
                      aria-label={`第 ${selectedIndex + 1} 則的內容`}
                      onChange={(event) => updateMessage(selectedMessage.id, { text: event.target.value })}
                      className={`w-full resize-y rounded-xl border px-3 py-2 text-sm leading-6 ${t.input}`}
                    />
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMessages((list) => moveMessage(list, selectedMessage.id, -1))}
                        disabled={selectedIndex === 0}
                        className={smallButton}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessages((list) => moveMessage(list, selectedMessage.id, 1))}
                        disabled={selectedIndex === messages.length - 1}
                        className={smallButton}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMessages((list) => list.filter((item) => item.id !== selectedMessage.id));
                          setSelected(null);
                        }}
                        className={smallButton}
                      >
                        刪掉
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${t.primary}`}
                      >
                        完成
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      aria-label="要送出的訊息"
                      placeholder={"貼上或打一段字，再按下面選誰說的。\n點預覽裡的泡泡可以修改。"}
                      className={`w-full resize-y rounded-xl border px-3 py-2 text-sm leading-6 ${t.input}`}
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={settings.pasteSplit}
                        onChange={(event) => updateSettings({ pasteSplit: event.target.value as PasteSplit })}
                        aria-label="怎麼分泡泡"
                        className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs ${t.input}`}
                      >
                        {PASTE_SPLITS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("清空全部訊息？")) {
                            setMessages(() => []);
                            setSelected(null);
                          }
                        }}
                        disabled={empty}
                        className={smallButton}
                      >
                        清空訊息
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
                      <button
                        type="button"
                        onClick={() => send("left")}
                        className={`truncate rounded-xl border px-2 py-2.5 text-sm ${t.secondary}`}
                      >
                        ◀ {leftLabel}說
                      </button>
                      <button type="button" onClick={() => send("center")} className={`rounded-xl border px-3 py-2.5 text-xs ${t.secondary}`}>
                        置中旁白
                      </button>
                      <button
                        type="button"
                        onClick={() => send("right")}
                        className={`truncate rounded-xl border px-2 py-2.5 text-sm ${t.primary}`}
                      >
                        {rightLabel}說 ▶
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 聊天室設定 */}
          <div className={`min-w-0 space-y-4 self-start rounded-2xl border p-3 ${t.subPanel}`}>
            <p className="text-xs tracking-[0.08em]">聊天室設定</p>
            <Field label="聊天室名稱" t={t}>
              <TextInput label="聊天室名稱" value={settings.title} onChange={(title) => updateSettings({ title })} t={t} />
              <Toggle checked={settings.showHeader} onChange={(showHeader) => updateSettings({ showHeader })} label="顯示標題列" t={t} />
            </Field>
            {settings.showHeader && (
              <Field label="副標題" t={t}>
                <TextInput
                  label="副標題"
                  placeholder="例如：上線中（可空）"
                  value={settings.subtitle}
                  onChange={(subtitle) => updateSettings({ subtitle })}
                  t={t}
                />
              </Field>
            )}
            <PersonFields
              label="左邊姓名"
              name={settings.leftName}
              showAvatar={settings.leftShowAvatar}
              showName={settings.leftShowName}
              avatar={settings.leftAvatar}
              onChange={({ name, showAvatar, showName, avatar }) =>
                updateSettings({
                  ...(name !== undefined && { leftName: name }),
                  ...(showAvatar !== undefined && { leftShowAvatar: showAvatar }),
                  ...(showName !== undefined && { leftShowName: showName }),
                  ...(avatar !== undefined && { leftAvatar: avatar }),
                })
              }
              onUpload={(file) => void uploadAvatar("left", file)}
              t={t}
            />
            <PersonFields
              label="右邊姓名"
              name={settings.rightName}
              showAvatar={settings.rightShowAvatar}
              showName={settings.rightShowName}
              avatar={settings.rightAvatar}
              onChange={({ name, showAvatar, showName, avatar }) =>
                updateSettings({
                  ...(name !== undefined && { rightName: name }),
                  ...(showAvatar !== undefined && { rightShowAvatar: showAvatar }),
                  ...(showName !== undefined && { rightShowName: showName }),
                  ...(avatar !== undefined && { rightAvatar: avatar }),
                })
              }
              onUpload={(file) => void uploadAvatar("right", file)}
              t={t}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Toggle checked={settings.inputBar} onChange={(inputBar) => updateSettings({ inputBar })} label="底部輸入列" t={t} />
              <Toggle checked={settings.typing} onChange={(typing) => updateSettings({ typing })} label="輸入動態" t={t} />
            </div>
            {settings.typing && (
              <div className="space-y-2">
                <Segmented
                  label="誰正在輸入"
                  value={settings.typingSide}
                  onChange={(typingSide) => updateSettings({ typingSide })}
                  options={[
                    { value: "left", label: leftLabel },
                    { value: "right", label: rightLabel },
                  ]}
                  t={t}
                />
                <TextInput
                  label="動態裡的文字"
                  placeholder={`${typingName} is typing…`}
                  value={settings.typingText}
                  onChange={(typingText) => updateSettings({ typingText })}
                  t={t}
                />
              </div>
            )}
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
          </div>
        </div>
      </section>
    </main>
  );
}
