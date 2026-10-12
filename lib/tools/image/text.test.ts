import { dragHandle, handlePoint, hitTextLayer, layoutTextLayer, newTextLayer } from "./text";

/** 假的量字:每個字寬 = 字級 */
const measureFor = (size: number) => (text: string) => ({ width: [...text].length * size });

describe("放字:排版", () => {
  const image = { width: 1000, height: 800 };

  it("新的一段字放在點的位置,字級照短邊抓", () => {
    const layer = newTextLayer("a", { x: 300, y: 200 }, image);
    expect(layer).toMatchObject({ x: 300, y: 200, size: 56 });
  });

  it("多行:寬度取最寬那行、高度是行數乘行高,有底色時加內距", () => {
    const layer = { ...newTextLayer("a", { x: 0, y: 0 }, image), size: 20, text: "一二三\n四" };
    const plain = layoutTextLayer(layer, measureFor(20));
    expect(plain.width).toBe(60);
    expect(plain.height).toBeCloseTo(2 * 20 * 1.3);
    const boxed = layoutTextLayer({ ...layer, backdrop: "line" }, measureFor(20));
    expect(boxed.width).toBeGreaterThan(60);
  });

  it("點在字上(含旋轉)才算點到", () => {
    const layer = { ...newTextLayer("a", { x: 500, y: 400 }, image), size: 20, text: "一二三四五" };
    const box = layoutTextLayer(layer, measureFor(20));
    expect(hitTextLayer(layer, box, { x: 540, y: 400 })).toBe(true);
    expect(hitTextLayer(layer, box, { x: 500, y: 450 })).toBe(false);
    // 轉 90 度之後,原本橫的那條變直的
    const turned = { ...layer, rotation: 90 };
    expect(hitTextLayer(turned, box, { x: 500, y: 440 })).toBe(true);
    expect(hitTextLayer(turned, box, { x: 540, y: 400 })).toBe(false);
  });

  it("拖把手:拉遠變大、繞中心轉", () => {
    const layer = { ...newTextLayer("a", { x: 0, y: 0 }, image), size: 40, rotation: 0 };
    const box = { width: 100, height: 40 };
    const start = handlePoint(layer, box);
    expect(start).toEqual({ x: 50, y: 20 });
    // 拉到兩倍遠:字級兩倍、角度不變
    expect(dragHandle(layer, layer, start, { x: 100, y: 40 })).toEqual({ size: 80, rotation: 0 });
    // 繞中心轉 90 度
    const turned = dragHandle(layer, layer, start, { x: -20, y: 50 });
    expect(turned.rotation).toBeCloseTo(90, 0);
    expect(turned.size).toBe(40);
  });
});
