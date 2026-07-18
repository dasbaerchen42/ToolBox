// app/tools/fullwidth/_components/FullwidthOptionsPanel.tsx
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createEmptyCustomRule } from "../_lib/customRules";
import type {
  FullwidthCustomRule,
  FullwidthOptions,
} from "../_lib/types";
import type { ThemeClasses } from "@/lib/theme";
import CollapsibleSection from "@/components/ToolCollapsible";

type Props = {
  options: FullwidthOptions;
  updateOption: <K extends keyof FullwidthOptions>(
    key: K,
    value: FullwidthOptions[K]
  ) => void;
  customRules: FullwidthCustomRule[];
  setCustomRules: Dispatch<SetStateAction<FullwidthCustomRule[]>>;
  handleResetOptions: () => void;
  t: ThemeClasses;
};

export default function FullwidthOptionsPanel({
  options,
  updateOption,
  customRules,
  setCustomRules,
  handleResetOptions,
  t,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(true);

  function updateCustomRule(
    id: string,
    patch: Partial<FullwidthCustomRule>
  ) {
    setCustomRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  }

  function removeCustomRule(id: string) {
    setCustomRules((prev) => prev.filter((rule) => rule.id !== id));
  }

  function addCustomRule() {
    setCustomRules((prev) => [...prev, createEmptyCustomRule()]);
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-[0.08em]">基本轉換</h2>

        <button
          type="button"
          onClick={handleResetOptions}
          className={`rounded-2xl border px-3 py-1.5 text-sm transition ${t.secondary}`}
        >
          重設
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-3">
        <OptionRow
          label="冒號 : → ："
          checked={options.convertColon}
          onChange={(checked) => updateOption("convertColon", checked)}
        />
        <OptionRow
          label="逗號 , → ，"
          checked={options.convertComma}
          onChange={(checked) => updateOption("convertComma", checked)}
        />
        <OptionRow
          label="問號 ? → ？"
          checked={options.convertQuestion}
          onChange={(checked) => updateOption("convertQuestion", checked)}
        />
        <OptionRow
          label="驚嘆號 ! → ！"
          checked={options.convertExclamation}
          onChange={(checked) => updateOption("convertExclamation", checked)}
        />
        <OptionRow
          label="句點 . → 。"
          checked={options.convertPeriod}
          onChange={(checked) => updateOption("convertPeriod", checked)}
        />
        <OptionRow
          label="分號 ; → ；"
          checked={options.convertSemicolon}
          onChange={(checked) => updateOption("convertSemicolon", checked)}
        />
        <OptionRow
          label="括號 ( ) → （ ）"
          checked={options.convertParentheses}
          onChange={(checked) => updateOption("convertParentheses", checked)}
        />
        <OptionRow
          label="大括號 { } → ｛ ｝"
          checked={options.convertBraces}
          onChange={(checked) => updateOption("convertBraces", checked)}
        />
        <OptionRow
          label={`引號 " ' → 「 」 / 『 』`}
          checked={options.convertQuotes}
          onChange={(checked) => updateOption("convertQuotes", checked)}
        />
      </div>

      {/* 這裡套用了我們新做的共用元件 */}
      <CollapsibleSection
        title="進階自訂"
        isOpen={advancedOpen}
        onToggle={() => setAdvancedOpen((prev) => !prev)}
        t={t}
        containerClassName={`border-t pt-5 ${t.divider}`}
        contentClassName="mt-4 space-y-5"
        headerClassName="items-center"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <OptionRow
            label="修正變成斜體的對話"
            checked={options.fixMiswrappedDialogueItalics}
            onChange={(checked) =>
              updateOption("fixMiswrappedDialogueItalics", checked)
            }
          />

          <OptionRow
            label="保留段落內的外文標點"
            checked={options.protectLatinClauses}
            onChange={(checked) =>
              updateOption("protectLatinClauses", checked)
            }
          />
        </div>

        <div className={`border-t pt-5 ${t.divider}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-[0.08em]">
                自訂置換區
              </h3>
              <p className={`mt-1 text-xs tracking-[0.04em] ${t.muted}`}>
                新增規則會往下增加
              </p>
            </div>

            <button
              type="button"
              onClick={addCustomRule}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
            >
              新增自訂規則
            </button>
          </div>

          <div className="mb-4">
            <OptionRow
              label="啟用自訂置換"
              checked={options.enableCustomReplace}
              onChange={(checked) =>
                updateOption("enableCustomReplace", checked)
              }
            />
          </div>

          <div className="space-y-3">
            {customRules.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-2xl border p-3 ${t.subPanel}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm tracking-[0.04em]">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        updateCustomRule(rule.id, {
                          enabled: e.target.checked,
                        })
                      }
                    />
                    啟用規則
                  </label>

                  <button
                    type="button"
                    onClick={() => removeCustomRule(rule.id)}
                    className={`rounded-2xl border px-3 py-1.5 text-sm transition ${t.secondary}`}
                  >
                    刪除
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label
                      className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}
                    >
                      取代前
                    </label>
                    <input
                      type="text"
                      value={rule.from}
                      onChange={(e) =>
                        updateCustomRule(rule.id, { from: e.target.value })
                      }
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
                    />
                  </div>

                  <div>
                    <label
                      className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}
                    >
                      取代後
                    </label>
                    <input
                      type="text"
                      value={rule.to}
                      onChange={(e) =>
                        updateCustomRule(rule.id, { to: e.target.value })
                      }
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </section>
  );
}

type OptionRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function OptionRow({ label, checked, onChange }: OptionRowProps) {
  return (
    <label className="flex items-center gap-2 text-sm tracking-[0.04em]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}