// Aqualit Robotları — Kılıçlı kombolar, takım taktikleri ve takım kombolar (v0.4.3)
// Kombo: birkaç güç art arda (motor uygun anı kendisi seçer). Takım: aynı sahibin yakındaki Kılıçlıları birlikte
// hareket eder; lider en yüksek seviyeli. Taktik durumdan seçilir (otomatik).
import { system, world } from "@minecraft/server";
import { V, safe } from "./util.js";
import * as FX from "./fx.js";
import { KOMBOLAR, usePower, analyze, enemiesAround, weightOf, POWERS, POWER_LIST, CASTS, EK_FIT, pay, endCast, findStand, faceEntity } from "./powers.js";

const T = 20;
KOMBOLAR.push(
  { id: "sallanan_simsek", ad: "Sallanan şimşek", model: 3, sira: ["kanca", "yildirim_kilici"], bekle: 30 * T,
    kosul: (b, c) => c.enemies.some((e) => V.dist(e.location, b.loc) > 6) && c.count >= 2 },
  { id: "golge_simsek", ad: "Gölge şimşek", model: 4, sira: ["golge_adim", "yildirim_kilici"], bekle: 30 * T,
    kosul: (b, c) => c.ranged.length >= 1 && c.count >= 2 },
  { id: "yildirim_dususu", ad: "Yıldırım düşüşü", model: 5, sira: ["duvar_kosusu", "uzun_ucus", "meteor_dalisi"], bekle: 60 * T,
    kosul: (b, c) => c.count >= 5 },
  { id: "klon_kusatmasi", ad: "Klon kuşatması", model: 5, sira: ["zaman_yavaslatma", "ayna_klonlari", "klon_firtinasi"], bekle: 80 * T,
    kosul: (b, c) => c.count >= 6 && c.sev >= 50 },
  { id: "kara_delik_tuzagi", ad: "Kara delik tuzağı", model: 5, sira: ["elektrik_agi", "kara_delik", "gok_gurultusu"], bekle: 90 * T,
    kosul: (b, c) => c.count >= 6 && c.sev >= 60 },
  { id: "hayalet_avci", ad: "Hayalet avcı", model: 5, sira: ["gorunmezlik", "golge_adim", "hayalet_adimlar"], bekle: 60 * T,
    kosul: (b, c) => c.ranged.length >= 2 && c.count >= 4 },
  { id: "son_kale", ad: "Son kale", model: 5, sira: ["kubbe", "kalkan_uydulari", "plazma_lazeri"], bekle: 90 * T,
    kosul: (b, c) => c.ownerNear && c.ownerHp <= 10 && c.count >= 3 },
);

// ---------------------------------------------------------------- takım
export const TAKTIKLER = { kusatma: "Kuşatma", oncu: "Öncü ve destek", yem: "Yem ve pusu", kalkan_halkasi: "Kalkan halkası",
  sirali: "Sıralı vuruş", hava_yer: "Hava ve yer" };
export const TAKIM_KOMBO = { capraz_kanca: "Çapraz kanca", simsek_agi: "Şimşek ağı", cifte_golge: "Çifte gölge", firtina_cemberi: "Fırtına çemberi" };
const sonTaktik = new Map();      // sahip -> tik

/** Takımın durumuna göre taktik/takım kombosu seçer ve uygular. Uygulanan adı döner. */
export function takimHamlesi(ekip) {
  if (ekip.length < 2) return null;
  const lider = [...ekip].sort((a, c) => c.model - a.model)[0];
  const ctx = analyze(lider);
  if (!ctx) return null;
  const sec = (keys) => { let n = 0; for (const [b, k] of keys) if (b && usePower(b, k)) n++; return n; };
  const [a, c2, c3] = ekip;
  // takım kombolar (iki ya da daha çok Kılıçlı aynı anda)
  if (ctx.ranged.length && sec([[a, "kanca"], [c2, "kanca"]]) >= 2) return "capraz_kanca";
  if (ctx.count >= 6 && ekip.length >= 3 && sec([[a, "elektrik_agi"], [c2, "yildirim_firtinasi"], [c3, "gok_gurultusu"]]) >= 2) return "firtina_cemberi";
  if (ctx.count >= 4 && sec([[a, "yildirim_kilici"], [c2, "yildirim_kilici"]]) >= 2) return "simsek_agi";
  if (ctx.count >= 3 && sec([[a, "golge_adim"], [c2, "golge_adim"]]) >= 2) return "cifte_golge";
  // taktikler: konumlanma + rol
  const hedef = ctx.enemies.find((e) => weightOf(e) >= 12) ?? ctx.nearest;
  if (!hedef) return null;
  if (ctx.ownerNear && ctx.ownerHp <= 10) {                    // kalkan halkası: sahibin çevresinde halka
    const o = ctx.owner;
    ekip.forEach((b, i) => { const t = (i / ekip.length) * Math.PI * 2; safe(() => b.e.teleport({ x: o.location.x + Math.cos(t) * 2, y: o.location.y, z: o.location.z + Math.sin(t) * 2 })); });
    usePower(lider, "kubbe");
    return "kalkan_halkasi";
  }
  if (weightOf(hedef) >= 20) {                                  // kuşatma: büyük düşmanın çevresini sarar
    ekip.forEach((b, i) => { const t = (i / ekip.length) * Math.PI * 2; safe(() => b.e.teleport({ x: hedef.location.x + Math.cos(t) * 2.5, y: hedef.location.y, z: hedef.location.z + Math.sin(t) * 2.5 })); });
    return "kusatma";
  }
  if (ctx.ranged.length >= 2) {                                 // hava ve yer: biri uçar, öteki yerden
    usePower(a, "uzun_ucus"); usePower(c2, "golge_adim");
    return "hava_yer";
  }
  if (ctx.count >= 5) {                                         // öncü ve destek
    usePower(lider, "deprem"); for (const b of ekip) if (b !== lider) usePower(b, "nano_onarim");
    return "oncu";
  }
  // sıralı vuruş: aynı hedefe sırayla
  ekip.forEach((b, i) => system.runTimeout(() => safe(() => { if (b.valid && safe(() => hedef.isValid, false)) hedef.applyDamage(4 + b.model, { cause: "entityAttack", damagingEntity: b.e }); FX.parlama(b.dim, FX.chest(hedef), 0.5); }), i * 6));
  return "sirali";
}

