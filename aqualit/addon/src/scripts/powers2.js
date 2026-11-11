// Aqualit Robotları — Kılıçlı yeni güçler (v0.4.3, büyük güncellemenin 1. parçası)
// Mevcut güç motoruna takılır (powers.js: POWERS, POWER_LIST, CASTS, EK_FIT). Her güç: seviye, bekleme, ciddiyet,
// uygunluk (durumu tartar) ve jeneratör uygulaması. Blok kırmaz, yangın çıkarmaz. Oyuncuya ve Aqualit'lere dokunmaz.
import { system } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import * as FX from "./fx.js";
import { POWERS, POWER_LIST, CASTS, EK_FIT, gucDurumu, enemiesAround, weightOf, RANGED, pay, root, endCast,
  faceEntity, findStand, ownerOf, snd, alive } from "./powers.js";

const T = 20;
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
const vur = (b, e, n, cause = "entityAttack") => safe(() => e.applyDamage(n, { cause, damagingEntity: b.e }));
const it = (b, e, k = 1, y = 0.3) => {
  const d = V.sub(e.location, b.loc);
  const L = Math.max(0.1, Math.hypot(d.x, d.z));
  safe(() => e.applyKnockback({ x: (d.x / L) * k, z: (d.z / L) * k }, y));
};
const hasar = (b, kat = 1) => Math.round((4 + b.model * 2) * kat);

function ekle(key, tanim, fitFn, cast) {
  POWERS[key] = tanim;
  if (!POWER_LIST.includes(key)) POWER_LIST.push(key);
  EK_FIT[key] = fitFn;
  CASTS[key] = cast;
}

// ---- Duvar koşusu (S2): uzaktaki düşmana duvardan sekip üstüne iner
ekle("duvar_kosusu", { no: 1, ad: "Duvar koşusu", model: 2, maliyet: 0, bekle: 10 * T, ciddiyet: 20 },
  (b, ctx, pw, near) => (near(6, 12).length ? 42 + (ctx.count >= 2 ? 6 : 0) : 0),
  function* (b, ctx) {
    const t = ctx.enemies.find((e) => { const d = V.dist(e.location, b.loc); return d >= 6 && d <= 12; });
    if (!t) return;
    pay(b, "duvar_kosusu"); faceEntity(b, t);
    yield* root(b, "p_dash", 3);
    const a = b.loc, c = t.location;
    for (let k = 1; k <= 6; k++) {
      const p = V.add(a, V.mul(V.sub(c, a), k / 6));
      safe(() => b.e.teleport({ x: p.x, y: p.y + Math.sin((k / 6) * Math.PI) * 2.5, z: p.z }));
      FX.duman(b.dim, b.loc);
      yield;
    }
    FX.sokDalgasi(b.dim, t.location, 2.5);
    vur(b, t, hasar(b, 1.2)); it(b, t, 0.8, 0.4);
    snd(b.dim, "aqualit.power.zap", t.location);
    endCast(b);
  });

// ---- Uzun uçuş (S3): sırt iticileriyle havalanır, havadan dalış saldırısı
ekle("uzun_ucus", { no: 3, ad: "Uzun uçuş", model: 3, maliyet: 0, bekle: 16 * T, ciddiyet: 30 },
  (b, ctx) => (ctx.ranged.length || ctx.count >= 3 ? 44 + ctx.ranged.length * 8 : 0),
  function* (b, ctx) {
    pay(b, "uzun_ucus");
    safe(() => b.e.addEffect("levitation", 25, { amplifier: 2, showParticles: false }));
    for (let i = 0; i < 25; i++) { if (i % 3 === 0) FX.parlama(b.dim, up(b.loc, -0.2), 0.4); yield; }
    for (const e of ctx.enemies.slice(0, 3)) {
      if (!alive(e)) continue;
      faceEntity(b, e);
      const s = findStand(b.dim, e.location);
      if (s) safe(() => b.e.teleport(s));
      FX.sokDalgasi(b.dim, e.location, 2);
      vur(b, e, hasar(b)); it(b, e, 0.6, 0.5);
      yield* wait(6);
    }
    safe(() => b.e.addEffect("slow_falling", 40, { showParticles: false }));
    endCast(b);
  });

