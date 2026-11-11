// Aqualit Robotları — Organizatör üssü (v0.4.0)
// Aqualit Kablo: komşu kablolara, Aqualit Bloğu'na, Fırın'a ve Aktarım Bloğu'na kendiliğinden bağlanır.
// Aqualit Fırın: elektriklidir; bir Aqualit Bloğu'na doğrudan ya da kabloyla bağlıysa çok hızlı eritir. Yalnız
// Organizatör kullanır. Uzaktan Aktarım Bloğu: yanındaki (3 blok) sandıklara Organizatör eşyayı uzaktan ışınlar.
// Organizatör Platformu: 9x9 tek parça mod yapısı; ortası Organizatör'ün yeri, paneline dokun: üs menüsü.
import { world, system, BlockVolume, ItemStack } from "@minecraft/server";
import { safe, V, log, wait } from "./util.js";
import { menu, modal } from "./ui/forms.js";
import { consumeHand } from "./place.js";
import { unitIdAt, UnitContainer } from "./sandik.js";
import { Chests } from "./store.js";

export const KABLO = "aqualit:aqualit_kablo";
export const FIRIN = "aqualit:aqualit_firin";
export const AKTARIM = "aqualit:aqualit_aktarim";
export const ENERJI = "aqualit:aqualit_block";
export const PLATFORM = "aqualit:org_platform";
const BAGLANIR = new Set([KABLO, FIRIN, AKTARIM, ENERJI]);
const YON = { n: { x: 0, y: 0, z: -1 }, s: { x: 0, y: 0, z: 1 }, w: { x: -1, y: 0, z: 0 }, e: { x: 1, y: 0, z: 0 },
  u: { x: 0, y: 1, z: 0 }, d: { x: 0, y: -1, z: 0 } };

const tip = (dim, p) => safe(() => dim.getBlock(p)?.typeId, null);

/** Kablonun kollarını komşularına göre ayarlar. */
export function kabloGuncelle(dim, p) {
  const b = safe(() => dim.getBlock(p));
  if (!b || b.typeId !== KABLO) return;
  let perm = b.permutation;
  for (const [k, d] of Object.entries(YON)) {
    const t = tip(dim, V.add(p, d));
    perm = safe(() => perm.withState(`aqualit:${k}`, BAGLANIR.has(t) ? "var" : "yok"), perm);
  }
  safe(() => b.setPermutation(perm));
}
function cevreyiGuncelle(dim, p) {
  kabloGuncelle(dim, p);
  for (const d of Object.values(YON)) kabloGuncelle(dim, V.add(p, d));
}

/** Fırın bir Aqualit Bloğu'na (doğrudan ya da kablo zinciriyle, en çok 96 kablo) bağlı mı? */
export function gucluMu(dim, p) {
  const gorulen = new Set([`${p.x},${p.y},${p.z}`]);
  const kuyruk = [p];
  let n = 0;
  while (kuyruk.length && n++ < 96) {
    const q = kuyruk.shift();
    for (const d of Object.values(YON)) {
      const r = V.add(q, d);
      const k = `${r.x},${r.y},${r.z}`;
      if (gorulen.has(k)) continue;
      gorulen.add(k);
      const t = tip(dim, r);
      if (t === ENERJI) return true;
      if (t === KABLO) kuyruk.push(r);
    }
  }
  return false;
}

/** Sandığın 3 blok yakınında Uzaktan Aktarım Bloğu var mı? Varsa yerini verir. */
export function aktarimYakin(dim, p, r = 3) {
  const vol = new BlockVolume({ x: p.x - r, y: p.y - r, z: p.z - r }, { x: p.x + r, y: p.y + r, z: p.z + r });
  const res = safe(() => dim.getBlocks(vol, { includeTypes: [AKTARIM] }, true));
  for (const q of safe(() => [...(res?.getBlockLocationIterator() ?? [])], []) ?? []) return q;
  return null;
}

