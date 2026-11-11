// Aqualit Robotları — Kılıçlı yeni güçler, 2. parti (v0.4.3): kalan 26 güç. Blok kırmaz, yangın yok,
// oyunculara ve Aqualit varlıklarına dokunmaz. powers.js motoruna takılır (powers2.js ile aynı yöntem).
import { system, world } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import * as FX from "./fx.js";
import { POWERS, POWER_LIST, CASTS, EK_FIT, enemiesAround, weightOf, pay, root, endCast,
  faceEntity, findStand, ownerOf, snd, alive } from "./powers.js";

const T = 20;
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
const vur = (b, e, n, cause = "entityAttack") => safe(() => e.applyDamage(n * (b._kat ?? 1), { cause, damagingEntity: b.e }));
const it = (b, e, k = 1, y = 0.3, from = b.loc) => {
  const d = V.sub(e.location, from);
  const L = Math.max(0.1, Math.hypot(d.x, d.z));
  safe(() => e.applyKnockback({ x: (d.x / L) * k, z: (d.z / L) * k }, y));
};
const hasar = (b, kat = 1) => Math.round((4 + b.model * 2) * kat);
const ilk = (ctx, n) => ctx.enemies.filter(alive).slice(0, n);
function ekle(key, no, ad, model, bekle, ciddiyet, fitFn, cast) {
  POWERS[key] = { no, ad, model, maliyet: 0, bekle: bekle * T, ciddiyet };
  if (!POWER_LIST.includes(key)) POWER_LIST.push(key);
  EK_FIT[key] = fitFn;
  CASTS[key] = cast;
}
/** Bir düşmana sıçrayıp vurur (birçok güçte ortak hamle). */
function* atil(b, e, kat = 1, iz = "duman") {
  if (!alive(e)) return;
  faceEntity(b, e);
  const s = findStand(b.dim, V.add(e.location, V.mul(V.sub(b.loc, e.location), 0.25)));
  if (iz === "duman") FX.duman(b.dim, b.loc); else FX.parlama(b.dim, b.loc, 0.5);
  if (s) safe(() => b.e.teleport(s));
  vur(b, e, hasar(b, kat));
  FX.parlama(b.dim, FX.chest(e), 0.6);
  yield* wait(3);
}