// ---- Ayna klonları (S5): 6 yansıma her yönden saldırır (gerçek hasar)
ekle("ayna_klonlari", { no: 7, ad: "Ayna klonları", model: 5, maliyet: 0, bekle: 22 * T, ciddiyet: 50 },
  (b, ctx) => (ctx.count >= 3 ? 40 + ctx.count * 8 : 0),
  function* (b, ctx) {
    pay(b, "ayna_klonlari");
    yield* root(b, "p_dome", 8);
    const hedefler = ctx.enemies.slice(0, 6);
    for (let i = 0; i < 6; i++) {
      const e = hedefler[i % Math.max(1, hedefler.length)];
      if (!e || !alive(e)) continue;
      const a = (i / 6) * Math.PI * 2;
      const kl = { x: e.location.x + Math.cos(a) * 2, y: e.location.y + 1, z: e.location.z + Math.sin(a) * 2 };
      FX.duman(b.dim, kl); FX.parlama(b.dim, kl, 0.7);
      FX.simsek(b.dim, kl, FX.chest(e), { kalin: 0.05, omur: 0.12 });
      vur(b, e, hasar(b, 0.8));
      yield* wait(3);
    }
    endCast(b);
  });

// ---- Zaman yavaşlatma (S5): 6 sn düşmanlar ağır çekimde
ekle("zaman_yavaslatma", { no: 9, ad: "Zaman yavaşlatma", model: 5, maliyet: 0, bekle: 30 * T, ciddiyet: 45 },
  (b, ctx) => (ctx.count >= 4 || ctx.sev >= 50 ? 46 + ctx.count * 4 : 0),
  function* (b, ctx) {
    pay(b, "zaman_yavaslatma");
    yield* root(b, "p_dome", 6);
    FX.enerjiHalka(b.dim, b.loc, 4);
    for (const e of enemiesAround(b, b.loc, 16)) {
      safe(() => e.addEffect("slowness", 6 * T, { amplifier: 4, showParticles: true }));
      safe(() => e.addEffect("mining_fatigue", 6 * T, { amplifier: 2, showParticles: false }));
    }
    safe(() => b.e.addEffect("speed", 6 * T, { amplifier: 2, showParticles: false }));
    snd(b.dim, "aqualit.power.dome", b.loc, { pitch: 0.5 });
    endCast(b);
  });

// ---- Zaman durdurma (S5): 3 sn her şey donar, vurulan hasar sonunda tek seferde patlar
ekle("zaman_durdurma", { no: 10, ad: "Zaman durdurma", model: 5, maliyet: 0, bekle: 45 * T, ciddiyet: 70 },
  (b, ctx) => (ctx.sev >= 60 ? 50 + ctx.count * 5 : 0),
  function* (b, ctx) {
    pay(b, "zaman_durdurma");
    const don = enemiesAround(b, b.loc, 16);
    const yer = new Map(don.map((e) => [e, { ...e.location }]));
    FX.flashAndShake(b.dim, b.loc, 24, 0.1);
    snd(b.dim, "aqualit.power.dome", b.loc, { pitch: 0.3 });
    const birikim = new Map();
    for (let t = 0; t < 3 * T; t++) {
      for (const [e, p] of yer) if (alive(e)) safe(() => e.teleport(p));
      if (t % 10 === 0) {
        const e = don.find((x) => alive(x));
        if (e) { faceEntity(b, e); birikim.set(e, (birikim.get(e) ?? 0) + hasar(b, 0.9)); FX.parlama(b.dim, FX.chest(e), 0.6); }
      }
      yield;
    }
    for (const [e, n] of birikim) if (alive(e)) { FX.simsek(b.dim, up(e.location, 4), FX.chest(e), { kalin: 0.08, omur: 0.2 }); vur(b, e, n, "lightning"); }
    endCast(b);
  });