world.afterEvents.playerPlaceBlock.subscribe((ev) => {
  const t = safe(() => ev.block.typeId);
  if (!BAGLANIR.has(t)) return;
  const p = { x: ev.block.x, y: ev.block.y, z: ev.block.z };
  system.run(() => cevreyiGuncelle(ev.block.dimension, p));
  if (t === FIRIN) system.run(() => {
    const g = gucluMu(ev.block.dimension, p);
    safe(() => ev.player.onScreenDisplay.setActionBar(g ? "§bAqualit Fırın güçlü §7· Organizatör çok hızlı eritir"
      : "§eFırına güç yok §7· Aqualit Bloğu'na doğrudan ya da Aqualit Kablo ile bağla (güçsüz yavaş eritir)"));
  });
});
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const t = safe(() => ev.brokenBlockPermutation.type.id);
  if (!BAGLANIR.has(t)) return;
  const p = { x: ev.block.x, y: ev.block.y, z: ev.block.z };
  system.run(() => { for (const d of Object.values(YON)) kabloGuncelle(ev.block.dimension, V.add(p, d)); });
});
// Fırın: yalnız Organizatör kullanır
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  if (safe(() => ev.block.typeId) !== FIRIN || ev.player.isSneaking) return;
  ev.cancel = true;
  const pl = ev.player, b = ev.block;
  system.run(() => {
    const g = gucluMu(b.dimension, { x: b.x, y: b.y, z: b.z });
    safe(() => pl.onScreenDisplay.setActionBar(`§bAqualit Fırın §7· yalnız Organizatör kullanır · ${g ? "§agüçlü (çok hızlı)" : "§egüç yok (yavaş)"}`));
  });
});

// ======================================================================= platform
export function platformKur(pl, block) {
  const p = { x: block.x + 0.5, y: block.y + 1, z: block.z + 0.5 };
  const e = safe(() => pl.dimension.spawnEntity(PLATFORM, p));
  if (!e) return safe(() => pl.sendMessage("§cPlatform buraya kurulamadı."));
  safe(() => e.setDynamicProperty("aq:owner", pl.id));
  consumeHand(pl);
  safe(() => pl.dimension.playSound("beacon.activate", p, { volume: 0.8, pitch: 1.2 }));
  safe(() => pl.sendMessage("§bOrganizatör Platformu§r kuruldu. Ortası Organizatör'ün yeri; paneline (öndeki konsol) dokun."));
  orguYerlestir(pl.id, e);
}
function orguYerlestir(owner, e) {
  import("./brain.js").then(({ bots }) => {
    const org = [...bots.values()].filter((b) => b.valid && b.owner === owner && b.type === "toplayici")
      .sort((a, b) => V.dist(a.loc, e.location) - V.dist(b.loc, e.location))[0];
    if (!org) return;
    const yer = { x: Math.floor(e.location.x) + 0.5, y: e.location.y + 0.4, z: Math.floor(e.location.z) + 0.5 };
    org.home = yer;
    safe(() => org.e.setDynamicProperty("aq:home", yer));
    safe(() => org.e.teleport(yer));
    org.say("Platformuma geçtim! Buradan bütün üssü yönetiyorum.");
  }).catch((x) => log("platform", x));
}
function usDurumu(dim, merkez) {
  const vol = new BlockVolume({ x: merkez.x - 24, y: merkez.y - 8, z: merkez.z - 24 }, { x: merkez.x + 24, y: merkez.y + 8, z: merkez.z + 24 });
  const say = (t) => safe(() => [...(dim.getBlocks(vol, { includeTypes: [t] }, true)?.getBlockLocationIterator() ?? [])], []) ?? [];
  const firinlar = say(FIRIN), aktarimlar = say(AKTARIM), kablolar = say(KABLO);
  const guclu = firinlar.filter((f) => gucluMu(dim, f)).length;
  return [`§7Fırın: §f${firinlar.length}§7 (güçlü ${guclu})`, `§7Uzaktan Aktarım Bloğu: §f${aktarimlar.length}`, `§7Kablo: §f${kablolar.length}`].join("\n");
}
// ======================================================================= üs ağı (v0.4.2)
const MASA = "minecraft:crafting_table";
const SANDIK_BLOK = new Set(["minecraft:trapped_chest", "minecraft:chest", "minecraft:barrel"]);
/** Platformun ağı: platformun kenarına değen kablolardan başlayıp kabloyla bağlı her şey. */
export function agBul(e) {
  const dim = e.dimension;
  const c = V.floor(e.location);
  const vol = new BlockVolume({ x: c.x - 5, y: c.y - 1, z: c.z - 5 }, { x: c.x + 5, y: c.y + 1, z: c.z + 5 });
  const bas = safe(() => [...(dim.getBlocks(vol, { includeTypes: [KABLO] }, true)?.getBlockLocationIterator() ?? [])], []) ?? [];
  const ag = { kablolar: [], sandiklar: new Map(), firinlar: [], masalar: [], aktarimlar: [], guc: false };
  const gor = new Set(), kuyruk = bas.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  for (const p of kuyruk) gor.add(`${p.x},${p.y},${p.z}`);
  while (kuyruk.length && ag.kablolar.length < 600) {
    const q = kuyruk.shift();
    ag.kablolar.push(q);
    for (const d of Object.values(YON)) {
      const r = V.add(q, d);
      const k = `${r.x},${r.y},${r.z}`;
      if (gor.has(k)) continue;
      gor.add(k);
      const t = tip(dim, r);
      if (t === KABLO) kuyruk.push(r);
      else if (t === ENERJI) ag.guc = true;
      else if (t === FIRIN) ag.firinlar.push(r);
      else if (t === MASA) ag.masalar.push(r);
      else if (t === AKTARIM) ag.aktarimlar.push(r);
      else if (SANDIK_BLOK.has(t)) {
        const uid = safe(() => unitIdAt(dim.id, r));
        if (uid) ag.sandiklar.set(uid, r);
      }
    }
  }
  return ag;
}

