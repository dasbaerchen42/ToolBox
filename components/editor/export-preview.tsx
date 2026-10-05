"use client";

// 轉圖視窗裡的預覽:照真正轉圖的寬度、字級、留白排一次,再整張縮小顯示,
// 換行、段距、分頁都跟下載下來的圖一樣。每一張圖是一張「紙」,
// 左邊勾選要不要轉、右邊「Aa」調這一段的樣式;手動分頁時點段落就在它後面切一刀。

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import { getFontFamily } from "@/lib/editor-font";
import { BLOCK_FILLS, type BlockFill, type BlockStyle } from "@/lib/markdown";
import type { ExportLayout, PageSize } from "@/lib/export-layout";
import type { FontFamilyName } from "@/lib/preferences";

const GUTTER_LEFT = 30;
const GUTTER_RIGHT = 36;

export type SheetItem = { kind: "title"; html: string } | { kind: "block"; index: number; html: string; selected: boolean; styled: boolean };

export type PreviewPage = {
  items: SheetItem[];
  /** 量好了才有;太長(超過單張上限)時 over 為 true */
  size: (PageSize & { over: boolean; slices: number }) | null;
  /** 手動分頁時,這張的前面那一刀切在第幾段之後(可以按掉) */
  cutBefore: number | null;
};