// ---- Geri sarma (S5): ağır hasarda 5 sn önceki yerine ve canına döner
const gecmis = new Map();          // robot kimliği -> [{p, hp, t}]
ekle("geri_sarma", { no: 11, ad: "Geri sarma", model: 5, maliyet: 0, bekle: 60 * T, ciddiyet: 40 },
  (b, ctx) => (ctx.selfRatio < 0.25 ? 95 : 0),
  function* (b) {
    const l = gecmis.get(b.id) ?? [];
    const eski = l.find((x) => system.currentTick - x.t >= 5 * T) ?? l[0];
    if (!eski) return;
    pay(b, "geri_sarma");
    FX.duman(b.dim, b.loc);
    safe(() => b.e.teleport(eski.p));
    const hp = safe(() => b.e.getComponent("minecraft:health"));
    safe(() => hp.setCurrentValue(Math.max(hp.currentValue, eski.hp)));
    FX.enerjiHalka(b.dim, b.loc, 1.5);
    snd(b.dim, "mob.endermen.portal", b.loc, { pitch: 0.6 });
    yield;
    endCast(b);
  });

// ---- Yıldırım fırtınası (S5): 10 sn yalnız düşmanlara yıldırım
ekle("yildirim_firtinasi", { no: 13, ad: "Yıldırım fırtınası", model: 5, maliyet: 0, bekle: 50 * T, ciddiyet: 65 },
  (b, ctx) => (ctx.count >= 5 ? 50 + ctx.count * 5 : 0),
  function* (b) {
    pay(b, "yildirim_firtinasi");
    yield* root(b, "p_dome", 8);
    for (let t = 0; t < 10 * T; t += 8) {
      const l = enemiesAround(b, b.loc, 16);
      const e = l[Math.floor(Math.random() * l.length)];
      if (e) {
        FX.gokSimsegi(b.dim, e.location);
        vur(b, e, hasar(b), "lightning");
        snd(b.dim, "ambient.weather.thunder", e.location, { volume: 0.5, pitch: 1.4 });
      }
      yield* wait(8);
    }
    endCast(b);
  });

// ---- Plazma lazeri (S5): kol topundan delici ışın, hattaki her düşmana
ekle("plazma_lazeri", { no: 14, ad: "Plazma lazeri", model: 5, maliyet: 0, bekle: 20 * T, ciddiyet: 45 },
  (b, ctx, pw, near) => (near(6, 30).length >= 1 && (ctx.ranged.length || weightOf(ctx.nearest) >= 12) ? 55 : 0),
  function* (b, ctx) {
    const t = ctx.ranged[0] ?? ctx.nearest;
    if (!t) return;
    pay(b, "plazma_lazeri"); faceEntity(b, t);
    yield* root(b, "p_hook", 6);
    const a = FX.handPos(b), c = FX.chest(t);
    const yon = V.sub(c, a), L = V.len(yon);
    for (let k = 0; k < 4; k++) { FX.cizgi(b.dim, a, V.add(a, V.mul(yon, 30 / Math.max(L, 0.1))), true); yield; }
    for (const e of enemiesAround(b, b.loc, 30)) {
      const r = V.sub(FX.chest(e), a);
      const proj = (r.x * yon.x + r.y * yon.y + r.z * yon.z) / Math.max(L, 0.1);
      if (proj < 0) continue;
      const yak = V.add(a, V.mul(yon, proj / Math.max(L, 0.1)));
      if (V.dist(yak, FX.chest(e)) < 1.4) { vur(b, e, hasar(b, 1.5)); FX.parlama(b.dim, FX.chest(e), 0.7); }
    }
    snd(b.dim, "aqualit.power.zap", b.loc, { pitch: 0.7 });
    endCast(b);
  });

