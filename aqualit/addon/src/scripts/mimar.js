// Aqualit Robotları — Mimar: yapı kütüphanesi, yer seçme, uçarak inşa, mini dron mimarlar
// Yapılar paketin yapı dosyalarında (aqualit:<kimlik>); bloklar structureManager ile tek tek okunur.
import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { V, wait, safe, yawOf, clamp } from "./util.js";
import { YAPILAR, KATEGORI } from "./yapi_data.js";
import { getJSON, setJSON, setProp } from "./store.js";
import { menu, confirm } from "./ui/forms.js";
import { idleJob } from "./jobs.js";
import { isCreative } from "./place.js";
import { Budget } from "./budget.js";

export const DRON_ID = "aqualit:dron";
const BY_ID = new Map(YAPILAR.map((y) => [y.id, y]));
const ICON = (id) => `textures/ui/aqualit_yapi/${id}`;
const FLY_STEP = 0.45;          // Mimar uçuş hızı (blok/tik)
const DRON_STEP = 0.8;          // dron uçuş hızı
const DRON_COOL = 3;            // dron iki blok arası bekleme (tik)
const OPS_PER_TICK = 24;        // tik başına en çok blok işlemi (temizleme + koyma), bütçe ayrıca sınırlar

// temizlenebilen doğal bloklar (yapının kapladığı alanda); sandık, robot işi ve oyuncu yapıları korunur
const NATURAL = /^minecraft:(dirt|coarse_dirt|grass_block|podzol|mycelium|mud|rooted_dirt|dirt_with_roots|moss_block|moss_carpet|stone|granite|diorite|andesite|deepslate|tuff|calcite|sand|red_sand|gravel|clay|snow|snow_layer|ice|packed_ice|powder_snow|water|flowing_water|short_grass|tall_grass|fern|large_fern|dead_bush|seagrass|kelp|vine|sweet_berry_bush|.*_leaves|.*_log|.*_wood|.*_sapling|.*_flower|poppy|dandelion|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|sunflower|lilac|rose_bush|peony|pink_petals|brown_mushroom|red_mushroom|cactus|sugar_cane|bamboo|pumpkin|melon_block|pointed_dripstone|glow_lichen|hanging_roots|leaf_litter|bush|firefly_bush|short_dry_grass|tall_dry_grass|wildflowers)$/;

export function yapi(id) {
  return BY_ID.get(id);
}
const full = (id) => (id.includes(":") ? id : `minecraft:${id}`);
/** Yapının malzeme listesi (tam eşya kimlikleriyle). */
export function needOf(y) {
  const out = {};
  for (const [id, n] of Object.entries(y.malzeme ?? {})) out[full(id)] = (out[full(id)] ?? 0) + n;
  return out;
}

// ======================================================================= döndürme
const CARD = ["north", "east", "south", "west"];                       // saat yönü
const WEIRDO = { 0: "east", 1: "west", 2: "south", 3: "north" };
const WEIRDO_INV = { east: 0, west: 1, south: 2, north: 3 };
const FACE6 = { 2: "north", 3: "south", 4: "west", 5: "east" };
const FACE6_INV = { north: 2, south: 3, west: 4, east: 5 };
const turn = (c, r) => (CARD.includes(c) ? CARD[(CARD.indexOf(c) + r) % 4] : c);
const RAIL = { 0: [0, 1, 0, 1], 1: [1, 0, 1, 0], 2: [2, 5, 3, 4], 3: [3, 4, 2, 5], 4: [4, 2, 5, 3], 5: [5, 3, 4, 2],
  6: [6, 7, 8, 9], 7: [7, 8, 9, 6], 8: [8, 9, 6, 7], 9: [9, 6, 7, 8] };
const VINE_BITS = [1, 2, 4, 8];                                          // güney, batı, kuzey, doğu (saat yönü)

