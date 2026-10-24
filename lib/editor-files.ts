import { migratePreferences } from "@/lib/preferences-migrate";
import type { EditorPreferences } from "@/lib/preferences";
import { createNewDoc, type WritingDoc, type WritingMode } from "@/lib/storage";
import { sanitizeFileName } from "@/lib/download";

export const EDITOR_BACKUP_KIND = "das-baerchen-toolbox-editor-backup";
export const EDITOR_BACKUP_VERSION = 1;

const WRITING_MODES: WritingMode[] = [
  "plain",
  "markdown",
  "yaml",
  "json",
  "html",
  "css",
  "social",
];

const MODE_BY_EXTENSION: Record<string, WritingMode> = {
  md: "markdown",
  markdown: "markdown",
  html: "html",
  htm: "html",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  txt: "plain",
};

const EXTENSION_BY_MODE: Record<WritingMode, string> = {
  plain: "txt",
  markdown: "md",
  yaml: "yaml",
  json: "json",
  html: "html",
  css: "css",
  social: "txt",
};

const MIME_BY_MODE: Record<WritingMode, string> = {
  plain: "text/plain",
  markdown: "text/markdown",
  yaml: "application/yaml",
  json: "application/json",
  html: "text/html",
  css: "text/css",
  social: "text/plain",
};

export type EditorBackup = {
  kind: typeof EDITOR_BACKUP_KIND;
  version: typeof EDITOR_BACKUP_VERSION;
  exportedAt: string;
  documents: WritingDoc[];
  preferences: EditorPreferences;
  activeDocumentId: string;
};

export type TextFileExport = {
  name: string;
  content: string;
  type: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function titleFromFileName(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? name;
  const dot = leaf.lastIndexOf(".");
  return (dot > 0 ? leaf.slice(0, dot) : leaf).trim() || "匯入的文件";
}

export function modeForFileName(name: string): WritingMode {
  return MODE_BY_EXTENSION[fileExtension(name)] ?? "plain";
}

export function documentFromTextFile(name: string, content: string): WritingDoc {
  return {
    ...createNewDoc(),
    title: titleFromFileName(name),
    content: content.replace(/^\uFEFF/, ""),
    mode: modeForFileName(name),
  };
}

export function textFileForDocument(doc: WritingDoc): TextFileExport {
  const extension = EXTENSION_BY_MODE[doc.mode] ?? "txt";
  return {
    name: `${sanitizeFileName(doc.title)}.${extension}`,
    content: doc.content,
    type: `${MIME_BY_MODE[doc.mode] ?? "text/plain"};charset=utf-8`,
  };
}

export function createEditorBackup(
  documents: WritingDoc[],
  preferences: EditorPreferences,
  activeDocumentId: string,
  now = new Date()
): EditorBackup {
  return {
    kind: EDITOR_BACKUP_KIND,
    version: EDITOR_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    documents,
    preferences,
    activeDocumentId,
  };
}

export function backupFileName(now = new Date()): string {
  return `toolbox-editor-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function serializeEditorBackup(backup: EditorBackup): string {
  return JSON.stringify(backup, null, 2);
}

function parseDocument(value: unknown, index: number): WritingDoc {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 份文件格式不正確。`);
  const mode = value.mode;
  if (
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.title !== "string" ||
    typeof value.content !== "string" ||
    typeof mode !== "string" ||
    !WRITING_MODES.includes(mode as WritingMode) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error(`第 ${index + 1} 份文件缺少必要資料。`);
  }

  const doc: WritingDoc = {
    id: value.id,
    title: value.title,
    content: value.content,
    mode: mode as WritingMode,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (Array.isArray(value.blockStyles)) {
    doc.blockStyles = value.blockStyles as WritingDoc["blockStyles"];
  }
  return doc;
}

export function parseEditorBackup(text: string): EditorBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("這不是有效的 JSON 備份檔。");
  }
  if (!isRecord(raw) || raw.kind !== EDITOR_BACKUP_KIND) {
    throw new Error("這不是工具箱編輯器的完整備份檔。");
  }
  if (raw.version !== EDITOR_BACKUP_VERSION) {
    throw new Error(`不支援這個備份版本（${String(raw.version)}）。`);
  }
  if (!Array.isArray(raw.documents) || raw.documents.length === 0) {
    throw new Error("備份裡沒有可還原的文件。");
  }

  const documents = raw.documents.map(parseDocument);
  const activeDocumentId =
    typeof raw.activeDocumentId === "string" &&
    documents.some((doc) => doc.id === raw.activeDocumentId)
      ? raw.activeDocumentId
      : documents[0].id;

  return {
    kind: EDITOR_BACKUP_KIND,
    version: EDITOR_BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    documents,
    preferences: migratePreferences(raw.preferences),
    activeDocumentId,
  };
}
