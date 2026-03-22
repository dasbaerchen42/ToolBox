import { WritingDoc } from "@/lib/storage";
import { formatDateTime24h } from "@/lib/datetime";

type EditorSidebarProps = {
  docs: WritingDoc[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (docId: string) => void;
  theme: {
    border: string;
    sidebarBg: string;
    primaryButton: string;
    primaryButtonText: string;
    secondaryButton: string;
    secondaryButtonText: string;
    activeItem: string;
    inactiveItem: string;
    mutedText: string;
    subtleText: string;
  };
};

export default function EditorSidebar({
  docs,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  theme,
}: EditorSidebarProps) {
  return (
    <aside
      className={`border-b p-4 md:border-b-0 md:border-r ${theme.border} ${theme.sidebarBg}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-[0.08em]">我的文件</h2>
        <button
          onClick={onCreateDoc}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${theme.primaryButton} ${theme.primaryButtonText}`}
        >
          新增
        </button>
      </div>

      <div className="space-y-2">
        {docs.map((doc) => {
          const isActive = doc.id === activeDocId;

          return (
            <div
              key={doc.id}
              className={`cursor-pointer rounded-2xl border p-3 transition ${
                isActive ? theme.activeItem : theme.inactiveItem
              }`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium tracking-[0.04em]">
                    {doc.title || "未命名文件"}
                  </p>
                  <p className={`mt-1 text-xs uppercase ${theme.subtleText}`}>
                    {doc.mode}
                  </p>
                  <p className={`mt-1 truncate text-sm leading-6 tracking-[0.03em] ${theme.mutedText}`}>
                    {doc.content || "尚未輸入內容"}
                  </p>
                  <p className={`mt-2 text-xs ${theme.subtleText}`}>
                    更新時間：{formatDateTime24h(doc.updatedAt)}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDoc(doc.id);
                  }}
                  className={`shrink-0 rounded-lg border px-2 py-1 text-xs transition ${theme.secondaryButton} ${theme.secondaryButtonText}`}
                >
                  刪除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}