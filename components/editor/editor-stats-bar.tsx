"use client";

import { EditorStats } from "@/lib/editor-stats";

type EditorStatsBarProps = {
  stats: EditorStats;
  /** 最後儲存時間(已格式化) */
  savedAt: string;
  /** 已經連到 Google Docs */
  linked: boolean;
  theme: {
    subtleText: string;
  };
};

/** 編輯區下面的一行小字:儲存時間、字數、段落數 */
export default function EditorStatsBar({ stats, savedAt, linked, theme }: EditorStatsBarProps) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-6 ${theme.subtleText}`}>
      <span>已儲存 {savedAt}</span>
      <span title={`含標點及空白 ${stats.totalChars}・不含空白 ${stats.totalCharsNoSpaces}・不含標點及空白 ${stats.totalCharsNoSpacesNoPunctuation}`}>
        字數 {stats.totalCharsNoSpaces}（不含標點 {stats.totalCharsNoSpacesNoPunctuation}）
      </span>
      <span>{stats.lineCount} 行・{stats.paragraphCount} 段</span>
      {linked && <span>↗ 已連結 Google Docs，下次匯出會直接複寫</span>}
    </div>
  );
}
