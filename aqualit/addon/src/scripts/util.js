// Aqualit Robotları — yardımcılar
import { system, world } from "@minecraft/server";

export const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  dist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2),
  dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2,
  hdist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2),
  floor: (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }),
  center: (b) => ({ x: b.x + 0.5, y: b.y, z: b.z + 0.5 }),
  mid: (b) => ({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }),
  eq: (a, b) => a.x === b.x && a.y === b.y && a.z === b.z,
  key: (p) => `${p.x},${p.y},${p.z}`,
  parse: (k) => {
    const [x, y, z] = k.split(",").map(Number);
    return { x, y, z };
  },
  manhattan: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z),
};

export const DIRS4 = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];
export const DIRS6 = [...DIRS4, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }];

/** Yönden yaw (Minecraft: 0 = güney/+Z, 90 = batı/-X). */
export function yawOf(dx, dz) {
  return (-Math.atan2(dx, dz) * 180) / Math.PI;
}

/** Jeneratör içinde n tik bekle. */
export function* wait(n = 1) {
  for (let i = 0; i < n; i++) yield;
}

export function rand(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
export function chance(p) {
  return Math.random() < p;
}
export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function safe(fn, fallback = undefined) {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
}

/** Async (Promise döndüren) işi güvenle başlatır: hatası oyunu bozmaz, kayda yazılır. */
export function fire(x, label = "arayüz") {
  try {
    const r = typeof x === "function" ? x() : x;
    if (r && typeof r.then === "function") r.catch((e) => log(`${label} hatası`, e, e?.stack));
    return r;
  } catch (e) {
    log(`${label} hatası`, e, e?.stack);
    return undefined;
  }
}

export function log(...a) {
  try {
    console.warn("[Aqualit]", ...a);
  } catch (e) {}
}

export function fmtPos(p) {
  return `${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}`;
}

const DIR_NAMES = ["Güney", "Güneybatı", "Batı", "Kuzeybatı", "Kuzey", "Kuzeydoğu", "Doğu", "Güneydoğu"];
const DIR_ARROWS = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
/** Oyuncuya göre yön (dünya yönü) ve ok. */
export function direction(from, to) {
  const yaw = yawOf(to.x - from.x, to.z - from.z);
  const idx = (((Math.round(yaw / 45) % 8) + 8) % 8);
  return { name: DIR_NAMES[idx], arrow: DIR_ARROWS[idx] };
}

export function dimName(id) {
  if (!id) return "?";
  if (id.includes("nether")) return "Nether";
  if (id.includes("end")) return "End";
  return "Dünya";
}

export function getDim(id) {
  return safe(() => world.getDimension(id));
}

/** Kısa benzersiz kimlik. */
export function shortId(prefix = "") {
  const s = Math.floor(Math.random() * 0xffffff).toString(36) + Date.now().toString(36).slice(-3);
  return prefix + s;
}

export function later(ticks, fn) {
  return system.runTimeout(() => safe(fn), ticks);
}

export function plural(n, word) {
  return `${n} ${word}`;
}

export function percent(a, b) {
  if (!b) return "0%";
  return `${Math.min(100, Math.floor((a * 100) / b))}%`;
}

export function bar(a, b, width = 10) {
  const f = b ? Math.min(width, Math.round((a * width) / b)) : 0;
  return "§a" + "|".repeat(f) + "§8" + "|".repeat(width - f) + "§r";
}
