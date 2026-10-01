"use client";

import type { Symmetry } from "@/lib/tools/beads/edit";
import { MATERIALS } from "@/lib/tools/beads/finish";
import type { BeadColor } from "@/lib/tools/beads/palette";
import type { ThemeClasses } from "@/lib/theme";
import { Field, Segmented } from "../../image/_components/controls";

export type EditTool = "pen" | "eraser" | "fill" | "picker" | "material";

type Props = {
  palette: BeadColor[];
  tool: EditTool;
  color: number;
  material: number;
  symmetry: Symmetry;
  canUndo: boolean;
  canRedo: boolean;
  t: ThemeClasses;
  onTool: (tool: EditTool) => void;
  onColor: (color: number) => void;
  onMaterial: (material: number) => void;
  /** 整幅作品都換成目前的材質 */
  onMaterialAll: () => void;
  onSymmetry: (symmetry: Symmetry) => void;
  onUndo: () => void;
  onRedo: () => void;
};

const TOOL_HINTS: Record<EditTool, string> = {
  pen: "點一下放一顆，按住拖曳連續放",
  eraser: "把豆子拿掉，留下空格",
  fill: "相連的同色區塊整片換成目前的顏色（空格也算一種顏色）",
  picker: "點板子上的豆子，取它的顏色與材質來用",
  material: "只改材質不改顏色，例如眼睛用亮粉、背景用霧面",
};

/** 工具列 + 色盤:只在底圖(編輯)階段出現 */
export default function EditPanel({
  palette,
  tool,
  color,
  material,
  symmetry,
  canUndo,
  canRedo,
  t,
  onTool,
  onColor,
  onMaterial,
  onMaterialAll,
  onSymmetry,
  onUndo,
  onRedo,
}: Props) {
  const current = palette[color];

  return (
    <div className={`space-y-4 border-t pt-4 ${t.divider}`}>
      <Field label="工具" hint={TOOL_HINTS[tool]} t={t}>
        <Segmented
          value={tool}
          onChange={onTool}
          t={t}
          label="工具"
          options={[
            { value: "pen", label: "畫筆" },
            { value: "eraser", label: "橡皮擦" },
            { value: "fill", label: "油漆桶" },
            { value: "picker", label: "滴管" },
            { value: "material", label: "材質筆" },
          ]}
        />
      </Field>

      <Field
        label="材質"
        hint={`${MATERIALS[material].hint}。畫筆、油漆桶、材質筆都用這個材質；不是霧面的格子在底圖上會有一個小白點`}
        t={t}
      >
        <Segmented
          value={String(material)}
          onChange={(value) => onMaterial(Number(value))}
          t={t}
          label="材質"
          options={MATERIALS.map((item) => ({ value: String(item.id), label: item.label }))}
        />
        <button
          type="button"
          onClick={onMaterialAll}
          className={`self-start rounded-xl border px-3 py-1.5 text-xs transition ${t.secondary}`}
        >
          整幅都換成「{MATERIALS[material].label}」
        </button>
      </Field>

      <Field label="對稱" t={t}>
        <Segmented
          value={symmetry}
          onChange={onSymmetry}
          t={t}
          label="對稱"
          options={[
            { value: "none", label: "不對稱" },
            { value: "x", label: "左右" },
            { value: "y", label: "上下" },
            { value: "both", label: "四向" },
          ]}
        />
      </Field>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="復原（Ctrl / ⌘ + Z）"
          className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
        >
          復原
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="重做（Ctrl / ⌘ + Shift + Z）"
          className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
        >
          重做
        </button>
      </div>

      <div role="group" aria-label="豆子顏色" className="flex flex-col gap-1.5">
        <span className="flex items-baseline gap-2 text-xs tracking-[0.08em]">
          顏色
          <span className={`text-[11px] ${t.muted}`}>
            {current.code}・{current.name} {current.reading}
          </span>
        </span>
        <div className="grid grid-cols-10 gap-1">
          {palette.map((item, index) => (
            <button
              key={item.code}
              type="button"
              onClick={() => onColor(index)}
              aria-pressed={index === color}
              aria-label={`${item.name}（${item.reading}）`}
              title={`${item.code} ${item.name} ${item.reading}`}
              className={`aspect-square w-full rounded-full border transition ${
                index === color
                  ? "scale-110 border-(--ink-primary) ring-2 ring-(--accent)"
                  : "border-(--border-light) hover:scale-110"
              }`}
              style={{ background: item.hex }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