ekle("klon_firtinasi", 8, "Klon fırtınası", 5, 30, 60, (b, ctx) => (ctx.count >= 4 ? 48 + ctx.count * 5 : 0), function* (b, ctx) {
  pay(b, "klon_firtinasi"); yield* root(b, "p_dome", 6);
  for (const e of ilk(ctx, 8)) {
    const a = Math.random() * Math.PI * 2;
    const kl = { x: e.location.x + Math.cos(a) * 3, y: e.location.y + 1, z: e.location.z + Math.sin(a) * 3 };
    FX.duman(b.dim, kl); FX.simsek(b.dim, kl, FX.chest(e), { kalin: 0.05, omur: 0.1 });
    vur(b, e, hasar(b)); it(b, e, 0.7, 0.3, kl);
  }
  snd(b.dim, "aqualit.power.zap", b.loc); yield* wait(6); endCast(b);
});
ekle("faz_gecisi", 19, "Faz geçişi", 5, 25, 30, (b, ctx) => (ctx.selfRatio < 0.4 ? 55 : 0), function* (b) {
  pay(b, "faz_gecisi");
  safe(() => b.e.addEffect("resistance", 5 * T, { amplifier: 4, showParticles: false }));
  safe(() => b.e.addEffect("invisibility", 5 * T, { showParticles: false }));
  for (let t = 0; t < 5 * T; t += 4) { FX.parilti(b.dim, up(b.loc, 1)); yield* wait(4); }
  endCast(b);
});
ekle("dron_surusu", 21, "Drone sürüsü", 5, 35, 45, (b, ctx) => (ctx.count >= 3 ? 46 + ctx.count * 4 : 0), function* (b) {
  pay(b, "dron_surusu"); yield* root(b, "p_dome", 5);
  for (let t = 0; t < 20 * T; t += 10) {
    const l = enemiesAround(b, b.loc, 14);
    for (let i = 0; i < 6; i++) {
      const a = t / 20 + (i * Math.PI) / 3;
      const d = { x: b.loc.x + Math.cos(a) * 2, y: b.loc.y + 2.6, z: b.loc.z + Math.sin(a) * 2 };
      FX.parlama(b.dim, d, 0.3);
      const e = l[i % Math.max(1, l.length)];
      if (e && i < l.length) { FX.cizgi(b.dim, d, FX.chest(e), true); vur(b, e, 1.5); }
    }
    yield* wait(10);
  }
  endCast(b);
});
ekle("roket_yumruk", 22, "Roket yumruk", 4, 12, 25, (b, ctx, pw, near) => (near(3, 10).length ? 44 : 0), function* (b, ctx) {
  const e = ctx.enemies.find((x) => V.dist(x.location, b.loc) >= 3) ?? ctx.nearest;
  if (!e) return;
  pay(b, "roket_yumruk"); faceEntity(b, e); yield* root(b, "p_hook", 4);
  let p = FX.handPos(b);
  for (let i = 0; i < 8; i++) { p = V.add(p, V.mul(V.sub(FX.chest(e), p), 0.35)); FX.duman(b.dim, p); FX.parlama(b.dim, p, 0.4); yield; }
  vur(b, e, hasar(b, 1.3)); it(b, e, 2.2, 0.6); FX.sokDalgasi(b.dim, e.location, 1.5);
  snd(b.dim, "random.explode", e.location, { volume: 0.4, pitch: 1.8 }); endCast(b);
});
ekle("kalkan_firlatma", 23, "Kalkan fırlatma", 4, 14, 25, (b, ctx) => (ctx.count >= 2 ? 42 + ctx.count * 4 : 0), function* (b, ctx) {
  pay(b, "kalkan_firlatma"); yield* root(b, "p_hook", 4);
  let from = FX.handPos(b);
  for (const e of ilk(ctx, 5)) {
    const to = FX.chest(e);
    for (let k = 1; k <= 3; k++) { FX.enerjiHalka(b.dim, V.add(from, V.mul(V.sub(to, from), k / 3)), 0.4); yield; }
    vur(b, e, hasar(b, 0.9)); FX.kivilcim(b.dim, to); from = to;
  }
  endCast(b);
});
ekle("kilic_kasirgasi", 24, "Kılıç kasırgası", 5, 25, 45, (b, ctx, pw, near) => (near(0, 6).length >= 3 ? 50 + near(0, 6).length * 5 : 0), function* (b) {
  pay(b, "kilic_kasirgasi"); b.setAct("p_sword");
  for (let t = 0; t < 40; t += 2) {
    safe(() => b.e.setRotation({ x: 0, y: (t * 36) % 360 }));
    const a = (t / 40) * Math.PI * 8;
    FX.parlama(b.dim, { x: b.loc.x + Math.cos(a) * 2, y: b.loc.y + 1 + t / 40, z: b.loc.z + Math.sin(a) * 2 }, 0.5);
    for (const e of enemiesAround(b, b.loc, 5)) {
      const d = V.sub(b.loc, e.location), L = Math.max(0.3, Math.hypot(d.x, d.z));
      safe(() => e.applyKnockback({ x: (d.x / L) * 0.2, z: (d.z / L) * 0.2 }, 0.15));
      if (t % 8 === 0) vur(b, e, hasar(b, 0.5));
    }
    yield* wait(2);
  }
  for (const e of enemiesAround(b, b.loc, 5)) it(b, e, 1.5, 0.6);
  endCast(b);
});
ekle("bumerang_kilic", 25, "Bumerang kılıç", 4, 14, 25, (b, ctx) => (ctx.count >= 3 ? 44 + ctx.count * 3 : 0), function* (b, ctx) {
  pay(b, "bumerang_kilic"); yield* root(b, "p_hook", 3);
  let p = FX.swordTip(b);
  const yol = [...ilk(ctx, 5), null];
  for (const e of yol) {
    const to = e ? FX.chest(e) : FX.handPos(b);
    for (let k = 1; k <= 3; k++) { const q = V.add(p, V.mul(V.sub(to, p), k / 3)); FX.parlama(b.dim, q, 0.35); FX.kivilcim(b.dim, q); yield; }
    if (e) vur(b, e, hasar(b, 0.8));
    p = to;
  }
  endCast(b);
});
ekle("hayalet_adimlar", 28, "Hayalet adımlar", 5, 22, 40, (b, ctx) => (ctx.count >= 4 ? 46 + ctx.count * 4 : 0), function* (b, ctx) {
  pay(b, "hayalet_adimlar");
  safe(() => b.e.addEffect("invisibility", 40, { showParticles: false }));
  for (const e of ilk(ctx, 6)) yield* atil(b, e, 1);
  endCast(b);
});
ekle("seken_basis", 29, "Seken basış zinciri", 5, 20, 35, (b, ctx) => (ctx.count >= 3 ? 44 + ctx.count * 4 : 0), function* (b, ctx) {
  pay(b, "seken_basis");
  for (const e of ilk(ctx, 5)) {
    if (!alive(e)) continue;
    safe(() => b.e.teleport(up(e.location, 2.2)));
    vur(b, e, hasar(b, 0.9)); FX.sokDalgasi(b.dim, e.location, 1.2);
    safe(() => e.addEffect("slowness", 30, { amplifier: 3 }));
    yield* wait(5);
  }
  safe(() => b.e.addEffect("slow_falling", 30, { showParticles: false }));
  endCast(b);
});
ekle("yapisik_saldiri", 30, "Yapışık saldırı", 5, 20, 40, (b, ctx) => (ctx.nearest && weightOf(ctx.nearest) >= 12 ? 55 : 0), function* (b, ctx) {
  const e = ctx.enemies.find((x) => weightOf(x) >= 12) ?? ctx.nearest;
  if (!e) return;
  pay(b, "yapisik_saldiri");
  for (let t = 0; t < 20; t++) { if (!alive(e)) break; safe(() => b.e.teleport(up(e.location, 1.5))); safe(() => e.applyKnockback({ x: 0, z: 0 }, 0.12)); yield; }
  if (alive(e)) { safe(() => e.applyKnockback({ x: 0, z: 0 }, -2)); yield* wait(6); vur(b, e, hasar(b, 2)); FX.sokDalgasi(b.dim, e.location, 2); }
  endCast(b);
});
ekle("elektrik_agi", 31, "Elektrik ağı", 4, 20, 30, (b, ctx) => (ctx.count >= 3 ? 46 + ctx.count * 4 : 0), function* (b) {
  pay(b, "elektrik_agi"); yield* root(b, "p_hook", 4);
  const l = enemiesAround(b, b.loc, 10);
  for (let t = 0; t < 5 * T; t += 5) {
    for (let i = 0; i < l.length; i++) {
      const e = l[i], f = l[(i + 1) % l.length];
      if (!alive(e)) continue;
      safe(() => e.addEffect("slowness", 10, { amplifier: 10, showParticles: false }));
      if (f && alive(f) && f !== e) FX.zincir(b.dim, FX.chest(e), FX.chest(f), { omur: 0.25 });
      if (t % 20 === 0) vur(b, e, 1.5, "lightning");
    }
    yield* wait(5);
  }
  endCast(b);
});
ekle("enerji_kanatlari", 32, "Enerji kanatları", 5, 30, 40, (b, ctx) => (ctx.ranged.length >= 2 ? 48 : 0), function* (b) {
  pay(b, "enerji_kanatlari");
  safe(() => b.e.addEffect("levitation", 15, { amplifier: 2, showParticles: false }));
  for (let t = 0; t < 6 * T; t += 4) {
    safe(() => b.e.addEffect("slow_falling", 10, { showParticles: false }));
    for (const s of [-1, 1]) FX.parilti(b.dim, { x: b.loc.x + s * 1.4, y: b.loc.y + 1.4, z: b.loc.z });
    const e = enemiesAround(b, b.loc, 14)[0];
    if (e && t % 12 === 0) { FX.cizgi(b.dim, up(b.loc, 1.4), FX.chest(e), true); vur(b, e, hasar(b, 0.5)); }
    yield* wait(4);
  }
  endCast(b);
});
ekle("isik_kilici", 33, "Işık kılıcı formu", 5, 30, 40, (b, ctx) => (ctx.nearest && weightOf(ctx.nearest) >= 14 ? 52 : 0), function* (b) {
  pay(b, "isik_kilici");
  b._kat = 2;
  for (let t = 0; t < 10 * T; t += 3) { FX.parlama(b.dim, FX.swordTip(b), 0.4); yield* wait(3); }
  b._kat = 1; endCast(b);
});
const yansit = new Map();            // robot kimliği -> bitiş
ekle("yansitici_zirh", 34, "Yansıtıcı zırh", 5, 30, 40, (b, ctx) => (ctx.count >= 4 || ctx.ranged.length >= 2 ? 48 : 0), function* (b) {
  pay(b, "yansitici_zirh");
  yansit.set(b.e.id, system.currentTick + 6 * T);
  for (let t = 0; t < 6 * T; t += 4) { FX.enerjiHalka(b.dim, up(b.loc, 1), 1.1); yield* wait(4); }
  endCast(b);
});
ekle("portal_kapisi", 37, "Portal kapısı", 5, 40, 50, (b, ctx) => (ctx.ownerNear && ctx.count >= 4 ? 50 : 0), function* (b, ctx) {
  pay(b, "portal_kapisi"); yield* root(b, "p_dome", 5);
  const o = ownerOf(b);
  for (const e of ilk(ctx, 6)) {
    const a = Math.random() * Math.PI * 2;
    const yer = findStand(b.dim, { x: e.location.x + Math.cos(a) * 25, y: e.location.y, z: e.location.z + Math.sin(a) * 25 });
    FX.enerjiHalka(b.dim, up(e.location, 1), 1.2);
    if (yer) safe(() => e.teleport(yer));
    yield* wait(2);
  }
  if (o) FX.enerjiHalka(b.dim, up(o.location, 1), 1.5);
  endCast(b);
});
ekle("savas_analizi", 38, "Savaş analizi", 5, 30, 30, (b, ctx) => (ctx.sev >= 40 ? 45 : 0), function* (b) {
  pay(b, "savas_analizi");
  b._kat = 1.8;
  for (let t = 0; t < 10 * T; t += 5) { FX.kivilcim(b.dim, up(b.loc, 2.2)); yield* wait(5); }
  b._kat = 1; endCast(b);
});
ekle("taktik_gorus", 39, "Taktik görüş", 5, 25, 20, (b, ctx) => (ctx.count >= 3 ? 42 : 0), function* (b) {
  pay(b, "taktik_gorus");
  for (const e of enemiesAround(b, b.loc, 24)) safe(() => e.addEffect("glowing", 15 * T, { showParticles: false }));
  const o = ownerOf(b);
  safe(() => o?.onScreenDisplay.setActionBar(`§s${b.name}§r: ${enemiesAround(b, b.loc, 24).length} düşman işaretlendi`));
  yield* wait(4); endCast(b);
});
// ---- Nanobotlar (41–45)
ekle("nanobot_surusu", 41, "Nanobot sürüsü", 5, 30, 50, (b, ctx) => (ctx.count >= 5 ? 50 + ctx.count * 3 : 0), function* (b) {
  pay(b, "nanobot_surusu"); yield* root(b, "p_dome", 4);
  for (let t = 0; t < 8 * T; t += 5) {
    for (const e of enemiesAround(b, b.loc, 9)) { for (let i = 0; i < 3; i++) FX.kivilcim(b.dim, V.add(FX.chest(e), { x: FX.rnd() * 0.6, y: FX.rnd() * 0.6, z: FX.rnd() * 0.6 })); vur(b, e, 1); }
    yield* wait(5);
  }
  endCast(b);
});
ekle("nanobot_gorusu", 42, "Nanobot görüşü", 5, 25, 30, (b, ctx) => (ctx.ranged.length >= 2 ? 50 : 0), function* (b) {
  pay(b, "nanobot_gorusu");
  for (const e of enemiesAround(b, b.loc, 16)) { safe(() => e.addEffect("blindness", 8 * T)); safe(() => e.addEffect("nausea", 8 * T)); safe(() => e.addEffect("weakness", 8 * T, { amplifier: 1 })); FX.kivilcim(b.dim, FX.chest(e)); }
  yield* wait(4); endCast(b);
});
ekle("nanobot_isirigi", 43, "Nanobot ısırığı", 5, 20, 30, (b, ctx) => (ctx.nearest && weightOf(ctx.nearest) >= 10 ? 46 : 0), function* (b, ctx) {
  const e = ctx.nearest; if (!e) return;
  pay(b, "nanobot_isirigi");
  for (let t = 0; t < 6 * T && alive(e); t += 10) { FX.kivilcim(b.dim, FX.chest(e)); vur(b, e, 2); yield* wait(10); }
  endCast(b);
});
ekle("nanobot_bulutu", 44, "Nanobot bulutu", 5, 30, 45, (b, ctx) => (ctx.count >= 3 ? 46 + ctx.count * 3 : 0), function* (b, ctx) {
  pay(b, "nanobot_bulutu");
  const l = ilk(ctx, 5);
  for (const e of l) safe(() => e.addEffect("levitation", 25, { amplifier: 2 }));
  for (let t = 0; t < 25; t += 3) { for (const e of l) if (alive(e)) FX.duman(b.dim, e.location); yield* wait(3); }
  for (const e of l) if (alive(e)) { it(b, e, 1.8, -0.5); yield* wait(2); vur(b, e, hasar(b)); }
  endCast(b);
});
ekle("nanobot_zirhi", 45, "Nanobot zırhı", 5, 40, 30, (b, ctx) => (ctx.selfRatio < 0.45 || ctx.ownerHp <= 8 ? 58 : 0), function* (b) {
  pay(b, "nanobot_zirhi");
  const o = ownerOf(b);
  for (const e of [b.e, o].filter(Boolean)) { safe(() => e.addEffect("absorption", 20 * T, { amplifier: 2, showParticles: false })); safe(() => e.addEffect("resistance", 10 * T, { amplifier: 1, showParticles: false })); FX.parilti(b.dim, up(e.location, 1)); }
  yield* wait(4); endCast(b);
});
ekle("akilli_karsilik", 46, "Akıllı karşılık", 5, 15, 25, (b, ctx) => (!safe(() => b.e.isOnGround, true) && ctx.nearest ? 70 : 0), function* (b, ctx) {
  pay(b, "akilli_karsilik");
  const e = ctx.nearest;
  safe(() => b.e.addEffect("slow_falling", 10, { showParticles: false }));
  if (e) { yield* atil(b, e, 1.5, "parlama"); FX.sokDalgasi(b.dim, b.loc, 2); }
  endCast(b);
});
const ogrenme = new Map();           // robot kimliği -> {tür: sayı}
ekle("savas_ogrenmesi", 47, "Savaş öğrenmesi", 5, 60, 10, (b, ctx) => (ctx.count >= 2 ? 30 : 0), function* (b, ctx) {
  pay(b, "savas_ogrenmesi");
  const o = ogrenme.get(b.e.id) ?? {};
  for (const e of ctx.enemies) o[e.typeId] = (o[e.typeId] ?? 0) + 1;
  ogrenme.set(b.e.id, o);
  const en = Object.entries(o).sort((a, c) => c[1] - a[1])[0];
  safe(() => b.e.addEffect("resistance", 30 * T, { amplifier: Math.min(2, Math.floor((en?.[1] ?? 0) / 5)), showParticles: false }));
  yield* wait(2); endCast(b);
});
ekle("emp_darbesi", 48, "EMP darbesi", 5, 25, 40, (b, ctx) => (ctx.ranged.length >= 2 ? 52 + ctx.ranged.length * 4 : 0), function* (b) {
  pay(b, "emp_darbesi"); yield* root(b, "p_thunder", 6);
  FX.sokDalgasi(b.dim, b.loc, 8); FX.flashAndShake(b.dim, b.loc, 16, 0.2);
  for (const tip of ["minecraft:arrow", "minecraft:small_fireball", "minecraft:fireball", "minecraft:shulker_bullet"])
    for (const m of safe(() => b.dim.getEntities({ type: tip, location: b.loc, maxDistance: 12 }), []) ?? []) safe(() => m.remove());
  for (const e of enemiesAround(b, b.loc, 10)) { safe(() => e.addEffect("slowness", 4 * T, { amplifier: 6 })); vur(b, e, hasar(b, 0.6), "lightning"); }
  endCast(b);
});
ekle("yildiz_kiliclari", 49, "Yıldız kılıçları", 5, 35, 60, (b, ctx) => (ctx.count >= 5 ? 52 + ctx.count * 4 : 0), function* (b, ctx) {
  pay(b, "yildiz_kiliclari"); yield* root(b, "p_dome", 8);
  for (let i = 0; i < 8; i++) {
    const e = ctx.enemies[i % Math.max(1, ctx.enemies.length)];
    if (!e || !alive(e)) continue;
    const ust = up(e.location, 8);
    for (let k = 1; k <= 4; k++) { FX.parlama(b.dim, V.add(ust, { x: 0, y: -2 * k, z: 0 }), 0.5); yield; }
    vur(b, e, hasar(b, 1.1)); FX.sokDalgasi(b.dim, e.location, 1.2);
  }
  endCast(b);
});
ekle("dev_form", 50, "Dev form", 5, 90, 85, (b, ctx) => (ctx.sev >= 80 ? 85 : 0), function* (b) {
  pay(b, "dev_form");
  // oyun varlığı oyun sırasında büyütmeye izin vermez: güç, hız, can ve adımlarda şok dalgası olarak
  safe(() => b.e.addEffect("strength", 15 * T, { amplifier: 3, showParticles: false }));
  safe(() => b.e.addEffect("resistance", 15 * T, { amplifier: 2, showParticles: false }));
  safe(() => b.e.addEffect("health_boost", 15 * T, { amplifier: 4, showParticles: false }));
  for (let t = 0; t < 15 * T; t += 10) {
    FX.sokDalgasi(b.dim, b.loc, 3);
    for (const e of enemiesAround(b, b.loc, 4)) { vur(b, e, hasar(b, 0.6)); it(b, e, 0.8, 0.3); }
    yield* wait(10);
  }
  endCast(b);
});

