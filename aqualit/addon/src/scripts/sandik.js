// Aqualit Robotları — Aqualit sandığı (v0.2.9)
//
// Sandık, oyunun kendi tuzaklı sandık bloğu (minecraft:trapped_chest) üzerine kurulu; kaynak paketi onun dokusunu
// Aqualit sandığına çevirir. Böylece dokununca açılır, basılı tutunca kırılır, aynı türden ikisi yan yana konunca
// çift sandık olur. Eğilip basılı tutunca sandık paneli açılır.
//
// Her sandık bloğunun önünde türün amblem plakasını gösteren bir yardımcı varlık (aqualit:sandik_depo) durur.
// Sandığın asıl deposu bu varlıkların envanteridir (blok başına 128 yuva; kapasite artınca görünmez bir ek depo
// varlığı (aqualit:sandik_ek) eklenir). Sandık kapalıyken boştur:
// sahibi açınca o anki sayfa sandığa taşınır, kapanınca geri alınır. Sayfa okları (◀ ▶) ve kilitli yuvalar
// yalnızca sandık açıkken görünür. Robotlar ve "İçindekiler" ekranı bütün sayfaları tek depo gibi kullanır.
//
// Kapasite: tek sandık 27, çift 54 yuva; panelden her eklenen normal sandık +27 yuva (en çok tek 200, çift 500).
import { world, system, ItemStack, BlockPermutation, GameMode } from "@minecraft/server";
import { V, safe } from "./util.js";
import { getJSON, setJSON, getProp, setProp, Chests } from "./store.js";
import { CHEST_ITEM, CHEST_NAME } from "./constants.js";
import { isPassableType } from "./blocks.js";

export const CHEST_BLOCK = "minecraft:trapped_chest";
export const DEPO_ID = "aqualit:sandik_depo";
export const EK_ID = "aqualit:sandik_ek";
/** Depo varlığı başına yuva. Kayıt biçiminde yuva numarası bir bayt; 128 her durumda güvenli. */
export const PER = 128;
export const OLD_CHEST_ID = "aqualit:robot_chest";
export const NAV_NEXT = "aqualit:sayfa_ileri";
export const NAV_PREV = "aqualit:sayfa_geri";
export const LOCKED = "aqualit:kilitli_yuva";
const MARKERS = new Set([NAV_NEXT, NAV_PREV, LOCKED]);
export const CAP = { single: 27, double: 54, perChest: 27, maxSingle: 200, maxDouble: 500 };
export const KIND_OF_ITEM = Object.fromEntries(Object.entries(CHEST_ITEM).map(([k, id]) => [id, k]));
const OPEN_RANGE = 8;

// ====================================================================== kimlik ve kayıtlar
const SH = { "minecraft:overworld": "o", "minecraft:nether": "n", "minecraft:the_end": "e" };
const LG = { o: "minecraft:overworld", n: "minecraft:nether", e: "minecraft:the_end" };
const P = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
export const idOf = (dimId, p) => `${SH[dimId] ?? dimId}:${Math.floor(p.x)}:${Math.floor(p.y)}:${Math.floor(p.z)}`;
export function parseId(id) {
  const m = /^(.+):(-?\d+):(-?\d+):(-?\d+)$/.exec(String(id ?? ""));
  return m ? { dimId: LG[m[1]] ?? m[1], pos: { x: +m[2], y: +m[3], z: +m[4] } } : null;
}
const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;

const cache = new Map(); // birim kimliği -> kayıt
/** Blok -> birim kimliği (çift sandığın iki bloğu da aynı birime bağlı). */
export function unitIdAt(dimId, p) {
  return getProp(world, `aq:sk:${idOf(dimId, p)}`, undefined);
}
function setUnitIdAt(dimId, p, uid) {
  setProp(world, `aq:sk:${idOf(dimId, p)}`, uid);
}
export function loadUnit(uid) {
  if (!uid) return null;
  if (cache.has(uid)) return cache.get(uid);
  const u = getJSON(world, `aq:su:${uid}`, null);
  if (u) cache.set(uid, u);
  return u;
}
function saveUnit(u) {
  cache.set(u.id, u);
  setJSON(world, `aq:su:${u.id}`, u);
}
function deleteUnit(uid) {
  cache.delete(uid);
  setProp(world, `aq:su:${uid}`, undefined);
}
/** Eski kimlikleri (taşınan varlık sandığı, çift sandığın kırılan ana yarısı) yenisine çevirir. */
export function resolveId(id) {
  let cur = id;
  let al = null;
  for (let i = 0; i < 6 && cur; i++) {
    if (loadUnit(cur)) return cur;
    al ??= getJSON(world, "aq:salias", {});
    if (!al[cur]) return cur;
    cur = al[cur];
  }
  return cur;
}
function addAlias(from, to) {
  if (!from || from === to) return;
  const al = getJSON(world, "aq:salias", {});
  delete al[to];                 // hedef artık yaşayan bir kayıt
  al[from] = to;
  for (const k of Object.keys(al)) if (al[k] === from) al[k] = to;
  for (const k of Object.keys(al)) if (al[k] === k) delete al[k];
  // çok eskileri at (dünya özelliği sınırı)
  const keys = Object.keys(al);
  for (let i = 0; i < keys.length - 400; i++) delete al[keys[i]];
  setJSON(world, "aq:salias", al);
}
/** Silinen kayda giden yönlendirmeleri kaldırır. */
function dropAliasesTo(uid) {
  const al = getJSON(world, "aq:salias", {});
  let n = 0;
  for (const k of Object.keys(al)) if (al[k] === uid) {
    delete al[k];
    n++;
  }
  if (n) setJSON(world, "aq:salias", al);
}

// ====================================================================== yön (plaka sandığın önünde durur)
const DIR = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } };
const OPP = { north: "south", south: "north", east: "west", west: "east" };
/** Oyun yön durumunu sandığın ön yüzü olarak mı tutuyor? İlk oyuncu yerleştirmesinde kendiliğinden ölçülür. */
const flipped = () => getProp(world, "aq:sandik_ters", false) === true;
function frontOf(block) {
  const st = safe(() => block.permutation.getState("minecraft:cardinal_direction"), "south") ?? "south";
  const s = DIR[st] ? st : "south";
  return flipped() ? OPP[s] : s;
}
function stateFor(front) {
  return flipped() ? OPP[front] : front;
}
function towards(from, to) {
  const dx = to.x - (from.x + 0.5), dz = to.z - (from.z + 0.5);
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? "east" : "west";
  return dz >= 0 ? "south" : "north";
}
function platePos(block) {
  const d = DIR[frontOf(block)];
  return { x: block.x + 0.5 + d.x * 0.445, y: block.y + 0.25, z: block.z + 0.5 + d.z * 0.445 };
}
const plateYaw = (block) => (DIR[frontOf(block)].x !== 0 ? 90 : 0);

