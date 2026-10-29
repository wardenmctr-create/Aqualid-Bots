// Aqualit Robotları — Kılıçlı güçleri (V3: 5 güç, geri kalan 45 güç sonraki sürümlerde)
//
// Güç motoru: enerji, bekleme süresi, durum ciddiyeti sınırı, durum analizi ve dövüş tarzı.
//   Model 2: Elektrik kancası
//   Model 3: Yıldırım kılıcı
//   Model 4: Gölge adım, Elektrik kubbe
//   Model 5: Gök gürültüsü
// Güçler yalnızca dünyadaki bloklara zarar vermez (yangın, krater yok).
import { world, system } from "@minecraft/server";
import { V, safe, clamp, yawOf, wait } from "./util.js";
import * as B from "./blocks.js";
import * as FX from "./fx.js";

const T = 20; // tik / saniye

// ------------------------------------------------------------------ güç tablosu
// model: açıldığı seviye · maliyet: enerji · bekle: tik · ciddiyet: bu güce izin için gereken ciddiyet sınırı
export const POWERS = {
  kanca: { no: 2, ad: "Elektrik kancası", model: 2, maliyet: 20, bekle: 8 * T, ciddiyet: 15 },
  yildirim_kilici: { no: 4, ad: "Yıldırım kılıcı", model: 3, maliyet: 30, bekle: 18 * T, ciddiyet: 30 },
  golge_adim: { no: 5, ad: "Gölge adım", model: 4, maliyet: 25, bekle: 6 * T, ciddiyet: 25 },
  kubbe: { no: 6, ad: "Elektrik kubbe", model: 4, maliyet: 40, bekle: 30 * T, ciddiyet: 40 },
  gok_gurultusu: { no: 12, ad: "Gök gürültüsü", model: 5, maliyet: 60, bekle: 40 * T, ciddiyet: 70 },
};
export const POWER_LIST = Object.keys(POWERS);

export const TARZLAR = ["dengeli", "saldirgan", "gizli"];
export const TARZ_AD = { dengeli: "Dengeli", saldirgan: "Saldırgan", gizli: "Gizli" };

/** Seviyede açık güçlerin adları. */
export function unlocked(model) {
  return POWER_LIST.filter((k) => POWERS[k].model <= model).map((k) => POWERS[k].ad);
}

// düşman tehdit ağırlıkları (varsayılan 8)
const WEIGHT = {
  "minecraft:creeper": 14, "minecraft:skeleton": 8, "minecraft:stray": 8, "minecraft:bogged": 8,
  "minecraft:zombie": 6, "minecraft:husk": 6, "minecraft:drowned": 6, "minecraft:zombie_villager": 6,
  "minecraft:spider": 6, "minecraft:cave_spider": 7, "minecraft:witch": 10, "minecraft:blaze": 12,
  "minecraft:wither_skeleton": 14, "minecraft:vindicator": 12, "minecraft:pillager": 10, "minecraft:evoker": 20,
  "minecraft:ravager": 30, "minecraft:piglin_brute": 14, "minecraft:hoglin": 12, "minecraft:ghast": 14,
  "minecraft:warden": 80, "minecraft:wither": 90, "minecraft:ender_dragon": 100, "minecraft:elder_guardian": 40,
};
const RANGED = new Set(["minecraft:skeleton", "minecraft:stray", "minecraft:bogged", "minecraft:pillager",
  "minecraft:blaze", "minecraft:ghast", "minecraft:witch", "minecraft:evoker"]);
const PROJECTILES = ["minecraft:arrow", "minecraft:small_fireball", "minecraft:fireball", "minecraft:wither_skull",
  "minecraft:wither_skull_dangerous", "minecraft:shulker_bullet", "minecraft:llama_spit"];

// ------------------------------------------------------------------ durum
function state(b) {
  const s = b.stats ?? {};
  const max = clamp(s.enerji ?? 100, 10, 1000);
  if (!b.pw) b.pw = { energy: max, cd: {}, cast: null, castName: "", sword: 0, dome: null, last: 0 };
  b.pw.max = max;
  if (b.pw.energy > max) b.pw.energy = max;
  return b.pw;
}

function ownerOf(b) {
  return world.getAllPlayers().find((p) => p.id === b.owner);
}

function isEnemy(e, b) {
  if (!e || e.id === b.id) return false;
  if (!safe(() => e.isValid, false)) return false;
  const t = safe(() => e.typeId, "");
  if (t === "minecraft:player" || t === "aqualit:robot") return false;
  return true;
}

