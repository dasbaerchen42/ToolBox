import {
  EditorPreferences,
  FontFamilyName,
} from "@/lib/preferences";
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

const fontOptions: { key: FontFamilyName; label: string }[] = [
  { key: "sans", label: "無襯線" },
  { key: "serif", label: "襯線" },
  { key: "mono", label: "等寬" },
  { key: "cursive", label: "手寫感" },
  { key: "round", label: "粉圓" },
];

const modeOptions: { value: WritingMode; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "social", label: "Social" },
];

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
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div>
        <label className={`mb-2 block text-sm tracking-[0.06em] ${theme.mutedText}`}>
          寫作模式
        </label>
        <select
          value={currentMode}
          onChange={(e) => onChangeMode(e.target.value as WritingMode)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] outline-none ${theme.border} ${theme.inputBg}`}
        >
          {modeOptions.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`mb-2 block text-sm tracking-[0.06em] ${theme.mutedText}`}>
          字體
        </label>
        <select
          value={preferences.fontFamily}
          onChange={(e) =>
            setPreferences((prev) => ({
              ...prev,
              fontFamily: e.target.value as FontFamilyName,
            }))
          }
          className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] outline-none ${theme.border} ${theme.inputBg}`}
        >
          {fontOptions.map((font) => (
            <option key={font.key} value={font.key}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`mb-2 block text-sm tracking-[0.06em] ${theme.mutedText}`}>
          字體大小
        </label>
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => adjustFontSize(-1)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            -
          </button>
          <input
            type="range"
            min="14"
            max="24"
            value={preferences.fontSize}
            onChange={(e) =>
              setPreferences((prev) => ({
                ...prev,
                fontSize: Number(e.target.value),
              }))
            }
            className="w-full"
          />
          <button
            onClick={() => adjustFontSize(1)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            +
          </button>
        </div>
        <p className={`text-sm tracking-[0.04em] ${theme.mutedText}`}>{preferences.fontSize}px</p>
      </div>

      <div>
        <label className={`mb-2 block text-sm tracking-[0.06em] ${theme.mutedText}`}>
          行高
        </label>
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => adjustLineHeight(-0.1)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            -
          </button>
          <input
            type="range"
            min="1.4"
            max="2.4"
            step="0.1"
            value={preferences.lineHeight}
            onChange={(e) =>
              setPreferences((prev) => ({
                ...prev,
                lineHeight: Number(e.target.value),
              }))
            }
            className="w-full"
          />
          <button
            onClick={() => adjustLineHeight(0.1)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            +
          </button>
        </div>
        <p className={`text-sm tracking-[0.04em] ${theme.mutedText}`}>{preferences.lineHeight}</p>
      </div>

      <div>
        <label className={`mb-2 block text-sm tracking-[0.06em] ${theme.mutedText}`}>
          字距
        </label>
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => adjustLetterSpacing(-0.1)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            -
          </button>
          <input
            type="range"
            min="-1"
            max="4"
            step="0.1"
            value={preferences.letterSpacing}
            onChange={(e) =>
              setPreferences((prev) => ({
                ...prev,
                letterSpacing: Number(e.target.value),
              }))
            }
            className="w-full"
          />
          <button
            onClick={() => adjustLetterSpacing(0.1)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            +
          </button>
        </div>
        <p className={`text-sm tracking-[0.04em] ${theme.mutedText}`}>
          {preferences.letterSpacing}px
        </p>
      </div>

      <div>
        <label className={`mb-2 block text-sm tracking-[0.06em] ${theme.mutedText}`}>
          編輯區寬度
        </label>
        <select
          value={preferences.editorWidth}
          onChange={(e) =>
            setPreferences((prev) => ({
              ...prev,
              editorWidth: e.target.value as EditorPreferences["editorWidth"],
            }))
          }
          className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] outline-none ${theme.border} ${theme.inputBg}`}
        >
          <option value="narrow">窄</option>
          <option value="medium">中</option>
          <option value="wide">寬</option>
        </select>
      </div>
    </div>
  );
}