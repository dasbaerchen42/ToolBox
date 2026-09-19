"use client";

import { analyzeSocial } from "../_lib/social-marks";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  text: string;
  t: ThemeClasses;
};

/**
 * 標記查看:把社群排版會插進去的隱形字元標出來。
 *
 * 用 <pre> 而不是 textarea——textarea 沒辦法只把標記上色,
 * 而不上色的話這一格看起來就跟左邊一模一樣,等於什麼都沒說。
 */
export default function MarkedView({ text, t }: Props) {
  const lines = analyzeSocial(text);

  return (
    <pre
      aria-label="標記查看"
      className={`h-full min-h-[16rem] w-full overflow-auto whitespace-pre-wrap break-words rounded-[24px] border p-4 text-sm leading-8 tracking-[0.04em] ${t.input}`}
    >
      {text === ""
        ? <span className={t.muted}>左邊還沒有內容。</span>
        : lines.map((line, index) => (
            <span key={index}>
              {line.kind === "blank" && (
                <span className="text-(--accent)" title="空行，會補上一個空白盲文">
                  ⟨空⟩
                </span>
              )}

              {line.kind === "indent" && (
                <>
                  <span
                    className="text-(--accent)"
                    title={`${line.spaces} 格縮排，每格會墊一個零寬空格`}
                  >
                    {"·".repeat(line.spaces)}
                  </span>
                  {line.text}
                </>
              )}

              {line.kind === "plain" && line.text}
              {index < lines.length - 1 ? "\n" : null}
            </span>
          ))}
    </pre>
  );
}