function enemiesAround(b, center, r) {
  const list = safe(() => b.dim.getEntities({ location: center, maxDistance: r, families: ["monster"] }), []);
  return list.filter((e) => isEnemy(e, b));
}

const weightOf = (e) => WEIGHT[e.typeId] ?? 8;

/** Durumu değerlendirir: düşmanlar, tehdit, sahibin ve robotun canı. */
export function analyze(b) {
  const loc = b.loc;
  const enemies = enemiesAround(b, loc, 16);
  if (!enemies.length) return null;
  let threat = 0;
  for (const e of enemies) {
    const d = V.dist(e.location, loc);
    threat += weightOf(e) * (d < 4 ? 1.5 : d < 8 ? 1 : 0.6);
  }
  const hp = safe(() => b.e.getComponent("minecraft:health"), null);
  const selfRatio = hp ? clamp(hp.currentValue / Math.max(1, hp.effectiveMax), 0, 1) : 1;
  const owner = ownerOf(b);
  let ownerHp = 20, ownerNear = false;
  if (owner && owner.dimension === b.dim) {
    ownerNear = V.dist(owner.location, loc) <= 9;
    const oh = safe(() => owner.getComponent("minecraft:health"), null);
    if (oh) ownerHp = oh.currentValue;
  }
  const sev = clamp(Math.round(threat + (selfRatio < 0.4 ? 20 : 0) + (ownerHp <= 8 && ownerNear ? 15 : 0)), 1, 100);
  const ranged = enemies.filter((e) => RANGED.has(e.typeId));
  const sorted = [...enemies].sort((a, c) => V.dist(a.location, loc) - V.dist(c.location, loc));
  return { enemies: sorted, ranged, count: enemies.length, threat, sev, selfRatio, owner, ownerHp, ownerNear,
    nearest: sorted[0], nearD: V.dist(sorted[0].location, loc) };
}

// ------------------------------------------------------------------ seçim: durumun gücü uygunluğu (0-100)
function fit(key, b, ctx, pw) {
  const near = (lo, hi) => ctx.enemies.filter((e) => {
    const d = V.dist(e.location, b.loc);
    return d >= lo && d <= hi;
  });
  switch (key) {
    case "kanca": {
      const far = near(5, 14);
      if (!far.length) return 0;
      const r = far.some((e) => RANGED.has(e.typeId));
      return 40 + (r ? 35 : 0) + (ctx.count === 1 ? 10 : 0);
    }
    case "yildirim_kilici": {
      if (pw.sword > system.currentTick) return 0;
      const close = near(0, 8);
      if (!close.length) return 0;
      return clamp(28 + close.length * 14 + (ctx.sev >= 30 ? 10 : 0), 0, 95);
    }
    case "golge_adim": {
      const far = near(6, 12);
      if (!far.length) return 0;
      const r = far.some((e) => RANGED.has(e.typeId));
      return 38 + (r ? 35 : 0) + (ctx.count >= 2 ? 6 : 0);
    }
    case "kubbe": {
      if (pw.dome) return 0;
      if (!ctx.ownerNear) return 0;
      const lowOwner = ctx.ownerHp <= 10;
      if (!(lowOwner || ctx.ranged.length >= 2 || ctx.count >= 4 || ctx.selfRatio < 0.35)) return 0;
      return 45 + (lowOwner ? 35 : 0) + ctx.count * 4;
    }
    case "gok_gurultusu": {
      const close = near(0, 14);
      const big = close.some((e) => weightOf(e) >= 20);
      if (close.length < 3 && !big) return 0;
      return clamp(36 + close.length * 11 + (big ? 20 : 0), 0, 100);
    }
  }
  return 0;
}

const STYLE = {
  dengeli: {},
  saldirgan: { kanca: 1.2, yildirim_kilici: 1.3, golge_adim: 1.1, gok_gurultusu: 1.3, kubbe: 0.8 },
  gizli: { golge_adim: 1.5, kanca: 0.9, gok_gurultusu: 0.7, yildirim_kilici: 0.9 },
};
const THRESHOLD = { dengeli: 48, saldirgan: 38, gizli: 48 };