// ---- Enerji küresi (S4): uçan küre çarpınca patlar, sersemletir
ekle("enerji_kuresi", { no: 15, ad: "Enerji küresi", model: 4, maliyet: 0, bekle: 14 * T, ciddiyet: 30 },
  (b, ctx, pw, near) => (near(4, 16).length >= 2 ? 45 + near(4, 16).length * 5 : 0),
  function* (b, ctx) {
    const t = ctx.enemies.find((e) => V.dist(e.location, b.loc) >= 4) ?? ctx.nearest;
    if (!t) return;
    pay(b, "enerji_kuresi"); faceEntity(b, t);
    yield* root(b, "p_hook", 4);
    let p = FX.handPos(b);
    for (let i = 0; i < 20 && alive(t); i++) {
      const c = FX.chest(t), d = V.sub(c, p), L = V.len(d);
      if (L < 0.8) break;
      p = V.add(p, V.mul(d, Math.min(1, 1.2 / L)));
      FX.enerjiHalka(b.dim, p, 0.4); FX.parlama(b.dim, p, 0.5);
      yield;
    }
    FX.sokDalgasi(b.dim, p, 3); FX.flashAndShake(b.dim, p, 12, 0.15);
    for (const e of enemiesAround(b, p, 3.5)) { vur(b, e, hasar(b)); safe(() => e.addEffect("slowness", 3 * T, { amplifier: 5 })); }
    snd(b.dim, "random.explode", p, { volume: 0.5, pitch: 1.6 });
    endCast(b);
  });

// ---- Kara delik (S5): içine çeker, sıkıştırır, patlatır
ekle("kara_delik", { no: 16, ad: "Kara delik", model: 5, maliyet: 0, bekle: 40 * T, ciddiyet: 70 },
  (b, ctx) => (ctx.count >= 5 ? 55 + ctx.count * 4 : 0),
  function* (b, ctx) {
    pay(b, "kara_delik");
    const m = ctx.enemies.slice(0, 6).reduce((a, e) => V.add(a, V.mul(e.location, 1 / Math.min(6, ctx.enemies.length))), { x: 0, y: 0, z: 0 });
    const merkez = up(m, 1);
    yield* root(b, "p_dome", 6);
    for (let t = 0; t < 40; t++) {
      if (t % 2 === 0) { FX.duman(b.dim, merkez); FX.enerjiHalka(b.dim, merkez, 1.2 - t / 50); }
      for (const e of enemiesAround(b, merkez, 9)) {
        const d = V.sub(merkez, e.location), L = Math.max(0.3, Math.hypot(d.x, d.z));
        safe(() => e.applyKnockback({ x: (d.x / L) * 0.35, z: (d.z / L) * 0.35 }, 0.05));
      }
      yield;
    }
    FX.sokDalgasi(b.dim, merkez, 5); FX.flashAndShake(b.dim, merkez, 20, 0.3);
    for (const e of enemiesAround(b, merkez, 4)) vur(b, e, hasar(b, 2));
    snd(b.dim, "random.explode", merkez, { volume: 0.8, pitch: 0.6 });
    endCast(b);
  });

// ---- Yerçekimi kontrolü (S5): havaya kaldırır, yere çarpar
ekle("yercekimi", { no: 17, ad: "Yerçekimi kontrolü", model: 5, maliyet: 0, bekle: 25 * T, ciddiyet: 45 },
  (b, ctx) => (ctx.count >= 3 ? 44 + ctx.count * 5 : 0),
  function* (b) {
    pay(b, "yercekimi");
    yield* root(b, "p_dome", 5);
    const l = enemiesAround(b, b.loc, 10);
    for (const e of l) safe(() => e.addEffect("levitation", 20, { amplifier: 3, showParticles: true }));
    yield* wait(22);
    for (const e of l) { safe(() => e.removeEffect("levitation")); safe(() => e.applyKnockback({ x: 0, z: 0 }, -1.5)); }
    yield* wait(8);
    for (const e of l) { if (alive(e)) { vur(b, e, hasar(b, 1.2)); FX.sokDalgasi(b.dim, e.location, 1.5); } }
    endCast(b);
  });