/** Oyuncunun bakışının tersi (sandık konunca oyuncuya döner); çaprazda belirsiz. */
function yawFront(rot) {
  if (!rot || !Number.isFinite(rot.y)) return null;
  const y = (rot.y * Math.PI) / 180;
  const fx = Math.sin(y), fz = -Math.cos(y);     // bakış (-sin, cos) yönünün tersi
  if (Math.abs(Math.abs(fx) - Math.abs(fz)) < 0.3) return null;
  return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? "east" : "west") : (fz > 0 ? "south" : "north");
}
/** İlk oyuncu yerleştirmesinde: yön durumu ön yüzü mü, arka yüzü mü gösteriyor? */
function calibrate(block, playerLoc, playerRot) {
  if (getProp(world, "aq:sandik_ters", undefined) !== undefined || !playerLoc) return;
  const dx = playerLoc.x - (block.x + 0.5), dz = playerLoc.z - (block.z + 0.5);
  if (Math.max(Math.abs(dx), Math.abs(dz)) < 0.6 || Math.abs(Math.abs(dx) - Math.abs(dz)) < 0.4) return;
  const want = towards(block, playerLoc);        // sandık oyuncuya bakar
  // bakış yönü başka yeri gösteriyorsa (yana koyma) ölçme; bir sonraki yerleştirmeyi bekle
  if (playerRot && yawFront(playerRot) !== want) return;
  const st = safe(() => block.permutation.getState("minecraft:cardinal_direction"));
  if (!DIR[st]) return;
  setProp(world, "aq:sandik_ters", st !== want);
  if (st !== want) system.run(() => safe(() => movePlates()));
}
/** Ölçüm değişince yüklü sandıkların plakalarını doğru yüze taşır. */
function movePlates() {
  for (const owner of getJSON(world, "aq:owners", [])) {
    for (const c of Chests.list(owner)) {
      const u = loadUnit(c.cid);
      if (!u) continue;
      u.blocks.forEach((b, i) => {
        const e = companion(u, i, false);
        const blk = blockOf(u, b);
        if (e && blk) safe(() => e.teleport(platePos(blk), { rotation: { x: 0, y: plateYaw(blk) } }));
      });
    }
  }
}

// ====================================================================== yardımcı varlık (depo + amblem)
const dimOf = (u) => safe(() => world.getDimension(u.dim));
const blockOf = (u, b) => safe(() => dimOf(u).getBlock(b));
const isChest = (blk) => !!blk && safe(() => blk.typeId, "") === CHEST_BLOCK;

function spawnCompanion(u, b, extra) {
  const blk = blockOf(u, b);
  if (!isChest(blk)) return undefined;
  const e = safe(() => dimOf(u).spawnEntity(extra ? EK_ID : DEPO_ID, platePos(blk), { initialRotation: plateYaw(blk) }));
  if (!e) return undefined;
  if (!extra) safe(() => e.setProperty("aqualit:kind", u.kind));
  setProp(e, "aq:blk", idOf(u.dim, b));
  return e;
}
/** Bloğun yardımcı varlığı (extra: görünmez ek depo); yoksa (ve create) yenisini koyar. */
function companion(u, bi, create = true, extra = false) {
  const b = u.blocks[bi];
  if (!b) return undefined;
  const fld = extra ? "ek" : "e";
  const type = extra ? EK_ID : DEPO_ID;
  let e = b[fld] ? safe(() => world.getEntity(b[fld])) : undefined;
  if (e && safe(() => e.isValid, false) && e.typeId === type) return e;
  const key = idOf(u.dim, b);
  e = safe(() => dimOf(u).getEntities({ type, location: { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }, maxDistance: 1.6 }), [])
    .find((x) => getProp(x, "aq:blk", "") === key);
  if (!e && create) e = spawnCompanion(u, b, extra);
  if (e && b[fld] !== e.id) {
    b[fld] = e.id;
    saveUnit(u);
  }
  return e;
}
/** Bloğun bütün yardımcı varlıklarını kaldırır. */
function removeCompanions(u, bi) {
  for (const extra of [false, true]) {
    const e = companion(u, bi, false, extra);
    if (e) safe(() => e.remove());
  }
}
/**
 * Depo parçaları (sıralı): [{c, size}] — mantıksal yuva bunların art arda dizilişidir:
 * önce blokların ana depoları, sonra ek depoları (blok sırasıyla). Ek depo yalnızca kapasite gerektirince konur.
 */
function stores(u, create = true) {
  const out = [];
  const add = (e) => {
    const c = e && safe(() => e.getComponent("minecraft:inventory")?.container);
    if (c) out.push({ c, size: c.size });
    return !!c;
  };
  const main = [];
  for (let i = 0; i < u.blocks.length; i++) main.push(add(companion(u, i, create)));
  const want = capacity(u);
  for (let i = 0; i < u.blocks.length; i++) {
    const b = u.blocks[i];
    if (b.ek) {
      if (add(companion(u, i, false, true))) continue;
      // ana depo yüklü ama ek depo yok: ek depo yok olmuş (aynı yerde dururlar, birlikte yüklenirler)
      if (!create || !main[i]) continue;
      delete b.ek;
      saveUnit(u);
    }
    if (create && main[i] && storeSize(out) < want) add(companion(u, i, true, true));
  }
  return out;
}
/** Depo düzeni değişecekken: eşyaları mantıksal yerleriyle çıkarır. */
function snapshot(u) {
  const list = [];
  let L = 0;
  for (const s of stores(u, false)) {
    for (let i = 0; i < s.size; i++, L++) {
      const it = safe(() => s.c.getItem(i));
      if (!it) continue;
      list.push([L, it]);
      safe(() => s.c.setItem(i, undefined));
    }
  }
  return list;
}
/** Eşyaları yeni düzende aynı mantıksal yerlerine koyar (sayfalardaki yerleri değişmez); olmazsa boş yere, o da yoksa yere. */
function restore(u, list, at) {
  const st = stores(u);
  const cap = capacity(u, st);
  const rest = [];
  for (const [L, it] of list) {
    const loc = L < cap ? storeLoc(st, L) : null;
    if (loc && !safe(() => loc[0].getItem(loc[1]))) safe(() => loc[0].setItem(loc[1], it));
    else rest.push(it);
  }
  if (!rest.length) return;
  const c = new UnitContainer(u.id);
  const b = u.blocks[0];
  for (const it of rest) {
    const r = c.addItem(it);
    if (r) safe(() => dimOf(u).spawnItem(r, at ?? { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 }));
  }
}
function storeLoc(st, L) {
  let base = 0;
  for (const s of st) {
    if (L < base + s.size) return [s.c, L - base];
    base += s.size;
  }
  return null;
}
const storeSize = (st) => st.reduce((n, s) => n + s.size, 0);

export function maxCapacity(u) {
  return u.double ? CAP.maxDouble : CAP.maxSingle;
}
/** Yuva sayısı (depo boyutuyla sınırlı). */
export function capacity(u, st) {
  const want = Math.min(maxCapacity(u), (u.double ? CAP.double : CAP.single) + CAP.perChest * (u.added ?? 0));
  return st ? Math.min(want, storeSize(st)) : want;
}
/** Sayfa düzeni: tek sayfaysa bütün yuvalar; değilse sol alt ◀ ve sağ alt ▶. */
export function layout(size, cap) {
  if (cap <= size) return { per: size, pages: 1, view: Array.from({ length: size }, (_, i) => i), prev: -1, next: -1 };
  const prev = size - 9, next = size - 1;
  const view = [];
  for (let i = 0; i < size; i++) if (i !== prev && i !== next) view.push(i);
  return { per: size - 2, pages: Math.ceil(cap / (size - 2)), view, prev, next };
}