/** Sandıklardaki eşyaları toplar: id -> adet. */
function icerik(cids) {
  const m = new Map();
  for (const cid of cids) {
    const k = safe(() => new UnitContainer(cid));
    if (!k?.isValid) continue;
    for (let L = 0; L < k.size; L++) {
      const it = k.getItem(L);
      if (it) m.set(it.typeId, (m.get(it.typeId) ?? 0) + it.amount);
    }
  }
  return m;
}
/** kaynak sandıklardan hedef sandıklara eşya taşır (id null: hepsi). Taşınan adet. */
export function aktar(kaynak, hedef, id = null, max = Infinity) {
  let n = 0;
  const hk = hedef.map((c) => safe(() => new UnitContainer(c))).filter((k) => k?.isValid);
  if (!hk.length) return 0;
  for (const cid of kaynak) {
    const k = safe(() => new UnitContainer(cid));
    if (!k?.isValid) continue;
    for (let L = 0; L < k.size && n < max; L++) {
      const it = k.getItem(L);
      if (!it || (id && it.typeId !== id)) continue;
      let kalan = it;
      if (n + it.amount > max) { kalan = it.clone(); kalan.amount = max - n; }
      const once = kalan.amount;
      let rest = kalan;
      for (const h of hk) { rest = safe(() => h.addItem(rest), rest); if (!rest) break; }
      const gitti = once - (rest?.amount ?? 0);
      if (!gitti) continue;
      n += gitti;
      if (gitti >= it.amount) k.setItem(L);
      else { it.amount -= gitti; k.setItem(L, it); }
    }
  }
  return n;
}
const ESYA_AD = (id) => id.replace("minecraft:", "").replace("aqualit:", "").replace(/_/g, " ");

