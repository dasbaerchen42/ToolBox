import type { TextMeta } from "../_lib/types";

type Props = {
  input: string;
  setInput: (value: string) => void;
  output: string;
  inputMeta: TextMeta;
  outputMeta: TextMeta;
  t: {
    panel: string;
    subPanel: string;
    input: string;
    muted: string;
  };
};

export default function FullwidthEditorPanel({
  input,
  setInput,
  output,
  inputMeta,
  outputMeta,
  t,
}: Props) {
  return (
    <section
      className={`rounded-[28px] border p-4 shadow-sm backdrop-blur md:p-5 ${t.panel}`}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={`rounded-[24px] border p-4 ${t.subPanel}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[0.08em]">輸入區</h2>
              <p className={`mt-1 text-xs tracking-[0.04em] ${t.muted}`}>
                貼上原始文本，保留換段即可
              </p>
            </div>

            <div className={`text-xs tracking-[0.04em] ${t.muted}`}>
              字數：{inputMeta.chars} ｜ 行數：{inputMeta.lines}
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="把原始內容貼在這裡……"
            className={`mt-4 h-[640px] w-full rounded-[24px] border p-4 text-sm leading-8 tracking-[0.04em] outline-none ${t.input}`}
          />
        </div>

        <div className={`rounded-[24px] border p-4 ${t.subPanel}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[0.08em]">輸出區</h2>
              <p className={`mt-1 text-xs tracking-[0.04em] ${t.muted}`}>
                轉換後的結果會顯示在這裡
              </p>
            </div>

            <div className={`text-xs tracking-[0.04em] ${t.muted}`}>
              字數：{outputMeta.chars} ｜ 行數：{outputMeta.lines}
            </div>
          </div>

          <textarea
            value={output}
            readOnly
            placeholder="執行轉換後，結果會顯示在這裡……"
            className={`mt-4 h-[640px] w-full rounded-[24px] border p-4 text-sm leading-8 tracking-[0.04em] outline-none ${t.input}`}
          />
        </div>
      </div>
    </section>
  );
}