/** O anda kullanılacak en verimli gücü seçer (yoksa null). */
export function choose(b, ctx) {
  const pw = state(b);
  const s = b.stats ?? {};
  const now = system.currentTick;
  const tarz = TARZLAR.includes(s.tarz) ? s.tarz : "dengeli";
  const lim = clamp(s.ciddiyet ?? 100, 1, 100);
  let best = null, bestScore = 0;
  for (const key of POWER_LIST) {
    const p = POWERS[key];
    if (p.model > b.model) continue;
    if (p.ciddiyet > lim) continue;
    if (pw.energy < p.maliyet) continue;
    if ((pw.cd[key] ?? 0) > now) continue;
    const score = fit(key, b, ctx, pw) * (STYLE[tarz][key] ?? 1);
    if (score >= THRESHOLD[tarz] && score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}

// ------------------------------------------------------------------ görsel yardımcılar
function snd(dim, id, p, opts) {
  safe(() => dim.playSound(id, p, opts));
}

const alive = (e) => safe(() => e.isValid, false);
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });

function bar(b, key) {
  const pw = state(b);
  const o = ownerOf(b);
  if (!o) return;
  safe(() => o.onScreenDisplay.setActionBar(`§s⚡ ${b.name}: ${POWERS[key].ad} §7· enerji ${Math.round(pw.energy)}/${pw.max}`));
}

function faceEntity(b, e) {
  const l = b.loc, t = e.location;
  safe(() => b.e.setRotation({ x: 0, y: yawOf(t.x - l.x, t.z - l.z) }));
}

/** Verilen noktanın yakınında robotun basabileceği bir hücre bulur. */
function findStand(dim, p) {
  const x = Math.floor(p.x), z = Math.floor(p.z);
  for (let y = Math.floor(p.y) + 2; y >= Math.floor(p.y) - 3; y--) {
    const here = safe(() => dim.getBlock({ x, y, z })?.typeId, null);
    const above = safe(() => dim.getBlock({ x, y: y + 1, z })?.typeId, null);
    const below = safe(() => dim.getBlock({ x, y: y - 1, z })?.typeId, null);
    if (here === null || above === null || below === null) continue;
    if (!B.isPassableType(here) || !B.isPassableType(above) || B.isDanger(here) || B.isDanger(above)) continue;
    if (B.isPassableType(below) || B.isDanger(below)) continue;
    return { x: x + 0.5, y, z: z + 0.5 };
  }
  return null;
}

// ------------------------------------------------------------------ güç uygulamaları (jeneratörler)
function pay(b, key) {
  const pw = state(b);
  const p = POWERS[key];
  pw.energy = Math.max(0, pw.energy - p.maliyet);
  pw.cd[key] = system.currentTick + p.bekle;
  bar(b, key);
}

/** Bir süre yerinde kalıp güç animasyonunu oynar. */
function* root(b, act, ticks) {
  b.setMove("none");
  b.setAct(act);
  safe(() => b.e.addEffect("slowness", ticks + 4, { amplifier: 6, showParticles: false }));
  yield* wait(ticks);
}

function endCast(b) {
  safe(() => b.e.removeEffect("slowness"));
  b.setAct("none");
}

