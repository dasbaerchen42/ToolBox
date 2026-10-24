"use client";

import { useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { downloadBlob } from "@/lib/download";
import {
  backupFileName,
  createEditorBackup,
  documentFromTextFile,
  parseEditorBackup,
  serializeEditorBackup,
  textFileForDocument,
} from "@/lib/editor-files";
import type { EditorPreferences } from "@/lib/preferences";
import type { WritingDoc } from "@/lib/storage";

const DOCUMENT_LIMIT = 4 * 1024 * 1024;
const BACKUP_LIMIT = 20 * 1024 * 1024;
const MENU_ITEM =
  "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition hover:bg-(--paper-bg-3) disabled:opacity-40";

export type EditorFileNotice = {
  kind: "success" | "error";
  text: string;
};

type Props = {
  activeDoc: WritingDoc;
  activeDocId: string;
  documents: WritingDoc[];
  preferences: EditorPreferences;
  setPreferences: Dispatch<SetStateAction<EditorPreferences>>;
  addDoc: (doc: WritingDoc) => void;
  replaceDocuments: (docs: WritingDoc[], activeDocId: string) => void;
  onNotice: (notice: EditorFileNotice) => void;
  onClose: () => void;
  mutedText: string;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function downloadText(name: string, content: string, type: string): void {
  downloadBlob({ name, blob: new Blob([content], { type }) });
}

export default function EditorLocalFiles({
  activeDoc,
  activeDocId,
  documents,
  preferences,
  setPreferences,
  addDoc,
  replaceDocuments,
  onNotice,
  onClose,
  mutedText,
}: Props) {
  const documentInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  async function importDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > DOCUMENT_LIMIT) {
      onNotice({ kind: "error", text: "這份文件超過 4 MB，放進瀏覽器本機儲存空間可能會失敗。" });
      onClose();
      return;
    }
    try {
      const doc = documentFromTextFile(file.name, await file.text());
      addDoc(doc);
      onNotice({ kind: "success", text: `已從「${file.name}」建立新文件。` });
    } catch (error) {
      onNotice({ kind: "error", text: errorMessage(error, "讀取文件失敗，請確認檔案仍可存取。") });
    } finally {
      onClose();
    }
  }

  function exportDocument() {
    try {
      const file = textFileForDocument(activeDoc);
      downloadText(file.name, file.content, file.type);
      onNotice({ kind: "success", text: `已下載「${file.name}」。` });
    } catch (error) {
      onNotice({ kind: "error", text: errorMessage(error, "下載失敗，請檢查瀏覽器的下載權限。") });
    } finally {
      onClose();
    }
  }

  function exportBackup() {
    try {
      const backup = createEditorBackup(documents, preferences, activeDocId);
      const name = backupFileName();
      downloadText(name, serializeEditorBackup(backup), "application/json;charset=utf-8");
      onNotice({ kind: "success", text: `已下載完整備份，共 ${documents.length} 份文件。` });
    } catch (error) {
      onNotice({ kind: "error", text: errorMessage(error, "建立備份失敗，請再試一次。") });
    } finally {
      onClose();
    }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > BACKUP_LIMIT) {
      onNotice({ kind: "error", text: "備份檔超過 20 MB，為避免瀏覽器失去回應，沒有讀取。" });
      onClose();
      return;
    }
    try {
      const backup = parseEditorBackup(await file.text());
      const confirmed = window.confirm(
        `這份備份有 ${backup.documents.length} 份文件。還原後會取代目前的 ${documents.length} 份文件與編輯器設定；建議先下載目前的完整備份。要繼續嗎？`
      );
      if (!confirmed) return;
      replaceDocuments(backup.documents, backup.activeDocumentId);
      setPreferences(backup.preferences);
      onNotice({ kind: "success", text: `已還原 ${backup.documents.length} 份文件與編輯器設定。` });
    } catch (error) {
      onNotice({ kind: "error", text: errorMessage(error, "無法還原這份備份。") });
    } finally {
      onClose();
    }
  }

  return (
    <>
      <input
        ref={documentInput}
        type="file"
        accept=".txt,.md,.markdown,.html,.htm,.json,.yaml,.yml,.css,text/plain,text/markdown,text/html,application/json"
        onChange={(event) => void importDocument(event)}
        className="hidden"
        tabIndex={-1}
      />
      <input
        ref={backupInput}
        type="file"
        accept=".json,application/json"
        onChange={(event) => void restoreBackup(event)}
        className="hidden"
        tabIndex={-1}
      />
      <button type="button" role="menuitem" onClick={() => documentInput.current?.click()} className={MENU_ITEM}>
        從本機匯入文件
      </button>
      <button type="button" role="menuitem" onClick={exportDocument} className={MENU_ITEM}>
        匯出目前文件
      </button>
      <div className="my-1 h-px bg-(--border-light)" />
      <button type="button" role="menuitem" onClick={exportBackup} className={MENU_ITEM}>
        下載完整備份
      </button>
      <button type="button" role="menuitem" onClick={() => backupInput.current?.click()} className={MENU_ITEM}>
        從完整備份還原
      </button>
      <p className={`px-3 pt-2 text-xs leading-5 ${mutedText}`}>
        文件只存在這個瀏覽器。清除網站資料或換裝置後不會自動帶過去，請定期下載完整備份。
      </p>
    </>
  );
}
