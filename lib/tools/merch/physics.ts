// 搖搖吊飾裡的小零件:會碰撞、翻滾的剛體。
//
// 碰撞形狀直接由有豆子的格子算出——每一顆豆子是一個小圓,整個零件是一群小圓,
// 星星就會照星星的形狀滾。容器(壓克力外框)用帶號距離函式描述:裡面是負的。
// 全部是純函式與純資料,不碰 canvas,才能測。

export type Vec = { x: number; y: number };

/** 零件上的一顆豆子:相對重心的位置與半徑 */
export type Part = { dx: number; dy: number; r: number };

export type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  av: number;
  mass: number;
  inertia: number;
  parts: Part[];
  /** 包住所有小圓的半徑,碰撞前先粗篩 */
  radius: number;
};

export type Container =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; cx: number; cy: number; hw: number; hh: number; round: number };

/** 有豆子的格子 → 剛體(重心在原點,質量 = 豆子數) */
export function bodyFromCells(cells: number[], cols: number, rows: number, cell: number): Body | null {
  const points: Vec[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] < 0) continue;
    points.push({ x: ((i % cols) + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell });
  }
  if (points.length === 0 || rows <= 0) return null;

  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const r = cell * 0.5;
  const parts = points.map((p) => ({ dx: p.x - cx, dy: p.y - cy, r }));
  // 每顆豆子當作質量 1 的小圓盤:自己的轉動慣量 + 平行軸
  const inertia = parts.reduce((sum, p) => sum + 0.5 * r * r + p.dx * p.dx + p.dy * p.dy, 0);
  const radius = Math.max(...parts.map((p) => Math.hypot(p.dx, p.dy) + p.r));

  return { x: 0, y: 0, vx: 0, vy: 0, angle: 0, av: 0, mass: parts.length, inertia, parts, radius };
}

/** 小圓在世界座標的位置 */
export function partPosition(body: Body, part: Part): Vec {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  return { x: body.x + part.dx * c - part.dy * s, y: body.y + part.dx * s + part.dy * c };
}

/** 帶號距離:點在容器裡面是負的,剛好在邊上是 0 */
export function containerDistance(container: Container, p: Vec): number {
  if (container.kind === "circle") {
    return Math.hypot(p.x - container.cx, p.y - container.cy) - container.r;
  }
  const { cx, cy, hw, hh, round } = container;
  const qx = Math.abs(p.x - cx) - (hw - round);
  const qy = Math.abs(p.y - cy) - (hh - round);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - round;
}

/** 距離函式的梯度(朝外的法線),用中央差分算 */
function outwardNormal(container: Container, p: Vec): Vec {
  const e = 0.5;
  const nx = containerDistance(container, { x: p.x + e, y: p.y }) - containerDistance(container, { x: p.x - e, y: p.y });
  const ny = containerDistance(container, { x: p.x, y: p.y + e }) - containerDistance(container, { x: p.x, y: p.y - e });
  const length = Math.hypot(nx, ny) || 1;
  return { x: nx / length, y: ny / length };
}

/**
 * 在接觸點 p 沿法線 n(從 a 指向外/指向 b)施加衝量,讓相對速度不再往裡鑽。
 * b 為 null 時是撞容器(容器不會動)。
 */
function resolveContact(a: Body, b: Body | null, p: Vec, n: Vec, restitution: number, friction: number) {
  const ra = { x: p.x - a.x, y: p.y - a.y };
  const rb = b ? { x: p.x - b.x, y: p.y - b.y } : { x: 0, y: 0 };
  // 接觸點的速度
  const va = { x: a.vx - a.av * ra.y, y: a.vy + a.av * ra.x };
  const vb = b ? { x: b.vx - b.av * rb.y, y: b.vy + b.av * rb.x } : { x: 0, y: 0 };
  const rel = { x: va.x - vb.x, y: va.y - vb.y };
  const along = rel.x * n.x + rel.y * n.y;
  if (along <= 0) return; // 已經在分開了

  const raCn = ra.x * n.y - ra.y * n.x;
  const rbCn = rb.x * n.y - rb.y * n.x;
  const invMass = 1 / a.mass + (b ? 1 / b.mass : 0);
  const invInertia = (raCn * raCn) / a.inertia + (b ? (rbCn * rbCn) / b.inertia : 0);
  const j = ((1 + restitution) * along) / (invMass + invInertia);

  // 摩擦:沿切線方向扣掉一部分速度,讓零件會滾而不是滑
  const tangent = { x: rel.x - along * n.x, y: rel.y - along * n.y };
  const tLength = Math.hypot(tangent.x, tangent.y);
  const t = tLength > 1e-6 ? { x: tangent.x / tLength, y: tangent.y / tLength } : { x: 0, y: 0 };
  const raCt = ra.x * t.y - ra.y * t.x;
  const rbCt = rb.x * t.y - rb.y * t.x;
  const jt =
    Math.min(friction * j, tLength / (invMass + (raCt * raCt) / a.inertia + (b ? (rbCt * rbCt) / b.inertia : 0)));

  const ix = -(j * n.x + jt * t.x);
  const iy = -(j * n.y + jt * t.y);
  a.vx += ix / a.mass;
  a.vy += iy / a.mass;
  a.av += (ra.x * iy - ra.y * ix) / a.inertia;
  if (b) {
    b.vx -= ix / b.mass;
    b.vy -= iy / b.mass;
    b.av -= (rb.x * iy - rb.y * ix) / b.inertia;
  }
}