/** Blok durumlarını r kez 90° (yukarıdan bakınca saat yönü) çevirir. */
export function rotateStates(st, r) {
  if (!r) return st;
  const o = {};
  for (const [k, v] of Object.entries(st)) {
    let nk = k;
    let nv = v;
    const m = /^(minecraft:connection_|wall_connection_type_)(north|east|south|west)$/.exec(k);
    if (m) nk = m[1] + turn(m[2], r);
    else if (k === "minecraft:cardinal_direction" || k === "torch_facing_direction" || k === "minecraft:block_face"
      || k === "minecraft:facing_direction") nv = turn(v, r);
    else if (k === "weirdo_direction") nv = WEIRDO_INV[turn(WEIRDO[v], r)] ?? v;
    else if (k === "facing_direction") nv = FACE6[v] ? FACE6_INV[turn(FACE6[v], r)] : v;
    else if (k === "direction") nv = (v + r) % 4;                                 // 0 güney, 1 batı, 2 kuzey, 3 doğu
    else if (k === "ground_sign_direction") nv = (v + 4 * r) % 16;
    else if (k === "pillar_axis" || k === "portal_axis") nv = r % 2 && v !== "y" ? (v === "x" ? "z" : "x") : v;
    else if (k === "rail_direction") nv = RAIL[v]?.[r] ?? v;
    else if (k === "vine_direction_bits") {
      nv = 0;
      VINE_BITS.forEach((b, i) => { if (v & b) nv |= VINE_BITS[(i + r) % 4]; });
    }
    o[nk] = nv;
  }
  return o;
}

/** Yapı içindeki (x, z) → döndürülmüş yerel (x, z). W, D: asıl boyutlar. */
export function rotXZ(x, z, W, D, r) {
  for (let i = 0; i < r; i++) {
    [x, z] = [D - 1 - z, x];
    [W, D] = [D, W];
  }
  return [x, z];
}
export function rotSize(W, D, r) {
  return r % 2 ? [D, W] : [W, D];
}

/** Ön yüzü (+Z) bu yöne bakacak döndürme: güney 0, batı 1, kuzey 2, doğu 3. */
export function rotForFront(dir) {
  return { south: 0, west: 1, north: 2, east: 3 }[dir] ?? 0;
}
function dirOf(dx, dz) {
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "east" : "west") : dz > 0 ? "south" : "north";
}

// ======================================================================= plan
function structureOf(id) {
  return safe(() => world.structureManager.get(`aqualit:${id}`));
}

/** Yapının blokları alttan üste, kat kat (yerel → dünya). */
function* cellsOf(T, st) {
  const { x: W, y: H, z: D } = st.size;
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const perm = safe(() => st.getBlockPermutation({ x, y, z }));
        if (!perm) {
          yield null;
          continue;
        }
        const [rx, rz] = rotXZ(x, z, W, D, T.rot);
        yield { p: { x: T.at.x + rx, y: T.at.y + y, z: T.at.z + rz }, perm, y };
      }
    }
  }
}

function placedPerm(perm, r) {
  if (!r) return perm;
  const st = safe(() => perm.getAllStates(), {}) ?? {};
  const rs = rotateStates(st, r);
  return safe(() => BlockPermutation.resolve(perm.type.id, rs), perm) ?? perm;
}

/** Bloğu koymak için gereken eşya (yoksa null: bedava ya da yarım parça). */
function itemFor(perm) {
  const st = safe(() => perm.getAllStates(), {}) ?? {};
  if (st.upper_block_bit || st.head_piece_bit) return null;
  const id = perm.type.id;
  if (/water|lava|bubble_column|^minecraft:air$/.test(id)) return null;
  return safe(() => perm.getItemStack(1)?.typeId, null) ?? null;
}

// ======================================================================= malzeme deposu (Mimar'ın alet kemeri)
function depo(bot) {
  return getJSON(bot.e, "aq:mdepo", {}) ?? {};
}
function saveDepo(bot, d) {
  setJSON(bot.e, "aq:mdepo", d);
}

