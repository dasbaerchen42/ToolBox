"use client";

import { useMemo } from "react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  type TokenResponse,
} from "@react-oauth/google";
import { type WritingDoc, createNewDoc } from "@/lib/storage";
import { type ThemeName } from "@/lib/preferences";
import EditorSidebar from "@/components/editor/editor-sidebar";
import EditorToolbar from "@/components/editor/editor-toolbar";
import EditorSettingsPanel from "@/components/editor/editor-settings-panel";
import EditorTextarea from "@/components/editor/editor-textarea";
import EditorStatusPanel from "@/components/editor/editor-status-panel";
import { validateContent } from "@/lib/validators";
import EditorStatsBar from "@/components/editor/editor-stats-bar";
import { getEditorStats } from "@/lib/editor-stats";
import CollapsibleSection from "@/components/editor/collapsible-section";
import { formatDateTime24h } from "@/lib/datetime";
import { exportDoc, importDoc, extractDocId } from "@/lib/google-docs";
import { useDocuments } from "@/hooks/useDocuments";
import { useEditorPreferences } from "@/hooks/useEditorPreferences";

type ThemeConfig = {
  pageBg: string;
  sidebarBg: string;
  panelBg: string;
  cardBg: string;
  border: string;
  text: string;
  mutedText: string;
  subtleText: string;
  inputBg: string;
  textareaBg: string;
  primaryButton: string;
  primaryButtonText: string;
  secondaryButton: string;
  secondaryButtonText: string;
  activeItem: string;
  inactiveItem: string;
};

const themeMap: Record<ThemeName, ThemeConfig> = {
  dark: {
    pageBg: "bg-zinc-950",
    sidebarBg: "bg-zinc-900/40",
    panelBg: "bg-zinc-900/60",
    cardBg: "bg-zinc-900",
    border: "border-zinc-800",
    text: "text-zinc-100",
    mutedText: "text-zinc-400",
    subtleText: "text-zinc-500",
    inputBg: "bg-zinc-900",
    textareaBg: "bg-zinc-900/60",
    primaryButton: "bg-white hover:opacity-90",
    primaryButtonText: "text-zinc-900",
    secondaryButton: "border-zinc-700 hover:bg-zinc-800",
    secondaryButtonText: "text-zinc-200",
    activeItem: "border-zinc-500 bg-zinc-800",
    inactiveItem: "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/70",
  },
  light: {
    pageBg: "bg-stone-100",
    sidebarBg: "bg-white",
    panelBg: "bg-white",
    cardBg: "bg-white",
    border: "border-stone-300",
    text: "text-stone-900",
    mutedText: "text-stone-600",
    subtleText: "text-stone-500",
    inputBg: "bg-white",
    textareaBg: "bg-white",
    primaryButton: "bg-stone-900 hover:opacity-90",
    primaryButtonText: "text-white",
    secondaryButton: "border-stone-300 hover:bg-stone-100",
    secondaryButtonText: "text-stone-800",
    activeItem: "border-stone-500 bg-stone-100",
    inactiveItem: "border-stone-300 bg-white hover:bg-stone-50",
  },
  forest: {
    pageBg: "bg-lime-50",
    sidebarBg: "bg-lime-100/70",
    panelBg: "bg-lime-50",
    cardBg: "bg-lime-50",
    border: "border-lime-200",
    text: "text-amber-950",
    mutedText: "text-amber-800",
    subtleText: "text-amber-700",
    inputBg: "bg-lime-50",
    textareaBg: "bg-lime-50",
    primaryButton: "bg-amber-900 hover:opacity-90",
    primaryButtonText: "text-lime-50",
    secondaryButton: "border-lime-300 hover:bg-lime-100",
    secondaryButtonText: "text-amber-900",
    activeItem: "border-lime-400 bg-lime-100",
    inactiveItem: "border-lime-200 bg-lime-50 hover:bg-lime-100/70",
  },
  sunny: {
    pageBg: "bg-amber-50",
    sidebarBg: "bg-yellow-100/70",
    panelBg: "bg-amber-50",
    cardBg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-slate-900",
    mutedText: "text-slate-700",
    subtleText: "text-slate-500",
    inputBg: "bg-amber-50",
    textareaBg: "bg-amber-50",
    primaryButton: "bg-slate-900 hover:opacity-90",
    primaryButtonText: "text-amber-50",
    secondaryButton: "border-amber-300 hover:bg-yellow-100",
    secondaryButtonText: "text-slate-900",
    activeItem: "border-amber-400 bg-yellow-100",
    inactiveItem: "border-amber-200 bg-amber-50 hover:bg-yellow-50",
  },
  paper: {
    pageBg: "bg-orange-50",
    sidebarBg: "bg-orange-100/60",
    panelBg: "bg-orange-50",
    cardBg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-neutral-900",
    mutedText: "text-neutral-700",
    subtleText: "text-neutral-500",
    inputBg: "bg-orange-50",
    textareaBg: "bg-orange-50",
    primaryButton: "bg-neutral-900 hover:opacity-90",
    primaryButtonText: "text-orange-50",
    secondaryButton: "border-orange-300 hover:bg-orange-100",
    secondaryButtonText: "text-neutral-900",
    activeItem: "border-orange-400 bg-orange-100",
    inactiveItem: "border-orange-200 bg-orange-50 hover:bg-orange-100/70",
  },
};