system.runInterval(() => {
  import("./brain.js").then(({ bots }) => {
    const gruplar = new Map();
    for (const b of bots.values()) {
      if (b.type !== "kilicli" || !b.valid || b.model < 2 || b.stats?.guc === false || b.pw?.cast) continue;
      const k = `${b.owner}:${b.dim.id}`;
      let g = gruplar.get(k);
      if (!g) gruplar.set(k, (g = []));
      g.push(b);
    }
    for (const [k, g] of gruplar) {
      if (g.length < 2 || system.currentTick - (sonTaktik.get(k) ?? -1e9) < 15 * T) continue;
      const lider = g[0];
      const ekip = g.filter((x) => V.dist(x.loc, lider.loc) <= 16);
      if (ekip.length < 2 || !enemiesAround(lider, lider.loc, 16).length) continue;
      const ad = takimHamlesi(ekip);
      if (ad) {
        sonTaktik.set(k, system.currentTick);
      }
    }
  }).catch(() => {});
}, 40);

// ---------------------------------------------------------------- %101 modu (Ayar Dişlisi'nde açılır)
// 10 sn zaman durur (çevredeki düşmanlar yerinde donar), yakındaki oyuncular robotu sinematik kamerayla izler,
// robot 5 sn içinde düşmanları birer birer yok eder (normal yolla ölmeyen başka eklenti yaratıklarını kaldırır),
// 10 sn hasar almaz. Oyunculara ve Aqualit varlıklarına dokunmaz; blok kırmaz.
POWERS.mod101 = { no: 101, ad: "%101 modu", model: 5, maliyet: 0, bekle: 300 * T, ciddiyet: 101 };
if (!POWER_LIST.includes("mod101")) POWER_LIST.push("mod101");
EK_FIT.mod101 = (b, ctx) => (b.stats?.mod101 && ctx.sev >= 95 ? 200 : 0);
CASTS.mod101 = function* (b) {
  pay(b, "mod101");
  const dim = b.dim;
  const donan = enemiesAround(b, b.loc, 32);
  const yer = new Map(donan.map((e) => [e, { ...e.location }]));
  const izleyen = world.getAllPlayers().filter((p) => p.dimension.id === dim.id && V.dist(p.location, b.loc) <= 32);
  safe(() => b.e.addEffect("resistance", 10 * T, { amplifier: 255, showParticles: false }));
  FX.flashAndShake(dim, b.loc, 32, 0.4);
  for (const p of izleyen) safe(() => p.camera.fade({ fadeTime: { fadeInTime: 0.1, holdTime: 0.1, fadeOutTime: 0.4 }, fadeColor: { red: 0.9, green: 0.1, blue: 0.1 } }));
  const sira = [...donan];
  const adim = Math.max(1, Math.floor((5 * T) / Math.max(1, donan.length)));
  for (let t = 0; t < 10 * T; t++) {
    for (const [e, p] of yer) if (safe(() => e.isValid, false)) { safe(() => e.teleport(p)); safe(() => e.addEffect("slowness", 4, { amplifier: 255, showParticles: false })); }
    if (t < 5 * T && t % adim === 0 && sira.length) {
      const e = sira.shift();
      if (safe(() => e.isValid, false)) {
        faceEntity(b, e);
        const s = findStand(dim, e.location);
        FX.duman(dim, b.loc);
        if (s) safe(() => b.e.teleport(s));
        FX.simsek(dim, FX.swordTip(b), FX.chest(e), { kalin: 0.1, omur: 0.2 });
        safe(() => e.applyDamage(9999, { cause: "entityAttack", damagingEntity: b.e }));
      }
    }
    if (t % 2 === 0) {
      const a = t / 30;
      for (const p of izleyen) safe(() => p.camera.setCamera("minecraft:free", { location: { x: b.loc.x + Math.cos(a) * 6, y: b.loc.y + 3, z: b.loc.z + Math.sin(a) * 6 },
        facingLocation: { x: b.loc.x, y: b.loc.y + 1, z: b.loc.z }, easeOptions: { easeTime: 0.1, easeType: "Linear" } }));
    }
    yield;
  }
  // normal yolla ölmeyenler (başka eklenti yaratıkları): kaldır
  for (const e of donan) if (safe(() => e.isValid, false) && !safe(() => e.typeId, "").startsWith("minecraft:")) safe(() => e.remove());
  for (const p of izleyen) safe(() => p.camera.clear());
  endCast(b);
};