/** Gereken malzemeyi sahibinin sandıklarından ve çantasından kemere alır. need: {eşya: adet} → eksikler */
function* gather(bot, need) {
  const d = depo(bot);
  const left = {};
  for (const [id, n] of Object.entries(need)) {
    const has = d[id] ?? 0;
    if (has < n) left[id] = n - has;
  }
  // çantası
  for (const id of Object.keys(left)) {
    const got = bot.take(id, left[id]);
    if (got) {
      d[id] = (d[id] ?? 0) + got;
      left[id] -= got;
    }
  }
  // sahibinin yakındaki genel ve İnşaatçı sandıkları (erişim ayarlarına uyar)
  const chests = bot.chestsNear(bot.home ?? bot.loc, 48);
  for (const ch of chests) {
    if (!Object.values(left).some((n) => n > 0)) break;
    const cc = safe(() => ch.getComponent("minecraft:inventory")?.container);
    if (!cc) continue;
    let opened = false;
    for (let i = 0; i < cc.size; i++) {
      const it = cc.getItem(i);
      if (!it || !(left[it.typeId] > 0)) continue;
      if (!opened) {
        opened = true;
        safe(() => ch.setProperty?.("aqualit:open", true));
        safe(() => bot.dim.playSound("random.chestopen", ch.location, { volume: 0.5 }));
      }
      const use = Math.min(it.amount, left[it.typeId]);
      d[it.typeId] = (d[it.typeId] ?? 0) + use;
      left[it.typeId] -= use;
      if (use >= it.amount) cc.setItem(i, undefined);
      else {
        it.amount -= use;
        cc.setItem(i, it);
      }
      if (Budget.over()) yield;
    }
    if (opened) {
      yield* wait(6);
      safe(() => ch.setProperty?.("aqualit:open", false));
    }
  }
  saveDepo(bot, d);
  for (const k of Object.keys(left)) if (left[k] <= 0) delete left[k];
  return left;
}

/** Kemerde kalanları sandığa (yoksa çantasına, o da doluysa yere) bırakır. */
function returnDepo(bot) {
  const d = depo(bot);
  const chests = bot.chestsNear(bot.home ?? bot.loc, 16);
  for (const [id, n0] of Object.entries(d)) {
    let n = n0;
    const max = safe(() => new ItemStack(id, 1).maxAmount, 64) ?? 64;
    while (n > 0) {
      const amt = Math.min(n, max);
      let rest = new ItemStack(id, amt);
      for (const ch of chests) {
        const cc = safe(() => ch.getComponent("minecraft:inventory")?.container);
        if (!cc) continue;
        rest = safe(() => cc.addItem(rest), rest);
        if (!rest) break;
      }
      if (rest) {
        const r2 = bot.addStack(rest);
        if (r2) safe(() => bot.dim.spawnItem(r2, bot.loc));
      }
      n -= amt;
    }
  }
  saveDepo(bot, {});
}

function takeDepo(d, id) {
  if ((d[id] ?? 0) <= 0) return false;
  d[id] -= 1;
  if (!d[id]) delete d[id];
  return true;
}

function itemName(id) {
  return id.replace("minecraft:", "").replace(/_/g, " ");
}
function needText(left, max = 8) {
  const list = Object.entries(left).sort((a, b) => b[1] - a[1]);
  const s = list.slice(0, max).map(([id, n]) => `${n} ${itemName(id)}`).join(", ");
  return list.length > max ? `${s} ve ${list.length - max} çeşit daha` : s;
}

// ======================================================================= uçuş
function flyOn(bot, on) {
  safe(() => bot.e.triggerEvent(on ? "aqualit:fly_on" : "aqualit:fly_off"));
  bot.flying = on;
}

/** Hedefe küçük ışınlanma adımlarıyla uçar (yerçekimi ve çarpışma kapalı). */
export function* flyTo(bot, target, opts = {}) {
  flyOn(bot, true);
  if (!opts.keepAct) bot.setAct("fly");
  bot.setMove("none");
  for (let i = 0; i < 20 * 600; i++) {
    const l = bot.loc;
    const d = V.sub(target, l);
    const n = V.len(d);
    if (n <= (opts.near ?? 0.6)) break;
    const k = Math.min(1, (opts.step ?? FLY_STEP) / n);
    const next = V.add(l, V.mul(d, k));
    const yaw = Math.abs(d.x) + Math.abs(d.z) > 0.05 ? yawOf(d.x, d.z) : undefined;
    bot.tp(next, yaw);
    if (i % 10 === 0) safe(() => bot.dim.spawnParticle("minecraft:basic_flame_particle", { x: l.x, y: l.y - 0.1, z: l.z }));
    yield;
  }
  return V.dist(bot.loc, target) <= (opts.near ?? 0.6) + 0.2;
}