// ---- 1) Elektrik kancası: kol uzanır, elektrikli zincir fırlar, hedefe kilitlenir, çarpar ve çeker
function* castKanca(b, ctx) {
  const far = ctx.enemies.filter((e) => V.dist(e.location, b.loc) >= 5 && V.dist(e.location, b.loc) <= 14);
  const target = far.find((e) => RANGED.has(e.typeId)) ?? far[0];
  if (!target) return;
  pay(b, "kanca");
  faceEntity(b, target);
  const dim = b.dim;
  yield* root(b, "p_hook", 5); // kol öne uzanır (fırlatma sesi animasyonda: aqualit.power.hook)
  if (!alive(target)) return endCast(b);
  snd(dim, "aqualit.power.chain", b.loc, { volume: 0.9 });
  // zincir 4 tikte hedefe uçar, ucunda parlayan kanca
  for (let k = 1; k <= 4; k++) {
    if (!alive(target)) return endCast(b);
    const h = FX.handPos(b), t = FX.chest(target);
    const tip = V.add(h, V.mul(V.sub(t, h), k / 4));
    FX.zincir(dim, h, tip, { omur: 0.1 });
    FX.parlama(dim, tip, 0.35);
    yield;
  }
  // kilitlenme: hedef elektrik çarpar
  const tl = FX.chest(target);
  FX.parlama(dim, tl, 1.3);
  FX.kivilcim(dim, tl);
  for (let i = 0; i < 3; i++) {
    FX.simsek(dim, tl, V.add(tl, { x: FX.rnd() * 1.4, y: FX.rnd() * 1.1, z: FX.rnd() * 1.4 }), { kalin: 0.06, omur: 0.14, seg: 0.4 });
  }
  snd(dim, "aqualit.power.zap", target.location, { volume: 0.9 });
  safe(() => target.applyDamage(3 + b.model, { cause: "lightning", damagingEntity: b.e }));
  safe(() => target.addEffect("slowness", 30, { amplifier: 2, showParticles: false }));
  // zincir gergin ve çatırdıyor (animasyon 0,75 sn'de çeker)
  for (let i = 0; i < 5; i++) {
    if (!alive(target)) break;
    const h = FX.handPos(b), t = FX.chest(target);
    FX.zincir(dim, h, t, { omur: 0.14, sarkma: 0.05 });
    if (i % 2 === 0) FX.simsek(dim, h, t, { kalin: 0.04, omur: 0.1, jit: 0.22 });
    yield* wait(2);
  }
  // çekiş: hedef robota doğru savrulur, zincir onu izler
  if (alive(target)) {
    const l = b.loc, t = target.location;
    const dx = l.x - t.x, dz = l.z - t.z;
    const len = Math.max(0.1, Math.hypot(dx, dz));
    const k = clamp((len - 1.8) * 0.28, 0.4, 2.4);
    safe(() => target.applyKnockback({ x: (dx / len) * k, z: (dz / len) * k }, 0.35));
    FX.kivilcim(dim, FX.chest(target));
  }
  for (let i = 0; i < 4; i++) {
    if (!alive(target)) break;
    FX.zincir(dim, FX.handPos(b), FX.chest(target), { omur: 0.12, sarkma: 0 });
    yield* wait(2);
  }
  if (alive(target)) {
    FX.kivilcim(dim, FX.chest(target));
    snd(dim, "aqualit.power.zap", target.location, { volume: 0.6, pitch: 1.3 });
  }
  yield* wait(3);
  endCast(b);
}

// ---- 2) Yıldırım kılıcı: enerji halkaları, kılıca akan arklar, gökten kılıca yıldırım, 8 sn çatırdayan kılıç
function* castYildirimKilici(b) {
  const pw = state(b);
  pay(b, "yildirim_kilici");
  const dim = b.dim;
  b.setAct("p_sword"); // şarj sesi animasyonda (aqualit.power.charge)
  safe(() => b.e.addEffect("slowness", 32, { amplifier: 6, showParticles: false }));
  snd(dim, "aqualit.power.blade", b.loc, { volume: 0.9 }); // doruk noktası 0,9 sn'de
  for (let i = 0; i < 18; i++) {
    const l = b.loc;
    if (i % 3 === 0) FX.enerjiHalka(dim, l, 0.9);
    if (i >= 6 && i % 2 === 0) {
      const a = Math.random() * Math.PI * 2;
      const from = { x: l.x + Math.cos(a) * 1.6, y: l.y + 0.2 + Math.random() * 1.2, z: l.z + Math.sin(a) * 1.6 };
      FX.simsek(dim, from, FX.swordTip(b, true), { kalin: 0.05, omur: 0.12, jit: 0.4, seg: 0.5 });
    }
    yield;
  }
  // gökten kılıca yıldırım
  let tip = FX.swordTip(b, true);
  const sky = { x: tip.x + FX.rnd() * 1.5, y: tip.y + 14, z: tip.z + FX.rnd() * 1.5 };
  FX.simsek(dim, sky, tip, { kalin: 0.18, omur: 0.22, jit: 0.3, seg: 0.8, dal: 3 });
  FX.parlama(dim, tip, 2.2);
  FX.sokDalgasi(dim, b.loc, 3.2);
  FX.kivilcim(dim, tip);
  snd(dim, "aqualit.power.thunder", b.loc, { volume: 0.55, pitch: 1.25 });
  yield* wait(2);
  FX.simsek(dim, sky, tip, { kalin: 0.11, omur: 0.15, jit: 0.34, seg: 0.8 }); // titreyen ikinci çakış
  for (let i = 0; i < 8; i++) {
    tip = FX.swordTip(b, true);
    FX.simsek(dim, tip, V.add(tip, { x: FX.rnd() * 0.8, y: FX.rnd() * 0.6, z: FX.rnd() * 0.8 }), { kalin: 0.045, omur: 0.1, jit: 0.5, seg: 0.3 });
    yield;
  }
  pw.sword = system.currentTick + 8 * T;
  endCast(b);
}

