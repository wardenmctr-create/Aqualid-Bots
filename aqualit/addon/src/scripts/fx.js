// Aqualit Robotları — Kılıçlı güç efektleri (v0.2.5)
//
// Parçacıklar RP'de (gen/efekt.py): aqualit:simsek, zincir, kivilcim, sok_dalgasi, enerji_halka,
// kubbe_parilti, golge_duman, parlama. Yönlü parçacıklara yön/uzunluk MolangVariableMap ile verilir.
// Efekt varlığı aqualit:fx: "kubbe" (altıgen enerji kalkanı) ve "hayalet" (gölge adım izi).
// Hiçbiri bloklara dokunmaz: yangın, krater, gerçek yıldırım yok.
import { MolangVariableMap, world, system } from "@minecraft/server";
import { V, safe } from "./util.js";

export const FX_ID = "aqualit:fx";
const MAX_PER_TICK = 280; // tik başına en çok parçacık çağrısı (telefonları yormasın)
let used = 0;
let usedTick = -1;

export const rnd = () => Math.random() * 2 - 1;

function vars(o) {
  const m = new MolangVariableMap();
  for (const k in o) {
    const v = o[k];
    if (typeof v === "number") m.setFloat(`variable.${k}`, v);
    else m.setVector3(`variable.${k}`, v);
  }
  return m;
}

/** Tek parçacık yayıcısı (tik başına üst sınırlı). */
export function emit(dim, name, p, o) {
  const now = system.currentTick;
  if (now !== usedTick) {
    usedTick = now;
    used = 0;
  }
  if (used >= MAX_PER_TICK) return false;
  used++;
  return safe(() => {
    if (o) dim.spawnParticle(name, p, vars(o));
    else dim.spawnParticle(name, p);
    return true;
  }, false);
}

// ------------------------------------------------------------------ şimşek
/** a'dan c'ye orta nokta kaydırmalı zikzak (doğal yıldırım kırılmaları). */
export function zigzag(a, c, jit = 0.35, seg = 0.7) {
  const L = V.dist(a, c);
  const depth = Math.max(1, Math.min(5, Math.ceil(Math.log(Math.max(1.01, L / seg)) / Math.LN2)));
  let pts = [a, c];
  let off = jit * L * 0.5;
  for (let d = 0; d < depth; d++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      out.push({ x: (p.x + q.x) / 2 + rnd() * off, y: (p.y + q.y) / 2 + rnd() * off, z: (p.z + q.z) / 2 + rnd() * off }, q);
    }
    pts = out;
    off *= 0.55;
  }
  return pts;
}

function strand(dim, pts, kalin, omur) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    const d = V.sub(q, p);
    const L = V.len(d);
    if (L < 0.02) continue;
    emit(dim, "aqualit:simsek", V.mul(V.add(p, q), 0.5), { yon: V.mul(d, 1 / L), uzun: L, kalin, omur });
  }
}

/**
 * Şimşek çizer. o: jit (kırıklık), kalin (yarı kalınlık, blok), omur (sn), seg (parça boyu), dal (dal sayısı).
 * Çizilen ana yolun noktalarını döndürür.
 */
export function simsek(dim, a, c, o = {}) {
  const jit = o.jit ?? 0.35;
  const kalin = o.kalin ?? 0.08;
  const omur = o.omur ?? 0.16;
  const pts = zigzag(a, c, jit, o.seg ?? 0.7);
  strand(dim, pts, kalin, omur);
  const L = V.dist(a, c);
  for (let k = 0; k < (o.dal ?? 0) && pts.length > 4; k++) {
    const i = 1 + Math.floor(Math.random() * (pts.length - 3));
    const s = pts[i];
    const main = V.sub(pts[i + 2], s);
    const ml = V.len(main) || 1;
    const dir = { x: main.x / ml + rnd() * 0.9, y: main.y / ml + rnd() * 0.9, z: main.z / ml + rnd() * 0.9 };
    const dl = V.len(dir) || 1;
    const len = L * (0.12 + Math.random() * 0.2);
    strand(dim, zigzag(s, V.add(s, V.mul(dir, len / dl)), jit * 1.2, 0.5), kalin * 0.55, omur * 0.9);
  }
  return pts;
}

/** Gökten inen büyük yıldırım: kalın ana kol + ince ikinci kol + dallar. */
export function gokSimsegi(dim, ground, o = {}) {
  const h = o.yukseklik ?? 18;
  const k = o.kalin ?? 0.2;
  const top = { x: ground.x + rnd() * 2.5, y: ground.y + h, z: ground.z + rnd() * 2.5 };
  simsek(dim, top, ground, { jit: 0.28, kalin: k, omur: o.omur ?? 0.24, seg: 0.8, dal: o.dal ?? 4 });
  simsek(dim, { x: top.x + rnd(), y: top.y, z: top.z + rnd() }, ground, { jit: 0.42, kalin: k * 0.4, omur: 0.18, seg: 0.9 });
}

