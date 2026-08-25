/**
 * 社群排版：多數平台會把行首空白與連續空行吃掉，
 * 這裡用盲文空白（U+2800）與零寬空格（U+200B）把它們固定住。
 */
export function convertSocialText(input: string): string {
  if (!input) return "";

  return input
    .split("\n")
    .map((line) => {
      // 空行塞入盲文空白，平台才不會把整行摺掉
      if (line.trim() === "") return "⠀";

      // 行首縮排改成「零寬空格 + 半形空白」，避免被 trim 掉
      const leadingSpaceMatch = line.match(/^ +/);
      if (leadingSpaceMatch) {
        const safeSpaces = "​ ".repeat(leadingSpaceMatch[0].length);
        return line.replace(/^ +/, safeSpaces);
      }

      return line;
    })
    .join("\n");
}