/** Yere iner, uçuşu kapatır. */
function* land(bot) {
  const l = bot.loc;
  for (let y = Math.floor(l.y); y > Math.floor(l.y) - 40; y--) {
    const b = safe(() => bot.dim.getBlock({ x: Math.floor(l.x), y: y - 1, z: Math.floor(l.z) }));
    if (b && !b.isAir && !/water|lava/.test(b.typeId)) {
      yield* flyTo(bot, { x: l.x, y, z: l.z }, { near: 0.15, step: 0.3 });
      break;
    }
  }
  flyOn(bot, false);
  bot.setAct("none");
}

// ======================================================================= dronlar
/** Kaç dron: yapı büyüklüğüne göre 1–10. */
export function dronCount(blocks) {
  return clamp(Math.round(blocks / 700) + 1, 1, 10);
}

function hatPos(bot) {
  const l = bot.loc;
  const yaw = (safe(() => bot.e.getRotation().y, 0) * Math.PI) / 180;
  return { x: l.x - Math.sin(yaw) * 0.6, y: l.y + 1.0, z: l.z + Math.cos(yaw) * 0.6 };
}

const live = new Set();          // çalışan dronların kimlikleri (yeniden yüklenince sahipsiz kalanlar silinir)

function clearDrones(bot) {
  for (const e of safe(() => bot.dim.getEntities({ type: DRON_ID }), []) ?? []) {
    if (safe(() => e.getDynamicProperty("aq:rid")) === bot.rid) safe(() => e.remove());
  }
  bot.drones = [];
}

function* releaseDrones(bot, n) {
  bot.setAct("hat_off");
  yield* wait(30);
  bot.setAct("hat_hold");
  bot.drones = [];
  for (let i = 0; i < n; i++) {
    const e = safe(() => bot.dim.spawnEntity(DRON_ID, hatPos(bot)));
    if (e) {
      live.add(e.id);
      setProp(e, "aq:rid", bot.rid);
      safe(() => e.setProperty("aqualit:dact", "out"));
      bot.drones.push({ e, job: null, cool: 10, act: "out", actT: 10 });
      safe(() => bot.dim.playSound("aqualit.robot.beep", hatPos(bot), { volume: 0.5, pitch: 1.6 + i * 0.05 }));
    }
    yield* wait(6);
  }
}

function* recallDrones(bot) {
  for (let t = 0; t < 120; t++) {
    let all = true;
    const hp = hatPos(bot);
    for (const d of bot.drones ?? []) {
      if (!safe(() => d.e.isValid, false)) continue;
      const l = d.e.location;
      const dv = V.sub(hp, l);
      const n = V.len(dv);
      if (n > 0.4) {
        all = false;
        safe(() => d.e.teleport(V.add(l, V.mul(dv, Math.min(1, DRON_STEP / n)))));
      } else if (d.act !== "in") {
        d.act = "in";
        safe(() => d.e.setProperty("aqualit:dact", "in"));
        d.gone = t + 10;
      } else if (t >= d.gone) {
        safe(() => d.e.remove());
      }
    }
    if (all && (bot.drones ?? []).every((d) => !safe(() => d.e.isValid, false))) break;
    yield;
  }
  for (const d of bot.drones ?? []) live.delete(safe(() => d.e.id));
  clearDrones(bot);
  bot.setAct("hat_on");
  yield* wait(26);
  bot.setAct("fly");
}

