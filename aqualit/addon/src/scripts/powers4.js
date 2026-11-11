// Aqualit Robotları — Kılıçlı kombolar, takım taktikleri ve takım kombolar (v0.4.3)
// Kombo: birkaç güç art arda (motor uygun anı kendisi seçer). Takım: aynı sahibin yakındaki Kılıçlıları birlikte
// hareket eder; lider en yüksek seviyeli. Taktik durumdan seçilir (otomatik).
import { system } from "@minecraft/server";
import { V, safe } from "./util.js";
import * as FX from "./fx.js";
import { KOMBOLAR, usePower, analyze, enemiesAround, weightOf } from "./powers.js";

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
