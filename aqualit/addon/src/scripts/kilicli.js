// Aqualit Robotları — Kılıçlı robot: seviye, istatistik, modlar
import { world, system } from "@minecraft/server";
import { getJSON, setJSON, getProp, setProp } from "./store.js";
import { KILICLI_MODELS, DMG_TIERS } from "./constants.js";
import { V, safe, clamp } from "./util.js";
import { powersTick } from "./powers.js";
import { teamTick } from "./takim.js";

const BASE_HEALTH = 20; // aqualit:kilicli bileşen grubundaki temel can

export function defaultStats(model) {
  const m = KILICLI_MODELS[model] ?? KILICLI_MODELS[1];
  return { model, can: m.can, hasar: m.hasar, hiz: m.hiz, enerji: 50 + model * 50, ciddiyet: 100, mod101: false,
    tarz: "dengeli", guc: true };
}

export function getStats(b) {
  const s = getJSON(b.e, "aq:stats", null);
  return s ?? defaultStats(b.model);
}

export function nearestTier(v) {
  let best = DMG_TIERS[0];
  for (const t of DMG_TIERS) if (Math.abs(t - v) < Math.abs(best - v)) best = t;
  return best;
}

/** İstatistikleri varlığa uygular (bileşen grupları + sağlık takviyesi). */
export function applyStats(b, s, heal = false) {
  const e = b.e;
  safe(() => e.setProperty("aqualit:model", clamp(s.model, 1, 5)));
  if (b.model !== s.model) {
    b.model = s.model;
    setProp(e, "aq:model", s.model);
  }
  safe(() => e.triggerEvent(`aqualit:dmg_${nearestTier(s.hasar)}`));
  safe(() => e.triggerEvent(`aqualit:spd_${clamp(Math.round(s.hiz), 1, 10)}`));
  const extra = Math.max(0, s.can - BASE_HEALTH);
  safe(() => e.removeEffect("health_boost"));
  if (extra > 0) {
    const amp = clamp(Math.ceil(extra / 4) - 1, 0, 255);
    safe(() => e.addEffect("health_boost", 20000000, { amplifier: amp, showParticles: false }));
  }
  if (heal) system.runTimeout(() => safe(() => e.getComponent("minecraft:health")?.resetToMaxValue()), 2);
  setJSON(e, "aq:stats", s);
  b.stats = s;
}

export function kilicliInit(b) {
  const e = b.e;
  b.holdTool("aqualit:aqualit_sword");
  const s = getStats(b);
  const mode = getProp(e, "aq:mode", "follow");
  b.mode = mode;
  applyStats(b, s, false);
  safe(() => e.triggerEvent("aqualit:fight_on")); // eski sürüm robotları: savaş davranışları ayrı grupta
  setMode(b, mode, true);
  b.status = modeName(mode);
}

export function modeName(m) {
  return { follow: "Takip edip koruyor", guard: "Bölgeyi koruyor", stay: "Bekliyor", collect: "Eşya topluyor" }[m] ?? m;
}

export function setMode(b, mode, silent = false) {
  b.job = null;
  b.mode = mode;
  setProp(b.e, "aq:mode", mode);
  if (mode === "follow") safe(() => b.e.triggerEvent("aqualit:mode_follow"));
  else if (mode === "guard") safe(() => b.e.triggerEvent("aqualit:mode_guard"));
  else safe(() => b.e.triggerEvent("aqualit:mode_stay"));
  safe(() => b.e.triggerEvent(mode === "follow" ? "aqualit:tick_off" : "aqualit:tick_on"));
  b.setStatus(modeName(mode));
  if (!silent) b.say(`Yeni görevim: ${modeName(mode)}.`);
}

/** Bölge koruma: robot bölgenin ortasına yürür, orası evi olur ve çevresini korur. */
export function guardZone(b, center, radius) {
  setProp(b.e, "aq:zone", { x: center.x, y: center.y, z: center.z, r: radius });
  b.zone = { x: center.x, y: center.y, z: center.z, r: radius };
  b.mode = "guard";
  setProp(b.e, "aq:mode", "guard");
  safe(() => b.e.triggerEvent("aqualit:mode_stay"));
  safe(() => b.e.triggerEvent("aqualit:tick_on"));
  b.setStatus("Bölgeye gidiyor");
  b.job = zoneWalk(b);
}

function* zoneWalk(b) {
  const z = b.zone;
  const target = V.floor(z);
  const ok = yield* b.walkTo((c) => V.hdist(c, target) <= 2 && Math.abs(c.y - target.y) <= 3,
    (c) => V.manhattan(c, target), { speed: 0.22, maxNodes: 5000, radius: 96, partial: true });
  safe(() => b.e.triggerEvent("aqualit:mode_guard"));
  b.setStatus(modeName("guard"));
  b.say(ok ? `Bölgeye vardım, ${z.r} blok çevreyi koruyorum.` : "Bölgeye tam ulaşamadım, olduğum yeri koruyorum.");
}

export function kilicliTick(b) {
  const t = system.currentTick;
  powersTick(b);
  teamTick(b);
  if (b._attackUntil && t > b._attackUntil) {
    b._attackUntil = 0;
    b.setAct("none");
  }
  if (b.job) {
    const r = b.job.next();
    if (r.done) b.job = null;
    return;
  }
  if (t % 100 === 0) {
    // sağlık takviyesi düşmüşse yenile
    const has = safe(() => b.e.getEffect("health_boost"), undefined);
    const s = b.stats ?? getStats(b);
    if (!has && s.can > BASE_HEALTH) applyStats(b, s, false);
    b.updateIndex();
  }
}

/** Saldırı animasyonu (vuruşta). */
export function onKilicliHit(b) {
  if (b.pw?.cast) return; // güç animasyonu oynuyor
  b.setAct("attack");
  b._attackUntil = system.currentTick + 8;
}