// ======================================================================= iş
/** Mimar'ın inşa görevi. task: {type:'insaatci', yapi, at, rot, dim, free} */
export function* mimarJob(bot) {
  const T = bot.task;
  const Y = yapi(T.yapi);
  const st = structureOf(T.yapi);
  if (!Y || !st) {
    bot.say("Bu yapının planını bulamadım. Paket eksik olabilir.");
    T.done = true;
    bot.saveTask();
    return yield* idleJob(bot);
  }
  safe(() => bot.e.triggerEvent("aqualit:tick_on"));
  bot.prog ??= {};
  const P = bot.prog;
  const [W2, D2] = rotSize(st.size.x, st.size.z, T.rot);
  const center = { x: T.at.x + W2 / 2, y: T.at.y, z: T.at.z + D2 / 2 };
  // 1) malzeme (hayatta kalma)
  if (!T.free && !P.mal) {
    bot.setStatus("Malzeme topluyor");
    const left = yield* gather(bot, needOf(Y));
    P.mal = true;
    bot.save(true);
    if (Object.keys(left).length) bot.say(`Malzemenin bir kısmı eksik: ${needText(left)}. Olanlarla başlıyorum, eksikleri sandığıma koyarsan tamamlarım.`);
    else bot.say(`${Y.ad} için bütün malzemeyi aldım, yola çıkıyorum!`);
  }
  // 2) yapı yerine uç
  bot.setStatus(`${Y.ad} yerine uçuyor`);
  const hover = { x: center.x, y: T.at.y + st.size.y + 3, z: center.z };
  yield* flyTo(bot, { x: bot.loc.x, y: Math.max(bot.loc.y + 4, hover.y), z: bot.loc.z }, { near: 0.8 });
  yield* flyTo(bot, hover, { near: 0.8 });
  // 3) baretten dronlar
  clearDrones(bot);
  const nd = dronCount(Y.blok);
  bot.say(`Bareti açıyorum: ${nd} mini dron mimar yardıma geliyor.`);
  yield* releaseDrones(bot, nd);
  // 4) kat kat inşa
  const missing = {};
  let done = P.done ?? 0;
  let idx = 0;
  const startIdx = P.i ?? 0;
  const queue = [];
  const it = cellsOf(T, st);
  let layer = -1;
  let ended = false;
  const total = Math.max(1, Y.blok);
  let lastPct = Math.floor((done * 100) / total);
  const d = depo(bot);
  let dirty = 0;
  const work = (job) => {
    // temizleme ya da koyma (tek blok); true: yapıldı
    const b = safe(() => bot.dim.getBlock(job.p));
    if (!b) return false;
    if (job.clear) {
      if (NATURAL.test(b.typeId)) safe(() => b.setType("minecraft:air"));
      return true;
    }
    const perm = placedPerm(job.perm, T.rot);
    if (perm.type.id === "minecraft:air") {
      if (NATURAL.test(b.typeId)) safe(() => b.setType("minecraft:air"));
      return true;
    }
    if (!T.free) {
      const item = itemFor(job.perm);
      if (item && !takeDepo(d, item)) {
        missing[item] = (missing[item] ?? 0) + 1;
        dirty++;
        return true;
      }
      dirty++;
    }
    safe(() => b.setPermutation(perm));
    return true;
  };
  const refill = () => {
    while (!ended && queue.length < 192) {
      const n = it.next();
      if (n.done) {
        ended = true;
        break;
      }
      idx++;
      if (idx <= startIdx || !n.value) continue;
      const c = n.value;
      if (c.y !== layer) {
        layer = c.y;
        // yeni kat: kaplanan alanın bu katındaki doğal blokları temizle (taban katı hariç)
        if (layer > 0) {
          for (let z = 0; z < D2; z++) for (let x = 0; x < W2; x++) queue.push({ p: { x: T.at.x + x, y: T.at.y + layer, z: T.at.z + z }, clear: true });
        }
      }
      queue.push(c);
    }
  };
  bot.setStatus(`${Y.ad} inşa ediliyor %0`);
  while (true) {
    refill();
    if (!queue.length && ended && !(bot.drones ?? []).some((x) => x.job && safe(() => x.e.isValid, false))) break;
    let ops = 0;
    // önce bu katın temizliği (Mimar'ın kendisi yapar, hızlı)
    while (queue.length && queue[0].clear && ops < OPS_PER_TICK) {
      work(queue.shift());
      ops++;
    }
    const clearing = queue.length && queue[0].clear;
    // dronlar: her biri sıradaki işlerden kendine en yakın olanı alır (birbirlerinin yolunu uzatmazlar)
    for (const dr of bot.drones ?? []) {
      if (!safe(() => dr.e.isValid, false)) continue;
      if (dr.actT > 0 && --dr.actT === 0) {
        dr.act = "none";
        safe(() => dr.e.setProperty("aqualit:dact", "none"));
      }
      if (!dr.job && !clearing) {
        const l = dr.e.location;
        let best = -1, bd = 1e9;
        for (let q = 0; q < queue.length; q++) {
          if (queue[q].clear) break;                  // sonraki katın temizliği: önce bu kat bitsin
          if (queue[q].y !== queue[0].y) break;
          const c = queue[q].p;
          const dd = (c.x + 0.5 - l.x) ** 2 + (c.y + 1 - l.y) ** 2 + (c.z + 0.5 - l.z) ** 2;
          if (dd < bd) { bd = dd; best = q; }
        }
        if (best >= 0) dr.job = queue.splice(best, 1)[0];
        if (dr.job) live.add(safe(() => dr.e.id));
      }
      if (!dr.job) continue;
      const tgt = { x: dr.job.p.x + 0.5, y: dr.job.p.y + 1.1, z: dr.job.p.z + 0.5 };
      const l = dr.e.location;
      const dv = V.sub(tgt, l);
      const n = V.len(dv);
      if (n > 1.2) {
        safe(() => dr.e.teleport(V.add(l, V.mul(dv, Math.min(1, DRON_STEP / n))), { facingLocation: tgt }));
        continue;
      }
      if (--dr.cool > 0) continue;
      if (ops >= OPS_PER_TICK) continue;
      ops++;
      if (!work(dr.job)) {
        dr.cool = 20;               // yığın yüklü değil: biraz bekle, aynı bloğu yeniden dene
        continue;
      }
      done++;
      dr.job = null;
      dr.cool = DRON_COOL;
      dr.act = "place";
      dr.actT = 8;
      safe(() => dr.e.setProperty("aqualit:dact", "place"));
    }
    // Mimar inşa alanının üstünde süzülür, işin yürüdüğü kata bakar
    const t = system.currentTick;
    const ang = (t % 400) / 400 * Math.PI * 2;
    const r = Math.max(W2, D2) / 2 + 2;
    const hv = { x: center.x + Math.cos(ang) * r * 0.6, y: T.at.y + Math.max(layer, 0) + 4, z: center.z + Math.sin(ang) * r * 0.6 };
    const ml = bot.loc;
    const mv = V.sub(hv, ml);
    const mn = V.len(mv);
    if (mn > 0.1) bot.tp(V.add(ml, V.mul(mv, Math.min(1, 0.15 / mn))), yawOf(center.x - ml.x, center.z - ml.z));
    // ilerleme
    P.i = Math.max(0, idx - queue.filter((q) => !q.clear).length - (bot.drones ?? []).filter((x) => x.job).length);
    P.done = done;
    if (dirty > 40) {
      saveDepo(bot, d);
      dirty = 0;
    }
    const pct = Math.min(100, Math.floor((done * 100) / total));
    if (pct !== lastPct) {
      bot.setStatus(`${Y.ad} inşa ediliyor %${pct}`);
      if (Math.floor(pct / 25) > Math.floor(lastPct / 25) && pct < 100) bot.say(`${Y.ad}: %${pct} bitti.`);
      lastPct = pct;
      bot.save();
    }
    yield;
  }
  saveDepo(bot, d);
  // 5) dronlar barete, eve dönüş
  yield* recallDrones(bot);
  const miss = Object.keys(missing).length;
  if (miss) bot.say(`${Y.ad} bitti ama bazı bloklar eksik kaldı: ${needText(missing)}. Malzemeyi sandığıma koyup bana yeniden görev verirsen tamamlarım.`, { force: true });
  else bot.say(`${Y.ad} tamamlandı!`, { force: true });
  bot.setStatus("Eve uçuyor");
  if (bot.home) {
    yield* flyTo(bot, { x: bot.loc.x, y: Math.max(bot.loc.y, bot.home.y + 6), z: bot.loc.z }, { near: 0.8 });
    yield* flyTo(bot, { x: bot.home.x, y: bot.home.y + 6, z: bot.home.z }, { near: 0.8 });
    yield* flyTo(bot, { x: bot.home.x, y: bot.home.y + 0.05, z: bot.home.z }, { near: 0.2, step: 0.3 });
  }
  yield* land(bot);
  returnDepo(bot);
  T.done = true;
  bot.saveTask();
  bot.prog = {};
  bot.save(true);
  bot.setAct("celebrate");
  yield* wait(50);
  bot.setAct("none");
  return yield* idleJob(bot);
}

