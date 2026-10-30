// Aqualit Robotları — konum çubuğu: robotlar sahibinin konum çubuğunda kendi kafa resimleriyle görünür.
// Bir robotun işaretine doğru bakınca adı ve uzaklığı ekranda yazar. Robotlar sahibine konum gönderebilir:
// gönderilen konum çubukta iğne olarak durur, oraya varınca ya da 10 dakika sonra kalkar.
import { world, system, EntityWaypoint, LocationWaypoint } from "@minecraft/server";
import { bots } from "./brain.js";
import { Robots, Prefs } from "./store.js";
import { V, safe, clamp } from "./util.js";
import { setLocationHook } from "./bot.js";

const SIZE = 10; // çubuktaki simge boyu
const PIN_LIFE = 20 * 60 * 10;
const state = new Map(); // oyuncu kimliği -> { wps: Map(rid -> {wp, kind, eid, icon}), pins: [], look }

export function skinOf(type, model) {
  return type === "kilicli" ? `kilicli_${clamp(model ?? 1, 1, 5)}` : type;
}
export function selector(path) {
  return { textureBoundsList: [{ lowerBound: 0, texture: { path, iconWidth: SIZE, iconHeight: SIZE } }] };
}
function st(player) {
  let s = state.get(player.id);
  if (!s) {
    s = { wps: new Map(), pins: [], look: "" };
    state.set(player.id, s);
  }
  return s;
}
export function barOn(player) {
  return Prefs.get(player.id).bar !== false;
}
export function setBar(player, on) {
  const p = Prefs.get(player.id);
  p.bar = !!on;
  Prefs.set(player.id, p);
  if (!on) clearAll(player);
  else refresh(player);
}

function liveBot(rid) {
  for (const b of bots.values()) if (b.rid === rid && b.valid) return b;
  return undefined;
}

function removeWp(player, wp) {
  safe(() => player.locatorBar.removeWaypoint(wp));
  safe(() => wp.remove());
}

export function clearAll(player) {
  const s = st(player);
  for (const w of s.wps.values()) removeWp(player, w.wp);
  s.wps.clear();
  for (const p of s.pins) removeWp(player, p.wp);
  s.pins = [];
}

/** Oyuncunun konum çubuğunu robotlarına göre güncelle. */
export function refresh(player) {
  const lb = safe(() => player.locatorBar);
  if (!lb) return;
  const s = st(player);
  if (!barOn(player)) return;
  const dim = player.dimension;
  const here = player.location;
  const now = system.currentTick;
  // iğneler: varınca ya da süresi dolunca kalkar
  s.pins = s.pins.filter((p) => {
    // varış: yatayda 4 blok içinde (ağaç tepesi, maden ocağı gibi yükseklik farkında da sayılsın)
    const reached = p.dim === dim.id && V.hdist(here, p.pos) < 4 && Math.abs(here.y - p.pos.y) < 12;
    if (reached || now > p.until || !safe(() => p.wp.isValid, true)) {
      removeWp(player, p.wp);
      if (reached) safe(() => player.onScreenDisplay.setActionBar(`§s${p.name}§r: gönderdiği konuma vardın.`));
      return false;
    }
    return true;
  });
  const max = Math.max(0, (safe(() => lb.maxCount, 32) ?? 32) - s.pins.length);
  const list = Robots.list(player.id)
    .map((r) => {
      const b = liveBot(r.rid);
      const pos = b ? b.loc : r.pos;
      const d = b ? b.dim.id : r.dim;
      return { r, b, pos, d };
    })
    .filter((x) => x.pos && x.d === dim.id)
    .sort((a, c) => V.dist2(a.pos, here) - V.dist2(c.pos, here))
    .slice(0, max);
  const seen = new Set();
  for (const { r, b, pos } of list) {
    seen.add(r.rid);
    const icon = `textures/ui/aqualit_bas/bas_${skinOf(r.type, b?.model ?? r.model)}`;
    const cur = s.wps.get(r.rid);
    if (b) {
      if (cur && cur.kind === "e" && cur.eid === b.id && cur.icon === icon && safe(() => cur.wp.isValid, false)) continue;
      if (cur) removeWp(player, cur.wp);
      const wp = safe(() => new EntityWaypoint(b.e, selector(icon), { showInvisible: true, showSneaking: true, showDead: false }));
      if (wp && safe(() => (lb.addWaypoint(wp), true), false)) s.wps.set(r.rid, { wp, kind: "e", eid: b.id, icon });
      else s.wps.delete(r.rid);
    } else {
      const dl = { dimension: dim, x: pos.x + 0.5, y: pos.y + 1, z: pos.z + 0.5 };
      if (cur && cur.kind === "l" && cur.icon === icon && safe(() => cur.wp.isValid, false)) {
        safe(() => cur.wp.setDimensionLocation(dl));
        continue;
      }
      if (cur) removeWp(player, cur.wp);
      const wp = safe(() => new LocationWaypoint(dl, selector(icon)));
      if (wp && safe(() => (lb.addWaypoint(wp), true), false)) s.wps.set(r.rid, { wp, kind: "l", icon });
      else s.wps.delete(r.rid);
    }
  }
  for (const [rid, w] of s.wps) {
    if (!seen.has(rid)) {
      removeWp(player, w.wp);
      s.wps.delete(rid);
    }
  }
}