// ====================================================================== sandık açıkken (oturum)
const sessions = new Map(); // birim -> {uid, player, dimId, pos, lay, cap, page, st, noNav}
/** Bir oyuncu sandığı açmış mı (Organizatör açık sandığa dokunmaz). */
export function acikMi(uid) {
  return sessions.has(uid);
}
const pending = new Map();  // oyuncu -> bekleyen yerleştirme {kind, pos, dimId, tick, ploc}

function viewOf(s) {
  const blk = safe(() => world.getDimension(s.dimId).getBlock(s.pos));
  return isChest(blk) ? safe(() => blk.getComponent("minecraft:inventory")?.container) : undefined;
}

function marker(id, s, dir) {
  const it = new ItemStack(id, 1);
  if (id === LOCKED) {
    it.nameTag = "§7Kilitli yuva";
    safe(() => it.setLore(["§8Kapasiteyi sandık panelinden artır", "§8(eğil + sandığa basılı tut)"]));
  } else {
    const to = (s.page + dir + s.lay.pages) % s.lay.pages;
    it.nameTag = dir > 0 ? `§b▶ Sonraki sayfa §7(${to + 1}/${s.lay.pages})` : `§b◀ Önceki sayfa §7(${to + 1}/${s.lay.pages})`;
    safe(() => it.setLore([`§7Şu an: sayfa ${s.page + 1}/${s.lay.pages}`, "§7Dokun ya da envanterine taşı"]));
  }
  return it;
}

/** Sandığın içinde kalmış eşyaları (huni vb.) depoya alır; işaretleri siler. */
function absorb(u, vc, st) {
  vc ??= safe(() => blockOf(u, u.blocks[0])?.getComponent("minecraft:inventory")?.container);
  if (!vc) return;
  st ??= stores(u);
  const cap = capacity(u, st);
  for (let i = 0; i < vc.size; i++) {
    const it = safe(() => vc.getItem(i));
    if (!it) continue;
    if (MARKERS.has(it.typeId)) {
      safe(() => vc.setItem(i, undefined));
      continue;
    }
    const L = freeLogical(st, cap);
    const loc = L >= 0 ? storeLoc(st, L) : null;
    if (loc) safe(() => vc.moveItem(i, loc[1], loc[0]));
    else {
      safe(() => dimOf(u).spawnItem(it, { x: u.blocks[0].x + 0.5, y: u.blocks[0].y + 1.1, z: u.blocks[0].z + 0.5 }));
      safe(() => vc.setItem(i, undefined));
    }
  }
}
function freeLogical(st, cap, skip) {
  for (let L = 0; L < cap; L++) {
    if (skip && skip(L)) continue;
    const loc = storeLoc(st, L);
    if (loc && !safe(() => loc[0].getItem(loc[1]))) return L;
  }
  return -1;
}

function loadPage(s, vc) {
  const { lay } = s;
  for (let k = 0; k < lay.per; k++) {
    const slot = lay.view[k];
    const L = s.page * lay.per + k;
    if (L < s.cap) {
      const loc = storeLoc(s.st, L);
      if (loc) safe(() => vc.swapItems(slot, loc[1], loc[0]));
    } else safe(() => vc.setItem(slot, marker(LOCKED, s)));
  }
  if (lay.pages > 1 && !s.noNav) {
    safe(() => vc.setItem(lay.prev, marker(NAV_PREV, s, -1)));
    safe(() => vc.setItem(lay.next, marker(NAV_NEXT, s, +1)));
  }
}

function savePage(s, vc) {
  const { lay } = s;
  const strays = [];
  for (let k = 0; k < lay.per; k++) {
    const slot = lay.view[k];
    const L = s.page * lay.per + k;
    const it = safe(() => vc.getItem(slot));
    if (L < s.cap) {
      const loc = storeLoc(s.st, L);
      if (!it || !loc) continue;
      if (MARKERS.has(it.typeId)) {
        safe(() => vc.setItem(slot, undefined));
        continue;
      }
      if (!safe(() => loc[0].getItem(loc[1]))) safe(() => vc.swapItems(slot, loc[1], loc[0]));
      else strays.push(slot);
    } else if (it) {
      if (it.typeId === LOCKED) safe(() => vc.setItem(slot, undefined));
      else strays.push(slot);
    }
  }
  for (const slot of [lay.prev, lay.next]) {
    if (slot < 0) continue;
    const it = safe(() => vc.getItem(slot));
    if (!it) continue;
    if (MARKERS.has(it.typeId)) safe(() => vc.setItem(slot, undefined));
    else strays.push(slot);
  }
  // kilitli yuvaya ya da ok yerine bırakılan eşyalar: boş bir yuvaya
  for (const slot of strays) {
    const L = freeLogical(s.st, s.cap);
    const loc = L >= 0 ? storeLoc(s.st, L) : null;
    if (loc) safe(() => vc.moveItem(slot, loc[1], loc[0]));
    else {
      const it = safe(() => vc.getItem(slot));
      if (it) giveTo(s.player, it, s.pos, s.dimId);
      safe(() => vc.setItem(slot, undefined));
    }
  }
}

/** Oyuncunun envanterine ya da imlecine kaçmış sayfa işaretlerini siler; silinen türleri döndürür. */
export function stripMarkers(player) {
  const took = new Set();
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const id = safe(() => inv.getItem(i)?.typeId);
      if (id && MARKERS.has(id)) {
        took.add(id);
        safe(() => inv.setItem(i, undefined));
      }
    }
  }
  const cur = safe(() => player.getComponent("minecraft:cursor_inventory"));
  const cid = safe(() => cur?.item?.typeId);
  if (cid && MARKERS.has(cid)) {
    took.add(cid);
    safe(() => cur.clear());
  }
  return took;
}

function isCreative(p) {
  return safe(() => p.getGameMode() === GameMode.Creative, false);
}
function giveTo(player, item, pos, dimId) {
  const inv = safe(() => player?.getComponent("minecraft:inventory")?.container);
  const rest = inv ? safe(() => inv.addItem(item), item) : item;
  if (rest) {
    const dim = safe(() => (player ? player.dimension : world.getDimension(dimId)));
    const at = player ? player.location : { x: pos.x + 0.5, y: pos.y + 1, z: pos.z + 0.5 };
    safe(() => dim.spawnItem(rest, at));
  }
}
function bar(p, text) {
  safe(() => p.onScreenDisplay.setActionBar(text));
}

/** Sahibi (ya da izinli oyuncu) sandığı açtı: o anki sayfayı sandığa taşı. */
export function startSession(player, block) {
  let uid = unitIdAt(block.dimension.id, block);
  if (!uid) return null;
  const vc = safe(() => block.getComponent("minecraft:inventory")?.container);
  if (!vc) return null;
  uid = syncDouble(uid, block, vc);
  const u = loadUnit(uid);
  if (!u) return null;
  const old = sessions.get(u.id);
  if (old) {
    old.player = player;
    return old;
  }
  const st = stores(u);
  absorb(u, vc, st);
  const cap = capacity(u, st);
  const lay = layout(vc.size, cap);
  const s = { uid: u.id, player, dimId: u.dim, pos: P(block), lay, cap, st, noNav: false,
    page: Math.max(0, Math.min(lay.pages - 1, u.page ?? 0)) };
  sessions.set(u.id, s);
  loadPage(s, vc);
  if (lay.pages > 1) bar(player, `§sSayfa ${s.page + 1}/${lay.pages}§r §7· ${cap} yuva`);
  return s;
}