/** Yıldırım kılıcı açıkken kılıcın çevresindeki çatırtı. */
function swordAura(b, pw, now) {
  const dim = b.dim;
  const tip = FX.swordTip(b, false);
  FX.simsek(dim, tip, V.add(tip, { x: FX.rnd() * 0.55, y: FX.rnd() * 0.45, z: FX.rnd() * 0.55 }), { kalin: 0.035, omur: 0.09, jit: 0.5, seg: 0.25 });
  if (Math.random() < 0.3) FX.parilti(dim, tip);
  if (now % 24 === 0) snd(dim, "aqualit.power.crackle", tip, { volume: 0.5 });
  if (pw.sword - now <= 3) FX.kivilcim(dim, tip); // biterken kıvılcımla söner
}

// ---- 3) Gölge adım: geride hayalet bırakır, duman izinde hedefin arkasına geçer, arkadan vurur
function* castGolgeAdim(b, ctx) {
  const far = ctx.enemies.filter((e) => V.dist(e.location, b.loc) >= 6 && V.dist(e.location, b.loc) <= 12);
  const target = far.find((e) => RANGED.has(e.typeId)) ?? far[0];
  if (!target) return;
  const tl = target.location;
  const dir = safe(() => target.getViewDirection(), { x: 0, y: 0, z: 1 });
  const hl = Math.max(0.01, Math.hypot(dir.x, dir.z));
  const bx = -dir.x / hl, bz = -dir.z / hl;
  const spots = [
    { x: tl.x + bx * 1.6, y: tl.y, z: tl.z + bz * 1.6 },
    { x: tl.x + bz * 1.6, y: tl.y, z: tl.z - bx * 1.6 },
    { x: tl.x - bz * 1.6, y: tl.y, z: tl.z + bx * 1.6 },
    { x: tl.x + bx * 2.4, y: tl.y, z: tl.z + bz * 2.4 },
  ];
  let dest = null;
  for (const s of spots) {
    dest = findStand(b.dim, s);
    if (dest) break;
  }
  if (!dest) return; // yer yok: enerji harcanmaz
  pay(b, "golge_adim");
  const dim = b.dim;
  const from = { ...b.loc };
  const yaw0 = safe(() => b.e.getRotation().y, 0);
  b.setAct("p_dash");
  snd(dim, "aqualit.power.shadow", from, { volume: 0.95 });
  yield; // eğilip atılma pozu
  const ghost = FX.fxSpawn(dim, "hayalet", from, yaw0);
  FX.duman(dim, from);
  FX.parlama(dim, up(from, 0.6), 1.2);
  safe(() => b.e.addEffect("invisibility", 6, { amplifier: 0, showParticles: false }));
  yield;
  b.tp(dest, yawOf(tl.x - dest.x, tl.z - dest.z));
  // gölge izi: yol boyunca duman ve sönük bir şimşek
  const n = Math.min(7, Math.ceil(V.dist(from, dest) / 1.5));
  for (let i = 1; i < n; i++) FX.duman(dim, V.add(from, V.mul(V.sub(dest, from), i / n)));
  FX.simsek(dim, up(from, 0.6), up(dest, 0.6), { kalin: 0.05, omur: 0.2, jit: 0.2 });
  FX.duman(dim, dest);
  FX.parlama(dim, up(dest, 0.6), 1.4);
  FX.kivilcim(dim, up(dest, 0.6));
  snd(dim, "aqualit.power.teleport", dest, { volume: 0.9, pitch: 1.15 });
  safe(() => b.e.removeEffect("invisibility"));
  yield* wait(2);
  // arkadan ilk vuruş: kılıçtan hedefe ark
  if (alive(target)) {
    faceEntity(b, target);
    safe(() => target.applyDamage(Math.max(2, (b.stats?.hasar ?? 7) * 0.6), { cause: "lightning", damagingEntity: b.e }));
    const c = FX.chest(target);
    FX.simsek(dim, FX.swordTip(b), c, { kalin: 0.07, omur: 0.14, seg: 0.4 });
    FX.kivilcim(dim, c);
    snd(dim, "aqualit.power.zap", target.location, { volume: 0.7, pitch: 1.1 });
  }
  if (ghost) system.runTimeout(() => FX.fxRemove(ghost), 10); // hayalet ~0,7 sn'de silinerek kaybolur
  yield* wait(5);
  b.setAct("none");
}

