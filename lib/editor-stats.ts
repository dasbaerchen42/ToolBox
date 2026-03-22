export type EditorStats = {
  totalChars: number;
  totalCharsNoSpaces: number;
  totalCharsNoSpacesNoPunctuation: number;
  lineCount: number;
  paragraphCount: number;
};

export function getEditorStats(content: string): EditorStats {
  const totalChars = content.length;
  const totalCharsNoSpaces = content.replace(/\s/g, "").length;
  const totalCharsNoSpacesNoPunctuation = content
    .replace(/\s/g, "")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()，。！？；：「」『』（）《》、…—]/g, "")
    .length;

  const lines = content.split("\n");
  const lineCount = lines.length;
  const paragraphCount = lines.filter((line) => line.trim().length > 0).length;

  return {
    totalChars,
    totalCharsNoSpaces,
    totalCharsNoSpacesNoPunctuation,
    lineCount,
    paragraphCount,
  };
}