// ---- Manyetik fırtına (S5): okları ve ateş toplarını durdurur
ekle("manyetik_firtina", { no: 18, ad: "Manyetik fırtına", model: 5, maliyet: 0, bekle: 18 * T, ciddiyet: 35 },
  (b, ctx) => (ctx.ranged.length >= 2 ? 50 + ctx.ranged.length * 8 : 0),
  function* (b) {
    pay(b, "manyetik_firtina");
    for (let t = 0; t < 6 * T; t += 2) {
      for (const tip of ["minecraft:arrow", "minecraft:small_fireball", "minecraft:fireball", "minecraft:shulker_bullet", "minecraft:wither_skull"]) {
        for (const m of safe(() => b.dim.getEntities({ type: tip, location: b.loc, maxDistance: 8 }), []) ?? []) {
          FX.kivilcim(b.dim, m.location); safe(() => m.remove());
        }
      }
      if (t % 10 === 0) FX.enerjiHalka(b.dim, up(b.loc, 1), 2.5);
      yield* wait(2);
    }
    endCast(b);
  });

// ---- Görünmezlik (S5): 10 sn görünmez; arkadan ilk darbe 3 kat
ekle("gorunmezlik", { no: 20, ad: "Görünmezlik", model: 5, maliyet: 0, bekle: 30 * T, ciddiyet: 30 },
  (b, ctx) => (ctx.selfRatio < 0.5 || ctx.count >= 4 ? 45 : 0),
  function* (b, ctx) {
    pay(b, "gorunmezlik");
    FX.duman(b.dim, b.loc);
    safe(() => b.e.addEffect("invisibility", 10 * T, { showParticles: false }));
    yield* wait(10);
    const t = ctx.nearest;
    if (t && alive(t)) {
      const arka = V.add(t.location, V.mul(V.sub(t.location, b.loc), 0.2));
      const s = findStand(b.dim, arka);
      if (s) safe(() => b.e.teleport(s));
      vur(b, t, hasar(b, 3));
      FX.parlama(b.dim, FX.chest(t), 1);
    }
    endCast(b);
  });

// ---- Meteor dalışı (S4): yükselip çakılır, şok patlaması (blok kırmaz)
ekle("meteor_dalisi", { no: 26, ad: "Meteor dalışı", model: 4, maliyet: 0, bekle: 20 * T, ciddiyet: 40 },
  (b, ctx, pw, near) => (near(0, 7).length >= 3 ? 46 + near(0, 7).length * 5 : 0),
  function* (b) {
    pay(b, "meteor_dalisi");
    safe(() => b.e.addEffect("levitation", 12, { amplifier: 6, showParticles: false }));
    yield* wait(14);
    safe(() => b.e.applyKnockback({ x: 0, z: 0 }, -2));
    for (let i = 0; i < 12 && !safe(() => b.e.isOnGround, true); i++) { FX.parlama(b.dim, b.loc, 0.8); yield; }
    FX.sokDalgasi(b.dim, b.loc, 6); FX.flashAndShake(b.dim, b.loc, 16, 0.35);
    for (const e of enemiesAround(b, b.loc, 6)) { vur(b, e, hasar(b, 1.4)); it(b, e, 1.2, 0.6); }
    snd(b.dim, "random.explode", b.loc, { volume: 0.7, pitch: 0.8 });
    endCast(b);
  });

// ---- Deprem darbesi (S4): halka halka şok dalgası, havaya fırlatır
ekle("deprem", { no: 27, ad: "Deprem darbesi", model: 4, maliyet: 0, bekle: 22 * T, ciddiyet: 40 },
  (b, ctx, pw, near) => (near(0, 10).length >= 4 ? 48 + near(0, 10).length * 4 : 0),
  function* (b) {
    pay(b, "deprem");
    yield* root(b, "p_thunder", 8);
    for (let r = 2; r <= 8; r += 2) {
      FX.sokDalgasi(b.dim, b.loc, r);
      for (const e of enemiesAround(b, b.loc, r)) if (V.dist(e.location, b.loc) > r - 2) { vur(b, e, hasar(b, 0.7)); it(b, e, 0.5, 0.7); }
      snd(b.dim, "dig.stone", b.loc, { pitch: 0.4 });
      yield* wait(4);
    }
    endCast(b);
  });

