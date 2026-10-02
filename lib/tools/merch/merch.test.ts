import { clampPlacement, defaultDesigns, placeSticker } from "./design";
import { acrylicImageQuad } from "./render";
import { eraseCircle, eraseSelection, opaqueBounds, wandSelect, type Pixels } from "../image/wand";
import {
  applyHomography,
  homography,
  isConvex,
  rectQuad,
  triangleAffine,
  type Quad,
} from "./perspective";
import {
  bodyFromCells,
  containerDistance,
  kineticEnergy,
  partPosition,
  step,
  type Body,
  type Container,
} from "./physics";

function image(width: number, height: number, paint: (x: number, y: number) => number[]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(paint(x, y), (y * width + x) * 4);
  return { width, height, data };
}

const alphaAt = (px: { data: Uint8ClampedArray; width: number }, data: Uint8ClampedArray, x: number, y: number) =>
  data[(y * px.width + x) * 4 + 3];

describe("wand:魔術棒", () => {
  // 白底中間一個紅方塊,方塊右下角連著一條很淡的灰(容許值內)
  const px = image(10, 10, (x, y) =>
    x >= 3 && x <= 6 && y >= 3 && y <= 6 ? [220, 30, 30, 255] : x === 9 ? [240, 240, 240, 255] : [255, 255, 255, 255]
  );

  it("點背景:相連的相近顏色都選進來,紅方塊不選", () => {
    const mask = wandSelect(px, 0, 0, 0.1);
    expect(mask[0]).toBe(1);
    expect(mask[9]).toBe(1); // 淡灰在容許值內
    expect(mask[4 * 10 + 4]).toBe(0);
  });

  it("容許值 0 只選完全一樣的顏色", () => {
    const mask = wandSelect(px, 0, 0, 0);
    expect(mask[9]).toBe(0);
  });

  it("不相連的同色不會被選到", () => {
    // 紅框裡包著一塊白:從外面點,裡面那塊白不選
    const ring = image(7, 7, (x, y) =>
      (x === 1 || x === 5 || y === 1 || y === 5) && x >= 1 && x <= 5 && y >= 1 && y <= 5
        ? [200, 0, 0, 255]
        : [255, 255, 255, 255]
    );
    const mask = wandSelect(ring, 0, 0, 0.05);
    expect(mask[3 * 7 + 3]).toBe(0);
    expect(mask[0]).toBe(1);
  });

  it("清掉選區;羽化讓外緣一圈半透明", () => {
    const mask = wandSelect(px, 0, 0, 0.1);
    const hard = eraseSelection(px, mask, 0);
    expect(alphaAt(px, hard, 0, 0)).toBe(0);
    expect(alphaAt(px, hard, 3, 3)).toBe(255);

    // 羽化 1 格:只有緊貼選區的那一圈變淡(紅方塊只有 4×4,寬一點就整塊都在外緣裡)
    const soft = eraseSelection(px, mask, 1);
    const edge = alphaAt(px, soft, 3, 3);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(alphaAt(px, soft, 5, 5)).toBe(255); // 離邊緣夠遠的地方不受影響
  });

  it("點在範圍外什麼都不選", () => {
    expect(wandSelect(px, -1, 50, 0.5).some(Boolean)).toBe(false);
  });

  it("橡皮擦清掉圓形範圍;外框找得到剩下的部分", () => {
    const copy = { ...px, data: new Uint8ClampedArray(px.data) };
    eraseCircle(copy, 0, 0, 2);
    expect(copy.data[3]).toBe(0);
    expect(copy.data[(9 * 10 + 9) * 4 + 3]).toBe(255);

    const cleared = { ...px, data: eraseSelection(px, wandSelect(px, 0, 0, 0.1), 0) };
    expect(opaqueBounds(cleared)).toEqual({ x: 3, y: 3, width: 4, height: 4 });
    expect(opaqueBounds({ ...px, data: new Uint8ClampedArray(px.data.length) })).toBeNull();
  });
});

