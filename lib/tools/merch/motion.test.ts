import type { Quad } from "./perspective";
import {
  acrylicWobble,
  cardLaserAngle,
  frameCount,
  frameT,
  omamoriSway,
} from "./motion";

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe("merch:循環路徑", () => {
  it("一圈的格數與每格的位置:最後一格的下一格就是第 0 格", () => {
    expect(frameCount(15, 2.4)).toBe(36);
    expect(frameT(0, 36)).toBe(0);
    expect(frameT(35, 36)).toBeCloseTo(35 / 36);
    expect(frameT(36, 36)).toBe(0);
  });

  it("每條路徑都是週期函式:t=0 與 t=1 一樣", () => {
    for (const f of [cardLaserAngle, omamoriSway]) close(f(0), f(1));
    const corners: Quad = [
      { x: 0.2, y: 0.24 },
      { x: 0.82, y: 0.2 },
      { x: 0.84, y: 0.62 },
      { x: 0.18, y: 0.66 },
    ];
    const a = acrylicWobble(corners, 0);
    const b = acrylicWobble(corners, 1);
    a.forEach((p, i) => {
      close(p.x, b[i].x);
      close(p.y, b[i].y);
    });
  });

  it("透卡晃動幅度小:每個角移動不到 5%", () => {
    const corners: Quad = [
      { x: 0.2, y: 0.24 },
      { x: 0.82, y: 0.2 },
      { x: 0.84, y: 0.62 },
      { x: 0.18, y: 0.66 },
    ];
    for (let i = 0; i < 20; i += 1) {
      acrylicWobble(corners, i / 20).forEach((p, k) => {
        expect(Math.hypot(p.x - corners[k].x, p.y - corners[k].y)).toBeLessThan(0.05);
      });
    }
  });
});