async function yonlendirMenu(pl, e, ag) {
  if (!ag.aktarimlar.length) return safe(() => pl.sendMessage("§eÖnce ağa bir Uzaktan Aktarım Bloğu bağla (kabloyla)."));
  const yon = await menu(pl, "§lUzaktan Aktarım", "§7Eşyalar platforma bağlı sandıklarla uzaktaki Aqualit sandıkların arasında ışınlanır.",
    [{ text: "§lPlatformdan uzak sandığa", v: "git" }, { text: "§lUzak sandıktan platforma", v: "gel" }]);
  if (!yon) return;
  const uzaklar = Chests.list(pl.id).filter((c) => !ag.sandiklar.has(c.cid));
  if (!uzaklar.length) return safe(() => pl.sendMessage("§7Ağın dışında Aqualit sandığın yok."));
  const s = await menu(pl, "§lHangi sandık?", "", uzaklar.slice(0, 30).map((c) => ({ text: `${c.name ?? "Sandık"}\n§7${c.pos ? `${c.pos.x}, ${c.pos.y}, ${c.pos.z}` : ""}`, c })));
  if (!s) return;
  const kaynak = yon.v === "git" ? [...ag.sandiklar.keys()] : [s.c.cid];
  const hedef = yon.v === "git" ? [s.c.cid] : [...ag.sandiklar.keys()];
  const ic = [...icerik(kaynak)].sort((a, b) => b[1] - a[1]);
  if (!ic.length) return safe(() => pl.sendMessage("§7Gönderilecek eşya yok."));
  const sec = await menu(pl, "§lNe gitsin?", "", [{ text: "§lHepsi", id: null }, ...ic.slice(0, 40).map(([id, n]) => ({ text: `${ESYA_AD(id)} §7×${n}`, id, n }))]);
  if (!sec) return;
  const n = aktar(kaynak, hedef, sec.id);
  const a = ag.aktarimlar[0];
  for (let i = 0; i < 3; i++) safe(() => e.dimension.spawnParticle("minecraft:portal_reverse_particle", { x: a.x + 0.5, y: a.y + 1.2, z: a.z + 0.5 }));
  safe(() => e.dimension.playSound("mob.endermen.portal", a, { volume: 0.6, pitch: 1.6 }));
  safe(() => pl.sendMessage(`§b${n} eşya ışınlandı.`));
}

async function alMenu(pl, ag) {
  const ic = [...icerik(ag.sandiklar.keys())].sort((a, b) => b[1] - a[1]);
  if (!ic.length) return safe(() => pl.sendMessage("§7Bağlı sandıklar boş."));
  const sec = await menu(pl, "§lBağlı sandıklardan al", "", ic.slice(0, 45).map(([id, n]) => ({ text: `${ESYA_AD(id)} §7×${n}`, id, n })));
  if (!sec) return;
  const r = await modal(pl, ESYA_AD(sec.id), [{ type: "slider", label: "Kaç tane?", min: 1, max: Math.min(sec.n, 640), value: Math.min(sec.n, 64) }], "Al");
  if (!r) return;
  let kalan = Number(r[0]) || 1;
  const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
  for (const cid of ag.sandiklar.keys()) {
    const k = safe(() => new UnitContainer(cid));
    if (!k?.isValid) continue;
    for (let L = 0; L < k.size && kalan > 0; L++) {
      const it = k.getItem(L);
      if (!it || it.typeId !== sec.id) continue;
      const m = Math.min(kalan, it.amount);
      const parca = it.clone(); parca.amount = m;
      const rest = safe(() => inv.addItem(parca), parca);
      const verilen = m - (rest?.amount ?? 0);
      if (!verilen) { kalan = 0; break; }
      kalan -= verilen;
      if (verilen >= it.amount) k.setItem(L); else { it.amount -= verilen; k.setItem(L, it); }
    }
  }
  safe(() => pl.playSound("random.pop"));
}

