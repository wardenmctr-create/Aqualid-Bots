// Aqualit Robotları — Kılıçlı takım davranışı (V3)
//  · Canı azalınca: tamir kiti varsa kendini onarır, yoksa geri çekilip toparlanır, sonra savaşa döner.
//  · Takım arkadaşı (sahibi ya da sahibinin robotları) saldırıya uğrarsa yardıma koşar.
//  · Canı azalan robotu kitle onarır, kapanıp heykele dönmüş robotu kitle uyandırır.
import { world, system } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import { ROBOT_ID } from "./constants.js";
import { STATUE_ID, kitCharges, addKitCharges, reviveByRobot, statueOwner } from "./statue.js";

const T = 20;
const LOW = 0.35; // bu oranın altında can azdır
const OK = 0.7; // geri çekilme bu orana kadar sürer
const KIT_ID = "aqualit:tamir_kiti";

/** sahip -> son saldırı bilgisi {attackerId, victimId, tick} */
const alerts = new Map();
let GB = () => undefined; // getBot (brain.js'ten wireTeam ile gelir)

function hpRatio(e) {
  const h = safe(() => e.getComponent("minecraft:health"), null);
  if (!h) return 1;
  return h.currentValue / Math.max(1, h.effectiveMax);
}

function ownerOf(b) {
  return world.getAllPlayers().find((p) => p.id === b.owner);
}

function state(b) {
  if (!b.tm) b.tm = { retreat: false, lastKit: -9999, lastScan: 0, lastAssist: 0 };
  return b.tm;
}

/** Robotun kendini ya da bir arkadaşını kitle onarması (kit eline gelir, kıvılcımlar, ses). */
function* repairWith(b, target, label) {
  b.setMove("none");
  b.holdTool(KIT_ID);
  b.setAct("kit");
  const dim = b.dim;
  for (let i = 0; i < 6; i++) {
    const p = target.location ?? target;
    safe(() => dim.spawnParticle("minecraft:villager_happy", { x: p.x + (Math.random() - 0.5), y: p.y + 0.6 + Math.random(), z: p.z + (Math.random() - 0.5) }));
    if (i % 2 === 0) safe(() => dim.playSound("random.anvil_use", p, { volume: 0.25, pitch: 1.5 + i * 0.08 }));
    yield* wait(4);
  }
  safe(() => target.getComponent?.("minecraft:health")?.resetToMaxValue());
  safe(() => target.addEffect?.("resistance", 60, { amplifier: 1, showParticles: false }));
  safe(() => dim.playSound("random.levelup", target.location ?? target, { volume: 0.4, pitch: 1.8 }));
  const left = addKitCharges(b, -1);
  b.setAct("none");
  b.holdTool("aqualit:aqualit_sword");
  const o = ownerOf(b);
  if (o) safe(() => o.onScreenDisplay.setActionBar(`§s${b.name}§r: ${label} §7(kalan tamir hakkı ${left})`));
}

function* healTrip(b, mate) {
  b.setStatus(`${mate.name} onarılıyor`);
  const ok = yield* b.walkTo((c) => V.dist(c, mate.loc) <= 2.5, (c) => V.manhattan(c, V.floor(mate.loc)),
    { speed: 0.25, maxNodes: 1500, radius: 32, partial: true });
  if (!mate.valid) return;
  if (!ok && V.dist(b.loc, mate.loc) > 4) return;
  b.face(V.floor(mate.loc));
  yield* repairWith(b, mate.e, `${mate.name} onarıldı`);
  b.say(`${mate.name} yaralanmıştı, tamir kitiyle onardım.`);
}

function* reviveTrip(b, pos) {
  b.setStatus("Kapanan arkadaşını uyandırıyor");
  const ok = yield* b.goReach(pos, { speed: 0.25, maxNodes: 1500, radius: 32 });
  if (!ok && V.dist(b.loc, pos) > 4) return;
  const block = safe(() => b.dim.getBlock(pos));
  if (!block || block.typeId !== STATUE_ID) return;
  const owner = ownerOf(b);
  if (!owner) return;
  b.face(pos);
  b.setMove("none");
  b.holdTool(KIT_ID);
  b.setAct("kit");
  for (let i = 0; i < 10; i++) {
    safe(() => b.dim.spawnParticle("minecraft:villager_happy", { x: pos.x + Math.random(), y: pos.y + 0.4 + Math.random(), z: pos.z + Math.random() }));
    if (i % 2 === 0) safe(() => b.dim.playSound("random.anvil_use", pos, { volume: 0.25, pitch: 1.4 + i * 0.05 }));
    yield* wait(4);
  }
  b.setAct("none");
  b.holdTool("aqualit:aqualit_sword");
  if (reviveByRobot(owner, block, b.name)) addKitCharges(b, -1);
}