export function endSession(s) {
  const vc = viewOf(s);
  if (vc) safe(() => savePage(s, vc));
  sessions.delete(s.uid);
  if (s.player) safe(() => stripMarkers(s.player));
  const u = loadUnit(s.uid);
  if (u && u.page !== s.page) {
    u.page = s.page;
    saveUnit(u);
  }
}

function flip(s, vc, dir) {
  savePage(s, vc);
  s.page = (s.page + dir + s.lay.pages) % s.lay.pages;
  loadPage(s, vc);
  const u = loadUnit(s.uid);
  if (u) {
    u.page = s.page;
    saveUnit(u);
  }
  safe(() => s.player.playSound("item.book.page_turn"));
  bar(s.player, `§sSayfa ${s.page + 1}/${s.lay.pages}`);
}

/** Bırakılan yabancı eşyayı sayfadaki boş yuvaya (yoksa depoya, o da yoksa oyuncuya) taşır. */
function rehome(s, vc, slot) {
  const { lay } = s;
  for (let k = 0; k < lay.per; k++) {
    const L = s.page * lay.per + k;
    if (L >= s.cap) break;
    const free = lay.view[k];
    if (free !== slot && !safe(() => vc.getItem(free))) {
      safe(() => vc.moveItem(slot, free, vc));
      return;
    }
  }
  const L = freeLogical(s.st, s.cap, (x) => Math.floor(x / lay.per) === s.page);
  const loc = L >= 0 ? storeLoc(s.st, L) : null;
  if (loc) safe(() => vc.moveItem(slot, loc[1], loc[0]));
  else {
    const it = safe(() => vc.getItem(slot));
    if (it) giveTo(s.player, it, s.pos, s.dimId);
    safe(() => vc.setItem(slot, undefined));
  }
}

function poll(s) {
  const p = s.player;
  const vc = viewOf(s);
  if (!vc) {
    sessions.delete(s.uid);
    return;
  }
  if (!safe(() => p.isValid, false) || V.dist(p.location, { x: s.pos.x + 0.5, y: s.pos.y, z: s.pos.z + 0.5 }) > OPEN_RANGE) {
    endSession(s);
    return;
  }
  const { lay } = s;
  if (lay.pages > 1 && !s.noNav) {
    for (const [slot, dir, id] of [[lay.next, 1, NAV_NEXT], [lay.prev, -1, NAV_PREV]]) {
      const it = safe(() => vc.getItem(slot));
      if (it?.typeId === id) continue;
      const took = stripMarkers(p);
      if (it) {
        // oka bir eşya bırakıldı: eşyayı yerleştir, oku geri koy (sayfa değişmez)
        rehome(s, vc, slot);
        safe(() => vc.setItem(slot, marker(id, s, dir)));
        return;
      }
      if (took.has(id)) {
        flip(s, vc, dir);
        return;
      }
      // ok oyuncuda değil: altındaki huni gibi bir şey çekmiş; oklar kapanır, sayfa panelden değişir
      s.noNav = true;
      for (const x of [lay.prev, lay.next]) if (MARKERS.has(safe(() => vc.getItem(x)?.typeId))) safe(() => vc.setItem(x, undefined));
      bar(p, "§eSandığın altındaki huni okları çekiyor; sayfayı panelden değiştir (eğil + basılı tut).");
      return;
    }
  }
  // kilitli yuvalar
  for (let k = 0; k < lay.per; k++) {
    const L = s.page * lay.per + k;
    if (L < s.cap) continue;
    const slot = lay.view[k];
    const it = safe(() => vc.getItem(slot));
    if (it?.typeId === LOCKED) continue;
    stripMarkers(p);
    if (it) rehome(s, vc, slot);
    safe(() => vc.setItem(slot, marker(LOCKED, s)));
  }
  if (system.currentTick % 4 === 0) stripMarkers(p);
}

system.runInterval(() => {
  if (!sessions.size) return;
  for (const s of [...sessions.values()]) safe(() => poll(s));
}, 1);

world.afterEvents.blockContainerOpened?.subscribe((ev) => {
  const p = safe(() => ev.openSource?.entity);
  const blk = ev.block;
  if (!p || safe(() => p.typeId) !== "minecraft:player" || !isChest(blk)) return;
  safe(() => startSession(p, blk));
});
world.afterEvents.blockContainerClosed?.subscribe((ev) => {
  const blk = ev.block;
  if (!isChest(blk)) return;
  const uid = resolveId(unitIdAt(blk.dimension.id, blk));
  const s = uid && sessions.get(uid);
  if (s) safe(() => endSession(s));
});
world.afterEvents.playerLeave?.subscribe((ev) => {
  for (const s of [...sessions.values()]) if (safe(() => s.player.id) === ev.playerId) safe(() => endSession(s));
  pending.delete(ev.playerId);
});
// dünyaya düşen işaretleri sil
world.afterEvents.entitySpawn?.subscribe((ev) => {
  const e = ev.entity;
  if (safe(() => e.typeId) !== "minecraft:item") return;
  const id = safe(() => e.getComponent("minecraft:item")?.itemStack?.typeId);
  if (id && MARKERS.has(id)) safe(() => e.remove());
});
// açık sandığı olmayan oyuncuların üstünde kalmış işaretler
system.runInterval(() => {
  const open = new Set([...sessions.values()].map((s) => safe(() => s.player.id)));
  for (const p of world.getAllPlayers()) if (!open.has(p.id)) safe(() => stripMarkers(p));
}, 100);

// ====================================================================== bütün sayfalar tek depo (robotlar, İçindekiler)
export class UnitContainer {
  constructor(uid) {
    this.uid = uid;
    const u = loadUnit(uid);
    this.st = u ? stores(u) : [];
    this.cap = u ? capacity(u, this.st) : 0;
    if (u && !sessions.has(uid)) safe(() => absorb(u, undefined, this.st));
  }
  get isValid() {
    return this.st.length > 0;
  }
  get size() {
    return this.cap;
  }
  _loc(L) {
    if (L < 0 || L >= this.cap) return null;
    const s = sessions.get(this.uid);
    if (s && Math.floor(L / s.lay.per) === s.page) {
      const vc = viewOf(s);
      if (vc) return [vc, s.lay.view[L - s.page * s.lay.per]];
    }
    return storeLoc(this.st, L);
  }
  getItem(L) {
    const r = this._loc(L);
    return r ? safe(() => r[0].getItem(r[1])) : undefined;
  }
  setItem(L, item) {
    const r = this._loc(L);
    if (r) safe(() => r[0].setItem(r[1], item));
  }
  get emptySlotsCount() {
    let n = 0;
    for (let L = 0; L < this.cap; L++) if (!this.getItem(L)) n++;
    return n;
  }
  /** Eşyayı ekler; sığmayanı döndürür. */
  addItem(item) {
    if (!item) return undefined;
    let left = item.amount;
    // tek geçiş: önce aynı türün yarım yığınları, sonra boş yuvalar (büyük sandıkta her yuva bir kez okunur)
    const empty = [];
    for (let L = 0; L < this.cap && left > 0; L++) {
      const cur = this.getItem(L);
      if (!cur) {
        empty.push(L);
        continue;
      }
      if (cur.amount >= cur.maxAmount || !safe(() => cur.isStackableWith(item), false)) continue;
      const n = Math.min(left, cur.maxAmount - cur.amount);
      cur.amount += n;
      this.setItem(L, cur);
      left -= n;
    }
    for (const L of empty) {
      if (left <= 0) break;
      const put = item.clone();
      put.amount = Math.min(left, item.maxAmount);
      this.setItem(L, put);
      left -= put.amount;
    }
    if (left <= 0) return undefined;
    const rest = item.clone();
    rest.amount = left;
    return rest;
  }
}