/** Elektrikli zincir: a'dan c'ye hafif sarkık, halka halka. */
export function zincir(dim, a, c, o = {}) {
  const L = V.dist(a, c);
  const n = Math.max(1, Math.min(14, Math.ceil(L / 1.4)));
  const sag = o.sarkma ?? Math.min(0.5, L * 0.04);
  const omur = o.omur ?? 0.14;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t - Math.sin(Math.PI * t) * sag, z: a.z + (c.z - a.z) * t };
    const d = V.sub(p, prev);
    const l = V.len(d);
    if (l > 0.02) emit(dim, "aqualit:zincir", V.mul(V.add(prev, p), 0.5), { yon: V.mul(d, 1 / l), uzun: l, omur });
    prev = p;
  }
}

// ------------------------------------------------------------------ küçük efektler
export const kivilcim = (dim, p) => emit(dim, "aqualit:kivilcim", p);
export const parlama = (dim, p, boy = 1.5) => emit(dim, "aqualit:parlama", p, { boy });
export const sokDalgasi = (dim, p, boy = 4) => emit(dim, "aqualit:sok_dalgasi", p, { boy });
export const enerjiHalka = (dim, p, boy = 0.9) => emit(dim, "aqualit:enerji_halka", p, { boy });
export const duman = (dim, p) => emit(dim, "aqualit:golge_duman", p);
export const parilti = (dim, p) => emit(dim, "aqualit:kubbe_parilti", p);

// ------------------------------------------------------------------ robot üzerindeki noktalar
function yawRad(b) {
  return (safe(() => b.e.getRotation().y, 0) * Math.PI) / 180;
}

/** Kılıcın ucu (yaklaşık): sağ elde, bakış yönünde; raised: kılıç göğe kalkmış. */
export function swordTip(b, raised = false) {
  const l = b.loc;
  const y = yawRad(b);
  const fx = -Math.sin(y), fz = Math.cos(y);   // ileri
  const rx = -Math.cos(y), rz = -Math.sin(y);  // sağ
  if (raised) return { x: l.x + rx * 0.3, y: l.y + 1.4, z: l.z + rz * 0.3 };
  return { x: l.x + fx * 0.45 + rx * 0.25, y: l.y + 0.55, z: l.z + fz * 0.45 + rz * 0.25 };
}

/** Öne uzanmış el (kanca fırlatma). */
export function handPos(b) {
  const l = b.loc;
  const y = yawRad(b);
  return { x: l.x - Math.sin(y) * 0.4 - Math.cos(y) * 0.25, y: l.y + 0.5, z: l.z + Math.cos(y) * 0.4 - Math.sin(y) * 0.25 };
}

/** Varlığın göğüs hizası (boyuna göre). */
export function chest(e) {
  const l = e.location;
  const h = safe(() => e.getHeadLocation().y - l.y, 1.4);
  return { x: l.x, y: l.y + Math.max(0.35, h * 0.72), z: l.z };
}

// ------------------------------------------------------------------ efekt varlığı
/** Efekt varlığı oluşturur: "kubbe" | "hayalet". */
export function fxSpawn(dim, kind, loc, yaw = 0) {
  return safe(() => dim.spawnEntity(FX_ID, loc, { initialRotation: yaw, spawnEvent: `aqualit:as_${kind}` }), null);
}

export function fxMove(e, loc) {
  if (e) safe(() => e.teleport(loc));
}

export function fxSize(e, k) {
  if (e) safe(() => e.setProperty("aqualit:boy", Math.max(0, Math.min(4, k))));
}

export function fxRemove(e) {
  if (e) safe(() => e.remove());
}

/** Dünya açılışında kalmış efekt varlıklarını temizler (betik onları artık tanımaz). */
export function fxCleanup() {
  for (const id of ["overworld", "nether", "the_end"]) {
    const dim = safe(() => world.getDimension(id));
    if (!dim) continue;
    for (const e of safe(() => dim.getEntities({ type: FX_ID }), [])) safe(() => e.remove());
  }
}

/** Yakındaki oyunculara kısa ışık patlaması ve sarsıntı (gök gürültüsü vuruşu). */
export function flashAndShake(dim, p, r = 24, shake = 0.22) {
  for (const pl of safe(() => dim.getPlayers({ location: p, maxDistance: r }), [])) {
    const d = V.dist(pl.location, p);
    const k = 1 - Math.min(1, d / r);
    if (d <= r * 0.65) {
      safe(() => pl.camera.fade({ fadeColor: { red: 0.82, green: 1, blue: 1 },
        fadeTime: { fadeInTime: 0, holdTime: 0.03, fadeOutTime: 0.3 } }));
    }
    safe(() => pl.camera.addShake({ intensity: shake * (0.4 + 0.6 * k), duration: 0.45, type: "Positional" }));
  }
}