// ---- 4) Elektrik kubbe: kollar yukarı, şok dalgasıyla altıgen enerji kalkanı açılır (10 sn, robotu izler)
function* castKubbe(b) {
  const pw = state(b);
  pay(b, "kubbe");
  yield* root(b, "p_dome", 8); // kollar yukarıda (kubbe sesi animasyonda: aqualit.power.dome)
  const dim = b.dim;
  const R = 5;
  const c = up(b.loc, 0.15);
  const e = FX.fxSpawn(dim, "kubbe", b.loc, 0);
  FX.sokDalgasi(dim, b.loc, R);
  FX.parlama(dim, up(b.loc, 1), 2.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    FX.simsek(dim, c, { x: c.x + Math.cos(a) * R, y: c.y + 0.1, z: c.z + Math.sin(a) * R }, { kalin: 0.06, omur: 0.16 });
  }
  snd(dim, "aqualit.power.shock", b.loc, { volume: 0.8, pitch: 1.2 });
  pw.dome = { until: system.currentTick + 10 * T, r: R, tickNo: 0, e, at: { ...b.loc }, closing: -1 };
  yield* wait(10);
  endCast(b);
}

function shellPoint(c, r) {
  const u = Math.random(), th = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return { x: c.x + r * s * Math.cos(th), y: c.y + r * u, z: c.z + r * s * Math.sin(th) };
}

function tickDome(b, pw) {
  const d = pw.dome;
  if (!d) return;
  const now = system.currentTick;
  if (!b.valid) {
    FX.fxRemove(d.e);
    pw.dome = null;
    return;
  }
  const dim = b.dim;
  const base = b.loc;
  // kubbe robotu izler
  if (V.dist(base, d.at) > 0.05) {
    FX.fxMove(d.e, base);
    d.at = { ...base };
  }
  // süre bitti: kubbe çöker (6 tik), sonra kaybolur
  if (now >= d.until) {
    if (d.closing < 0) {
      d.closing = 0;
      snd(dim, "beacon.deactivate", base, { pitch: 1.5, volume: 0.7 });
    }
    d.closing++;
    if (d.closing % 2 === 0) FX.fxSize(d.e, 1 - d.closing / 6);
    if (d.closing >= 6) {
      FX.fxRemove(d.e);
      FX.sokDalgasi(dim, base, 2.5);
      for (let i = 0; i < 6; i++) FX.parilti(dim, shellPoint(base, d.r * 0.3));
      pw.dome = null;
    }
    return;
  }
  if (now % 4 !== 0) return;
  d.tickNo++;
  const c = { x: base.x, y: base.y + 0.15, z: base.z };
  // kabukta pırıltılar ve yüzeyde gezen kısa arklar
  for (let i = 0; i < 5; i++) FX.parilti(dim, shellPoint(c, d.r));
  if (d.tickNo % 2 === 0) {
    const a = shellPoint(c, d.r);
    const q = shellPoint(c, d.r);
    if (V.dist(a, q) < d.r) FX.simsek(dim, a, q, { kalin: 0.04, omur: 0.12, jit: 0.25 });
  }
  if (d.tickNo % 6 === 0) snd(dim, "beacon.ambient", base, { pitch: 1.8, volume: 0.35 });
  // içerideki dostlara direnç
  const owner = ownerOf(b);
  const friends = [];
  if (owner && owner.dimension === dim) friends.push(owner);
  for (const r of safe(() => dim.getEntities({ type: "aqualit:robot", location: c, maxDistance: d.r }), [])) friends.push(r);
  for (const f of friends) {
    if (V.dist(f.location, c) <= d.r + 0.5) safe(() => f.addEffect("resistance", 30, { amplifier: 2, showParticles: false }));
  }
  // kubbeye giren düşmanlar çarpılır ve dışarı itilir
  if (d.tickNo % 2 === 0) {
    for (const e of enemiesAround(b, c, d.r + 0.5)) {
      const dx = e.location.x - c.x, dz = e.location.z - c.z;
      const len = Math.max(0.1, Math.hypot(dx, dz));
      safe(() => e.applyDamage(2, { cause: "lightning", damagingEntity: b.e }));
      safe(() => e.applyKnockback({ x: (dx / len) * 0.9, z: (dz / len) * 0.9 }, 0.25));
      const ec = FX.chest(e);
      FX.simsek(dim, up(base, 0.7), ec, { kalin: 0.06, omur: 0.14, dal: 1 });
      FX.kivilcim(dim, ec);
      snd(dim, "aqualit.power.zap", e.location, { volume: 0.6 });
    }
  }
  // gelen mermiler kalkana çarpıp yok olur
  for (const type of PROJECTILES) {
    for (const pr of safe(() => dim.getEntities({ type, location: c, maxDistance: d.r + 1 }), [])) {
      const dist = V.dist(pr.location, c);
      if (dist < d.r - 1.3 || dist > d.r + 1) continue;
      const v = safe(() => pr.getVelocity(), { x: 0, y: 0, z: 0 });
      const inward = v.x * (c.x - pr.location.x) + v.y * (c.y - pr.location.y) + v.z * (c.z - pr.location.z);
      if (inward <= 0) continue;
      const hit = { ...pr.location };
      FX.parlama(dim, hit, 0.9);
      FX.parilti(dim, hit);
      FX.kivilcim(dim, hit);
      snd(dim, "aqualit.power.zap", hit, { volume: 0.5, pitch: 1.5 });
      safe(() => pr.remove());
    }
  }
}