// ======================================================================= menüler
/** Görev Kumandası → Mimar → Görev ver: kütüphane. */
export async function mimarMenu(player, bot, startTask) {
  for (;;) {
    const kats = Object.entries(KATEGORI).filter(([k]) => YAPILAR.some((y) => y.kat === k));
    const r = await menu(player, "§lMimar · Yapı Kütüphanesi", `§7${YAPILAR.length} yapı. Bir kategori seç.`,
      kats.map(([k, name]) => {
        const first = YAPILAR.find((y) => y.kat === k);
        return { text: `§l${name}§r\n§7${YAPILAR.filter((y) => y.kat === k).length} yapı`, icon: ICON(first.id), k };
      }));
    if (!r) return;
    const picked = await listMenu(player, r.k);
    if (picked === "back") continue;
    if (!picked) return;
    const card = await cardMenu(player, picked);
    if (card === "back") continue;
    if (!card) return;
    const plan = await chooseSite(player, picked, card.free);
    if (!plan) continue;
    startTask(bot, plan);
    return;
  }
}

async function listMenu(player, kat) {
  const list = YAPILAR.filter((y) => y.kat === kat).sort((a, b) => a.blok - b.blok);
  const btns = [{ text: "§8◀ Geri", v: "back" }];
  for (const y of list) btns.push({ text: `§l${y.ad}§r\n§7${y.boyut.join("×")} · ${y.blok} blok`, icon: ICON(y.id), v: y });
  const r = await menu(player, `§l${KATEGORI[kat]}`, "Küçükten büyüğe sıralı.", btns);
  return r?.v;
}

