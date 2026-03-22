import { KnifeSection, joinParagraphs } from "@/lib/tools/knife";

type Props = {
  selectedSection: KnifeSection | null;
  updateSectionTitle: (id: string, title: string) => void;
  moveFirstParagraphToPrev: (id: string) => void;
  moveLastParagraphToNext: (id: string) => void;
  copyText: (text: string) => Promise<void>;
  t: {
    muted: string;
    input: string;
    primary: string;
    secondary: string;
    subPanel: string;
  };
};

export default function KnifePreviewPanel({
  selectedSection,
  updateSectionTitle,
  moveFirstParagraphToPrev,
  moveLastParagraphToNext,
  copyText,
  t,
}: Props) {
  return (
    <div className={`rounded-[28px] border p-4 md:p-5 ${t.subPanel}`}>
      {selectedSection ? (
        <>
          <div>
            <label className={`mb-2 block text-sm tracking-[0.04em] ${t.muted}`}>
              章節名稱
            </label>
            <input
              type="text"
              value={selectedSection.title}
              onChange={(e) =>
                updateSectionTitle(selectedSection.id, e.target.value)
              }
              className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${t.input}`}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => moveFirstParagraphToPrev(selectedSection.id)}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
            >
              首段往前移
            </button>

            <button
              type="button"
              onClick={() => moveLastParagraphToNext(selectedSection.id)}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
            >
              末段往後移
            </button>

            <button
              type="button"
              onClick={() => copyText(joinParagraphs(selectedSection.paragraphs))}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
            >
              複製本章
            </button>
          </div>

          <div className={`mt-4 text-sm tracking-[0.04em] ${t.muted}`}>
            字數：{joinParagraphs(selectedSection.paragraphs).length} ｜ 段落數：
            {selectedSection.paragraphs.length}
          </div>

          <textarea
            value={joinParagraphs(selectedSection.paragraphs)}
            readOnly
            className={`mt-4 h-[640px] w-full rounded-[28px] border p-5 text-sm leading-8 tracking-[0.04em] outline-none ${t.input}`}
          />
        </>
      ) : null}
    </div>
  );
}