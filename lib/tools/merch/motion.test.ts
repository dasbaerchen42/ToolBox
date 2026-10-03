import { charmGeometry } from "./render";
import { defaultDesigns, DESIGN_SIZE } from "./design";
import {
  acrylicWobble,
  cardLaserAngle,
  charmPieceOffsets,
  charmSwing,
  frameCount,
  frameT,
  omamoriSway,
} from "./motion";
import { bodyFromCells, containerDistance, partPosition, type Body, type Container } from "./physics";

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe("merch:循環路徑", () => {
  it("一圈的格數與每格的位置:最後一格的下一格就是第 0 格", () => {
    expect(frameCount(15, 2.4)).toBe(36);
    expect(frameT(0, 36)).toBe(0);
    expect(frameT(35, 36)).toBeCloseTo(35 / 36);
    expect(frameT(36, 36)).toBe(0);
  });

  it("每條路徑都是週期函式:t=0 與 t=1 一樣", () => {
    for (const f of [cardLaserAngle, omamoriSway, charmSwing]) close(f(0), f(1));
    const corners = defaultDesigns().acrylic.corners;
    const a = acrylicWobble(corners, 0);
    const b = acrylicWobble(corners, 1);
    a.forEach((p, i) => {
      close(p.x, b[i].x);
      close(p.y, b[i].y);
    });
  });

  it("透卡晃動幅度小:每個角移動不到 5%", () => {
    const corners = defaultDesigns().acrylic.corners;
    for (let i = 0; i < 20; i += 1) {
      acrylicWobble(corners, i / 20).forEach((p, k) => {
        expect(Math.hypot(p.x - corners[k].x, p.y - corners[k].y)).toBeLessThan(0.05);
      });
    }
  });
});

describe("merch:吊飾零件的循環", () => {
  const { width: W, height: H } = DESIGN_SIZE.charm;
  const design = defaultDesigns().charm;
  const { inner } = charmGeometry(design, W, H);
  const box = inner as Container;
  const bottom = inner.kind === "circle" ? inner.cy + inner.r : inner.cy + inner.hh;

  // 一顆 3×3 的方塊躺在底上(剛好貼著底邊),一顆浮在中間
  const square = (x: number, y: number): Body => {
    const body = bodyFromCells([0, 0, 0, 0, 0, 0, 0, 0, 0], 3, 3, 16)!;
    body.x = x;
    body.y = y;
    return body;
  };
  const resting = square(W / 2, bottom - 24);
  const floating = square(W / 2 + 40, inner.cy);

  const inside = (body: Body) =>
    body.parts.every((part) => containerDistance(box, partPosition(body, part)) + part.r <= 0.5);

  it("整圈任何一格都不會穿出容器", () => {
    expect(inside(resting) && inside(floating)).toBe(true);
    for (let i = 0; i < 60; i += 1) {
      const offsets = charmPieceOffsets([resting, floating], box, i / 60);
      [resting, floating].forEach((body, k) => {
        const moved = { ...body, x: body.x + offsets[k].dx, y: body.y + offsets[k].dy, angle: body.angle + offsets[k].dAngle };
        expect(inside(moved)).toBe(true);
      });
    }
  });

  it("躺在底上的零件也會動(只往上抬,不會被壓進底邊),而且接得回第一格", () => {
    const moves = Array.from({ length: 12 }, (_, i) => charmPieceOffsets([resting], box, i / 12)[0]);
    expect(Math.max(...moves.map((m) => Math.abs(m.dx)))).toBeGreaterThan(1);
    expect(moves.every((m) => m.dy <= 1e-9)).toBe(true);
    const [first] = charmPieceOffsets([resting], box, 0);
    const [wrap] = charmPieceOffsets([resting], box, 1);
    close(first.dx, wrap.dx);
    close(first.dy, wrap.dy);
    close(first.dAngle, wrap.dAngle);
  });
});
