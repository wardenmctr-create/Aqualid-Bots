// v0.5.0: Kılıçlı eksikleri.
// 1) Sahibine 1 kalpten (2 can) fazla vuran her şeye saldırır (oyuncu da olsa; diğer Aqualit varlıkları ve sahip hariç).
// 2) Sahibi başka boyuta (Nether/End) geçince takip eden Kılıçlı kendi portalını açıp yanına geçer.
// 3) Eşya toplama: robot başka boyuttaysa önce portalla sahibin yanına gelir (kilicli_ui.js).
// Yer altındaki görünmeyen moblarla uğraşmama: powers.js analyze (görüş çizgisi) + robotun hedef süzgeci (gen/entities.py).
// Oyunda denenmedi.
import { world, system } from "@minecraft/server";
import { safe, V } from "./util.js";
import { bots } from "./brain.js";
import { portalAc } from "./portalci.js";

export const KILICLI_EK = { ESIK: 2, MENZIL: 32, BOYUT_BEKLE: 60 };

const sahibi = (b) => world.getAllPlayers().find((p) => p.id === b.owner);
const kilicliler = (oid) => [...bots.values()].filter((b) => b.type === "kilicli" && b.owner === oid && b.valid);

/** Saldırganı kovalar ve vurur (en çok ~20 sn ya da hedef ölene / uzaklaşana dek). */
function* sahipKoruma(b, hedef, pl) {
  const st = b.stats ?? {};
  b.setStatus("Sahibine vuranla savaşıyor");
  for (let i = 0; i < 60; i++) {
    if (!safe(() => hedef.isValid, false)) break;
    if (safe(() => hedef.dimension.id) !== b.dim.id) break;
    if (V.dist(hedef.location, pl.location) > KILICLI_EK.MENZIL + 8) break;
    const d = V.dist(hedef.location, b.loc);
    if (d > 2.6) {
      yield* b.goTo(V.floor(hedef.location), { range: 2, maxNodes: 800, radius: 40, speed: 0.28 });
      continue;
    }
    b.face(V.floor(hedef.location));
    safe(() => hedef.applyDamage(st.hasar ?? 7, { cause: "entityAttack", damagingEntity: b.e }));
    b.setAct("attack");
    b._attackUntil = system.currentTick + 8;
    for (let t = 0; t < 12; t++) yield;
  }
  b.setStatus(b.mode === "follow" ? "Takip edip koruyor" : "Bekliyor");
}

world.afterEvents.entityHurt.subscribe((ev) => {
  const pl = ev.hurtEntity;
  if (safe(() => pl.typeId) !== "minecraft:player") return;
  if ((ev.damage ?? 0) <= KILICLI_EK.ESIK) return;
  const src = ev.damageSource;
  let a = src?.damagingEntity;
  if (!a && src?.damagingProjectile) a = safe(() => src.damagingProjectile.getComponent("minecraft:projectile")?.owner);
  if (!a || a.id === pl.id) return;
  const t = safe(() => a.typeId, "");
  if (!t || t.startsWith("aqualit:")) return;
  for (const b of kilicliler(pl.id)) {
    if (b.dim.id !== pl.dimension.id || V.dist(b.loc, pl.location) > KILICLI_EK.MENZIL) continue;
    if (b.job && b.jobName !== "sahip_koruma" && b.mode !== "follow" && b.mode !== "guard") continue;
    b.job = sahipKoruma(b, a, pl);
    b.jobName = "sahip_koruma";
    if (t === "minecraft:player") b.say(`${safe(() => a.name, "Biri")} sana vurdu, ona saldırıyorum!`);
  }
});

/** Robot sahibin boyutunda değilse kendi portalını açıp yanına geçer. Geçtiyse true. */
export function boyutaGec(b, pl) {
  if (!pl || b.dim.id === pl.dimension.id) return false;
  const PC = { portalAc };
  const yaw = safe(() => b.e.getRotation().y, 0);
  const l = b.loc;
  const p1 = PC.portalAc(b.dim, { x: l.x, y: l.y, z: l.z }, yaw, null, true, 60);
  const r = (safe(() => pl.getRotation().y, 0) * Math.PI) / 180;
  const hedef = { x: pl.location.x + Math.cos(r) * 1.5, y: pl.location.y, z: pl.location.z + Math.sin(r) * 1.5 };
  system.runTimeout(() => {
    safe(() => b.e.teleport(hedef, { dimension: pl.dimension }));
    PC.portalAc(pl.dimension, hedef, safe(() => pl.getRotation().y, 0), null, true, 40);
    safe(() => pl.dimension.playSound("mob.endermen.portal", hedef, { volume: 0.7, pitch: 1.2 }));
    b.say("Kendi portalımı açıp yanına geldim!");
  }, 20);
  void p1;
  return true;
}

// takip eden Kılıçlı, sahibi başka boyuttaysa (3 sn sonra) portalla gelir
const ayri = new Map();     // robot kimliği -> ayrı kaldığı ilk tik
system.runInterval(() => {
  const now = system.currentTick;
  for (const b of bots.values()) {
    if (b.type !== "kilicli" || !b.valid || b.mode !== "follow" || b.kostumda) continue;
    const pl = sahibi(b);
    if (!pl || pl.dimension.id === b.dim.id) { ayri.delete(b.id); continue; }
    if (!ayri.has(b.id)) { ayri.set(b.id, now); continue; }
    if (now - ayri.get(b.id) < KILICLI_EK.BOYUT_BEKLE) continue;
    ayri.delete(b.id);
    b.job = null;
    boyutaGec(b, pl);
  }
}, 20);
