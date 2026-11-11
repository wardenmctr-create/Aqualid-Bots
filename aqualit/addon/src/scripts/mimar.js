// Aqualit Robotları — Mimar: yapı kütüphanesi, yer seçme, uçarak inşa, mini dron mimarlar
// Yapılar paketin yapı dosyalarında (aqualit:<kimlik>); bloklar structureManager ile tek tek okunur.
import { world, system, BlockPermutation, ItemStack, MolangVariableMap } from "@minecraft/server";
import { V, wait, safe, yawOf, clamp } from "./util.js";
import { YAPILAR, KATEGORI, BLOK_DURUM, ALTERNATIF, BLOK_ESYA } from "./yapi_data.js";
import { eksikleriIste, sandigaKoy, orgListesi } from "./organizator.js";
import { YARDIMCI } from "./yardimci.js";
import { getJSON, setJSON, setProp } from "./store.js";
import { menu, modal, confirm } from "./ui/forms.js";
import { idleJob } from "./jobs.js";
import { isCreative } from "./place.js";
import { Budget } from "./budget.js";
import { ICONS } from "./ikon_data.js";
import * as FX from "./fx.js";

export const DRON_ID = "aqualit:dron";
const BY_ID = new Map(YAPILAR.map((y) => [y.id, y]));
const ICON = (id) => `textures/ui/aqualit_yapi/${id}`;
const FLY_STEP = 0.45;          // Mimar uçuş hızı (blok/tik)
const DRON_STEP = 0.8;          // dron uçuş hızı
const DRON_COOL = 3;            // dron iki blok arası bekleme (tik)
const OPS_PER_TICK = 24;        // tik başına en çok blok işlemi (temizleme + koyma), bütçe ayrıca sınırlar

// temizlenebilen doğal bloklar (yapının kapladığı alanda); sandık, robot işi ve oyuncu yapıları korunur
const NATURAL = /^minecraft:(dirt|coarse_dirt|grass_block|podzol|mycelium|mud|rooted_dirt|dirt_with_roots|moss_block|moss_carpet|stone|granite|diorite|andesite|deepslate|tuff|calcite|sand|red_sand|gravel|clay|snow|snow_layer|ice|packed_ice|powder_snow|water|flowing_water|short_grass|tall_grass|fern|large_fern|dead_bush|seagrass|kelp|vine|sweet_berry_bush|.*_leaves|.*_log|.*_wood|.*_sapling|.*_flower|poppy|dandelion|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|sunflower|lilac|rose_bush|peony|pink_petals|brown_mushroom|red_mushroom|cactus|sugar_cane|bamboo|pumpkin|melon_block|pointed_dripstone|glow_lichen|hanging_roots|leaf_litter|bush|firefly_bush|short_dry_grass|tall_dry_grass|wildflowers|.*_ore|netherrack|soul_sand|soul_soil|basalt|smooth_basalt|blackstone|end_stone|.*terracotta|sandstone|red_sandstone|cobblestone|mossy_cobblestone|cobbled_deepslate|magma|glowstone|amethyst_block|budding_amethyst|.*amethyst_bud|amethyst_cluster|dripstone_block|sculk|sculk_vein|crimson_nylium|warped_nylium)$/;
// v0.3.8: inşa alanında çıkan cevherlerin düşürdüğü (Organizatör'ün sandığına gider)
const CEVHER_DUSUR = { coal: ['coal', 1], iron: ['raw_iron', 1], copper: ['raw_copper', 3], gold: ['raw_gold', 1],
  redstone: ['redstone', 4], lapis: ['lapis_lazuli', 5], diamond: ['diamond', 1], emerald: ['emerald', 1],
  quartz: ['quartz', 1], nether_gold: ['gold_nugget', 4] };
function cevherDususu(t) {
  const m = /^minecraft:(?:deepslate_|nether_)?(\w+?)_ore$/.exec(t);
  if (!m) return null;
  const k = t.includes('nether_gold') ? 'nether_gold' : t.includes('quartz') ? 'quartz' : m[1].replace('lit_', '');
  const d = CEVHER_DUSUR[k];
  return d ? ['minecraft:' + d[0], d[1]] : null;
}
// v0.3.8: bir yere tutunan / iki parçalı bloklar yapı bitince son turda konur (önce konunca düşüyordu)
const BAGIMLI = /(door|_bed$|torch|lantern|_sign$|_sign_|banner|ladder|button|lever|carpet|rail$|_rail|pressure_plate|vine|candle|redstone_wire|repeater|comparator|tripwire|sapling|coral_fan|_fan$|bell$|item_frame|flower_pot|double_plant|tall_grass|large_fern|sunflower|lilac|rose_bush|peony|snow_layer|cake$|chain$|_chain$|campfire|lily_pad|pointed_dripstone|hanging_roots|glow_lichen|spore_blossom|amethyst_bud|amethyst_cluster|dripleaf|pitcher_plant)/;