// ====================================================================== sandık tutamacı (robot kodu varlık sandığı gibi kullanır)
export class Sandik {
  constructor(uid) {
    this.uid = uid;
  }
  get u() {
    return loadUnit(this.uid);
  }
  get id() {
    return this.uid;
  }
  get typeId() {
    return "aqualit:sandik";
  }
  get dimension() {
    const u = this.u;
    return u ? dimOf(u) : undefined;
  }
  get location() {
    const b = this.u?.blocks?.[0];
    return b ? { x: b.x + 0.5, y: b.y, z: b.z + 0.5 } : { x: 0, y: -999, z: 0 };
  }
  get isValid() {
    const u = this.u;
    return !!u && u.blocks.some((b) => isChest(blockOf(u, b)));
  }
  get nameTag() {
    return this.u?.name ?? "";
  }
  set nameTag(v) {
    const u = this.u;
    if (!u) return;
    u.name = String(v ?? "").slice(0, 32);
    saveUnit(u);
    Chests.upsert(u.owner, { cid: u.id, name: u.name || CHEST_NAME[u.kind] });
  }
  getProperty(k) {
    return k === "aqualit:kind" ? this.u?.kind ?? "genel" : undefined;
  }
  setProperty() {
    // kapak: oyunun sandığı kendisi açılır; robotlar ses çalar
  }
  getDynamicProperty(k) {
    const u = this.u;
    if (!u) return undefined;
    switch (k) {
      case "aq:owner": return u.owner;
      case "aq:ownerName": return u.ownerName;
      case "aq:cid": return u.id;
      case "aq:kind": return u.kind;
      case "aq:access": return JSON.stringify(u.access ?? {});
    }
    return undefined;
  }
  setDynamicProperty(k, v) {
    const u = this.u;
    if (!u) return;
    if (k === "aq:access") {
      u.access = typeof v === "string" ? JSON.parse(v) : { allow: [], deny: [], only: false };
      saveUnit(u);
    }
  }
  getComponent(c) {
    if (c === "minecraft:inventory" || c === "inventory") return { container: new UnitContainer(this.uid) };
    return undefined;
  }
}

/** Robotların sandık başında durduğu yer: önündeki (yoksa yanındaki) boş hücrenin ortası. */
export function standSpot(h) {
  const u = h && loadUnit(h.id ?? h);
  if (!u) return h?.location;
  const dim = dimOf(u);
  const open = (q) => {
    const t = safe(() => dim.getBlock(q)?.typeId, null);
    return t !== null && safe(() => isPassableType(t), false) && !/lava|fire/.test(t);
  };
  for (const b of u.blocks) {
    const blk = blockOf(u, b);
    if (!isChest(blk)) continue;
    const f = frontOf(blk);
    for (const d of [f, ...Object.keys(DIR).filter((x) => x !== f && x !== OPP[f]), OPP[f]]) {
      const q = { x: b.x + DIR[d].x, y: b.y, z: b.z + DIR[d].z };
      if (open(q) && open({ x: q.x, y: q.y + 1, z: q.z }) && !open({ x: q.x, y: q.y - 1, z: q.z })) return { x: q.x + 0.5, y: q.y, z: q.z + 0.5 };
    }
  }
  return h.location;
}

/** Kimlikten tutamaç (eski kimlikler çevrilir). */
export function getSandik(id) {
  const uid = resolveId(id);
  return loadUnit(uid) ? new Sandik(uid) : undefined;
}
export function sandikAt(dim, p) {
  const uid = unitIdAt(dim.id, P(p));
  return uid && loadUnit(uid) ? new Sandik(uid) : undefined;
}

// ====================================================================== kayıt, çift sandık
let placedHook = null;
/** Yeni sandık konunca (robot bağlama vb.) çağrılır: fn(handle, player). */
export function setPlacedHook(fn) {
  placedHook = fn;
}

/** Bloğu Aqualit sandığı olarak kaydeder. owner: {id, name}. */
export function registerChest(dim, pos, kind, owner, opts = {}) {
  const p = P(pos);
  const exist = unitIdAt(dim.id, p);
  if (exist && loadUnit(exist)) return loadUnit(exist);
  const id = idOf(dim.id, p);
  const u = { id, v: 1, dim: dim.id, blocks: [{ x: p.x, y: p.y, z: p.z }], owner: owner?.id ?? "", ownerName: owner?.name ?? "",
    kind: CHEST_ITEM[kind] ? kind : "genel", name: opts.name ?? "", access: opts.access ?? { allow: [], deny: [], only: false },
    added: 0, double: false, page: 0 };
  saveUnit(u);
  setUnitIdAt(dim.id, p, id);
  if (u.owner) Chests.upsert(u.owner, { cid: id, kind: u.kind, dim: dim.id, pos: { ...p }, name: u.name || CHEST_NAME[u.kind] });
  companion(u, 0, true);
  if (!opts.noPair) system.runTimeout(() => safe(() => checkPair(id)), 2);
  return u;
}

const SIDES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