/** 一段的樣式列:對齊、底色、底線 */
export function BlockStyleBar({
  style,
  onChange,
  onClose,
  theme,
}: {
  style: BlockStyle;
  onChange: (patch: Partial<BlockStyle>) => void;
  onClose: () => void;
  theme: EditorThemeConfig;
}) {
  const chip = (active: boolean) =>
    `rounded-xl border px-2.5 py-1 text-xs ${theme.border} ${
      active ? `${theme.primaryButton} ${theme.primaryButtonText}` : `${theme.secondaryButton} ${theme.secondaryButtonText}`
    }`;
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-2xl border px-2 py-1.5 shadow-lg ${theme.border} ${theme.panelBg}`}
      onClick={(e) => e.stopPropagation()}
    >
      {(
        [
          ["left", "靠左"],
          ["center", "置中"],
          ["right", "置右"],
        ] as const
      ).map(([value, label]) => (
        <button key={value} type="button" aria-pressed={style.align === value} onClick={() => onChange({ align: value })} className={chip(style.align === value)}>
          {label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: "var(--border-light)" }} />
      <button type="button" aria-pressed={style.fill === "none"} onClick={() => onChange({ fill: "none" })} className={chip(style.fill === "none")}>
        無底色
      </button>
      {(Object.entries(BLOCK_FILLS) as [Exclude<BlockFill, "none">, { label: string; color: string }][]).map(([value, fill]) => (
        <button
          key={value}
          type="button"
          aria-label={`${fill.label}色底`}
          aria-pressed={style.fill === value}
          onClick={() => onChange({ fill: value })}
          className={`h-7 w-7 rounded-full border-2 ${style.fill === value ? "" : "border-transparent"}`}
          style={{ background: fill.color, borderColor: style.fill === value ? "var(--accent)" : undefined }}
        />
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: "var(--border-light)" }} />
      <button type="button" aria-pressed={style.underline} onClick={() => onChange({ underline: !style.underline })} className={chip(style.underline)}>
        <span className="underline underline-offset-2">底線</span>
      </button>
      <button type="button" onClick={onClose} className={`ml-auto ${chip(false)}`}>
        完成
      </button>
    </div>
  );
}

type SheetProps = {
  page: PreviewPage;
  /** 這張是第幾張(從 1 數)、總共幾張:頁碼用 */
  number: number;
  total: number;
  /** 圖片配色:內建主題的 id,或自選配色的整組顏色變數 */
  palette: { theme?: string; vars?: Record<string, string> };
  signature: string;
  pageNumbers: boolean;
  layout: ExportLayout;
  scale: number;
  contentClass: string;
  fontFamily: FontFamilyName;
  cutting: boolean;
  styling: number | null;
  theme: EditorThemeConfig;
  onToggleSelect: (index: number, shiftKey: boolean) => void;
  onToggleCut: (index: number) => void;
  onStyle: (index: number | null) => void;
  renderStyleBar: (index: number) => React.ReactNode;
};

function PageSheet({
  page,
  number,
  total,
  palette,
  signature,
  pageNumbers,
  layout,
  scale,
  contentClass,
  fontFamily,
  cutting,
  styling,
  theme,
  onToggleSelect,
  onToggleCut,
  onStyle,
  renderStyleBar,
}: SheetProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ top: number; height: number }[]>([]);
  const [height, setHeight] = useState(0);
  const html = page.items.map((item) => item.html).join("");
  // 同一個物件才不會每次重畫都重設 innerHTML(會把下面加上去的狀態洗掉)
  const markup = useMemo(() => ({ __html: html }), [html]);

  // 每一段加上狀態(沒選的縮成一行淡淡的),每張的第一段不留上外距、最後一段不留下外距——跟轉圖一樣
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const live = page.items.map((item) => item.kind === "title" || item.selected);
    const first = live.indexOf(true);
    const last = live.lastIndexOf(true);
    // 每次都重新抓子元素:內容換過的話,舊的那批已經不在畫面上了
    const measure = () => {
      const children = Array.from(inner.children) as HTMLElement[];
      children.forEach((el, i) => {
        el.classList.toggle("export-skip", !live[i]);
        el.style.marginTop = i === first ? "0" : "";
        el.style.marginBottom = i === last ? "0" : "";
      });
      setHeight(inner.offsetHeight);
      setBoxes(children.map((el) => ({ top: el.offsetTop, height: el.offsetHeight })));
    };
    measure();
    // 字型晚一步載到、寬度改了,高度都會變
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [html, page.items, layout]);

  function childIndex(target: EventTarget | null): number {
    const inner = innerRef.current;
    let el = target instanceof Element ? target : null;
    while (el && el.parentElement !== inner) el = el.parentElement;
    return el && inner ? Array.prototype.indexOf.call(inner.children, el) : -1;
  }

  return (
    <div className="relative" style={{ height: height * scale, marginLeft: GUTTER_LEFT, marginRight: GUTTER_RIGHT }}>
      <div
        ref={innerRef}
        className={`${contentClass} export-sheet absolute left-0 top-0 rounded-[24px] shadow-md`}
        data-cutting={cutting ? "" : undefined}
        data-theme={palette.theme}
        style={{
          width: layout.width,
          minHeight: layout.pageHeight ?? undefined,
          padding: layout.padding,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          ...palette.vars,
          background: "var(--paper-bg)",
          color: "var(--ink-primary)",
          // 用 outline 不用 border:border 會吃掉內容寬度,換行就跟圖片不一樣了
          outline: `${1 / scale}px solid var(--border-light)`,
          fontFamily: getFontFamily(fontFamily),
          fontSize: layout.fontSize,
          lineHeight: layout.lineHeight,
          letterSpacing: layout.letterSpacing,
          // 跟轉圖一樣不擠壓相鄰的全形標點
          ["textSpacingTrim" as string]: "space-all",
          ["--sheet-scale" as string]: scale,
        }}
        onClick={(e) => {
          // 預覽裡的連結不要真的跳走
          if (e.target instanceof Element && e.target.closest("a")) e.preventDefault();
          const item = page.items[childIndex(e.target)];
          if (!item || item.kind !== "block") return;
          if (!item.selected) onToggleSelect(item.index, false);
          else if (cutting) onToggleCut(item.index);
        }}
        dangerouslySetInnerHTML={markup}
      />

      {(signature || (pageNumbers && total > 1)) && (
        <div
          aria-hidden
          data-theme={palette.theme}
          className="pointer-events-none absolute flex justify-between gap-4"
          style={{
            left: layout.padding * scale,
            right: layout.padding * scale,
            bottom: layout.footerBottom * scale,
            fontSize: layout.footerSize * scale,
            ...palette.vars,
            fontFamily: getFontFamily(fontFamily),
            lineHeight: 1.4,
            color: "var(--ink-tertiary)",
            background: "transparent",
          }}
        >
          <span>{signature}</span>
          <span>{pageNumbers && total > 1 ? `${number} / ${total}` : ""}</span>
        </div>
      )}

      {page.items.map((item, i) => {
        if (item.kind !== "block" || !boxes[i]) return null;
        const top = boxes[i].top * scale;
        return (
          <div key={item.index}>
            <input
              type="checkbox"
              className="absolute h-4 w-4"
              style={{ top: top + Math.max(0, Math.min(boxes[i].height * scale, 22) / 2 - 8), left: -GUTTER_LEFT + 6 }}
              checked={item.selected}
              onChange={() => undefined}
              onClick={(e) => onToggleSelect(item.index, e.shiftKey)}
              aria-label={`第 ${item.index + 1} 段`}
            />
            {item.selected && (
              <button
                type="button"
                onClick={() => onStyle(styling === item.index ? null : item.index)}
                aria-label={`第 ${item.index + 1} 段的樣式`}
                aria-expanded={styling === item.index}
                title="這一段置中、置右、加底色或底線"
                className={`absolute h-6 rounded-lg border px-1.5 text-[11px] leading-none ${theme.border} ${
                  styling === item.index || item.styled
                    ? `${theme.primaryButton} ${theme.primaryButtonText}`
                    : `${theme.secondaryButton} ${theme.secondaryButtonText}`
                }`}
                style={{ top: top + Math.max(0, Math.min(boxes[i].height * scale, 22) / 2 - 12), right: -GUTTER_RIGHT + 2 }}
              >
                Aa
              </button>
            )}
            {styling === item.index && (
              <div className="absolute z-10" style={{ top: top + boxes[i].height * scale + 4, left: -GUTTER_LEFT + 4, right: -GUTTER_RIGHT + 4 }}>
                {renderStyleBar(item.index)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExportPreview({
  pages,
  layout,
  contentClass,
  fontFamily,
  cutting,
  styling,
  theme,
  onToggleSelect,
  onToggleCut,
  onRemoveCut,
  onStyle,
  renderStyleBar,
  overLabel,
  palette,
  signature,
  pageNumbers,
}: Omit<SheetProps, "page" | "scale" | "number" | "total"> & {
  pages: PreviewPage[];
  onRemoveCut: (index: number) => void;
  /** 某一張超過單張上限時,標題列上的說明 */
  overLabel: (slices: number) => string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBoxWidth(box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // 紙最多顯示 560 寬:桌機上不要大到一頁看不到幾段
  const sheetWidth = Math.min(560, Math.max(120, boxWidth - GUTTER_LEFT - GUTTER_RIGHT));
  const scale = sheetWidth / layout.width;
  const many = pages.length > 1;
  // 每張從第幾號開始(太長、會在段落中間再切開的那張佔好幾號)
  const firstNumbers = pages.map((_, index) => 1 + pages.slice(0, index).reduce((sum, page) => sum + (page.size?.slices ?? 1), 0));
  const total = pages.reduce((sum, page) => sum + (page.size?.slices ?? 1), 0);

  return (
    <div ref={boxRef} className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 560 + GUTTER_LEFT + GUTTER_RIGHT }}>
      {boxWidth > 0 &&
        pages.map((page, index) => (
          <div key={index}>
            {(many || page.size) && (
              <div
                className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] leading-5"
                style={{ marginLeft: GUTTER_LEFT, color: page.size?.over ? "var(--danger, #c0392b)" : "var(--ink-tertiary)" }}
              >
                <span className="font-semibold">第 {index + 1} 張</span>
                {page.size && (
                  <span>
                    {page.size.width} × {page.size.height}
                    {page.size.over ? `・${overLabel(page.size.slices)}` : ""}
                  </span>
                )}
                {page.cutBefore !== null && (
                  <button
                    type="button"
                    onClick={() => onRemoveCut(page.cutBefore!)}
                    className={`ml-auto rounded-lg border px-2 text-[11px] ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
                  >
                    ✂ 不在這裡切
                  </button>
                )}
              </div>
            )}
            <PageSheet
              page={page}
              number={firstNumbers[index]}
              total={total}
              palette={palette}
              signature={signature}
              pageNumbers={pageNumbers}
              layout={layout}
              scale={scale}
              contentClass={contentClass}
              fontFamily={fontFamily}
              cutting={cutting}
              styling={styling}
              theme={theme}
              onToggleSelect={onToggleSelect}
              onToggleCut={onToggleCut}
              onStyle={onStyle}
              renderStyleBar={renderStyleBar}
            />
          </div>
        ))}
    </div>
  );
}