export function yapi(id) {
  return BY_ID.get(id);
}
/** Yazıyla verilen yapı adına en uygun kütüphane yapısı ("kule", "küçük ev", "buğday çiftliği"). */
// v0.3.8: yazım hatasını ve anlatımı anlayan yapı araması
const ESANLAM = {
  ev: ["ev", "evi", "kulube", "kulubesi", "konak", "konagi", "kosk", "koksu", "villa", "yuva", "apartman", "apartmani", "baraka", "kir"],
  kale: ["kale", "kalesi", "sato", "satosu", "hisar", "hisari", "burc"], kule: ["kule", "kulesi", "fener", "feneri", "gozetleme"],
  tapinak: ["tapinak", "tapinagi", "mabet", "kilise", "katedral", "cami", "piramit"], gemi: ["gemi", "gemisi", "tekne", "kayik", "korsan"],
  ciftlik: ["ciftlik", "ciftligi", "tarla", "tarlasi", "farm", "agil", "agili", "ambar", "ahir"],
  kucuk: ["kucuk", "minik", "ufak", "kucucuk", "basit"], buyuk: ["buyuk", "dev", "mega", "kocaman", "genis", "devasa"],
  koy: ["koy", "kasaba", "kuyu", "kuyusu", "pazar", "dukkan", "dukkani", "demirci", "kutuphane"],
  japon: ["japon", "japonya", "pagoda", "asya"], ortacag: ["ortacag", "sovalye", "viking"], modern: ["modern", "sehir", "banliyo", "eko"],
  susleme: ["anit", "heykel", "cesme", "bahce", "bahcesi", "susleme"], buyulu: ["buyulu", "cadi", "masal", "fantastik", "buyu"],
};
const ES_KOK = new Map();
for (const [k, l] of Object.entries(ESANLAM)) for (const w of l) ES_KOK.set(w, k);
const sadeYaz = (t) => String(t ?? "").replace(/İ/g, "i").toLowerCase().replace(/[çğıöşüâî]/g, (c) => ({ "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i" })[c] ?? c)
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function mesafe(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** İki kelime ne kadar benzer (0..1): aynı, ön ek, eş anlam ya da az harf farkı. */
function kelimeBenzer(k, w) {
  if (k === w) return 1;
  if (w.startsWith(k) && k.length >= 3) return 0.9;
  const kk = ES_KOK.get(k) ?? ES_KOK.get(k.slice(0, -1)), wk = ES_KOK.get(w);
  if (kk && kk === wk) return 0.75;
  if (kk && wk) return 0;            // ayrı anlam kümeleri (küçük ≠ büyük)
  const tol = k.length <= 4 ? 1 : k.length <= 7 ? 2 : 3;
  const d = Math.min(mesafe(k, w), w.length > k.length ? mesafe(k, w.slice(0, k.length)) + 0.5 : 99);
  return d <= tol ? 0.7 - d * 0.1 : 0;
}
export function yapiAra(ad) {
  const q = sadeYaz(ad);
  if (!q) return [];
  const ks = q.split(" ").filter((k) => k.length >= 2);
  const puan = (y) => {
    const n = sadeYaz(y.ad);
    const ws = (n + " " + sadeYaz(KATEGORI[y.kat] ?? "")).split(" ");
    let p = n === q ? 100 : n.includes(q) ? 60 : 0;
    for (const k of ks) {
      const sifat = ["kucuk", "buyuk"].includes(ES_KOK.get(k));   // boyut sözcükleri daha az ağır basar
      p += (sifat ? 10 : 20) * Math.max(0, ...ws.map((w) => kelimeBenzer(k, w)));
    }
    return p;
  };
  return YAPILAR.map((y) => [puan(y), y]).filter(([p]) => p >= 12).sort((a, b) => b[0] - a[0] || a[1].blok - b[1].blok).map(([, y]) => y);
}
const full = (id) => (id.includes(":") ? id : `minecraft:${id}`);
/** Yapının malzeme listesi (tam eşya kimlikleriyle); degis: {blok: yeni blok} oyuncunun değiştirdikleri. */
export function needOf(y, degis = {}) {
  const out = {};
  if (y.bloklar) {
    for (const [b, n] of Object.entries(y.bloklar)) {
      const e = BLOK_ESYA[degis[b] ?? b];
      if (!e) continue;
      out[full(e[0])] = (out[full(e[0])] ?? 0) + n * e[1];
    }
    return out;
  }
  for (const [id, n] of Object.entries(y.malzeme ?? {})) out[full(id)] = (out[full(id)] ?? 0) + n;
  return out;
}

/** Değiştirilen bloğu yerine koyarken: aynı durumları taşır (yeni blokta olmayanları atar). */
function degistir(perm, degis) {
  const to = degis?.[perm.type.id.replace("minecraft:", "")];
  if (!to) return perm;
  const st = safe(() => perm.getAllStates(), {}) ?? {};
  const full2 = `minecraft:${to}`;
  const tam = safe(() => BlockPermutation.resolve(full2, st));
  if (tam) return tam;
  const bos = safe(() => BlockPermutation.resolve(full2));
  if (!bos) return perm;
  let p = bos;
  for (const [k, v] of Object.entries(st)) p = safe(() => p.withState(k, v), p) ?? p;
  return p;
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
function ikinciParcaMi(perm) {
  const st = safe(() => perm.getAllStates(), {}) ?? {};
  return !!(st.upper_block_bit || st.head_piece_bit);
}

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
    const left = yield* gather(bot, needOf(Y, T.degis));
    P.mal = true;
    bot.save(true);
    if (Object.keys(left).length) {
      bot.say(`Malzemenin bir kısmı eksik: ${needText(left)}. Olanlarla başlıyorum; Organizatör'den istedim.`);
      safe(() => eksikleriIste(bot.owner, left, bot));
    }
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
  // v0.4.2: sahibin Organizatör'ü varsa Organizatör Yardımcısı da gelir, blokları turkuaz ışınla uzaktan koyar
  if (safe(() => orgListesi(bot.owner).length, 0)) {
    const ye = safe(() => bot.dim.spawnEntity(YARDIMCI, { x: bot.loc.x, y: bot.loc.y + 3, z: bot.loc.z }));
    if (ye) {
      live.add(ye.id);
      bot.drones.push({ e: ye, job: null, cool: 10, act: "none", actT: 0, yard: true });
      bot.say("Organizatör'ün Yardımcısı da geldi; blokları ışınlayarak yardım ediyor.");
    }
  }
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
  const sonra = [];                 // v0.3.8: son turda konacak bağımlı bloklar
  const ikinci = new Map();         // kapının üst yarısı, yatağın başı: alt/ayak yarısıyla aynı anda konur
  let sonTur = false;
  const cevherler = {};
  const koy = (cell) => {
    const b = safe(() => bot.dim.getBlock(cell.p));
    if (!b) return false;
    safe(() => b.setPermutation(placedPerm(degistir(cell.perm, T.degis), T.rot)));
    return true;
  };
  const work = (job) => {
    // temizleme ya da koyma (tek blok); true: yapıldı
    const b = safe(() => bot.dim.getBlock(job.p));
    if (!b) return false;
    if (job.clear) {
      if (NATURAL.test(b.typeId)) {
        const dd = cevherDususu(b.typeId);
        if (dd) cevherler[dd[0]] = (cevherler[dd[0]] ?? 0) + dd[1];
        safe(() => b.setType("minecraft:air"));
      }
      return true;
    }
    const src = degistir(job.perm, T.degis);
    const perm = placedPerm(src, T.rot);
    if (perm.type.id === "minecraft:air") {
      if (NATURAL.test(b.typeId)) safe(() => b.setType("minecraft:air"));
      return true;
    }
    if (!T.free) {
      const item = itemFor(src);
      if (item && !takeDepo(d, item)) {
        missing[item] = (missing[item] ?? 0) + 1;
        dirty++;
        return true;
      }
      dirty++;
    }
    safe(() => b.setPermutation(perm));
    // iki parçalı blok: öbür yarısını aynı anda koy (yoksa oyun yarım kapıyı hemen kırıyor)
    if (job.bagimli) {
      for (const o of [{ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }]) {
        const k = V.key(V.add(job.p, o));
        const es = ikinci.get(k);
        if (es) {
          koy(es);
          ikinci.delete(k);
        }
      }
    }
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
      const tid = safe(() => c.perm.type.id, "") ?? "";
      if (ikinciParcaMi(c.perm)) {
        ikinci.set(V.key(c.p), c);
        continue;
      }
      if (BAGIMLI.test(tid)) {
        sonra.push({ ...c, bagimli: true });
        continue;
      }
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
    const dronIsi = (bot.drones ?? []).some((x) => x.job && safe(() => x.e.isValid, false));
    if (!queue.length && ended && !dronIsi && !sonTur && (sonra.length || ikinci.size)) {
      // son tur: kapılar, meşaleler, flamalar... (dayandıkları bloklar artık yerinde)
      sonTur = true;
      for (const c of sonra) queue.push(c);
      for (const c of ikinci.values()) if (!sonra.some((x) => V.dist(x.p, c.p) <= 1.01)) queue.push({ ...c });
      sonra.length = 0;
    }
    if (!queue.length && ended && !dronIsi) break;
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
        // v0.3.8: her dronun kendi şeridi var (yapı x boyunca dron sayısı kadar dilim); önce kendi diliminden iş alır,
        // yoksa en yakınını (eskiden hepsi aynı yere üşüşüyordu)
        const nd = Math.max(1, (bot.drones ?? []).length);
        const di = (bot.drones ?? []).indexOf(dr);
        const s0 = T.at.x + (di * W2) / nd, s1 = T.at.x + ((di + 1) * W2) / nd;
        let best = -1, bd = 1e9;
        for (let q = 0; q < queue.length; q++) {
          if (queue[q].clear) break;                  // sonraki katın temizliği: önce bu kat bitsin
          if (queue[q].y !== queue[0].y && !sonTur) break;
          const c = queue[q].p;
          const disarida = c.x < s0 || c.x >= s1 ? 4000 : 0;
          const dd = (c.x + 0.5 - l.x) ** 2 + (c.y + 1 - l.y) ** 2 + (c.z + 0.5 - l.z) ** 2 + disarida;
          if (dd < bd) { bd = dd; best = q; }
        }
        if (best >= 0) dr.job = queue.splice(best, 1)[0];
        if (dr.job) live.add(safe(() => dr.e.id));
      }
      if (!dr.job) continue;
      // Yardımcı bloğun 4 blok üstüne kadar gelir, oradan ışınlar
      const tgt = { x: dr.job.p.x + 0.5, y: dr.job.p.y + (dr.yard ? 4.5 : 1.1), z: dr.job.p.z + 0.5 };
      const l = dr.e.location;
      const dv = V.sub(tgt, l);
      const n = V.len(dv);
      if (n > (dr.yard ? 3 : 1.2)) {
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
      if (dr.yard) safe(() => FX.cizgi(bot.dim, { x: l.x, y: l.y - 0.4, z: l.z }, { x: dr.job.p.x + 0.5, y: dr.job.p.y + 0.5, z: dr.job.p.z + 0.5 }, true));
      dr.job = null;
      dr.cool = dr.yard ? 1 : DRON_COOL;
      if (dr.yard) continue;
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
  // v0.3.8: inşa alanından çıkan cevherler Organizatör'ün dizinindeki uygun sandığa
  const cv = Object.entries(cevherler);
  if (cv.length) {
    for (const [id, n] of cv) safe(() => bot.inv.addItem(new ItemStack(id, n)));
    bot.say(`İnşa alanında ${cv.map(([id, n]) => `${n} ${itemName(id)}`).join(", ")} çıktı; sandığa gönderiyorum.`);
    yield* sandigaKoy(bot);
  }
  const miss = Object.keys(missing).length;
  if (miss) bot.say(`${Y.ad} bitti ama bazı bloklar eksik kaldı: ${needText(missing)}. Malzemeyi sandığıma koyup bana yeniden görev verirsen tamamlarım.`, { force: true });
  else bot.say(`${Y.ad} tamamlandı!`, { force: true });
  // v0.4.2: köylü gereken çiftlik: Organizatör'e söyler, o da Keşif'i köye gönderir
  const koyluGerek = Y.koylu ?? KOYLU_GEREK.find(([re]) => re.test(Y.id))?.[1] ?? 0;
  if (koyluGerek > 0 && !miss) {
    const yer = { x: Math.floor(center.x), y: T.at.y, z: Math.floor(center.z) };
    const ka = await_kesif();
    const ok = ka && safe(() => ka.koyluIste(bot.owner, yer, koyluGerek, `${Y.ad} çiftliğine`), false);
    bot.say(ok ? `${Y.ad} için ${koyluGerek} köylü lazım; Organizatör'e söyledim, Keşif köyden getiriyor.`
      : `${Y.ad} için ${koyluGerek} köylü lazım. Boşta bir Keşif'in olursa getirtirim; yoksa köylüleri sen getir.`, { force: true });
  }
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
    const r = await menu(player, "§lMimar · Yapı Kütüphanesi", `§7${YAPILAR.length} yapı. Ara ya da bir kategori seç.`,
      [{ text: "§lYapı ara§r\n§7Yaz: ör. \"küçük japon evi\", \"kale\" (yanlış yazsan da anlar)", icon: "textures/items/spyglass", k: "ara" },
        ...kats.map(([k, name]) => {
          const first = YAPILAR.find((y) => y.kat === k);
          return { text: `§l${name}§r\n§7${YAPILAR.filter((y) => y.kat === k).length} yapı`, icon: ICON(first.id), k };
        })]);
    if (!r) return;
    const picked = r.k === "ara" ? await araMenu(player) : await listMenu(player, r.k);
    if (picked === "back") continue;
    if (!picked) return;
    const degis = {};
    let card;
    for (;;) {
      card = await cardMenu(player, picked, degis);
      if (card?.v === "onizle") { await hologram(player, picked); continue; }
      if (card?.v !== "mal") break;
      await malzemeMenu(player, picked, degis);
    }
    if (card === "back") continue;
    if (!card) return;
    const plan = await chooseSite(player, picked, card.free);
    if (!plan) continue;
    if (Object.keys(degis).length) plan.degis = { ...degis };
    startTask(bot, plan);
    return;
  }
}

async function araMenu(player) {
  const v = await modal(player, "Yapı ara", [{ type: "text", label: "Ne yapmak istiyorsun?", placeholder: "ör. küçük ahşap ev, kale, japon" }], "Ara");
  if (!v) return "back";
  const sonuc = yapiAra(v[0]).slice(0, 15);
  if (!sonuc.length) {
    await menu(player, "§lYapı ara", `§7"${v[0]}" için yapı bulamadım. Başka kelimelerle dene.`, [{ text: "§8◀ Geri", v: "back" }]);
    return "back";
  }
  const btns = [{ text: "§8◀ Geri", v: "back" }];
  for (const y of sonuc) btns.push({ text: `§l${y.ad}§r\n§7${KATEGORI[y.kat] ?? ""} · ${y.blok} blok`, icon: ICON(y.id), v: y });
  const r = await menu(player, `§l"${v[0]}"`, `§7${sonuc.length} yapı buldum (en uygun en üstte).`, btns);
  return r?.v;
}

async function listMenu(player, kat) {
  const list = YAPILAR.filter((y) => y.kat === kat).sort((a, b) => a.blok - b.blok);
  const btns = [{ text: "§8◀ Geri", v: "back" }];
  for (const y of list) btns.push({ text: `§l${y.ad}§r\n§7${y.boyut.join("×")} · ${y.blok} blok`, icon: ICON(y.id), v: y });
  const r = await menu(player, `§l${KATEGORI[kat]}`, "Küçükten büyüğe sıralı.", btns);
  return r?.v;
}

/** Bloğun oyundaki adı (çeviri anahtarıyla, Türkçe görünür). */
function blokAdi(b) {
  const e = BLOK_ESYA[b];
  const key = safe(() => new ItemStack(full(e ? e[0] : b), 1).localizationKey);
  return key ? { translate: key } : { text: itemName(b) };
}
const DURUM_YAZI = { yok: "§c  ✖ hayatta kalmada bulunmaz", zor: "§6  ! zor bulunur" };

function matLines(y, degis, n = 8) {
  const out = [];
  const need = needOf(y, degis);
  for (const [id, c] of Object.entries(need).sort((a, b) => b[1] - a[1]).slice(0, n)) {
    const key = safe(() => new ItemStack(id, 1).localizationKey);
    out.push({ text: `\n§f${c} §7` }, key ? { translate: key } : { text: itemName(id) });
  }
  const rest = Object.keys(need).length - n;
  if (rest > 0) out.push({ text: `\n§8... ve ${rest} çeşit daha` });
  const yok = Object.keys(y.bloklar ?? {}).filter((b) => !degis[b] && BLOK_DURUM[b] === "yok").length;
  const zor = Object.keys(y.bloklar ?? {}).filter((b) => !degis[b] && BLOK_DURUM[b] === "zor").length;
  if (yok) out.push({ text: `\n§c${yok} çeşit blok hayatta kalmada bulunmaz` });
  if (zor) out.push({ text: `\n§6${zor} çeşit blok zor bulunur` });
  if (yok || zor) out.push({ text: "\n§7\"Malzemeyi değiştir\" ile kolay bulunanlarla değiştirebilirsin." });
  return out;
}

/** Malzeme listesi: her blok bir satır; dokununca en iyi alternatifler, seçilen yerine konur. */
async function malzemeMenu(player, y, degis) {
  for (;;) {
    const list = Object.entries(y.bloklar ?? {}).sort((a, b) => {
      const o = { yok: 0, zor: 1 };
      return (o[BLOK_DURUM[a[0]]] ?? 2) - (o[BLOK_DURUM[b[0]]] ?? 2) || b[1] - a[1];
    });
    const btns = [{ text: "§l§2Tamam ▶", v: "ok" }];
    if (Object.keys(degis).length) btns.push({ text: "§cDeğişiklikleri geri al", v: "sifir" });
    for (const [b, n] of list) {
      const now = degis[b] ?? b;
      const durum = BLOK_DURUM[now];
      btns.push({
        text: { rawtext: [{ text: `§f${n} × ` }, blokAdi(now), { text: degis[b] ? "§a (değişti)" : "" },
          { text: durum ? `\n${DURUM_YAZI[durum]}` : ALTERNATIF[b] ? "\n§7dokun: alternatifler" : "\n§8alternatif yok" }] },
        icon: blokIcon(now), b });
    }
    const r = await menu(player, `${y.ad} · malzeme`, "Bir bloğa dokun, yerine kullanılacak bloğu seç.", btns);
    if (!r || r.v === "ok") return;
    if (r.v === "sifir") {
      for (const k of Object.keys(degis)) delete degis[k];
      continue;
    }
    const alts = ALTERNATIF[r.b] ?? [];
    if (!alts.length) {
      player.sendMessage("§7Bu blok için alternatif yok.");
      continue;
    }
    const a = await menu(player, "Yerine ne koyalım?", { rawtext: [{ text: `§7${y.bloklar[r.b]} tane ` }, blokAdi(r.b),
      { text: " yerine (en iyisi üstte):" }] }, [
      { text: { rawtext: [{ text: "§8Aslı kalsın: " }, blokAdi(r.b)] }, icon: blokIcon(r.b), v: null },
      ...alts.map((alt) => ({ text: { rawtext: [blokAdi(alt), { text: BLOK_DURUM[alt] ? `\n${DURUM_YAZI[BLOK_DURUM[alt]]}` : "\n§akolay bulunur" }] },
        icon: blokIcon(alt), v: alt })),
    ]);
    if (!a) continue;
    if (a.v) degis[r.b] = a.v;
    else delete degis[r.b];
  }
}

function blokIcon(b) {
  return ICONS[`minecraft:${BLOK_ESYA[b]?.[0] ?? b}`] ?? ICONS[`minecraft:${b}`];
}

async function cardMenu(player, y, degis = {}) {
  const body = { rawtext: [
    { text: `§7Boyut: §f${y.boyut[0]}×${y.boyut[1]}×${y.boyut[2]}§7 (en × yükseklik × boy)\n§7Blok: §f${y.blok}` },
    { text: `\n§7Yardımcı dron: §f${dronCount(y.blok)}` },
    ...(y.aciklama ? [{ text: `\n§7${y.aciklama}` }] : []),
    ...(y.yazar ? [{ text: `\n§8Tasarım: ${y.yazar} (Planet Minecraft)` }] : []),
    { text: "\n\n§lMalzeme:§r" }, ...matLines(y, degis),
  ] };
  const btns = [{ text: "§l§2Yer seç ▶§r\n§7Malzemeyi sandıklardan toplar", icon: ICON(y.id), v: { free: false } }];
  btns.push({ text: "§l§bÖnizle (3B hologram)§r\n§7Önünde 10 sn kendi etrafında döner", icon: "textures/items/ender_eye", v: { v: "onizle" } });
  if (y.bloklar) btns.push({ text: `§lMalzemeyi değiştir§r\n§7${Object.keys(degis).length ? `${Object.keys(degis).length} blok değişti` : "Zor bulunanları kolaylarla değiştir"}`,
    icon: "textures/items/book_writable", v: { v: "mal" } });
  if (isCreative(player)) btns.push({ text: "§l§bMalzemesiz yap§r\n§7Yaratıcı: hiçbir şey harcamaz", icon: "textures/items/nether_star", v: { free: true } });
  btns.push({ text: "§8◀ Geri", v: "back" });
  const r = await menu(player, `§l${y.ad}`, body, btns);
  return r?.v;
}

// köylü gereken çiftlikler (yapı kimliğine göre): demir 3, ticaret/köylü üretme/otomatik ekin 2
const KOYLU_GEREK = [[/demir|iron/, 3], [/ticaret|trading|koylu_uret|villager/, 2], [/otomatik_ekin|auto_crop/, 2]];
let _ka = null;
import("./kesif_ai.js").then((m) => { _ka = m; }).catch(() => {});
const await_kesif = () => _ka;
const BAKMA = 100;                 // panel kapalıyken yer seçme süresi (tik): 5 sn

// ======================================================================= dönen 3B hologram önizleme (v0.4.2)
// Yapı dosyasından dış yüzeydeki bloklar örneklenir (en çok ~350 nokta); oyuncunun önünde küçültülmüş, yarı saydam
// turkuaz-renkli noktalardan oluşan model 10 sn kendi etrafında döner. Renk bloğun cinsinden (ahşap, taş, cam...).
const HOLO_RENK = [[/glass/, [0.6, 0.9, 1]], [/log|wood|planks|stairs|slab|door|fence/, [0.95, 0.7, 0.4]], [/stone|cobble|brick|andesite|deepslate/, [0.75, 0.8, 0.85]],
  [/leaves|grass|moss|vine/, [0.45, 0.95, 0.5]], [/wool|carpet|terracotta|concrete/, [1, 0.6, 0.85]], [/gold|lantern|torch|glowstone/, [1, 0.9, 0.4]]];
export function hologramNoktalari(st, maxN = 700) {
  const { x: W, y: H, z: D } = st.size;
  const dolu = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D && !!safe(() => st.getBlockPermutation({ x, y, z }));
  const nok = [];
  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const perm = safe(() => st.getBlockPermutation({ x, y, z }));
    if (!perm) continue;
    const t = safe(() => perm.type.id, "") ?? "";
    if (t === "minecraft:air" || t === "minecraft:structure_void") continue;
    if (dolu(x + 1, y, z) && dolu(x - 1, y, z) && dolu(x, y + 1, z) && dolu(x, y - 1, z) && dolu(x, y, z + 1) && dolu(x, y, z - 1)) continue;
    nok.push({ x: x - W / 2 + 0.5, y, z: z - D / 2 + 0.5, c: (HOLO_RENK.find(([re]) => re.test(t)) ?? [0, [0.3, 1, 0.9]])[1] });
  }
  if (nok.length <= maxN) return { nok, W, H, D };
  const adim = nok.length / maxN;
  return { nok: Array.from({ length: maxN }, (_, i) => nok[Math.floor(i * adim)]), W, H, D };
}
export async function hologram(player, y) {
  const st = structureOf(y.id);
  if (!st) return safe(() => player.sendMessage("§cYapı dosyası okunamadı."));
  const { nok, W, H, D } = hologramNoktalari(st);
  const boy = 3.2 / Math.max(W, H, D, 1);                      // 3,2 blokluk maket
  const v = player.getViewDirection();
  const l = player.location;
  const merkez = { x: l.x + v.x * 3.5, y: l.y + 0.3, z: l.z + v.z * 3.5 };
  safe(() => player.onScreenDisplay.setActionBar(`§b${y.ad}§7 · hologram önizleme (10 sn)`));
  safe(() => player.playSound("beacon.activate", { pitch: 1.6, volume: 0.6 }));
  let t = 0;
  const run = system.runInterval(() => {
    t += 3;
    const a = (t / 200) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const p of nok) {
      const mv = new MolangVariableMap();
      mv.setColorRGB("variable.renk", { red: p.c[0], green: p.c[1], blue: p.c[2] });
      mv.setFloat("variable.boy", boy * 0.55);                // nokta boyu ~ blok boyu (dolu görünsün)
      safe(() => player.spawnParticle("aqualit:holo", { x: merkez.x + (p.x * ca - p.z * sa) * boy, y: merkez.y + p.y * boy, z: merkez.z + (p.x * sa + p.z * ca) * boy }, mv));
    }
    if (t >= 200) system.clearRun(run);
  }, 3);
}