/** Bloğun kabı çift (54) olduysa yanındaki yarıyı birime katar. Birimin (değişmiş olabilir) kimliğini döndürür. */
function checkPair(uid) {
  const u = loadUnit(uid);
  if (!u || u.blocks.length > 1) return uid;
  const blk = blockOf(u, u.blocks[0]);
  const vc = isChest(blk) && safe(() => blk.getComponent("minecraft:inventory")?.container);
  if (!vc || vc.size < 54) return uid;
  const b = u.blocks[0];
  // hangi komşuyla birleşti? sandığa geçici bir işaret koyup komşunun kabında ara
  const slot = safe(() => vc.firstEmptySlot(), undefined) ?? -1;
  let partner = null;
  const tag = `§0aq${system.currentTick}`;
  if (slot >= 0) {
    const m = new ItemStack(LOCKED, 1);
    m.nameTag = tag;
    safe(() => vc.setItem(slot, m));
  }
  for (const d of SIDES) {
    const q = { x: b.x + d.x, y: b.y, z: b.z + d.z };
    const nb = blockOf(u, q);
    if (!isChest(nb)) continue;
    const nc = safe(() => nb.getComponent("minecraft:inventory")?.container);
    if (!nc || nc.size < 54) continue;
    let hit = slot < 0;
    if (!hit) for (let i = 0; i < nc.size && !hit; i++) hit = safe(() => nc.getItem(i)?.nameTag, "") === tag;
    if (hit) {
      partner = q;
      break;
    }
  }
  if (slot >= 0) safe(() => vc.setItem(slot, undefined));
  if (!partner) return uid;
  const nid = unitIdAt(u.dim, partner);
  const n = nid && loadUnit(nid);
  if (n && n.id !== u.id) {
    if (n.blocks.length > 1 || n.owner !== u.owner || n.kind !== u.kind) return uid;
    // yeni yarı eski birime katılır (eşyası, kapasitesi, adı olan)
    const keep = n.blocks[0].ek ? snapshot(n) : null;
    // yeni yarının deposu boş (yeni kondu); kalan bir şey varsa ana birime aktarılır
    const extra = snapshot(u).map(([, it]) => it);
    if (u.blocks[0].ek) {
      const x = companion(u, 0, false, true);
      if (x) safe(() => x.remove());
      delete u.blocks[0].ek;
    }
    n.blocks.push({ ...u.blocks[0] });
    n.double = true;
    saveUnit(n);
    setUnitIdAt(u.dim, u.blocks[0], n.id);
    deleteUnit(u.id);
    Chests.remove(u.owner, u.id);
    addAlias(u.id, n.id);
    if (keep) restore(n, keep);
    if (extra.length) restore(n, extra.map((it) => [1e9, it]));
    return n.id;
  }
  // kayıtsız (oyunun sıradan tuzaklı sandığı) yarı: aynı birime kaydet
  const keep = u.blocks[0].ek ? snapshot(u) : null;
  u.blocks.push({ x: partner.x, y: partner.y, z: partner.z });
  u.double = true;
  saveUnit(u);
  setUnitIdAt(u.dim, partner, u.id);
  companion(u, 1, true);
  if (keep) restore(u, keep);
  return u.id;
}

/** Açılışta: kap 54 ise çifti tamamla, 27 ise kaybolan yarıyı ayır. */
function syncDouble(uid, block, vc) {
  const u = loadUnit(uid);
  if (!u) return uid;
  if (vc.size >= 54 && !u.double) {
    if (u.blocks.length === 1) return checkPair(uid);
  }
  if (vc.size < 54 && u.blocks.length > 1) {
    const gone = u.blocks.findIndex((b) => !isChest(blockOf(u, b)));
    if (gone >= 0) return detachHalf(u, gone, null);
    u.double = false;
    saveUnit(u);
  }
  return uid;
}

/** Çiftin bir yarısını çıkarır; eşyaları kalan yarıya geçer. Kalan birimin kimliğini döndürür. */
function detachHalf(u, bi, dropAt) {
  const st = stores(u);
  const items = [];
  for (let L = 0; L < storeSize(st); L++) {
    const loc = storeLoc(st, L);
    const it = loc && safe(() => loc[0].getItem(loc[1]));
    if (it) {
      items.push(it);
      safe(() => loc[0].setItem(loc[1], undefined));
    }
  }
  removeCompanions(u, bi);
  const keep = u.blocks[1 - bi];
  const oldId = u.id;
  setUnitIdAt(u.dim, u.blocks[bi], undefined);
  u.blocks = [keep];
  u.double = false;
  if (bi === 0) {
    // ana yarı gitti: birim kalan yarının kimliğine taşınır
    deleteUnit(oldId);
    u.id = idOf(u.dim, keep);
    setUnitIdAt(u.dim, keep, u.id);
    Chests.remove(u.owner, oldId);
    Chests.upsert(u.owner, { cid: u.id, kind: u.kind, dim: u.dim, pos: { x: keep.x, y: keep.y, z: keep.z }, name: u.name || CHEST_NAME[u.kind] });
    addAlias(oldId, u.id);
  }
  saveUnit(u);
  // eşyaları yeni düzende geri koy; sığmayan yere düşer
  const c = new UnitContainer(u.id);
  const at = dropAt ?? { x: keep.x + 0.5, y: keep.y + 1, z: keep.z + 0.5 };
  for (const it of items) {
    const rest = c.addItem(it);
    if (rest) safe(() => dimOf(u).spawnItem(rest, at));
  }
  return u.id;
}

// ====================================================================== kırma, kaldırma
/** Bütün depoyu boşaltır: eşyaların listesi (depo temizlenir). */
function takeAll(u) {
  const st = stores(u, false);
  const out = [];
  for (const s of st) {
    for (let i = 0; i < s.size; i++) {
      const it = safe(() => s.c.getItem(i));
      if (it) {
        out.push(it);
        safe(() => s.c.setItem(i, undefined));
      }
    }
  }
  return out;
}
function dropItems(dim, at, items) {
  // kalabalık sandıkta dünyayı yormamak için tik başına 16 yığın
  const list = items.slice();
  const step = () => {
    for (let n = 0; n < 16 && list.length; n++) safe(() => dim.spawnItem(list.shift(), at));
    if (list.length) system.runTimeout(step, 1);
  };
  step();
}
function refund(u) {
  const out = [];
  let n = u.added ?? 0;
  while (n > 0) {
    out.push(new ItemStack("minecraft:chest", Math.min(64, n)));
    n -= 64;
  }
  return out;
}
function unregister(u) {
  for (const b of u.blocks) setUnitIdAt(u.dim, b, undefined);
  deleteUnit(u.id);
  if (u.owner) Chests.remove(u.owner, u.id);
  dropAliasesTo(u.id);
}

/** Sahibi sandığı kırdı (ya da başka yolla bloğu gitti). */
export function breakChestAt(dim, pos, player, opts = {}) {
  const p = P(pos);
  const uid = unitIdAt(dim.id, p);
  const u = uid && loadUnit(uid);
  if (!u) {
    if (uid) setUnitIdAt(dim.id, p, undefined);
    return false;
  }
  const s = sessions.get(u.id);
  if (s) endSession(s);
  safe(() => absorb(u));
  const bi = u.blocks.findIndex((b) => same(b, p));
  const at = { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 };
  const kind = u.kind;
  if (u.blocks.length > 1 && bi >= 0) {
    detachHalf(u, bi, at);
  } else {
    const items = takeAll(u).concat(refund(u));
    for (let i = 0; i < u.blocks.length; i++) removeCompanions(u, i);
    unregister(u);
    dropItems(dim, at, items);
  }
  if (!opts.keepBlock) {
    const blk = safe(() => dim.getBlock(p));
    if (isChest(blk)) safe(() => blk.setType("minecraft:air"));
    safe(() => dim.playSound("dig.wood", at));
    safe(() => dim.spawnParticle("minecraft:basic_smoke_particle", at));
  }
  if (!(player && isCreative(player)) && !opts.noItem) safe(() => dim.spawnItem(new ItemStack(CHEST_ITEM[kind] ?? CHEST_ITEM.genel, 1), at));
  return true;
}

/** Panelden "Sandığı kaldır": içindekiler ve sandık eşyaları oyuncuya. */
export function pickupUnit(player, uid) {
  const u = loadUnit(resolveId(uid));
  if (!u) return false;
  const s = sessions.get(u.id);
  if (s) endSession(s);
  safe(() => absorb(u));
  const items = takeAll(u).concat(refund(u));
  for (const b of u.blocks) items.push(new ItemStack(CHEST_ITEM[u.kind] ?? CHEST_ITEM.genel, 1));
  for (let i = 0; i < u.blocks.length; i++) removeCompanions(u, i);
  const dim = dimOf(u);
  for (const b of u.blocks) {
    const blk = blockOf(u, b);
    if (isChest(blk)) safe(() => blk.setType("minecraft:air"));
  }
  unregister(u);
  for (const it of items) giveTo(player, it, u.blocks[0], u.dim);
  safe(() => dim.playSound("random.chestclosed", player.location));
  return true;
}

