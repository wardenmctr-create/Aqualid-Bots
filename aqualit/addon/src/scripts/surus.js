// Aqualit Robotları — Arazi aracı sürüş efektleri (v0.4.1)
// Gövde hareketi (drift açısı, virajda yatma, ani frende öne dalıp yaylanma) modelde, istemcide hesaplanır
// (gen/kesif_oyun.py pre_animation). Burada: tekerleklerden zemin renginde toz, drift ve sert frende toz bulutu ve
// lastik sesi. Not: oyun binilen araca betikle itki uygulatmıyor; kayma görünüşte (gövde açısı), yol çizgisi oyunun.
import { world, system, MolangVariableMap } from "@minecraft/server";
import { safe } from "./util.js";
import { KESIF_ID, formOf, ridersOf } from "./kesif.js";

const once = new Map();      // araç kimliği -> { yaw, hiz }
// v0.4.1 rampa uçuşu: hızla rampadan çıkınca araç havalanır, süzülür; inince yaylanır, toz kalkar; süre ve rekor
const ucus = new Map();      // araç kimliği -> { havada, bas, x, z, yer: kaç örnek yerdeydi }
// rampa: araç en az YOKUS_MIN tik (örnekleme 2 tikte bir) yokuş çıkıp (burnu yukarıda) hızla yerden ayrılınca uçar.
// Tek blokluk basamak sayılmaz. Minecraft vagonu gibi: hız, rampa eğimi ve rampa yüksekliği ne kadarsa o kadar
// yükseğe ve uzağa.
export const UCUS = { HIZ: 0.3, MIN_SURE: 8, YOKUS_MIN: 20 };   // YOKUS_MIN: en az 1 sn (20 tik) rampada
const RENK = [
  [/sand|sandstone/, [0.86, 0.79, 0.55]],
  [/snow|ice/, [0.95, 0.97, 1]],
  [/grass|moss|podzol|mycelium/, [0.55, 0.45, 0.3]],
  [/dirt|farmland|mud|path|clay/, [0.52, 0.38, 0.24]],
  [/gravel|stone|deepslate|andesite|tuff|cobble/, [0.6, 0.6, 0.6]],
  [/netherrack|crimson|nylium/, [0.55, 0.2, 0.18]],
  [/soul/, [0.4, 0.33, 0.27]],
  [/end_stone/, [0.88, 0.88, 0.66]],
];
function zeminRengi(dim, p) {
  const t = safe(() => dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y - 0.2), z: Math.floor(p.z) })?.typeId, "") ?? "";
  if (!t || t === "minecraft:air" || /water|lava/.test(t)) return null;
  for (const [re, c] of RENK) if (re.test(t)) return c;
  return [0.55, 0.5, 0.42];
}
function toz(dim, p, n, c) {
  const mv = new MolangVariableMap();
  mv.setFloat("variable.n", n);
  mv.setFloat("variable.r", c[0]);
  mv.setFloat("variable.g", c[1]);
  mv.setFloat("variable.b", c[2]);
  safe(() => dim.spawnParticle("aqualit:toz", p, mv));
}

/** Bir arazi aracının bu adımdaki sürüş durumu (test için dışarı açık). */
export function surusDurumu(v, onceki) {
  const vel = safe(() => v.getVelocity(), { x: 0, y: 0, z: 0 }) ?? { x: 0, y: 0, z: 0 };
  const hiz = Math.hypot(vel.x, vel.z);                       // blok/tik
  const yaw = safe(() => v.getRotation().y, 0) ?? 0;
  let dn = onceki ? yaw - onceki.yaw : 0;
  dn = ((dn + 540) % 360) - 180;                              // derece/2 tik
  const fren = onceki ? Math.max(0, onceki.hiz - hiz) : 0;
  const drift = Math.abs(dn) * hiz;                           // dönüş x hız
  return { hiz, yaw, dn, fren, drift };
}

