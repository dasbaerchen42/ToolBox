"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  type TokenResponse,
} from "@react-oauth/google";
import { STORAGE_KEY, type WritingDoc, createNewDoc } from "@/lib/storage";
import {
  ACTIVE_DOC_KEY,
  type EditorPreferences,
  PREFERENCES_KEY,
  type ThemeName,
  defaultPreferences,
} from "@/lib/preferences";
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
  const [docs, setDocs] = useState<WritingDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>("");
  const [preferences, setPreferences] =
    useState<EditorPreferences>(defaultPreferences);

  const activeDoc = useMemo(() => {
    return docs.find((doc) => doc.id === activeDocId) || null;
  }, [docs, activeDocId]);

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

        const accessToken = tokenResponse.access_token;

        const titleToExport =
          activeDoc.title && activeDoc.title.trim()
            ? activeDoc.title
            : "未命名文件";

        const contentToExport =
          activeDoc.content && activeDoc.content.trim()
            ? activeDoc.content
            : "（這份文件目前沒有內容）";

        const createResponse = await fetch(
          "https://docs.googleapis.com/v1/documents",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: titleToExport,
            }),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`建立文件失敗：${errorText}`);
        }

        const createdDoc = await createResponse.json();
        const documentId = createdDoc.documentId as string;

        const updateResponse = await fetch(
          `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [
                {
                  insertText: {
                    location: {
                      index: 1,
                    },
                    text: contentToExport,
                  },
                },
              ],
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`寫入內容失敗：${errorText}`);
        }

        alert("已成功匯出到 Google Docs！");
        window.open(
          `https://docs.google.com/document/d/${documentId}/edit`,
          "_blank"
        );
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
        const accessToken = tokenResponse.access_token;
        const input = window.prompt("請貼上 Google Docs 文件連結：");

        if (!input) {
          return;
        }

        const match = input.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);

        if (!match) {
          alert("看起來不是有效的 Google Docs 連結。");
          return;
        }

        const documentId = match[1];

        const response = await fetch(
          `https://docs.googleapis.com/v1/documents/${documentId}?includeTabsContent=true`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`讀取 Google Docs 失敗：${errorText}`);
        }

        const docData = await response.json();
        const title = docData.title || "匯入的文件";

        function getAllTabs(tabs: any[] = []): any[] {
          const result: any[] = [];

          for (const tab of tabs) {
            result.push(tab);

            if (tab.childTabs?.length) {
              result.push(...getAllTabs(tab.childTabs));
            }
          }

          return result;
        }

        function readStructuralElements(elements: any[] = []): string {
          let text = "";

          for (const element of elements) {
            if (element.paragraph?.elements) {
              text += element.paragraph.elements
                .map((el: any) => el.textRun?.content || "")
                .join("");
            }

            if (element.table?.tableRows) {
              for (const row of element.table.tableRows) {
                for (const cell of row.tableCells || []) {
                  text += readStructuralElements(cell.content || []);
                }
              }
            }

            if (element.tableOfContents?.content) {
              text += readStructuralElements(element.tableOfContents.content);
            }
          }

          return text;
        }

        let textContent = "";

        if (docData.tabs?.length) {
          const allTabs = getAllTabs(docData.tabs);

          textContent = allTabs
            .map((tab: any, index: number) => {
              const tabTitle = tab.tabProperties?.title || `分頁 ${index + 1}`;
              const tabBody = tab.documentTab?.body?.content || [];
              const tabText = readStructuralElements(tabBody).trim();

              return `# ${tabTitle}\n\n${tabText}`;
            })
            .join("\n\n---\n\n");
        } else {
          const bodyContent = docData.body?.content || [];
          textContent = readStructuralElements(bodyContent).trim();
        }

        const baseDoc = createNewDoc();

        const importedDoc: WritingDoc = {
          ...baseDoc,
          title,
          content: textContent.trim(),
          mode: "plain",
        };

        setDocs((prev) => [importedDoc, ...prev]);
        setActiveDocId(importedDoc.id);

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

  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem(STORAGE_KEY);
      const savedPreferences = localStorage.getItem(PREFERENCES_KEY);
      const savedActiveDocId = localStorage.getItem(ACTIVE_DOC_KEY);

      if (savedPreferences) {
        setPreferences(JSON.parse(savedPreferences) as EditorPreferences);
      }

      if (savedDocs) {
        const parsed = JSON.parse(savedDocs) as WritingDoc[];

        const normalizedDocs: WritingDoc[] = parsed.map((doc) => ({
          ...doc,
          mode: doc.mode || "plain",
        }));

        setDocs(normalizedDocs);

        if (
          savedActiveDocId &&
          normalizedDocs.some((doc) => doc.id === savedActiveDocId)
        ) {
          setActiveDocId(savedActiveDocId);
        } else if (normalizedDocs.length > 0) {
          setActiveDocId(normalizedDocs[0].id);
        } else {
          const firstDoc = createNewDoc();
          setDocs([firstDoc]);
          setActiveDocId(firstDoc.id);
        }
      } else {
        const firstDoc = createNewDoc();
        setDocs([firstDoc]);
        setActiveDocId(firstDoc.id);
      }
    } catch (error) {
      console.error("Failed to load editor data from localStorage:", error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PREFERENCES_KEY);
      localStorage.removeItem(ACTIVE_DOC_KEY);

      const firstDoc = createNewDoc();
      setDocs([firstDoc]);
      setActiveDocId(firstDoc.id);
      setPreferences(defaultPreferences);
    }
  }, []);

  useEffect(() => {
    if (docs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    }
  }, [docs]);

  useEffect(() => {
    if (activeDocId) {
      localStorage.setItem(ACTIVE_DOC_KEY, activeDocId);
    }
  }, [activeDocId]);

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const theme = themeMap[preferences.theme];

  const validationResult = activeDoc
    ? validateContent(activeDoc.mode, activeDoc.content)
    : {
        status: "idle" as const,
        title: "狀態",
        messages: ["尚未選擇文件。"],
      };

  const editorStats = activeDoc
    ? getEditorStats(activeDoc.content)
    : getEditorStats("");

  function handleCreateDoc() {
    const newDoc = createNewDoc();
    setDocs((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
  }

  function handleDeleteDoc(docId: string) {
    const filteredDocs = docs.filter((doc) => doc.id !== docId);

    if (filteredDocs.length === 0) {
      const newDoc = createNewDoc();
      setDocs([newDoc]);
      setActiveDocId(newDoc.id);
      return;
    }

    setDocs(filteredDocs);

    if (activeDocId === docId) {
      setActiveDocId(filteredDocs[0].id);
    }
  }

  function updateActiveDoc(fields: Partial<WritingDoc>) {
    setDocs((prev) => {
      const updatedDocs = prev.map((doc) =>
        doc.id === activeDocId
          ? {
              ...doc,
              ...fields,
              updatedAt: new Date().toISOString(),
            }
          : doc
      );

      const activeUpdatedDoc = updatedDocs.find(
        (doc) => doc.id === activeDocId
      );
      const otherDocs = updatedDocs.filter((doc) => doc.id !== activeDocId);

      return activeUpdatedDoc ? [activeUpdatedDoc, ...otherDocs] : updatedDocs;
    });
  }

  function getEditorWidthClass() {
    switch (preferences.editorWidth) {
      case "narrow":
        return "max-w-2xl";
      case "wide":
        return "max-w-6xl";
      case "medium":
      default:
        return "max-w-4xl";
    }
  }

  function adjustFontSize(amount: number) {
    setPreferences((prev) => ({
      ...prev,
      fontSize: Math.min(24, Math.max(14, prev.fontSize + amount)),
    }));
  }

  function adjustLineHeight(amount: number) {
    setPreferences((prev) => ({
      ...prev,
      lineHeight: Math.min(
        2.4,
        Math.max(1.4, +(prev.lineHeight + amount).toFixed(1))
      ),
    }));
  }

  function adjustLetterSpacing(amount: number) {
    setPreferences((prev) => ({
      ...prev,
      letterSpacing: Math.min(
        4,
        Math.max(-1, +(prev.letterSpacing + amount).toFixed(1))
      ),
    }));
  }

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
