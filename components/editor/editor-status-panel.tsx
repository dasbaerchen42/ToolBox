"use client";

import { ValidationResult } from "@/lib/validators";

type EditorStatusPanelProps = {
  result: ValidationResult;
  theme: {
    mutedText: string;
  };
};

function getStatusTextColor(status: ValidationResult["status"]) {
  switch (status) {
    case "success":
      return "text-emerald-400";
    case "warning":
      return "text-amber-400";
    case "error":
      return "text-red-400";
    default:
      return "";
  }
}

export default function EditorStatusPanel({
  result,
  theme,
}: EditorStatusPanelProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[0.06em]">{result.title}</h3>
        <span className={`text-xs ${getStatusTextColor(result.status)}`}>
          {result.status}
        </span>
      </div>

      <div className={`space-y-2 text-sm leading-7 tracking-[0.03em] ${theme.mutedText}`}>
        {result.messages.map((message, index) => (
          <p key={`${message}-${index}`}>• {message}</p>
        ))}
      </div>
    </div>
  );
}