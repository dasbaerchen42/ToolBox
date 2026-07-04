import { EditorPreferences } from "@/lib/preferences";

type EditorTextareaProps = {
  content: string;
  onChange: (value: string) => void;
  preferences: EditorPreferences;
  theme: {
    border: string;
    textareaBg: string;
    text: string;
  };
  widthClass: string;
};

function getFontFamily(fontFamily: EditorPreferences["fontFamily"]) {
  switch (fontFamily) {
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "mono":
      return '"SFMono-Regular", "Cascadia Mono", "Fira Code", "Consolas", monospace';
    case "cursive":
      return '"Segoe Script", "Brush Script MT", cursive';
    case "round":
      return "var(--font-round)";
    case "sans":
    default:
      return '"Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif';
  }
}

export default function EditorTextarea({
  content,
  onChange,
  preferences,
  theme,
  widthClass,
}: EditorTextareaProps) {
  return (
    <div className={`mx-auto w-full flex-1 ${widthClass}`}>
      <div
        className={`rounded-3xl border p-4 shadow-sm ${theme.border} ${theme.textareaBg}`}
      >
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontSize: `${preferences.fontSize}px`,
            lineHeight: preferences.lineHeight,
            letterSpacing: `${preferences.letterSpacing}px`,
            fontFamily: getFontFamily(preferences.fontFamily),
          }}
          className={`h-[70vh] w-full resize-none bg-transparent outline-none ${theme.text}`}
          placeholder="在這裡開始寫字……"
        />
      </div>
    </div>
  );
}