// ---- Nano onarım (S5): kendini ve sahibini iyileştirir, takımın canını doldurur
ekle("nano_onarim", { no: 35, ad: "Nano onarım", model: 5, maliyet: 0, bekle: 35 * T, ciddiyet: 20 },
  (b, ctx) => (ctx.selfRatio < 0.5 || ctx.ownerHp <= 10 ? 60 : 0),
  function* (b, ctx) {
    pay(b, "nano_onarim");
    yield* root(b, "p_dome", 6);
    const o = ownerOf(b);
    for (const e of [b.e, o].filter(Boolean)) {
      const hp = safe(() => e.getComponent("minecraft:health"));
      safe(() => hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + hp.effectiveMax * 0.5)));
      FX.parilti(b.dim, up(e.location, 1)); FX.enerjiHalka(b.dim, e.location, 1);
    }
    safe(() => o?.addEffect("regeneration", 5 * T, { amplifier: 1 }));
    snd(b.dim, "random.levelup", b.loc, { pitch: 1.6, volume: 0.6 });
    endCast(b);
  });

// ---- Kalkan uyduları (S5): sahibin etrafında 3 kalkan (direnç)
ekle("kalkan_uydulari", { no: 36, ad: "Kalkan uyduları", model: 5, maliyet: 0, bekle: 40 * T, ciddiyet: 35 },
  (b, ctx) => (ctx.ownerNear && (ctx.ranged.length >= 1 || ctx.ownerHp <= 12) ? 52 : 0),
  function* (b) {
    pay(b, "kalkan_uydulari");
    const o = ownerOf(b);
    if (!o) return endCast(b);
    safe(() => o.addEffect("resistance", 10 * T, { amplifier: 2, showParticles: false }));
    for (let t = 0; t < 10 * T; t += 3) {
      for (let i = 0; i < 3; i++) {
        const a = t / 10 + (i * Math.PI * 2) / 3;
        FX.parilti(b.dim, { x: o.location.x + Math.cos(a) * 1.3, y: o.location.y + 1.1, z: o.location.z + Math.sin(a) * 1.3 });
      }
      yield* wait(3);
    }
    endCast(b);
  });

// ---- Son form (S5): 20 sn bekleme süreleri sıfır, şimşek aurası
ekle("son_form", { no: 40, ad: "Son form", model: 5, maliyet: 0, bekle: 120 * T, ciddiyet: 90 },
  (b, ctx) => (ctx.sev >= 85 ? 90 : 0),
  function* (b) {
    pay(b, "son_form");
    const pw = gucDurumu(b);
    FX.flashAndShake(b.dim, b.loc, 24, 0.3);
    for (let t = 0; t < 20 * T; t += 5) {
      for (const k of Object.keys(pw.cd)) if (k !== "son_form") pw.cd[k] = 0;
      FX.simsek(b.dim, up(b.loc, 2.2), V.add(b.loc, { x: FX.rnd() * 1.5, y: 0.2, z: FX.rnd() * 1.5 }), { kalin: 0.05, omur: 0.15 });
      yield* wait(5);
    }
    safe(() => b.e.addEffect("slowness", 4 * T, { amplifier: 1, showParticles: false }));
    endCast(b);
  });

// geri sarma için konum/can geçmişi (her 10 tikte)
system.runInterval(() => {
  import("./brain.js").then(({ bots }) => {
    for (const b of bots.values()) {
      if (b.type !== "kilicli" || b.model < 5 || !b.valid) continue;
      const l = gecmis.get(b.id) ?? [];
      const hp = safe(() => b.e.getComponent("minecraft:health")?.currentValue, 20);
      l.push({ p: { ...b.loc }, hp, t: system.currentTick });
      while (l.length > 12) l.shift();
      gecmis.set(b.id, l);
    }
  }).catch(() => {});
}, 10);

export const YENI_GUCLER = ["duvar_kosusu", "uzun_ucus", "ayna_klonlari", "zaman_yavaslatma", "zaman_durdurma", "geri_sarma",
  "yildirim_firtinasi", "plazma_lazeri", "enerji_kuresi", "kara_delik", "yercekimi", "manyetik_firtina", "gorunmezlik",
  "meteor_dalisi", "deprem", "nano_onarim", "kalkan_uydulari", "son_form"];
