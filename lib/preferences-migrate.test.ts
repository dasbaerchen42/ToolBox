import { defaultPreferences } from "./preferences";
import { migratePreferences, PER_LINE_MAX, PER_LINE_MIN } from "./preferences-migrate";
import { PRESETS } from "./theme-core";

describe("編輯器偏好:舊版轉圖設定換成新的", () => {
  it("沒有存過或壞掉就用預設值", () => {
    expect(migratePreferences(null)).toEqual(defaultPreferences);
    expect(migratePreferences("x")).toEqual(defaultPreferences);
  });

  it("寬度拿掉,字級四段換成一行幾個字", () => {
    const out = migratePreferences({ exportImageWidth: 600, exportTextSize: "xl" }) as unknown as Record<string, unknown>;
    expect("exportImageWidth" in out).toBe(false);
    expect("exportTextSize" in out).toBe(false);
    expect(out.exportPerLine).toBe(16);
    expect(migratePreferences({ exportPerLine: 99 }).exportPerLine).toBe(PER_LINE_MAX);
    expect(migratePreferences({ exportPerLine: 2 }).exportPerLine).toBe(PER_LINE_MIN);
  });

  it("比例與分頁併成一個切頁選單:有比例用比例,手動留手動,一律單張變自動", () => {
    expect(migratePreferences({ exportRatio: "9:16", exportPaginate: "none" }).exportPages).toBe("9:16");
    expect(migratePreferences({ exportRatio: "free", exportPaginate: "manual" }).exportPages).toBe("manual");
    expect(migratePreferences({ exportRatio: "free", exportPaginate: "none" }).exportPages).toBe("auto");
    expect(migratePreferences({ exportPages: "4:5", exportRatio: "1:1" }).exportPages).toBe("4:5");
    const out = migratePreferences({ exportRatio: "1:1", exportPaginate: "auto" }) as unknown as Record<string, unknown>;
    expect("exportRatio" in out || "exportPaginate" in out).toBe(false);
  });

  it("以前挑某個主題配色的,換成自選並帶入那個主題的顏色", () => {
    const preset = PRESETS[1];
    const out = migratePreferences({ exportPalette: preset.id });
    expect(out.exportPalette).toBe("custom");
    expect(out.exportCustomBg).toBe(preset.input.bg);
    expect(out.exportCustomInk).toBe(preset.input.ink);
    expect(migratePreferences({ exportPalette: "gone" }).exportPalette).toBe("site");
    expect(migratePreferences({ exportPalette: "custom", exportCustomBg: "#123456" }).exportCustomBg).toBe("#123456");
  });
});
