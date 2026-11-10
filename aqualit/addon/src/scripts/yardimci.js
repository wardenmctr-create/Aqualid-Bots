// Aqualit Robotları — Organizatör Yardımcısı (v0.4.0)
// Organizatör sandıklara kendisi yürümez: büyük Yardımcı dronu gövdesinden çıkar, sandığa uçar, eşyaları turkuaz ışınla
// ışınlar ve geri dönüp Organizatör'e yanaşır. Organizatör yerinde kalır (üste bakan sandıklar uzaktan okunur).
import { system } from "@minecraft/server";
import { V, safe } from "./util.js";
import * as FX from "./fx.js";

export const YARDIMCI = "aqualit:org_yardimci";
const HIZ = 0.9;                 // blok/tik
const aktif = new Map();         // org kimliği -> yardımcı varlığı

function* uc(e, dim, hedef) {
  for (let i = 0; i < 300; i++) {
    if (!safe(() => e.isValid, false)) return;
    const l = e.location;
    const d = V.dist(l, hedef);
    if (d < 0.3) return;
    const k = Math.min(1, HIZ / d);
    safe(() => e.teleport({ x: l.x + (hedef.x - l.x) * k, y: l.y + (hedef.y - l.y) * k, z: l.z + (hedef.z - l.z) * k },
      { dimension: dim, facingLocation: d > 1 ? { x: hedef.x, y: l.y, z: hedef.z } : undefined }));
    yield;
  }
}

/** Yardımcı sandığa (hedef blok) uçar, ışınlar, geri döner. Organizatör bu sırada yerinde bekler. */
export function* yardimciGonder(org, hedef, durum = "Yardımcısı sandığa uçtu") {
  const dim = org.dim;
  if (!hedef || safe(() => dim.id) !== org.dim.id) return;
  const ust = { x: hedef.x + 0.5, y: hedef.y + 2.6, z: hedef.z + 0.5 };
  if (V.dist(org.loc, ust) < 4) return;           // yanındaysa gerek yok
  org.setMove("none");
  org.setStatus(durum);
  org.face?.(hedef);
  let e = aktif.get(org.id);
  if (!safe(() => e?.isValid, false)) {
    e = safe(() => dim.spawnEntity(YARDIMCI, { x: org.loc.x, y: org.loc.y + 2.4, z: org.loc.z }));
    if (!e) return;
    aktif.set(org.id, e);
    safe(() => dim.playSound("beacon.activate", org.loc, { volume: 0.5, pitch: 1.6 }));
  }
  yield* uc(e, dim, ust);
  for (let i = 0; i < 8; i++) {                    // ışın: Yardımcı -> sandık
    if (i % 2 === 0) safe(() => FX.cizgi(dim, { x: ust.x, y: ust.y - 0.3, z: ust.z }, { x: hedef.x + 0.5, y: hedef.y + 1, z: hedef.z + 0.5 }, true));
    yield;
  }
  safe(() => dim.playSound("mob.shulker.teleport", ust, { volume: 0.5, pitch: 1.5 }));
  yield* uc(e, dim, { x: org.loc.x, y: org.loc.y + 2.4, z: org.loc.z });
  // bir süre işi yoksa Organizatör'e girer
  const id = org.id;
  system.runTimeout(() => {
    const y = aktif.get(id);
    if (y === e && !e._mesgul) { safe(() => e.remove()); aktif.delete(id); }
  }, 100);
}

export function yardimciOf(org) {
  const e = aktif.get(org.id);
  return safe(() => e?.isValid, false) ? e : null;
}
