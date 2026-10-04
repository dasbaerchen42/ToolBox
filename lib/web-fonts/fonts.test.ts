import { loadableFamilies } from "./index";

describe("要下載的字體", () => {
  it("去掉通用字族與 next/font 的 Fallback 別名,重複的只留一個", () => {
    expect(loadableFamilies(`"LXGW WenKai TC", "LXGW WenKai TC Fallback", "LXGW WenKai TC", serif`)).toEqual(['"LXGW WenKai TC"']);
    expect(loadableFamilies(`'Noto Sans TC', 'Noto Sans TC Fallback', system-ui, sans-serif`)).toEqual(["'Noto Sans TC'"]);
    expect(loadableFamilies("monospace")).toEqual([]);
  });
});
