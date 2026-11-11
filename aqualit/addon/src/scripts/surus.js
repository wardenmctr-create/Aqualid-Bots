// Aqualit Robotları — Arazi aracı sürüş efektleri (v0.4.1)
// Gövde hareketi (drift açısı, virajda yatma, ani frende öne dalıp yaylanma) modelde, istemcide hesaplanır
// (gen/kesif_oyun.py pre_animation). Burada: tekerleklerden zemin renginde toz, drift ve sert frende toz bulutu ve
// lastik sesi. Not: oyun binilen araca betikle itki uygulatmıyor; kayma görünüşte (gövde açısı), yol çizgisi oyunun.
import { world, system, MolangVariableMap } from "@minecraft/server";
import { safe } from "./util.js";
import { KESIF_ID, formOf, ridersOf } from "./kesif.js";

const once = new Map();      // araç kimliği -> { yaw, hiz }
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