/** Kapasite ekle: n normal sandık. Eklenen yuva sayısını döndürür. */
export function addCapacity(u, n) {
  const before = capacity(u);
  u.added = (u.added ?? 0) + Math.max(0, n);
  const after = capacity(u);
  saveUnit(u);
  return after - before;
}
/** Kaç sandık daha eklenebilir? */
export function roomForChests(u) {
  return Math.max(0, Math.ceil((maxCapacity(u) - capacity(u)) / CAP.perChest));
}
export function setOpenPage(u, page) {
  u.page = Math.max(0, page | 0);
  saveUnit(u);
}
/** Sandık özeti: {cap, used, pages, max}. */
export function summary(uid) {
  const u = loadUnit(uid);
  if (!u) return null;
  const c = new UnitContainer(u.id);
  let used = 0;
  for (let L = 0; L < c.size; L++) if (c.getItem(L)) used++;
  const size = u.double ? 54 : 27;
  return { cap: c.size, used, pages: layout(size, c.size).pages, max: maxCapacity(u), double: !!u.double, added: u.added ?? 0 };
}
export function canOpen(player, u) {
  return !u.owner || u.owner === player.id;
}

// ====================================================================== oyuncu olayları
function replaceable(t) {
  return t === "minecraft:air" || safe(() => isPassableType(t), false) && !/door|trapdoor|sign|bed|button|lever|rail|torch|ladder/.test(t);
}

world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  const b = ev.block;
  const p = ev.player;
  const t = safe(() => b.typeId, "");
  if (t === CHEST_BLOCK) {
    const uid = unitIdAt(b.dimension.id, b);
    const u = uid && loadUnit(uid);
    if (u && !canOpen(p, u)) {
      ev.cancel = true;
      if (ev.isFirstEvent !== false) system.run(() => bar(p, `§cBu sandık ${u.ownerName || "başka bir oyuncu"}'ya ait.`));
      return;
    }
    if (!p.isSneaking) return;     // dokununca açılır; yerleştirme yok
  }
  const held = ev.itemStack?.typeId;
  if (!held) return;
  const kind = KIND_OF_ITEM[held];
  if (!kind && held !== CHEST_BLOCK) return;
  // nereye konacak?
  const off = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] }[ev.blockFace] ?? [0, 1, 0];
  const at = replaceable(t) ? { x: b.x, y: b.y, z: b.z } : { x: b.x + off[0], y: b.y + off[1], z: b.z + off[2] };
  const dimId = b.dimension.id;
  for (const d of SIDES) {
    const q = { x: at.x + d.x, y: at.y, z: at.z + d.z };
    const nt = safe(() => b.dimension.getBlock(q)?.typeId, "");
    if (nt !== CHEST_BLOCK) continue;
    const nid = unitIdAt(dimId, q);
    const n = nid && loadUnit(nid);
    let why = null;
    if (!kind && n) why = "Aqualit sandığının yanına sıradan tuzaklı sandık konmaz (birleşirler).";
    else if (kind && !n) why = "Yanında sıradan bir tuzaklı sandık var; Aqualit sandığı onunla birleşirdi. Bir blok boşluk bırak.";
    else if (kind && n && n.owner !== p.id) why = "Başka bir oyuncunun sandığının yanına sandık koyamazsın.";
    else if (kind && n && n.kind !== kind && n.blocks.length < 2) why = "Farklı türdeki Aqualit sandıkları yan yana birleşir. Bir blok boşluk bırak ya da aynı türü koy.";
    if (why) {
      ev.cancel = true;
      if (ev.isFirstEvent !== false) system.run(() => bar(p, `§c${why}`));
      return;
    }
  }
  if (kind) {
    pending.set(p.id, { kind, dimId, pos: at, tick: system.currentTick, ploc: { ...p.location }, prot: safe(() => p.getRotation()) });
    system.runTimeout(() => safe(() => confirmPlacement(p)), 2);
  }
});

function confirmPlacement(player, blk) {
  const pd = pending.get(player.id);
  if (!pd || system.currentTick - pd.tick > 6) {
    pending.delete(player.id);
    return;
  }
  const dim = safe(() => world.getDimension(pd.dimId));
  blk ??= safe(() => dim.getBlock(pd.pos));
  if (!isChest(blk) || unitIdAt(pd.dimId, blk)) return;
  pending.delete(player.id);
  calibrate(blk, pd.ploc, pd.prot);
  const u = registerChest(dim, blk, pd.kind, { id: player.id, name: player.name });
  if (placedHook) safe(() => placedHook(new Sandik(u.id), player));
}

world.afterEvents.playerPlaceBlock?.subscribe((ev) => {
  // v0.3.2: sandık eşyaları gerçek 3B bloktur (envanterde ve elde oyunun sandığı gibi görünsün diye).
  // Konunca aynı yerde tuzaklı sandığa dönüşür ve Aqualit sandığı olarak kaydolur.
  const bk = KIND_OF_ITEM[safe(() => ev.block.typeId, "")];
  if (bk) {
    const blk = ev.block, pl = ev.player;
    const front = towards(blk, pl.location);
    try {
      blk.setPermutation(BlockPermutation.resolve(CHEST_BLOCK, { "minecraft:cardinal_direction": stateFor(front) }));
    } catch (e) {
      return;
    }
    const pd = pending.get(pl.id);
    if (!pd || pd.kind !== bk) {
      pending.set(pl.id, { kind: bk, dimId: blk.dimension.id, pos: { x: blk.x, y: blk.y, z: blk.z }, tick: system.currentTick,
        ploc: { ...pl.location }, prot: safe(() => pl.getRotation()) });
    } else pd.pos = { x: blk.x, y: blk.y, z: blk.z };
    safe(() => confirmPlacement(pl, blk.dimension.getBlock(blk.location)));
    return;
  }
  if (!isChest(ev.block) || !pending.has(ev.player.id)) return;
  safe(() => confirmPlacement(ev.player, ev.block));
});

// eğil + basılı tut: panel; sahibi değilse kıramaz; sahibi kırınca bütün sayfalar düşer
let panelHook = null;
/** Sandık paneli: fn(player, handle). */
export function setPanelHook(fn) {
  panelHook = fn;
}
world.afterEvents.playerStartBreakingBlock?.subscribe((ev) => {
  const b = ev.block;
  const p = ev.player;
  if (!isChest(b) || !p.isSneaking) return;
  const uid = unitIdAt(b.dimension.id, b);
  const u = uid && loadUnit(uid);
  if (!u) return;
  if (!canOpen(p, u)) return bar(p, `§cBu sandık ${u.ownerName || "başka bir oyuncu"}'ya ait.`);
  if (panelHook) system.run(() => safe(() => panelHook(p, new Sandik(u.id))));
});
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  const b = ev.block;
  if (safe(() => b.typeId) !== CHEST_BLOCK) return;
  const uid = unitIdAt(b.dimension.id, b);
  const u = uid && loadUnit(uid);
  if (!u) return;
  const p = ev.player;
  ev.cancel = true;
  if (p.isSneaking) return;   // panel açılıyor
  if (!canOpen(p, u)) {
    system.run(() => bar(p, `§cBu sandık ${u.ownerName || "başka bir oyuncu"}'ya ait.`));
    return;
  }
  const dim = b.dimension;
  const pos = { x: b.x, y: b.y, z: b.z };
  system.run(() => safe(() => breakChestAt(dim, pos, p)));
});
// patlamalar Aqualit sandığını kırmaz
world.beforeEvents.explosion?.subscribe((ev) => {
  const list = safe(() => ev.getImpactedBlocks(), []) ?? [];
  const keep = list.filter((bl) => !(safe(() => bl.typeId) === CHEST_BLOCK && unitIdAt(bl.dimension.id, bl)));
  if (keep.length !== list.length) safe(() => ev.setImpactedBlocks(keep));
});

