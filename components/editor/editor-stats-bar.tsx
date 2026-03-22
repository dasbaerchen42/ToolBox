"use client";

import { EditorStats } from "@/lib/editor-stats";

type EditorStatsBarProps = {
  stats: EditorStats;
  theme: {
    mutedText: string;
  };
};

export default function EditorStatsBar({
  stats,
  theme,
}: EditorStatsBarProps) {
  return (
    <div className={`text-sm tracking-[0.04em] leading-7 ${theme.mutedText}`}>
      ［字數］
      <span className="ml-2">含標點及空白 {stats.totalChars}</span>
      <span className="ml-3">不含空白 {stats.totalCharsNoSpaces}</span>
      <span className="ml-3">不含標點及空白 {stats.totalCharsNoSpacesNoPunctuation}
      </span>
      <span className="mx-3">｜</span>
      <span>［行數］{stats.lineCount}</span>
      <span className="mx-3">｜</span>
      <span>［段落數］{stats.paragraphCount}</span>
    </div>
  );
}