// ---- 5) Gök gürültüsü: bulutlarda şimşekler, kılıç göğü çağırır, yere çöküşle düşmanlara gökten yıldırımlar
function* castGokGurultusu(b, ctx) {
  const targets = ctx.enemies.filter((e) => V.dist(e.location, b.loc) <= 14)
    .sort((a, c) => weightOf(c) - weightOf(a)).slice(0, 5);
  if (!targets.length) return;
  pay(b, "gok_gurultusu");
  const dim = b.dim;
  snd(dim, "ambient.weather.thunder", b.loc, { pitch: 0.8, volume: 0.8 });
  b.setAct("p_thunder"); // kılıç 0,4 sn'de yukarıda, 1,25 sn'de yere çöküş (şarj sesi animasyonda)
  safe(() => b.e.addEffect("slowness", 60, { amplifier: 6, showParticles: false }));
  for (let i = 0; i < 22; i++) {
    const l = b.loc;
    if (i % 3 === 0) FX.enerjiHalka(dim, l, 1.1);
    if (i >= 8 && i % 2 === 0) {
      const a = Math.random() * Math.PI * 2;
      FX.simsek(dim, { x: l.x + Math.cos(a) * 2.2, y: l.y + Math.random() * 1.5, z: l.z + Math.sin(a) * 2.2 },
        FX.swordTip(b, true), { kalin: 0.06, omur: 0.12, seg: 0.5 });
    }
    if (i % 4 === 1) { // bulutlarda çakan şimşekler
      const c = { x: l.x + FX.rnd() * 8, y: l.y + 13 + Math.random() * 3, z: l.z + FX.rnd() * 8 };
      FX.simsek(dim, c, { x: c.x + FX.rnd() * 6, y: c.y + FX.rnd() * 1.5, z: c.z + FX.rnd() * 6 }, { kalin: 0.12, omur: 0.2, dal: 2 });
    }
    yield;
  }
  // kılıç göğü çağırır
  const tip = FX.swordTip(b, true);
  FX.simsek(dim, tip, { x: tip.x, y: tip.y + 16, z: tip.z }, { kalin: 0.14, omur: 0.2, seg: 0.8 });
  FX.parlama(dim, tip, 1.8);
  yield* wait(3);
  // yere çöküş: şok dalgası, ışık, sarsıntı
  FX.sokDalgasi(dim, b.loc, 6);
  FX.kivilcim(dim, b.loc);
  snd(dim, "aqualit.power.shock", b.loc, { volume: 1.0 });
  FX.flashAndShake(dim, b.loc, 24, 0.25);
  const dmg = 10 + b.model * 2;
  for (const t of targets) {
    if (!alive(t)) continue;
    const p = { ...t.location };
    FX.gokSimsegi(dim, p);
    FX.parlama(dim, up(p, 0.5), 3.2);
    FX.sokDalgasi(dim, p, 4.2);
    FX.kivilcim(dim, up(p, 0.2));
    FX.kivilcim(dim, up(p, 0.8));
    snd(dim, "aqualit.power.thunder", p, { volume: 1.0, pitch: 0.9 + Math.random() * 0.2 });
    snd(dim, "ambient.weather.lightning.impact", p, { pitch: 1.0, volume: 0.6 });
    // vuruş alanı: çevresindeki düşmanlar
    for (const e of enemiesAround(b, p, 3.2)) {
      safe(() => e.applyDamage(dmg, { cause: "lightning", damagingEntity: b.e }));
      safe(() => e.applyKnockback({ x: 0, z: 0 }, 0.7));
    }
    yield* wait(2);
    FX.gokSimsegi(dim, p, { kalin: 0.12, omur: 0.16, dal: 2 }); // yıldırım titreyerek ikinci kez çakar
    FX.duman(dim, p);
    yield* wait(2);
  }
  yield* wait(8);
  endCast(b);
}