/** Baktığın yer: bloğun üstü (yoksa 6 blok önün). */
function bakilanYer(player) {
  const hit = safe(() => player.getBlockFromViewDirection({ maxDistance: 48 }));
  if (hit?.block) return { x: hit.block.x, y: hit.block.y + 1, z: hit.block.z };
  const v = player.getViewDirection();
  const l = player.location;
  return { x: Math.floor(l.x + v.x * 6), y: Math.floor(l.y), z: Math.floor(l.z + v.z * 6) };
}
function kutu(y, base, rot) {
  const [W2, D2] = rotSize(y.boyut[0], y.boyut[2], rot);
  return { at: { x: base.x - Math.floor(W2 / 2), y: base.y, z: base.z - Math.floor(D2 / 2) }, size: { x: W2, y: y.boyut[1], z: D2 } };
}

/**
 * Yer seçme: panel kapanır; 5 sn boyunca çerçeve baktığın yeri izler (kapı tarafı sana döner).
 * Sonra onay paneli gelir: Onayla / 90° çevir / Yeniden seç / kırmızı İptal.
 */
export async function chooseSite(player, y, free) {
  let base = bakilanYer(player);
  let rot = 0;
  let serbest = true;              // yön kendiliğinden (kapı sana bakar) mı, elle mi çevrildi
  const izle = async (sure) => {
    let stop = () => {};
    for (let t = 0; t < sure; t += 10) {
      const nb = bakilanYer(player);
      if (!stop.base || V.dist(nb, stop.base) >= 1 || stop.rot !== rot) {
        stop();
        base = nb;
        if (serbest) {
          const pl = player.location;
          rot = rotForFront(dirOf(pl.x - (base.x + 0.5), pl.z - (base.z + 0.5)));
        }
        const k = kutu(y, base, rot);
        stop = outline(player.dimension, k.at, k.size, rot);
        stop.base = base;
        stop.rot = rot;
      }
      const kalan = Math.ceil((sure - t) / 20);
      safe(() => player.onScreenDisplay.setActionBar(`§s${y.ad}§r: yerine bak · §f${kalan} sn§r sonra onay paneli`));
      await system.waitTicks(10);
    }
    return stop;
  };
  let stop = await izle(BAKMA);
  for (;;) {
    const k = kutu(y, base, rot);
    const r = await menu(player, `§l${y.ad} · yer`,
      `§7Turkuaz çerçeve yapının yerini gösteriyor. Kapı tarafı (turuncu) ${["güneye", "batıya", "kuzeye", "doğuya"][rot]} bakıyor.\n§7Köşe: §f${k.at.x}, ${k.at.y}, ${k.at.z}`,
      [{ text: "§l§2Onayla, inşa et", v: "ok" }, { text: "90° çevir\n§7Paneli kapatıp 3 sn gösterir", icon: "textures/items/compass_item", v: "turn" },
        { text: "Yeniden seç\n§75 sn yeni yere bak", icon: "textures/items/spyglass", v: "again" }, { text: "§l§cİptal", v: "no" }]);
    stop();
    if (!r || r.v === "no") return null;
    if (r.v === "turn") {
      rot = (rot + 1) % 4;
      serbest = false;
      const kk = kutu(y, base, rot);
      stop = outline(player.dimension, kk.at, kk.size, rot);
      safe(() => player.onScreenDisplay.setActionBar(`§s${y.ad}§r: döndürüldü · 3 sn sonra onay paneli`));
      await system.waitTicks(60);
      continue;
    }
    if (r.v === "again") {
      serbest = true;
      stop = await izle(BAKMA);
      continue;
    }
    return { type: "insaatci", yapi: y.id, at: k.at, rot, dim: player.dimension.id, free: !!free, owner: player.id };
  }
}