describe("perspective:透視", () => {
  const src = rectQuad(0, 0, 100, 50);
  const dst: Quad = [
    { x: 10, y: 20 },
    { x: 120, y: 5 },
    { x: 130, y: 90 },
    { x: 0, y: 70 },
  ];

  it("四個角對到四個角", () => {
    const h = homography(src, dst);
    src.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });

  it("沒有變形時就是原地", () => {
    const h = homography(src, src);
    const q = applyHomography(h, { x: 37, y: 12 });
    expect(q.x).toBeCloseTo(37, 6);
    expect(q.y).toBeCloseTo(12, 6);
  });

  it("拖成蝴蝶結或三點共線就不算凸四邊形", () => {
    expect(isConvex(dst)).toBe(true);
    expect(isConvex([dst[0], dst[2], dst[1], dst[3]])).toBe(false);
    expect(isConvex([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
  });

  it("三角形仿射:三個頂點對得上", () => {
    const s = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    const d = [{ x: 5, y: 5 }, { x: 25, y: 8 }, { x: 3, y: 30 }];
    const [a, b, c, dd, e, f] = triangleAffine(s[0], s[1], s[2], d[0], d[1], d[2]);
    s.forEach((p, i) => {
      expect(a * p.x + c * p.y + e).toBeCloseTo(d[i].x, 6);
      expect(b * p.x + dd * p.y + f).toBeCloseTo(d[i].y, 6);
    });
  });
});

describe("physics:搖搖吊飾", () => {
  const star = [-1, 0, -1, 0, 0, 0, -1, 0, -1]; // 3×3 的十字
  const box: Container = { kind: "rect", cx: 100, cy: 100, hw: 80, hh: 80, round: 10 };

  it("剛體由有豆子的格子組成,重心在中間", () => {
    const body = bodyFromCells(star, 3, 3, 10)!;
    expect(body.parts).toHaveLength(5);
    expect(body.mass).toBe(5);
    const cx = body.parts.reduce((s, p) => s + p.dx, 0);
    expect(cx).toBeCloseTo(0, 6);
    expect(bodyFromCells([-1, -1], 2, 1, 10)).toBeNull();
  });

  it("容器的帶號距離:裡面負、外面正", () => {
    expect(containerDistance(box, { x: 100, y: 100 })).toBeLessThan(0);
    expect(containerDistance(box, { x: 300, y: 100 })).toBeGreaterThan(0);
    expect(containerDistance({ kind: "circle", cx: 0, cy: 0, r: 10 }, { x: 10, y: 0 })).toBeCloseTo(0, 6);
  });

  function drop(count: number): Body[] {
    const bodies: Body[] = [];
    for (let k = 0; k < count; k += 1) {
      const body = bodyFromCells(star, 3, 3, 10)!;
      body.x = 70 + k * 25;
      body.y = 60;
      body.av = k % 2 ? 1 : -1;
      bodies.push(body);
    }
    return bodies;
  }

  it("在重力下落到底、停下來,而且都還在容器裡", () => {
    const bodies = drop(3);
    for (let i = 0; i < 600; i += 1) step(bodies, box, 1 / 60, { gravity: { x: 0, y: 900 } });

    expect(kineticEnergy(bodies)).toBeLessThan(50);
    for (const body of bodies) {
      expect(body.y).toBeGreaterThan(130); // 掉到下半部
      for (const part of body.parts) {
        expect(containerDistance(box, partPosition(body, part))).toBeLessThan(part.r * 0.5);
      }
    }
  });

  it("零件之間不會疊在一起", () => {
    const bodies = drop(4);
    for (let i = 0; i < 600; i += 1) step(bodies, box, 1 / 60, { gravity: { x: 0, y: 900 } });
    for (let i = 0; i < bodies.length; i += 1) {
      for (let k = i + 1; k < bodies.length; k += 1) {
        for (const pa of bodies[i].parts) {
          for (const pb of bodies[k].parts) {
            const a = partPosition(bodies[i], pa);
            const b = partPosition(bodies[k], pb);
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan((pa.r + pb.r) * 0.7);
          }
        }
      }
    }
  });

  it("搖一下:零件會被甩起來", () => {
    const bodies = drop(1);
    for (let i = 0; i < 300; i += 1) step(bodies, box, 1 / 60, { gravity: { x: 0, y: 900 } });
    const before = bodies[0].y;
    step(bodies, box, 1 / 60, { gravity: { x: 0, y: 900 }, shake: { x: 0, y: -60000 } });
    for (let i = 0; i < 3; i += 1) step(bodies, box, 1 / 60, { gravity: { x: 0, y: 900 } });
    expect(bodies[0].y).toBeLessThan(before);
  });
});

describe("design:貼紙擺法與打卡棒的透視延伸", () => {
  it("新貼紙錯開放,不會疊在同一點;拖曳夾在設計區附近", () => {
    const first = placeSticker([], "a");
    const second = placeSticker([first], "b");
    expect(first.x).toBeCloseTo(0.5);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(0.1);
    expect(clampPlacement(2, -1)).toEqual({ x: 1.05, y: -0.05 });
  });

  it("打卡棒:板子的四個角不變,握把沿同一個透視往下延伸", () => {
    const design = { ...defaultDesigns().acrylic, mode: "stick" as const };
    const board: Quad = [
      { x: 100, y: 120 },
      { x: 500, y: 100 },
      { x: 520, y: 400 },
      { x: 90, y: 430 },
    ];
    const quad = acrylicImageQuad(design, board)!;
    expect(quad[0].x).toBeCloseTo(100, 6);
    expect(quad[1].y).toBeCloseTo(100, 6);
    expect(quad[2].y).toBeGreaterThan(400);
    expect(quad[3].y).toBeGreaterThan(430);
    // 透卡沒有握把:就是板子本身
    expect(acrylicImageQuad(defaultDesigns().acrylic, board)).toBe(board);
  });
});