// yansıtıcı zırh: robota vuran düşman hasarı geri alır
{
  world.afterEvents.entityHurt.subscribe((ev) => {
    const r = ev.hurtEntity;
    const bit = yansit.get(safe(() => r.id));
    if (!bit || bit < system.currentTick) return;
    const a = ev.damageSource?.damagingEntity;
    if (!a || safe(() => a.typeId, "").startsWith("aqualit:") || safe(() => a.typeId) === "minecraft:player") return;
    safe(() => a.applyDamage(ev.damage, { cause: "thorns", damagingEntity: r }));
    FX.kivilcim(r.dimension, FX.chest(a));
  });
}

export const YENI_GUCLER2 = ["klon_firtinasi", "faz_gecisi", "dron_surusu", "roket_yumruk", "kalkan_firlatma", "kilic_kasirgasi",
  "bumerang_kilic", "hayalet_adimlar", "seken_basis", "yapisik_saldiri", "elektrik_agi", "enerji_kanatlari", "isik_kilici",
  "yansitici_zirh", "portal_kapisi", "savas_analizi", "taktik_gorus", "nanobot_surusu", "nanobot_gorusu", "nanobot_isirigi",
  "nanobot_bulutu", "nanobot_zirhi", "akilli_karsilik", "savas_ogrenmesi", "emp_darbesi", "yildiz_kiliclari", "dev_form"];