function EditorPageContent() {
  const {
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    handleCreateDoc,
    handleDeleteDoc,
    updateActiveDoc,
    addDoc,
  } = useDocuments();

  const {
    preferences,
    setPreferences,
    adjustFontSize,
    adjustLineHeight,
    adjustLetterSpacing,
    getEditorWidthClass,
  } = useEditorPreferences();

  const exportToGoogleDocs = useGoogleLogin({
    scope: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        if (!activeDoc) {
          alert("目前沒有可匯出的文件。");
          return;
        }

        const { documentId, url, isUpdate } = await exportDoc(
          tokenResponse.access_token,
          activeDoc.title,
          activeDoc.content,
          activeDoc.googleDocId
        );

        if (!activeDoc.googleDocId) {
          updateActiveDoc({ googleDocId: documentId });
        }

        alert(isUpdate ? "已成功更新 Google Docs！" : "已成功匯出到 Google Docs！");
        window.open(url, "_blank");
      } catch (error) {
        console.error("匯出失敗：", error);
        alert("匯出失敗，請按 F12 查看 Console 錯誤。");
      }
    },
    onError: () => {
      alert("Google 授權失敗。");
    },
  });

  const importFromGoogleDocs = useGoogleLogin({
    scope: [
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ].join(" "),
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        const input = window.prompt("請貼上 Google Docs 文件連結：");
        if (!input) return;

        const documentId = extractDocId(input);
        if (!documentId) {
          alert("看起來不是有效的 Google Docs 連結。");
          return;
        }

        const { title, content, documentId: docId } = await importDoc(
          tokenResponse.access_token,
          documentId
        );

        const importedDoc: WritingDoc = {
          ...createNewDoc(),
          title,
          content,
          mode: "plain",
          googleDocId: docId,
        };

        addDoc(importedDoc);
        alert("已成功從 Google Docs 匯入！");
      } catch (error) {
        console.error("匯入失敗：", error);
        alert("匯入失敗，請按 F12 查看 Console 錯誤。");
      }
    },
    onError: () => {
      alert("Google 授權失敗。");
    },
  });

  const theme = themeMap[preferences.theme];

  const validationResult = useMemo(
    () =>
      activeDoc
        ? validateContent(activeDoc.mode, activeDoc.content)
        : { status: "idle" as const, title: "狀態", messages: ["尚未選擇文件。"] },
    [activeDoc]
  );

  const editorStats = useMemo(
    () => getEditorStats(activeDoc?.content ?? ""),
    [activeDoc?.content]
  );

  return (
    <main className={`min-h-screen ${theme.pageBg} ${theme.text}`}>
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <EditorSidebar
          docs={docs}
          activeDocId={activeDocId}
          onSelectDoc={setActiveDocId}
          onCreateDoc={handleCreateDoc}
          onDeleteDoc={handleDeleteDoc}
          theme={theme}
        />

        <section className="p-4 md:p-6">
          {activeDoc ? (
            <div className="flex h-full flex-col">
              <header className={`mb-6 ${theme.border}`}>
                <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                  <div>
                    <label className={`mb-2 block text-sm ${theme.mutedText}`}>
                      Title
                    </label>
                    <input
                      type="text"
                      value={activeDoc.title}
                      onChange={(e) => updateActiveDoc({ title: e.target.value })}
                      className={`w-full rounded-2xl border px-4 py-3 text-xl font-semibold tracking-[0.04em] outline-none transition ${theme.border} ${theme.inputBg}`}
                      placeholder="請輸入文件標題"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className={`mb-2 block text-sm ${theme.mutedText}`}>
                      操作
                    </label>
                    <EditorToolbar
                      onImport={importFromGoogleDocs}
                      onExport={exportToGoogleDocs}
                      theme={theme}
                    />
                  </div>
                </div>

                <CollapsibleSection title="Status" defaultOpen={true} theme={theme}>
                  <div className="space-y-3">
                    <div className={`text-sm ${theme.mutedText}`}>
                      ［最後儲存時間］{formatDateTime24h(activeDoc.updatedAt)}
                    </div>
                    {activeDoc.googleDocId && (
                      <div className={`text-xs ${theme.subtleText}`}>
                        ↗ 已連結 Google Docs・下次匯出將直接複寫
                      </div>
                    )}
                    <EditorStatsBar stats={editorStats} theme={theme} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Setting" defaultOpen={false} theme={theme}>
                  <EditorSettingsPanel
                    preferences={preferences}
                    currentMode={activeDoc.mode}
                    onChangeMode={(mode) => updateActiveDoc({ mode })}
                    setPreferences={setPreferences}
                    theme={theme}
                    adjustFontSize={adjustFontSize}
                    adjustLineHeight={adjustLineHeight}
                    adjustLetterSpacing={adjustLetterSpacing}
                  />
                </CollapsibleSection>
              </header>

              <EditorTextarea
                content={activeDoc.content}
                onChange={(value) => updateActiveDoc({ content: value })}
                preferences={preferences}
                theme={theme}
                widthClass={getEditorWidthClass()}
              />

              <CollapsibleSection title="Hint" defaultOpen={true} theme={theme}>
                <EditorStatusPanel result={validationResult} theme={theme} />
              </CollapsibleSection>
            </div>
          ) : (
            <div className={`flex h-full items-center justify-center ${theme.mutedText}`}>
              尚未選擇文件
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function EditorPage() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <main style={{ padding: 24 }}>
        <h1>CLIENT ID MISSING</h1>
      </main>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <EditorPageContent />
    </GoogleOAuthProvider>
  );
}