system.runInterval(() => {
  for (const pl of world.getAllPlayers()) {
    const v = safe(() => pl.getComponent("minecraft:riding")?.entityRidingOn);
    if (!v || safe(() => v.typeId) !== KESIF_ID || formOf(v) !== "arazi") continue;
    if (ridersOf(v)[0] !== pl) continue;                       // yalnız sürücü için bir kez
    const d = surusDurumu(v, once.get(v.id));
    once.set(v.id, { yaw: d.yaw, hiz: d.hiz });
    rampa(pl, v, d);
    if (d.hiz < 0.08) continue;
    const dim = v.dimension, l = v.location;
    const r = (d.yaw * Math.PI) / 180;
    const ileri = { x: -Math.sin(r), z: Math.cos(r) }, sag = { x: -Math.cos(r), z: -Math.sin(r) };
    const c = zeminRengi(dim, l);
    if (!c) continue;
    const arka = (s) => ({ x: l.x - ileri.x * 1.5 + sag.x * s, y: l.y + 0.15, z: l.z - ileri.z * 1.5 + sag.z * s });
    // normal sürüşte az toz; drift ve sert frende bulut
    let n = d.hiz > 0.35 ? 1 : 0;
    if (d.drift > 2.2) n = Math.min(6, 2 + Math.round(d.drift / 3));
    if (d.fren > 0.06) n = Math.max(n, Math.min(6, Math.round(d.fren * 40)));
    if (n) { toz(dim, arka(1.05), n, c); toz(dim, arka(-1.05), n, c); }
    if (d.fren > 0.08) {
      const on = (s) => ({ x: l.x + ileri.x * 1.4 + sag.x * s, y: l.y + 0.15, z: l.z + ileri.z * 1.4 + sag.z * s });
      toz(dim, on(1), 3, c); toz(dim, on(-1), 3, c);
    }
    if ((d.drift > 3.5 || d.fren > 0.1) && system.currentTick % 6 === 0)
      safe(() => dim.playSound("step.gravel", l, { volume: 0.8, pitch: 0.6 + Math.random() * 0.3 }));
  }
}, 2);

