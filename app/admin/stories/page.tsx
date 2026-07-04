"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import type { CharacterRow, StoryRow } from "@/lib/database.types";
// ── Auth hook ─────────────────────────────────────────────────────

function useAdminAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const login = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setChecking(true);
      try {
        const res = await fetch("/api/admin/verify", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const data = await res.json();
        if (data.isAdmin) {
          setAccessToken(tokenResponse.access_token);
          setIsAdmin(true);
        } else {
          alert("你沒有管理員權限。");
        }
      } finally {
        setChecking(false);
      }
    },
    onError: () => alert("Google 授權失敗。"),
  });

  return { accessToken, isAdmin, checking, login };
}

// ── API helpers ────────────────────────────────────────────────────

function useAdminApi(accessToken: string | null) {
  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  async function fetchCharacters(): Promise<CharacterRow[]> {
    const res = await fetch("/api/admin/characters", { headers: headers() });
    if (!res.ok) throw new Error("載入角色失敗");
    return res.json();
  }

  async function fetchStories(characterSlug: string): Promise<StoryRow[]> {
    const res = await fetch(
      `/api/admin/stories?character_slug=${characterSlug}`,
      { headers: headers() }
    );
    if (!res.ok) throw new Error("載入故事失敗");
    return res.json();
  }

  async function fetchStory(id: string): Promise<StoryRow> {
    const res = await fetch(`/api/admin/stories/${id}`, { headers: headers() });
    if (!res.ok) throw new Error("載入故事失敗");
    return res.json();
  }

  async function createCharacter(
    payload: CharacterRow["id"] extends never ? never : Omit<CharacterRow, "id" | "created_at" | "updated_at">
  ): Promise<CharacterRow> {
    const res = await fetch("/api/admin/characters", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("新增角色失敗");
    return res.json();
  }

  async function updateCharacter(
    slug: string,
    payload: Partial<CharacterRow>
  ): Promise<CharacterRow> {
    const res = await fetch(`/api/admin/characters/${slug}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("更新角色失敗");
    return res.json();
  }

  async function createStory(payload: Omit<StoryRow, "id" | "created_at" | "updated_at">): Promise<StoryRow> {
    const res = await fetch("/api/admin/stories", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("新增故事失敗");
    return res.json();
  }

  async function updateStory(id: string, payload: Partial<StoryRow>): Promise<StoryRow> {
    const res = await fetch(`/api/admin/stories/${id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("更新故事失敗");
    return res.json();
  }

  async function deleteStory(id: string): Promise<void> {
    const res = await fetch(`/api/admin/stories/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) throw new Error("刪除故事失敗");
  }

  return {
    fetchCharacters,
    fetchStories,
    fetchStory,
    createCharacter,
    updateCharacter,
    createStory,
    updateStory,
    deleteStory,
  };
}

// ── Main admin page ────────────────────────────────────────────────

function AdminStoriesContent() {
  const { accessToken, isAdmin, checking, login } = useAdminAuth();
  const api = useAdminApi(accessToken);

  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharacterRow | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryRow | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editPublished, setEditPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 載入角色列表
  useEffect(() => {
    if (!isAdmin) return;
    api.fetchCharacters().then(setCharacters).catch(console.error);
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // 載入選定角色的故事
  useEffect(() => {
    if (!selectedChar) return;
    api.fetchStories(selectedChar.slug).then(setStories).catch(console.error);
    setSelectedStory(null);
    setEditContent("");
  }, [selectedChar]); // eslint-disable-line react-hooks/exhaustive-deps

  // 選定故事時載入完整內容
  useEffect(() => {
    if (!selectedStory) return;
    api.fetchStory(selectedStory.id).then((story) => {
      setEditContent(story.content);
      setEditTitle(story.title);
      setEditExcerpt(story.excerpt);
      setEditPublished(story.published);
    }).catch(console.error);
  }, [selectedStory?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!selectedStory) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const updated = await api.updateStory(selectedStory.id, {
        title: editTitle,
        excerpt: editExcerpt,
        content: editContent,
        published: editPublished,
      });
      setStories((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setSelectedStory(updated);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  async function handleNewStory() {
    if (!selectedChar) return;
    try {
      const newStory = await api.createStory({
        character_slug: selectedChar.slug,
        title: "新故事",
        type: "main",
        order_index: stories.length,
        excerpt: "",
        content: "",
        published: false,
      });
      setStories((prev) => [...prev, newStory]);
      setSelectedStory(newStory);
    } catch (e) {
      alert(String(e));
    }
  }

  async function handleDeleteStory(id: string) {
    if (!confirm("確定要刪除這個故事嗎？此操作無法復原。")) return;
    try {
      await api.deleteStory(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (selectedStory?.id === id) {
        setSelectedStory(null);
        setEditContent("");
      }
    } catch (e) {
      alert(String(e));
    }
  }

  async function handleNewCharacter() {
    const name = prompt("角色名稱：");
    if (!name?.trim()) return;
    const slug = prompt("角色 slug（英文、數字、底線）：");
    if (!slug?.trim()) return;
    try {
      const newChar = await api.createCharacter({
        slug: slug.trim(),
        name: name.trim(),
        job: "",
        age: "",
        tagline: "",
        chat_link: null,
        chat_link_alt: null,
        display_order: characters.length,
        coming_soon: false,
      });
      setCharacters((prev) => [...prev, newChar]);
      setSelectedChar(newChar);
    } catch (e) {
      alert(String(e));
    }
  }

  // ── Login screen ──────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-xl font-semibold tracking-[0.1em]">故事後台</h1>
          <p className="text-sm text-zinc-500 tracking-widest">Das Baerchen</p>
          <button
            onClick={() => login()}
            disabled={checking}
            className="rounded-2xl bg-white text-zinc-900 px-8 py-3 text-sm font-medium tracking-wider hover:opacity-90 transition disabled:opacity-50"
          >
            {checking ? "驗證中…" : "以 Google 帳號登入"}
          </button>
        </div>
      </main>
    );
  }

  // ── Admin UI ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="grid h-screen grid-cols-[220px_240px_1fr]">

        {/* 角色列表 */}
        <aside className="border-r border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-xs tracking-widest text-zinc-500">角色</span>
            <button
              onClick={handleNewCharacter}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              ＋
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {characters.map((char) => (
              <button
                key={char.slug}
                onClick={() => setSelectedChar(char)}
                className={`w-full text-left px-4 py-3 text-sm tracking-wide transition border-b border-zinc-900 ${
                  selectedChar?.slug === char.slug
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {char.name}
              </button>
            ))}
          </div>
        </aside>

        {/* 故事列表 */}
        <aside className="border-r border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-xs tracking-widest text-zinc-500">
              {selectedChar ? selectedChar.name : "故事"}
            </span>
            {selectedChar && (
              <button
                onClick={handleNewStory}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                ＋
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedChar && (
              <p className="px-4 py-3 text-xs text-zinc-600">請先選擇角色</p>
            )}
            {stories.map((story) => (
              <div
                key={story.id}
                className={`group relative border-b border-zinc-900 ${
                  selectedStory?.id === story.id ? "bg-zinc-800" : "hover:bg-zinc-900"
                }`}
              >
                <button
                  onClick={() => setSelectedStory(story)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm tracking-wide ${
                      selectedStory?.id === story.id ? "text-zinc-100" : "text-zinc-400"
                    }`}>
                      {story.title}
                    </span>
                    {story.published && (
                      <span className="text-xs text-emerald-500 opacity-70">已發布</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-600">
                    {story.type === "main" ? "主線" : "番外"}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteStory(story.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition px-2 py-1"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* 編輯區 */}
        <section className="flex flex-col overflow-hidden">
          {!selectedStory ? (
            <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm tracking-widest">
              選擇一個故事開始編輯
            </div>
          ) : (
            <>
              {/* 標題列 */}
              <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 bg-transparent text-base font-semibold tracking-wide outline-none placeholder-zinc-700"
                  placeholder="故事標題"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPublished}
                    onChange={(e) => setEditPublished(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  發布
                </label>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-white text-zinc-900 px-4 py-1.5 text-xs font-medium tracking-wide hover:opacity-90 transition disabled:opacity-50"
                >
                  {saving ? "儲存中…" : "儲存"}
                </button>
                {saveStatus === "saved" && (
                  <span className="text-xs text-emerald-500">已儲存</span>
                )}
                {saveStatus === "error" && (
                  <span className="text-xs text-red-400">儲存失敗</span>
                )}
              </div>

              {/* 摘要 */}
              <div className="border-b border-zinc-800 px-6 py-2">
                <input
                  value={editExcerpt}
                  onChange={(e) => setEditExcerpt(e.target.value)}
                  className="w-full bg-transparent text-xs text-zinc-500 tracking-wide outline-none placeholder-zinc-700"
                  placeholder="故事摘要（一兩句，顯示在列表頁）"
                />
              </div>

              {/* 內容編輯區 */}
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 resize-none bg-zinc-950 px-6 py-4 text-sm leading-[2.2] tracking-[0.04em] text-zinc-200 outline-none font-mono"
                placeholder="在這裡貼上故事內容，段落之間以空行分隔…"
                spellCheck={false}
              />

              {/* 底部狀態列 */}
              <div className="border-t border-zinc-800 px-6 py-2 flex gap-6 text-xs text-zinc-600">
                <span>{editContent.length} 字元</span>
                <span>{editContent.split(/\n{2,}/).filter(Boolean).length} 段落</span>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AdminStoriesPage() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <main className="p-8 text-red-500">
        NEXT_PUBLIC_GOOGLE_CLIENT_ID 未設定
      </main>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AdminStoriesContent />
    </GoogleOAuthProvider>
  );
}
