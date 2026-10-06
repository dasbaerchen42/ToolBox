"use client";

// 工具列「⚙ 設定」點開的小視窗:字體、字級、行高、字距、斜體顯示、檢查提示,
// 以及收在「進階」裡的其他寫作模式(YAML、JSON、CSS、HTML、Social)。

import { EditorPreferences, FontFamilyName } from "@/lib/preferences";
import { FONT_OPTIONS } from "@/lib/editor-font";
import { WritingMode } from "@/lib/storage";
import type { EditorThemeConfig } from "@/lib/theme";

type EditorSettingsPanelProps = {
  preferences: EditorPreferences;
  currentMode: WritingMode;
  onChangeMode: (mode: WritingMode) => void;
  setPreferences: React.Dispatch<React.SetStateAction<EditorPreferences>>;
  theme: EditorThemeConfig;
  adjustFontSize: (amount: number) => void;
  adjustLineHeight: (amount: number) => void;
  adjustLetterSpacing: (amount: number) => void;
};

/** 一般寫作用的模式 */
const MAIN_MODES: { value: WritingMode; label: string }[] = [
  { value: "markdown", label: "文件" },
  { value: "plain", label: "純文字" },
];

/** 進階:有語法檢查或特殊用途的模式 */
const ADVANCED_MODES: { value: WritingMode; label: string }[] = [
  { value: "html", label: "HTML" },
  { value: "yaml", label: "YAML" },
  { value: "json", label: "JSON" },
  { value: "css", label: "CSS" },
  { value: "social", label: "Social（社群排版）" },
];

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  theme,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  theme: EditorThemeConfig;
}) {
  const btn = `h-8 w-8 rounded-full border text-sm transition ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-sm ${theme.mutedText}`}>{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onMinus} className={btn} aria-label={`${label}減少`}>
          −
        </button>
        <span className="w-14 text-center text-sm tabular-nums">{value}</span>
        <button type="button" onClick={onPlus} className={btn} aria-label={`${label}增加`}>
          ＋
        </button>
      </div>
    </div>
  );
}

export default function EditorSettingsPanel({
  preferences,
  currentMode,
  onChangeMode,
  setPreferences,
  theme,
  adjustFontSize,
  adjustLineHeight,
  adjustLetterSpacing,
}: EditorSettingsPanelProps) {
  const select = `w-full rounded-2xl border px-3 py-1.5 text-sm outline-none ${theme.border} ${theme.inputBg}`;
  const isAdvanced = ADVANCED_MODES.some((mode) => mode.value === currentMode);
  const set = (patch: Partial<EditorPreferences>) => setPreferences((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3">
        <span className={`shrink-0 text-sm ${theme.mutedText}`}>字體</span>
        <select
          value={preferences.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value as FontFamilyName })}
          className={`${select} max-w-[12rem]`}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.key} value={font.key}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <Stepper label="字級" value={`${preferences.fontSize}px`} onMinus={() => adjustFontSize(-1)} onPlus={() => adjustFontSize(1)} theme={theme} />
      <Stepper label="行高" value={String(preferences.lineHeight)} onMinus={() => adjustLineHeight(-0.1)} onPlus={() => adjustLineHeight(0.1)} theme={theme} />
      <Stepper label="字距" value={`${preferences.letterSpacing}px`} onMinus={() => adjustLetterSpacing(-0.1)} onPlus={() => adjustLetterSpacing(0.1)} theme={theme} />

      <div className="h-px" style={{ background: "var(--border-light)" }} />

      <label className={`flex items-center gap-2 text-sm ${theme.mutedText}`}>
        <input type="checkbox" checked={preferences.softItalic} onChange={(e) => set({ softItalic: e.target.checked })} />
        斜體改淡色正體
      </label>
      {preferences.softItalic && (
        <label className={`ml-6 flex items-center gap-2 text-sm ${theme.mutedText}`}>
          <input type="checkbox" checked={preferences.softItalicBold} onChange={(e) => set({ softItalicBold: e.target.checked })} />
          對白加粗
        </label>
      )}
      <label className={`flex items-center gap-2 text-sm ${theme.mutedText}`}>
        <input type="checkbox" checked={preferences.showHints} onChange={(e) => set({ showHints: e.target.checked })} />
        顯示格式檢查提示
      </label>

      <div className="h-px" style={{ background: "var(--border-light)" }} />

      <label className="flex items-center justify-between gap-3">
        <span className={`shrink-0 text-sm ${theme.mutedText}`}>這份文件</span>
        <select value={currentMode} onChange={(e) => onChangeMode(e.target.value as WritingMode)} className={`${select} max-w-[12rem]`}>
          {MAIN_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
          <optgroup label="進階">
            {ADVANCED_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {isAdvanced && <p className={`text-xs ${theme.subtleText}`}>進階模式：適合寫程式設定檔或社群貼文排版，會顯示對應的語法檢查。</p>}
    </div>
  );
}