// ====================================================================== betikle sandık koyma (robot sandığı, taşıma)
/** Sandık bloğu koyup kaydeder. toward: önü bakacağı nokta. Tutamaç döndürür. */
export function placeChestBlock(dim, pos, kind, owner, toward, opts = {}) {
  const p = P(pos);
  const blk = safe(() => dim.getBlock(p));
  if (!blk) return undefined;
  let front = toward ? towards(p, toward) : "south";
  // yan komşu tuzaklı sandıkla birleşmesin: komşu yan eksendeyse yüzü çevir
  const sideAxis = (f) => (DIR[f].x !== 0 ? "z" : "x");
  const hasSide = (f) => SIDES.some((d) => (sideAxis(f) === "x" ? d.x !== 0 : d.z !== 0)
    && safe(() => dim.getBlock({ x: p.x + d.x, y: p.y, z: p.z + d.z })?.typeId) === CHEST_BLOCK);
  if (hasSide(front)) {
    const alt = { north: "east", south: "west", east: "south", west: "north" }[front];
    if (!hasSide(alt)) front = alt;
  }
  try {
    blk.setPermutation(BlockPermutation.resolve(CHEST_BLOCK, { "minecraft:cardinal_direction": stateFor(front) }));
  } catch (e) {
    return undefined;
  }
  const u = registerChest(dim, p, kind, owner, { name: opts.name, access: opts.access, noPair: true });
  return new Sandik(u.id);
}

// ====================================================================== eski varlık sandıklarını taşı (v0.2.8 ve öncesi)
/** Eski sandığı aynı yere gerçek sandık olarak koyar; eşyaları, adı, erişimi ve robot bağlantıları korunur. */
export function migrateOld(e) {
  if (safe(() => e.typeId) !== OLD_CHEST_ID || !safe(() => e.isValid, false)) return false;
  const dim = e.dimension;
  const pos = P(e.location);
  const blk = safe(() => dim.getBlock(pos));
  if (!blk) return false;
  const t = blk.typeId;
  if (t !== "minecraft:air" && !replaceable(t)) return false;   // yer dolu: eski sandık yerinde kalır
  const owner = getProp(e, "aq:owner", "");
  const kind = getProp(e, "aq:kind", safe(() => e.getProperty("aqualit:kind"), "genel"));
  const yaw = safe(() => e.getRotation().y, 0) ?? 0;
  const look = { x: pos.x + 0.5 - Math.sin((yaw * Math.PI) / 180) * 3, y: pos.y, z: pos.z + 0.5 + Math.cos((yaw * Math.PI) / 180) * 3 };
  const h = placeChestBlock(dim, pos, kind, { id: owner, name: getProp(e, "aq:ownerName", "") }, look,
    { name: e.nameTag || "", access: getJSON(e, "aq:access", undefined) });
  if (!h) return false;
  const oc = safe(() => e.getComponent("minecraft:inventory")?.container);
  const u = loadUnit(h.id);
  const st = stores(u);
  if (oc && st.length) {
    for (let i = 0; i < oc.size; i++) if (safe(() => oc.getItem(i))) safe(() => oc.moveItem(i, i, st[0].c));
  }
  let left = 0;
  if (oc) for (let i = 0; i < oc.size; i++) if (safe(() => oc.getItem(i))) left++;
  if (left) {
    // taşınamayan bir şey kaldıysa (olmamalı) eski sandık içindekilerle yerinde kalsın
    return false;
  }
  addAlias(e.id, h.id);
  const oldCid = getProp(e, "aq:cid", "");
  if (oldCid) {
    addAlias(oldCid, h.id);
    if (owner) Chests.remove(owner, oldCid);
  }
  safe(() => e.remove());
  return true;
}

function migrateLoaded() {
  for (const id of ["overworld", "nether", "the_end"]) {
    const dim = safe(() => world.getDimension(id));
    if (!dim) continue;
    for (const e of safe(() => dim.getEntities({ type: OLD_CHEST_ID }), [])) safe(() => migrateOld(e));
  }
}
world.afterEvents.entityLoad?.subscribe((ev) => {
  const t = safe(() => ev.entity.typeId);
  if (t === OLD_CHEST_ID) system.runTimeout(() => safe(() => migrateOld(ev.entity)), 5);
  else if (t === DEPO_ID || t === EK_ID) system.runTimeout(() => safe(() => checkOrphan(ev.entity)), 10);
});

/**
 * Yüklenen depo varlığı sandığına kayıtlı mı? Değilse (sandık yokken kalmış ya da geç yüklenip yerine yenisi
 * konmuş) eşyaları sandığa (sığmazsa yere) aktarılır, varlık kaldırılır. Eşya kaybolmaz.
 */
export function checkOrphan(e) {
  if (!safe(() => e.isValid, false)) return false;
  const key = getProp(e, "aq:blk", "");
  const pr = parseId(key);
  const fld = e.typeId === EK_ID ? "ek" : "e";
  const uid = pr && unitIdAt(pr.dimId, pr.pos);
  const u = uid && loadUnit(uid);
  const bi = u ? u.blocks.findIndex((b) => idOf(u.dim, b) === key) : -1;
  if (bi >= 0) {
    const cur = u.blocks[bi][fld];
    if (cur === e.id) return false;
    const live = cur && safe(() => world.getEntity(cur));
    if (!live || !safe(() => live.isValid, false)) {
      // kayıtlı olan yok: bunu sahiplen
      u.blocks[bi][fld] = e.id;
      saveUnit(u);
      return false;
    }
  }
  const oc = safe(() => e.getComponent("minecraft:inventory")?.container);
  const items = [];
  if (oc) {
    for (let i = 0; i < oc.size; i++) {
      const it = safe(() => oc.getItem(i));
      if (!it) continue;
      items.push(it);
      safe(() => oc.setItem(i, undefined));
    }
  }
  const c = u ? new UnitContainer(u.id) : null;
  for (const it of items) {
    const r = c ? c.addItem(it) : it;
    if (r) safe(() => e.dimension.spawnItem(r, e.location));
  }
  safe(() => e.remove());
  return true;
}
system.runTimeout(() => safe(() => migrateLoaded()), 100);
system.runInterval(() => safe(() => migrateLoaded()), 1200);

// test için
export const _test = { sessions, pending, cache, poll, checkPair, layout, absorb, stores, capacity, yawFront, frontOf, companion };