function matLines(y, n = 8) {
  const out = [];
  for (const [id, c] of Object.entries(y.malzeme).slice(0, n)) {
    const key = safe(() => new ItemStack(full(id), 1).localizationKey);
    out.push({ text: `\n§f${c} §7` }, key ? { translate: key } : { text: itemName(id) });
  }
  const rest = Object.keys(y.malzeme).length - n;
  if (rest > 0) out.push({ text: `\n§8... ve ${rest} çeşit daha` });
  return out;
}

async function cardMenu(player, y) {
  const body = { rawtext: [
    { text: `§7Boyut: §f${y.boyut[0]}×${y.boyut[1]}×${y.boyut[2]}§7 (en × yükseklik × boy)\n§7Blok: §f${y.blok}` },
    { text: `\n§7Yardımcı dron: §f${dronCount(y.blok)}` },
    ...(y.aciklama ? [{ text: `\n§7${y.aciklama}` }] : []),
    ...(y.yazar ? [{ text: `\n§8Tasarım: ${y.yazar} (Planet Minecraft)` }] : []),
    { text: "\n\n§lMalzeme:§r" }, ...matLines(y),
  ] };
  const btns = [{ text: "§l§2Yer seç ▶§r\n§7Malzemeyi sandıklardan toplar", icon: ICON(y.id), v: { free: false } }];
  if (isCreative(player)) btns.push({ text: "§l§bMalzemesiz yap§r\n§7Yaratıcı: hiçbir şey harcamaz", icon: "textures/items/nether_star", v: { free: true } });
  btns.push({ text: "§8◀ Geri", v: "back" });
  const r = await menu(player, `§l${y.ad}`, body, btns);
  return r?.v;
}