function* assistTrip(b, attacker) {
  b.setStatus("Takım arkadaşına yardıma koşuyor");
  yield* b.walkTo((c) => V.dist(c, attacker.location) <= 4, (c) => V.manhattan(c, V.floor(attacker.location)),
    { speed: 0.3, maxNodes: 1200, radius: 40, partial: true });
}

/** Kılıçlı her tik çağırır (işler 10 tikte bir). */
export function teamTick(b) {
  const now = system.currentTick;
  if (now % 10 !== 5) return; // güç kararlarıyla aynı tike düşmesin
  const tm = state(b);
  const ratio = hpRatio(b.e);
  const kits = kitCharges(b);
  // 1) can az
  if (ratio < LOW && !b.job && !b.pw?.cast) {
    if (kits > 0 && now - tm.lastKit > 6 * T) {
      tm.lastKit = now;
      b.job = repairWith(b, b.e, "kendini onardı");
      return;
    }
    if (!tm.retreat) {
      tm.retreat = true;
      safe(() => b.e.triggerEvent("aqualit:retreat_on"));
      safe(() => b.e.addEffect("regeneration", 20 * 30, { amplifier: 1, showParticles: false }));
      b.setStatus("Geri çekilip toparlanıyor");
      b.say("Canım az, geri çekilip toparlanıyorum. Bana tamir kiti verirsen hemen iyileşirim.");
    }
    return;
  }
  // 2) toparlandı
  if (tm.retreat && ratio >= OK) {
    tm.retreat = false;
    safe(() => b.e.triggerEvent("aqualit:fight_on"));
    safe(() => b.e.removeEffect("regeneration"));
    b.setStatus("Takip edip koruyor");
    b.say("Toparlandım, savaşa dönüyorum!");
  }
  if (tm.retreat || b.job || b.pw?.cast) return;
  // 3) saldırıya uğrayan takım arkadaşına yardım
  const al = alerts.get(b.owner);
  if (al && now - al.tick < 5 * T && now - tm.lastAssist > 3 * T) {
    const attacker = safe(() => world.getEntity(al.attackerId));
    if (attacker && safe(() => attacker.isValid, false) && attacker.dimension === b.dim) {
      const d = V.dist(attacker.location, b.loc);
      if (d > 5 && d < 32) {
        tm.lastAssist = now;
        b.job = assistTrip(b, attacker);
        return;
      }
    }
  }
  if (kits <= 0) return;
  // 4) canı azalan robot arkadaşını onar
  const mates = safe(() => b.dim.getEntities({ type: ROBOT_ID, location: b.loc, maxDistance: 16 }), []);
  for (const m of mates) {
    if (m.id === b.id) continue;
    const mb = GB(m);
    if (!mb || mb.owner !== b.owner) continue;
    if (hpRatio(m) < 0.4) {
      b.job = healTrip(b, mb);
      return;
    }
  }
  // 5) kapanıp heykele dönmüş arkadaşını uyandır (5 sn'de bir bakar)
  if (now - tm.lastScan > 5 * T) {
    tm.lastScan = now;
    const owner = ownerOf(b);
    if (!owner) return;
    for (const p of b.scan([STATUE_ID], b.loc, 12, 4, 12, 4)) {
      const blk = safe(() => b.dim.getBlock(p));
      if (blk && statueOwner(blk) === b.owner) {
        b.job = reviveTrip(b, p);
        return;
      }
    }
  }
}

/** Saldırıları dinler: sahibine ya da robotlarından birine bir yaratık vurursa kılıçlılar haberdar olur. */
export function wireTeam(getBot) {
  GB = getBot;
  world.afterEvents.entityHurt.subscribe((ev) => {
    const victim = ev.hurtEntity;
    const src = ev.damageSource;
    const attacker = src?.damagingEntity;
    if (!attacker || !victim) return;
    const at = safe(() => attacker.typeId, "");
    if (!at || at === "minecraft:player" || at === ROBOT_ID) return;
    const vt = safe(() => victim.typeId, "");
    let ownerId = "";
    if (vt === "minecraft:player") ownerId = victim.id;
    else if (vt === ROBOT_ID) ownerId = getBot(victim)?.owner ?? "";
    if (!ownerId) return;
    alerts.set(ownerId, { attackerId: attacker.id, victimId: victim.id, tick: system.currentTick });
  });
}