export type StepOptions = {
  gravity: Vec;
  /** 外力加速度(搖晃、拖動的那一下),只作用這一步 */
  shake?: Vec;
  restitution?: number;
  friction?: number;
  /** 空氣阻力,讓零件最後會停下來 */
  damping?: number;
};

/**
 * 往前推進 dt 秒。拆成幾個小步,碰撞比較不會穿透;
 * 每小步:加速度 → 位置 → 跟容器、跟彼此的碰撞(推開 + 衝量)。就地修改 bodies。
 */
export function step(bodies: Body[], container: Container, dt: number, options: StepOptions): void {
  const { gravity, shake = { x: 0, y: 0 }, restitution = 0.35, friction = 0.3, damping = 0.6 } = options;
  const substeps = 4;
  const h = dt / substeps;

  for (let s = 0; s < substeps; s += 1) {
    for (const body of bodies) {
      body.vx += (gravity.x + shake.x) * h;
      body.vy += (gravity.y + shake.y) * h;
      const keep = Math.max(0, 1 - damping * h);
      body.vx *= keep;
      body.vy *= keep;
      body.av *= keep;
      body.x += body.vx * h;
      body.y += body.vy * h;
      body.angle += body.av * h;
    }

    // 撞容器:每顆豆子各自檢查,鑽出去多少就推回來多少
    for (const body of bodies) {
      for (const part of body.parts) {
        const p = partPosition(body, part);
        const depth = containerDistance(container, p) + part.r;
        if (depth <= 0) continue;
        const n = outwardNormal(container, p);
        body.x -= n.x * depth;
        body.y -= n.y * depth;
        resolveContact(body, null, { x: p.x + n.x * part.r, y: p.y + n.y * part.r }, n, restitution, friction);
      }
    }

    // 零件彼此:先用外接圓粗篩,再逐顆豆子比
    for (let i = 0; i < bodies.length; i += 1) {
      for (let k = i + 1; k < bodies.length; k += 1) {
        const a = bodies[i];
        const b = bodies[k];
        if (Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius) continue;

        // 找最深的那一對豆子,只處理它(多對同時處理容易彈飛)
        let deepest = 0;
        let contact: { p: Vec; n: Vec } | null = null;
        const bPositions = b.parts.map((part) => ({ ...partPosition(b, part), r: part.r }));
        for (const pa of a.parts) {
          const p1 = partPosition(a, pa);
          for (const p2 of bPositions) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const d = Math.hypot(dx, dy);
            const overlap = pa.r + p2.r - d;
            if (overlap <= deepest || d < 1e-6) continue;
            deepest = overlap;
            const n = { x: dx / d, y: dy / d };
            contact = { p: { x: p1.x + n.x * pa.r, y: p1.y + n.y * pa.r }, n };
          }
        }
        if (!contact) continue;

        // 按質量比例推開
        const total = a.mass + b.mass;
        a.x -= contact.n.x * deepest * (b.mass / total);
        a.y -= contact.n.y * deepest * (b.mass / total);
        b.x += contact.n.x * deepest * (a.mass / total);
        b.y += contact.n.y * deepest * (a.mass / total);
        resolveContact(a, b, contact.p, contact.n, restitution, friction);
      }
    }
  }
}

/** 所有零件的動能(測試用:確認最後會停下來) */
export function kineticEnergy(bodies: Body[]): number {
  return bodies.reduce(
    (sum, b) => sum + 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy) + 0.5 * b.inertia * b.av * b.av,
    0
  );
}
