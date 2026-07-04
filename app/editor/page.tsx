"use client";

import { useMemo } from "react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  type TokenResponse,
} from "@react-oauth/google";
import { type WritingDoc, createNewDoc } from "@/lib/storage";
import { EDITOR_THEME } from "@/lib/theme";
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

  const theme = EDITOR_THEME;

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
