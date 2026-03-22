export function socialAddBlankLines(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function socialAddFullWidthIndent(content: string) {
  return content
    .split("\n")
    .map((line) => (line.trim() ? `　　${line.trim()}` : ""))
    .join("\n");
}

export function socialAddInvisibleSpacing(content: string) {
  return content
    .split("\n")
    .map((line) => (line.trim() ? `${line.trim()}\u200B` : ""))
    .join("\n");
}

export function socialCompactHashtags(content: string) {
  return content.replace(/\s+#/g, "\n#");
}