/** Robot sahibine konum gönderir: çubukta iğne çıkar, sohbette mesaj. */
export function sendLocation(bot, why) {
  const player = world.getAllPlayers().find((p) => p.id === bot.owner);
  if (!player) return false;
  const s = st(player);
  const lb = safe(() => player.locatorBar);
  const pos = { x: Math.floor(bot.loc.x), y: Math.floor(bot.loc.y), z: Math.floor(bot.loc.z) };
  for (const p of s.pins.filter((q) => q.rid === bot.rid)) removeWp(player, p.wp); // robot başına tek iğne
  s.pins = s.pins.filter((q) => q.rid !== bot.rid);
  if (lb && barOn(player)) {
    const icon = `textures/ui/aqualit_bas/pin_${skinOf(bot.type, bot.model)}`;
    const wp = safe(() => new LocationWaypoint({ dimension: bot.dim, x: pos.x + 0.5, y: pos.y + 1, z: pos.z + 0.5 }, selector(icon)));
    if (wp && safe(() => (lb.addWaypoint(wp), true), false)) {
      s.pins.push({ wp, pos, dim: bot.dim.id, until: system.currentTick + PIN_LIFE, name: bot.name, rid: bot.rid });
    }
  }
  bot.say(`${why} Konumumu gönderdim (${pos.x}, ${pos.y}, ${pos.z}); konum çubuğundaki iğneyi takip et.`, { force: true });
  return true;
}

/** Bakılan yöndeki robotun adı ve uzaklığı. */
function lookName(player) {
  const s = st(player);
  if (!s.wps.size && !s.pins.length) return;
  const dir = safe(() => player.getViewDirection());
  if (!dir) return;
  const pyaw = Math.atan2(-dir.x, dir.z);
  const here = player.location;
  let best = null, bestDiff = 0.11; // ~6 derece
  const consider = (name, pos, extra) => {
    const dx = pos.x - here.x, dz = pos.z - here.z;
    if (dx * dx + dz * dz < 4) return;
    let diff = Math.atan2(-dx, dz) - pyaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      best = { name, dist: Math.round(Math.hypot(dx, dz)), extra };
    }
  };
  for (const [rid, w] of s.wps) {
    const b = liveBot(rid);
    const r = b ? null : Robots.get(player.id, rid);
    const pos = b ? b.loc : r?.pos;
    if (pos) consider(b?.name ?? r?.name ?? "Robot", pos, "");
  }
  for (const p of s.pins) if (p.dim === player.dimension.id) consider(p.name, p.pos, " §e(gönderdiği konum)");
  const key = best ? `${best.name}|${best.dist}` : "";
  if (best && key !== s.look) safe(() => player.onScreenDisplay.setActionBar(`§s${best.name}§r §7· ${best.dist} blok${best.extra}`));
  s.look = key;
}

setLocationHook(sendLocation);

system.runInterval(() => {
  const t = system.currentTick;
  for (const p of world.getAllPlayers()) {
    if (t % 40 === 0) safe(() => refresh(p));
    if (t % 4 === 0) safe(() => lookName(p));
  }
}, 1);
world.afterEvents.playerLeave?.subscribe((ev) => state.delete(ev.playerId));