/** Rampa uçuşu: kalkış (yerden hızla, yukarı doğru ayrılınca kısa kaldırma), süzülme, iniş. */
export function rampa(pl, v, d) {
  if (safe(() => v.getProperty("aqualit:tutucu"), false)) return;     // yapışkan modda yüzeye tutunur
  const yerde = safe(() => v.isOnGround, true);
  const vel = safe(() => v.getVelocity(), { x: 0, y: 0, z: 0 }) ?? { x: 0, y: 0, z: 0 };
  let u = ucus.get(v.id);
  if (!u) ucus.set(v.id, (u = { havada: false, bas: 0, yer: 0, x: 0, z: 0, yokus: 0, y: v.location.y }));
  const t = system.currentTick;
  const dy = v.location.y - (u.y ?? v.location.y);
  u.y = v.location.y;
  if (yerde) {
    // yokuş süresi: hızla yukarı çıkarken artar, düzde yavaşça azalır (rampanın ucundaki düzlük sayacı silmez), inişte sıfır
    if (dy > 0.04 && d.hiz > 0.12) { if (!u.yokus) u.yBas = v.location.y - dy; u.yokus += 2; u.yDy = (u.yDy ?? 0) + dy; u.yDx = (u.yDx ?? 0) + d.hiz * 2; }
    else if (dy < -0.04) { u.yokus = 0; u.yDy = 0; u.yDx = 0; }
    else u.yokus = Math.max(0, u.yokus - 1);
    if (u.havada) {                                        // iniş
      u.havada = false;
      safe(() => v.removeEffect("slow_falling"));
      safe(() => v.removeEffect("levitation"));
      const sure = t - u.bas;
      if (u.ucus && sure >= UCUS.MIN_SURE) {
        const l = v.location;
        const mesafe = Math.round(Math.hypot(l.x - u.x, l.z - u.z));
        const c = zeminRengi(v.dimension, l) ?? [0.55, 0.5, 0.42];
        const r = (d.yaw * Math.PI) / 180;
        for (const [fx, sx] of [[1.4, 1], [1.4, -1], [-1.5, 1], [-1.5, -1]]) {
          toz(v.dimension, { x: l.x - Math.sin(r) * fx - Math.cos(r) * sx, y: l.y + 0.15, z: l.z + Math.cos(r) * fx - Math.sin(r) * sx }, 5, c);
        }
        safe(() => v.dimension.playSound("mob.irongolem.walk", l, { volume: 1, pitch: 0.6 }));
        safe(() => v.dimension.playSound("step.gravel", l, { volume: 1, pitch: 0.5 }));
        const sn = (sure / 20).toFixed(1);
        const rekor = Number(safe(() => pl.getDynamicProperty("aq:ucus_rekor"), 0) ?? 0);
        const yeni = sure > rekor;
        if (yeni) safe(() => pl.setDynamicProperty("aq:ucus_rekor", sure));
        safe(() => pl.onScreenDisplay.setActionBar(`§b✈ Uçuş: §f${sn} sn · ${mesafe} blok${yeni ? " §6§l YENİ REKOR!" : ` §7(rekor ${(rekor / 20).toFixed(1)} sn)`}`));
        if (yeni && sure > 20) safe(() => pl.playSound("random.levelup", { pitch: 1.4 }));
      }
    }
    u.yer = Math.min(u.yer + 1, 10);
    return;
  }
  if (!u.havada) {
    // kalkış: bir süredir yerdeydi, hızlı gidiyor ve yukarı doğru ayrıldı (rampa) ya da hızla kenardan uçtu
    u.havada = true;
    u.bas = t;
    u.x = v.location.x;
    u.z = v.location.z;
    if (u.yokus >= UCUS.YOKUS_MIN && d.hiz >= UCUS.HIZ) {
      // vagon gibi: rampanın eğimi ve hızla fırlar. Kalkış dikey hızı = hız x sin(eğim); tepe yüksekliği v²/2g
      // (oyunun yerçekimi 0.08 blok/tik²), biraz abartılı (x1.6). Kaldırma: havalanma etkisi (amp 3 ≈ 0.2 blok/tik).
      const egim = (u.yDy ?? 0) / Math.max(0.1, u.yDx ?? 0);
      const vy0 = d.hiz * (egim / Math.sqrt(1 + egim * egim));
      // rampanın yüksekliği: tırmanırken Y koordinatının ne kadar arttığı (tırmanış başı -> kalkış anı).
      // Yüksek rampa = daha yükseğe ve (uzun süzülmeyle) daha uzağa
      const rampaY = Math.max(0, v.location.y - (u.yBas ?? v.location.y));
      const H = Math.min(30, (vy0 * vy0) / (2 * 0.08) * 1.6 + rampaY * 0.4 + 0.8);
      const sure = Math.max(3, Math.round(H / 0.2));
      u.tepe = H;
      safe(() => v.addEffect("levitation", sure, { amplifier: 3, showParticles: false }));
      // süzülme süresi: hız ve rampa yüksekliğiyle uzar (en çok 6 sn) — uzaklığı belirler
      const hizK = Math.min(1, Math.max(0, (d.hiz - UCUS.HIZ) / 0.7));
      u.suzul = Math.round(20 * Math.min(6, 1.5 + hizK * 2.5 + rampaY / 6));
      safe(() => v.addEffect("slow_falling", u.suzul, { amplifier: 0, showParticles: false }));
      safe(() => v.dimension.playSound("mob.horse.jump", v.location, { volume: 0.8, pitch: 0.8 }));
      u.ucus = true;
    } else u.ucus = false;
    u.yokus = 0; u.yDy = 0; u.yDx = 0;
    u.yer = 0;
    return;
  }
  // havada: 6 saniyeden uzun kalırsa süzülme biter (sonsuz uçmasın)
  if (t - u.bas > (u.suzul ?? 120)) safe(() => v.removeEffect("slow_falling"));
}
