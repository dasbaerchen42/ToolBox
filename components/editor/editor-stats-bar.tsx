"use client";

import { EditorStats } from "@/lib/editor-stats";

type EditorStatsBarProps = {
  stats: EditorStats;
  /** 最後儲存時間(已格式化) */
  savedAt: string;
  /** localStorage 寫入失敗時顯示，避免把記憶體裡的變更誤稱為已儲存 */
  saveError?: string | null;
  theme: {
    subtleText: string;
  };
};

/** 標題下面的一行小字:儲存時間、字數、段落數(手機上只留儲存時間與字數,不換行) */
export default function EditorStatsBar({ stats, savedAt, saveError, theme }: EditorStatsBarProps) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-6 ${theme.subtleText}`}>
      <span>{saveError ? "尚未儲存" : `已儲存 ${savedAt}`}</span>
      <span title={`含標點及空白 ${stats.totalChars}・不含空白 ${stats.totalCharsNoSpaces}・不含標點及空白 ${stats.totalCharsNoSpacesNoPunctuation}`}>
        字數 {stats.totalCharsNoSpaces}
        <span className="hidden sm:inline">（不含標點 {stats.totalCharsNoSpacesNoPunctuation}）</span>
      </span>
      <span className="hidden sm:inline">
        {stats.lineCount} 行・{stats.paragraphCount} 段
      </span>
      <span title="清除網站資料或換裝置後不會自動保留，請定期下載完整備份">
        只存在這個瀏覽器
      </span>
    </div>
  );
}