const ERIT = { "minecraft:raw_iron": "minecraft:iron_ingot", "minecraft:raw_gold": "minecraft:gold_ingot", "minecraft:raw_copper": "minecraft:copper_ingot",
  "aqualit:raw_aqualit": "aqualit:aqualit_ingot", "minecraft:sand": "minecraft:glass", "minecraft:cobblestone": "minecraft:stone",
  "minecraft:beef": "minecraft:cooked_beef", "minecraft:porkchop": "minecraft:cooked_porkchop", "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:clay_ball": "minecraft:brick", "minecraft:potato": "minecraft:baked_potato" };
/** Ağdaki fırınlarda, ağdaki sandıkların ham eşyalarını eritir (güç varsa çok hızlı). */
export function* agdaErit(e, ag, pl) {
  const f = ag.firinlar[0];
  if (!f) { safe(() => pl?.sendMessage("§eAğa bağlı Aqualit Fırın yok.")); return 0; }
  const cids = [...ag.sandiklar.keys()];
  const hiz = ag.guc ? 8 : 1;
  let top = 0;
  const b = safe(() => e.dimension.getBlock(f));
  safe(() => b.setPermutation(b.permutation.withState("aqualit:yanik", "evet")));
  for (const cid of cids) {
    const k = safe(() => new UnitContainer(cid));
    if (!k?.isValid) continue;
    for (let L = 0; L < k.size; L++) {
      const it = k.getItem(L);
      const cikti = it && ERIT[it.typeId];
      if (!cikti) continue;
      const n = it.amount;
      k.setItem(L);
      for (let i = 0; i < n; i += hiz) yield;
      const yeni = new ItemStack(cikti, n);
      const rest = aktarBir(cids, yeni);
      if (rest) safe(() => e.dimension.spawnItem(rest, { x: f.x + 0.5, y: f.y + 1, z: f.z + 0.5 }));
      top += n;
    }
  }
  safe(() => b.setPermutation(b.permutation.withState("aqualit:yanik", "hayir")));
  safe(() => e.dimension.playSound("random.fizz", f, { volume: 0.5, pitch: 1.6 }));
  return top;
}
function aktarBir(cids, st) {
  let rest = st;
  for (const cid of cids) {
    const k = safe(() => new UnitContainer(cid));
    if (!k?.isValid) continue;
    rest = safe(() => k.addItem(rest), rest);
    if (!rest) return null;
  }
  return rest;
}

