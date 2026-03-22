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
};

export const STORAGE_KEY = "orange-writing-documents";

export function createNewDoc(): WritingDoc {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "未命名文件",
    content: "",
    mode: "plain",
    createdAt: now,
    updatedAt: now,
  };
}