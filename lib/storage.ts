export type WritingMode =
  | "plain"
  | "markdown"
  | "yaml"
  | "json"
  | "html"
  | "css"
  | "social";

export type WritingDoc = {
  id: string;
  title: string;
  content: string;
  mode: WritingMode;
  createdAt: string;
  updatedAt: string;
  googleDocId?: string;
};

export const STORAGE_KEY = "orange-writing-documents";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createNewDoc(): WritingDoc {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "未命名文件",
    content: "",
    mode: "plain",
    createdAt: now,
    updatedAt: now,
  };
}