// Organizatör üssünü kendisi kurar: platform kenarından fırına ve evdeki sandığa kablo döşer, sandığın yanına aktarım bloğu koyar
export function* usKur(org, e) {
  const ORGU = globalThis.__aqOrgUretim;
  const dim = e.dimension;
  const c = V.floor(e.location);
  org.setStatus("Üssünü kuruyor");
  // 1) fırın (yoksa yapar ve koyar)
  let f = null;
  if (ORGU) f = yield* ORGU.firinHazirla(org);
  // 2) kablo yolları: platform kenarından hedefe (önce x sonra z), platform zemininde
  const hedefler = [];
  if (f) hedefler.push(f);
  const ev = org.homeChest?.();
  if (ev) hedefler.push(V.floor(ev.location));
  const yol = [];
  for (const h of hedefler) {
    let p = { x: c.x + Math.sign(h.x - c.x) * 5, y: c.y, z: c.z };
    if (Math.abs(h.x - c.x) < 5) p = { x: c.x, y: c.y, z: c.z + Math.sign(h.z - c.z || 1) * 5 };
    for (let i = 0; i < 64; i++) {
      if (Math.abs(p.x - h.x) + Math.abs(p.z - h.z) <= 1) break;
      yol.push({ ...p });
      if (p.x !== h.x) p.x += Math.sign(h.x - p.x); else p.z += Math.sign(h.z - p.z);
    }
  }
  const bos = yol.filter((p) => { const t = tip(dim, p); return t === "minecraft:air" || /short_grass|tall_grass|fern|flower|snow_layer/.test(t ?? ""); });
  if (!bos.length) return true;
  // 3) kablo: çantada yoksa yapar
  if (ORGU && org.count(KABLO) < bos.length) yield* ORGU.uretIsi(org, KABLO, Math.ceil((bos.length - org.count(KABLO)) / 16) * 16, null);
  let kondu = 0;
  for (const p of bos) {
    if (org.count(KABLO) < 1) break;
    org.take(KABLO, 1);
    safe(() => dim.setBlockType(p, KABLO));
    cevreyiGuncelle(dim, p);
    kondu++;
    if (kondu % 3 === 0) yield* wait(2);
  }
  org.say(kondu ? `Üssümü kurdum: ${kondu} kablo döşedim${f ? ", fırını bağladım" : ""}. Panelden bağlı sandıkları kullanabilirsin.` : "Kablo yapacak malzemem yok (Aqualit külçesi + bakır).");
  return true;
}

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (safe(() => ev.target.typeId) !== PLATFORM) return;
  ev.cancel = true;
  const pl = ev.player, e = ev.target;
  system.run(async () => {
    const ag = agBul(e);
    const govde = [`§7Kabloyla bağlı: §f${ag.sandiklar.size}§7 sandık, §f${ag.firinlar.length}§7 fırın, §f${ag.masalar.length}§7 çalışma masası, §f${ag.aktarimlar.length}§7 aktarım bloğu`,
      `§7Güç: ${ag.guc ? "§avar (Aqualit Bloğu bağlı)" : "§eyok (fırınlar yavaş)"}`, usDurumu(e.dimension, V.floor(e.location))].join("\n");
    const r = await menu(pl, "§lOrganizatör Platformu", govde, [
      { text: "§lBağlı sandıklardan al§r\n§7Eşya seç, kaç tane", v: "al" },
      { text: "§lUzaktan aktarım§r\n§7Platform <-> uzak sandık", v: "aktar" },
      { text: "§lBağlı fırınlarda erit§r\n§7Ham cevher, kum, et...", v: "erit" },
      { text: "§lOrganizatör'le konuş§r\n§7Yap, getir, düzenle (çalışma masaları kullanılır)", v: "tel" },
      { text: "§lÜssü Organizatör kursun§r\n§7Fırın, kablolar, bağlantılar", v: "kur" },
      { text: "Organizatör'ü platforma çağır", v: "cagir" },
      { text: "§7Platformu kaldır (eşyaya dönüştür)", v: "kaldir" },
    ]);
    if (!r) return;
    if (r.v === "al") return alMenu(pl, ag);
    if (r.v === "aktar") return yonlendirMenu(pl, e, ag);
    if (r.v === "erit") {
      safe(() => pl.sendMessage("§bBağlı fırınlar çalışıyor..."));
      return system.runJob((function* () { const n = yield* agdaErit(e, ag, pl); if (n) safe(() => pl.sendMessage(`§b${n} eşya eritildi.`)); })());
    }
    if (r.v === "tel") return (await import("./org_ui.js")).telefonAc(pl);
    if (r.v === "cagir") return orguYerlestir(pl.id, e);
    if (r.v === "kur") {
      const { bots } = await import("./brain.js");
      const org = [...bots.values()].filter((b) => b.valid && b.owner === pl.id && b.type === "toplayici")
        .sort((a, b) => V.dist(a.loc, e.location) - V.dist(b.loc, e.location))[0];
      if (!org) return safe(() => pl.sendMessage("§eÜssü kuracak Organizatör yok."));
      (org._isler ??= []).push(function* (o) { yield* usKur(o, e); });
      return org.say("Üssümü kuruyorum: fırın, kablolar, bağlantılar.");
    }
    if (r.v === "kaldir") {
      safe(() => e.remove());
      const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
      const it = new ItemStack("aqualit:org_platform", 1);
      if (safe(() => inv.addItem(it), it)) safe(() => pl.dimension.spawnItem(it, pl.location));
    }
  });
});