/** Bakılan yere çerçeve çizer; onay / 90° çevir / iptal. */
async function chooseSite(player, y, free) {
  const hit = safe(() => player.getBlockFromViewDirection({ maxDistance: 48 }));
  let base;
  if (hit?.block) base = { x: hit.block.x, y: hit.block.y + 1, z: hit.block.z };
  else {
    const v = player.getViewDirection();
    const l = player.location;
    base = { x: Math.floor(l.x + v.x * 6), y: Math.floor(l.y), z: Math.floor(l.z + v.z * 6) };
  }
  const pl = player.location;
  let rot = rotForFront(dirOf(pl.x - (base.x + 0.5), pl.z - (base.z + 0.5)));
  for (;;) {
    const [W2, D2] = rotSize(y.boyut[0], y.boyut[2], rot);
    const at = { x: base.x - Math.floor(W2 / 2), y: base.y, z: base.z - Math.floor(D2 / 2) };
    const stop = outline(player.dimension, at, { x: W2, y: y.boyut[1], z: D2 }, rot);
    const r = await menu(player, `§l${y.ad} · yer`,
      `§7Turkuaz çerçeve yapının yerini gösteriyor. Kapı tarafı ${["güneye", "batıya", "kuzeye", "doğuya"][rot]} bakıyor.\n§7Köşe: §f${at.x}, ${at.y}, ${at.z}`,
      [{ text: "§l§2Onayla, inşa et", v: "ok" }, { text: "90° çevir", icon: "textures/items/compass_item", v: "turn" },
        { text: "§l§cİptal", v: "no" }]);
    stop();
    if (!r || r.v === "no") return null;
    if (r.v === "turn") {
      rot = (rot + 1) % 4;
      continue;
    }
    return { type: "insaatci", yapi: y.id, at, rot, dim: player.dimension.id, free: !!free, owner: player.id };
  }
}

/** Yapı kutusunun kenarlarına parçacık (telefon için seyrek), durdurma işlevi döndürür. */
function outline(dim, at, size, rot) {
  const pts = [];
  const step = Math.max(1, Math.ceil((size.x + size.y + size.z) * 4 / 160));
  const X = [at.x, at.x + size.x], Y = [at.y, at.y + size.y], Z = [at.z, at.z + size.z];
  for (const y of Y) for (const z of Z) for (let x = X[0]; x <= X[1]; x += step) pts.push({ x, y, z });
  for (const y of Y) for (const x of X) for (let z = Z[0]; z <= Z[1]; z += step) pts.push({ x, y, z });
  for (const x of X) for (const z of Z) for (let y = Y[0]; y <= Y[1]; y += step) pts.push({ x, y, z });
  // kapı tarafı: ön kenarda sık işaret
  const fz = [Z[1], X[0], Z[0], X[1]][rot];
  const front = [];
  if (rot % 2 === 0) for (let x = X[0]; x <= X[1]; x += 0.5) front.push({ x, y: at.y + 0.2, z: fz });
  else for (let z = Z[0]; z <= Z[1]; z += 0.5) front.push({ x: fz, y: at.y + 0.2, z });
  let n = 0;
  const h = system.runInterval(() => {
    n++;
    for (const p of pts) safe(() => dim.spawnParticle("minecraft:villager_happy", p));
    for (const p of front) safe(() => dim.spawnParticle("minecraft:basic_flame_particle", p));
    if (n > 60) system.clearRun(h);
  }, 10);
  return () => safe(() => system.clearRun(h));
}

// sahipsiz dronlar (dünya yeniden açılınca iş yarıda kaldıysa) kaldırılır; iş sürerse yenileri çıkar
world.afterEvents.entityLoad.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) !== DRON_ID) return;
  const e = ev.entity;
  system.runTimeout(() => {
    if (!live.has(safe(() => e.id))) safe(() => e.remove());
  }, 40);
});