/** Yapı kutusunun 12 kenarını kalın, parlak, kesintisiz çizgiyle gösterir (v0.3.8; eskiden seyrek, kısa ömürlü toz
 * tanecikleriydi, 3-4 saniyede bir zor görünüyordu). Kapı tarafının alt kenarı turuncu. Durdurma işlevi döndürür. */
function outline(dim, at, size, rot) {
  const X = [at.x, at.x + size.x], Y = [at.y, at.y + size.y], Z = [at.z, at.z + size.z];
  const kenar = [];
  const parca = (a, b, on) => {
    const L = V.dist(a, b);
    const n = Math.max(1, Math.ceil(L / 6));
    for (let i = 0; i < n; i++) kenar.push([V.add(a, V.mul(V.sub(b, a), i / n)), V.add(a, V.mul(V.sub(b, a), (i + 1) / n)), on]);
  };
  for (const y of Y) for (const z of Z) parca({ x: X[0], y, z }, { x: X[1], y, z });
  for (const y of Y) for (const x of X) parca({ x, y, z: Z[0] }, { x, y, z: Z[1] });
  for (const x of X) for (const z of Z) parca({ x, y: Y[0], z }, { x, y: Y[1], z });
  // kapı tarafı: ön alt kenar turuncu (biraz yukarıda, üst üste binmesin)
  const fz = [Z[1], X[0], Z[0], X[1]][rot];
  const yy = at.y + 0.15;
  if (rot % 2 === 0) parca({ x: X[0], y: yy, z: fz }, { x: X[1], y: yy, z: fz }, true);
  else parca({ x: fz, y: yy, z: Z[0] }, { x: fz, y: yy, z: Z[1] }, true);
  let n = 0;
  const ciz = () => { for (const [a, b, on] of kenar) FX.cizgi(dim, a, b, on); };
  ciz();
  const h = system.runInterval(() => {
    n++;
    ciz();
    if (n > 90) system.clearRun(h);
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
