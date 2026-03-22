import { KnifeSection, getPreviewEnd, getPreviewStart, joinParagraphs } from "@/lib/tools/knife";

type Props = {
  sections: KnifeSection[];
  selectedSectionId: string;
  setSelectedSectionId: (id: string) => void;
  t: {
    listSelected: string;
    listUnselected: string;
  };
};

export default function KnifeSectionList({
  sections,
  selectedSectionId,
  setSelectedSectionId,
  t,
}: Props) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const text = joinParagraphs(section.paragraphs);
        const isSelected = section.id === selectedSectionId;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => setSelectedSectionId(section.id)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              isSelected ? t.listSelected : t.listUnselected
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-[0.05em]">
                  {section.title}
                </div>
                <div className="mt-1 text-[11px] opacity-75">
                  Chapter {index + 1}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs leading-6 tracking-[0.04em] opacity-80">
              字數：{text.length} ｜ 段落數：{section.paragraphs.length}
            </div>

            <div className="mt-3 text-xs leading-6 tracking-[0.03em] opacity-80">
              <div>開頭預覽：{getPreviewStart(text, 36)}</div>
              <div className="mt-1">結尾預覽：{getPreviewEnd(text, 36)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}