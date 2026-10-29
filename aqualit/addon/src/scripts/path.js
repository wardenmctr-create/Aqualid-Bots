// Aqualit Robotları — blok ızgarasında A* yol bulma (jeneratör: işi tiklere böler)
import { V, DIRS4, safe } from "./util.js";
import { Budget } from "./budget.js";
import { isPassableType, isSupportType, isWater, isDanger, isClimb, isLava } from "./blocks.js";

class Heap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Blok türü önbelleği olan ızgara görünümü. */
export class Grid {
  constructor(dim) {
    this.dim = dim;
    this.cache = new Map();
    this.blocked = new Set(); // sandık vb. varlıkların durduğu hücreler
    this.allowDig = null; // (p, type) => bool : madenci tünel açarken
  }
  type(p) {
    const k = V.key(p);
    let t = this.cache.get(k);
    if (t !== undefined) return t;
    t = safe(() => this.dim.getBlock(p)?.typeId, null) ?? null;
    this.cache.set(k, t);
    return t;
  }
  invalidate(p) {
    this.cache.delete(V.key(p));
  }
  passable(p) {
    if (this.blocked.has(V.key(p))) return false;
    const t = this.type(p);
    if (t === null) return false;
    if (isDanger(t)) return false;
    return isPassableType(t);
  }
  support(p) {
    const t = this.type({ x: p.x, y: p.y - 1, z: p.z });
    if (t === null) return false;
    if (isDanger(t) && !t.endsWith("magma")) return false;
    return isSupportType(t);
  }
  standable(p) {
    if (!this.passable(p)) return false;
    const t = this.type(p);
    if (isWater(t) || isClimb(t)) return true;
    if (this.support(p)) return true;
    const below = this.type({ x: p.x, y: p.y - 1, z: p.z });
    return below !== null && (isWater(below) || isClimb(below));
  }
  nearLava(p) {
    for (const d of [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
      { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }]) {
      const t = this.type(V.add(p, d));
      if (t && isLava(t)) return true;
    }
    return false;
  }
}

const UP = { x: 0, y: 1, z: 0 };

/** Bir hücreden gidilebilecek komşular: [hücre, maliyet] */
export function neighbors(g, c) {
  const out = [];
  const ct = g.type(c);
  const inFluid = ct && (isWater(ct) || isClimb(ct));
  for (const d of DIRS4) {
    const n = V.add(c, d);
    const same = g.standable(n);
    if (same) out.push([n, isWater(g.type(n)) ? 2.5 : 1]);
    if (same && !g.digMode) continue;
    // bir basamak yukarı
    const up = V.add(n, UP);
    if (g.passable(V.add(c, UP)) && g.standable(up)) out.push([up, 2.2]);
    // aşağı in (en fazla 3 blok)
    if (g.passable(n)) {
      for (let k = 1; k <= 3; k++) {
        const dn = { x: n.x, y: n.y - k, z: n.z };
        if (!g.passable(dn)) break;
        if (g.standable(dn)) {
          out.push([dn, 1 + k * 0.6]);
          break;
        }
      }
    }
  }
  // suda / merdivende dikey hareket
  if (inFluid) {
    const u = V.add(c, UP);
    if (g.passable(u)) out.push([u, 1.6]);
  }
  const dn = { x: c.x, y: c.y - 1, z: c.z };
  const dt = g.type(dn);
  if (dt && (isWater(dt) || isClimb(dt)) && g.passable(dn)) out.push([dn, 1.6]);
  return out;
}

/**
 * A* jeneratörü. goal(p) => bool, h(p) => tahmini maliyet.
 * opts: {maxNodes, perTick, radius, center}
 * Dönen değer: hücre dizisi (başlangıç dahil) ya da null.
 */
export function* findPath(g, start, goal, h, opts = {}) {
  const maxNodes = opts.maxNodes ?? 3000;
  const perTick = opts.perTick ?? 250;
  const radius = opts.radius ?? 48;
  const center = opts.center ?? start;
  const r2 = radius * radius;
  const open = new Heap();
  const best = new Map();
  const startNode = { p: start, g: 0, f: h(start), prev: null };
  open.push(startNode);
  best.set(V.key(start), 0);
  let n = 0;
  let closest = startNode;
  let closestH = h(start);
  while (open.size) {
    const cur = open.pop();
    const ck = V.key(cur.p);
    if (cur.g > (best.get(ck) ?? Infinity)) continue;
    if (goal(cur.p)) return build(cur);
    const ch = h(cur.p);
    if (ch < closestH) {
      closestH = ch;
      closest = cur;
    }
    if (++n > maxNodes) break;
    if (n % perTick === 0 || ((n & 15) === 0 && Budget.over())) yield;
    for (const [np, cost] of neighbors(g, cur.p)) {
      if (V.dist2(np, center) > r2) continue;
      const k = V.key(np);
      const ng = cur.g + cost + (opts.extraCost ? opts.extraCost(np, cur.p) : 0);
      if (ng < (best.get(k) ?? Infinity)) {
        best.set(k, ng);
        open.push({ p: np, g: ng, f: ng + h(np) * 1.15, prev: cur });
      }
    }
  }
  if (opts.partial && closest !== startNode) return build(closest);
  return null;
}

function build(node) {
  const out = [];
  for (let n = node; n; n = n.prev) out.push(n.p);
  return out.reverse();
}

/** Robotun bir bloğu kazabileceği/ulaşabileceği hücre mi? (yan, üst, alt komşu) */
export function canReach(cell, b) {
  const dx = Math.abs(cell.x - b.x), dz = Math.abs(cell.z - b.z), dy = b.y - cell.y;
  if (dx + dz === 1 && (dy === 0 || dy === 1 || dy === -1)) return true;
  if (dx === 0 && dz === 0 && (dy === -1 || dy === 1)) return true;
  if (dx === 1 && dz === 1 && dy === 0) return true;
  return false;
}
