import { formatDateTime24h, formatShortDateTime } from "./datetime";

describe("datetime", () => {
  const now = new Date(2026, 9, 23, 15, 0);

  it("完整時間是 24 小時制", () => {
    expect(formatDateTime24h(new Date(2026, 9, 23, 3, 7).toISOString())).toBe("2026-10-23 03:07");
  });

  it("短時間:今天只寫時分、今年寫月日、其他年份寫年月日", () => {
    expect(formatShortDateTime(new Date(2026, 9, 23, 3, 7).toISOString(), now)).toBe("03:07");
    expect(formatShortDateTime(new Date(2026, 9, 22, 22, 41).toISOString(), now)).toBe("10/22 22:41");
    expect(formatShortDateTime(new Date(2025, 0, 5, 9, 0).toISOString(), now)).toBe("2025/01/05");
  });

  it("讀不懂的字串原樣回傳", () => {
    expect(formatShortDateTime("nope", now)).toBe("nope");
  });
});