const CASTS = {
  kanca: castKanca,
  yildirim_kilici: castYildirimKilici,
  golge_adim: castGolgeAdim,
  kubbe: castKubbe,
  gok_gurultusu: castGokGurultusu,
};

// ------------------------------------------------------------------ her tik
/** Kılıçlı her tik burayı çağırır. */
export function powersTick(b) {
  const pw = state(b);
  const now = system.currentTick;
  tickDome(b, pw);
  if (pw.sword > now && now % 3 === 0) swordAura(b, pw, now);
  if (pw.cast) {
    let r;
    try {
      r = pw.cast.next();
    } catch (e) {
      r = { done: true };
      endCast(b);
    }
    if (r.done) {
      pw.cast = null;
      pw.castName = "";
    }
    return;
  }
  if (now % 10 !== 0) return;
  // enerji dolumu: ~60 saniyede tam dolar
  pw.energy = Math.min(pw.max, pw.energy + pw.max / 120);
  if (b.model < 2 || b.stats?.guc === false) return;
  if (b.job) return; // bölgeye yürürken güç kullanma
  const ctx = analyze(b);
  if (!ctx) return;
  const key = choose(b, ctx);
  if (!key) return;
  pw.castName = key;
  pw.cast = CASTS[key](b, ctx);
}

/** Dışarıdan (kumanda, test) belirli bir gücü hemen dene; başarılıysa true. */
export function usePower(b, key) {
  const pw = state(b);
  const p = POWERS[key];
  if (!p || pw.cast || p.model > b.model) return false;
  if (pw.energy < p.maliyet || (pw.cd[key] ?? 0) > system.currentTick) return false;
  const ctx = analyze(b);
  if (!ctx && key !== "yildirim_kilici" && key !== "kubbe") return false;
  pw.castName = key;
  pw.cast = CASTS[key](b, ctx ?? { enemies: [], ranged: [], count: 0, sev: 1 });
  return true;
}

// ------------------------------------------------------------------ yıldırım kılıcı: vuruşlar zincirleme atlar
export function wireChain(getBot) {
  world.afterEvents.entityHurt.subscribe((ev) => {
    const src = ev.damageSource;
    if (!src || src.cause === "lightning") return;
    const attacker = src.damagingEntity;
    if (!attacker || safe(() => attacker.typeId) !== "aqualit:robot") return;
    const b = getBot(attacker);
    if (!b || b.type !== "kilicli" || !b.pw || b.pw.sword <= system.currentTick) return;
    const victim = ev.hurtEntity;
    const dim = b.dim;
    const near = enemiesAround(b, victim.location, 6).filter((e) => e.id !== victim.id)
      .sort((a, c) => V.dist(a.location, victim.location) - V.dist(c.location, victim.location)).slice(0, 3);
    const vc = FX.chest(victim);
    FX.simsek(dim, FX.swordTip(b), vc, { kalin: 0.06, omur: 0.12, seg: 0.35 });
    FX.parlama(dim, vc, 0.9);
    FX.kivilcim(dim, vc);
    let from = vc;
    for (const e of near) {
      const to = FX.chest(e);
      FX.simsek(dim, from, to, { kalin: 0.09, omur: 0.18, jit: 0.38, dal: 2 });
      FX.parlama(dim, to, 0.8);
      FX.kivilcim(dim, to);
      safe(() => e.applyDamage(Math.max(2, 3 + b.model * 1.5), { cause: "lightning", damagingEntity: b.e }));
      from = to;
    }
    if (near.length) snd(dim, "aqualit.power.zap", victim.location, { volume: 0.8 });
  });
}
