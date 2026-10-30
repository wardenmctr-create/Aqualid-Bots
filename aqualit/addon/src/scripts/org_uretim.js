// Aqualit Robotları — Organizatör'ün üretimi (v0.4.0): tarif kitabı, eritme, plan yapma, Aqualit Fırın.
// "10 meşale yap" → stoğa bakar: meşale yoksa çubuk + kömür gerekir; çubuk yoksa tahtadan, tahta yoksa kütükten yapar;
// kömür yoksa madenciye toplatır ya da kütükten odun kömürü eritir. Planı oyuncuya gösterir, sonra uygular:
// sandıklardan malzemeyi alır, çalışma masasında üretir, Aqualit Fırın'da (yalnız Organizatör kullanır, çok hızlı) eritir.
import { world, ItemStack, BlockVolume } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import { UnitContainer, acikMi, standSpot, getSandik } from "./sandik.js";
import { ESYA } from "./dil.js";
import * as ORG from "./organizator.js";

export const FIRIN = "aqualit:aqualit_firin";
const MASA = "minecraft:crafting_table";

// ======================================================================= tarifler
// girdi: kimlik ya da "#grup" (herhangi bir tahta, kütük, kömür...). masa: 3x3 gerekir (çalışma masası).
const M = (s) => (s.includes(":") ? s : `minecraft:${s}`);
const T = (cikti, adet, girdi, masa = true) => ({ cikti: M(cikti), adet, girdi: Object.fromEntries(Object.entries(girdi).map(([k, v]) => [k.startsWith("#") ? k : M(k), v])), masa });
export const GRUP = {
  "#tahta": /_planks$/, "#kutuk": /_(log|stem)$|_wood$|_hyphae$/, "#komur": /^minecraft:(coal|charcoal)$/,
  "#yun": /_wool$/, "#tas": /^minecraft:(cobblestone|cobbled_deepslate|blackstone)$/, "#kum": /^minecraft:(sand|red_sand)$/,
};
const TAHTA_OF = (kutuk) => kutuk.replace(/_(log|wood)$/, "_planks").replace(/_(stem|hyphae)$/, "_planks").replace("stripped_", "");
export const TARIFLER = [
  // ahşap
  T("oak_planks", 4, { "#kutuk": 1 }, false),
  T("stick", 4, { "#tahta": 2 }, false),
  T("crafting_table", 1, { "#tahta": 4 }, false),
  T("chest", 1, { "#tahta": 8 }),
  T("barrel", 1, { "#tahta": 6, wooden_slab: 0, stick: 0 }),
  T("ladder", 3, { stick: 7 }),
  T("oak_door", 3, { "#tahta": 6 }),
  T("oak_fence", 3, { "#tahta": 4, stick: 2 }),
  T("oak_boat", 1, { "#tahta": 5 }),
  T("bowl", 4, { "#tahta": 3 }),
  T("wooden_pickaxe", 1, { "#tahta": 3, stick: 2 }),
  T("wooden_axe", 1, { "#tahta": 3, stick: 2 }),
  T("wooden_shovel", 1, { "#tahta": 1, stick: 2 }),
  T("wooden_sword", 1, { "#tahta": 2, stick: 1 }),
  T("wooden_hoe", 1, { "#tahta": 2, stick: 2 }),
  // taş
  T("furnace", 1, { "#tas": 8 }),
  T("stone_pickaxe", 1, { "#tas": 3, stick: 2 }),
  T("stone_axe", 1, { "#tas": 3, stick: 2 }),
  T("stone_shovel", 1, { "#tas": 1, stick: 2 }),
  T("stone_sword", 1, { "#tas": 2, stick: 1 }),
  T("stone_hoe", 1, { "#tas": 2, stick: 2 }),
  T("stone_bricks", 4, { stone: 4 }, false),
  T("sandstone", 1, { sand: 4 }, false),
  T("brick_block", 1, { brick: 4 }, false),
  T("stonecutter", 1, { iron_ingot: 1, stone: 3 }),
  // ışık
  T("torch", 4, { stick: 1, "#komur": 1 }, false),
  T("lantern", 1, { iron_nugget: 8, torch: 1 }),
  T("iron_nugget", 9, { iron_ingot: 1 }, false),
  // demir
  T("iron_pickaxe", 1, { iron_ingot: 3, stick: 2 }),
  T("iron_axe", 1, { iron_ingot: 3, stick: 2 }),
  T("iron_shovel", 1, { iron_ingot: 1, stick: 2 }),
  T("iron_sword", 1, { iron_ingot: 2, stick: 1 }),
  T("iron_hoe", 1, { iron_ingot: 2, stick: 2 }),
  T("iron_helmet", 1, { iron_ingot: 5 }),
  T("iron_chestplate", 1, { iron_ingot: 8 }),
  T("iron_leggings", 1, { iron_ingot: 7 }),
  T("iron_boots", 1, { iron_ingot: 4 }),
  T("bucket", 1, { iron_ingot: 3 }),
  T("shears", 1, { iron_ingot: 2 }, false),
  T("iron_bars", 16, { iron_ingot: 6 }),
  T("rail", 16, { iron_ingot: 6, stick: 1 }),
  T("minecart", 1, { iron_ingot: 5 }),
  T("hopper", 1, { iron_ingot: 5, chest: 1 }),
  T("iron_block", 1, { iron_ingot: 9 }),
  T("shield", 1, { "#tahta": 6, iron_ingot: 1 }),
  T("compass", 1, { iron_ingot: 4, redstone: 1 }),
  T("clock", 1, { gold_ingot: 4, redstone: 1 }),
  // elmas
  T("diamond_pickaxe", 1, { diamond: 3, stick: 2 }),
  T("diamond_axe", 1, { diamond: 3, stick: 2 }),
  T("diamond_shovel", 1, { diamond: 1, stick: 2 }),
  T("diamond_sword", 1, { diamond: 2, stick: 1 }),
  T("diamond_hoe", 1, { diamond: 2, stick: 2 }),
  T("diamond_block", 1, { diamond: 9 }),
  T("gold_block", 1, { gold_ingot: 9 }),
  T("coal_block", 1, { coal: 9 }),
  // yemek, tarım
  T("bread", 1, { wheat: 3 }),
  T("hay_block", 1, { wheat: 9 }),
  T("sugar", 1, { sugar_cane: 1 }, false),
  T("cookie", 8, { wheat: 2, cocoa_beans: 1 }),
  T("pumpkin_pie", 1, { pumpkin: 1, sugar: 1, egg: 1 }, false),
  T("golden_carrot", 1, { carrot: 1, gold_nugget: 8 }),
  T("bone_meal", 3, { bone: 1 }, false),
  // diğer
  T("paper", 3, { sugar_cane: 3 }),
  T("book", 1, { paper: 3, leather: 1 }, false),
  T("bookshelf", 1, { "#tahta": 6, book: 3 }),
  T("glass_pane", 16, { glass: 6 }),
  T("bow", 1, { stick: 3, string: 3 }),
  T("arrow", 4, { flint: 1, stick: 1, feather: 1 }),
  T("white_wool", 1, { string: 4 }, false),
  T("white_bed", 1, { "#yun": 3, "#tahta": 3 }),
  T("fishing_rod", 1, { stick: 3, string: 2 }),
  T("tnt", 1, { gunpowder: 5, sand: 4 }),
  // Aqualit
  T("aqualit:aqualit_block", 1, { "aqualit:aqualit_ingot": 9 }),
  T("aqualit:aqualit_chest", 1, { "aqualit:aqualit_ingot": 8, chest: 1 }),
  T("aqualit:aqualit_kablo", 16, { "aqualit:aqualit_ingot": 1, copper_ingot: 2 }, false),
  T("aqualit:aqualit_firin", 1, { "aqualit:aqualit_ingot": 4, furnace: 1, iron_ingot: 3, redstone: 1 }),
  T("aqualit:aqualit_aktarim", 1, { "aqualit:aqualit_ingot": 4, ender_pearl: 1, redstone: 4 }),
  T("aqualit:tamir_kiti", 1, { "aqualit:aqualit_ingot": 1, iron_ingot: 2, redstone: 1 }, false),
  T("aqualit:aqualit_telefon", 1, { "aqualit:aqualit_ingot": 5, glass_pane: 1, redstone: 1 }),
];
for (const t of TARIFLER) for (const k of Object.keys(t.girdi)) if (t.girdi[k] === 0) delete t.girdi[k];
const TARIF_OF = new Map();
for (const t of TARIFLER) if (!TARIF_OF.has(t.cikti)) TARIF_OF.set(t.cikti, t);

// eritme (Aqualit Fırın): girdi -> çıktı
export const ERITME = Object.fromEntries([
  ["raw_iron", "iron_ingot"], ["raw_gold", "gold_ingot"], ["raw_copper", "copper_ingot"], ["iron_ore", "iron_ingot"],
  ["gold_ore", "gold_ingot"], ["copper_ore", "copper_ingot"], ["deepslate_iron_ore", "iron_ingot"], ["deepslate_gold_ore", "gold_ingot"],
  ["aqualit:raw_aqualit", "aqualit:aqualit_ingot"], ["aqualit:aqualit_ore", "aqualit:aqualit_ingot"],
  ["sand", "glass"], ["red_sand", "glass"], ["cobblestone", "stone"], ["stone", "smooth_stone"], ["clay_ball", "brick"],
  ["cobbled_deepslate", "deepslate"], ["netherrack", "netherbrick"], ["ancient_debris", "netherite_scrap"], ["wet_sponge", "sponge"],
  ["beef", "cooked_beef"], ["porkchop", "cooked_porkchop"], ["chicken", "cooked_chicken"], ["mutton", "cooked_mutton"],
  ["rabbit", "cooked_rabbit"], ["cod", "cooked_cod"], ["salmon", "cooked_salmon"], ["potato", "baked_potato"],
  ["kelp", "dried_kelp"], ["cactus", "green_dye"], ["oak_log", "charcoal"], ["spruce_log", "charcoal"], ["birch_log", "charcoal"],
  ["jungle_log", "charcoal"], ["acacia_log", "charcoal"], ["dark_oak_log", "charcoal"], ["chorus_fruit", "popped_chorus_fruit"],
].map(([a, b]) => [M(a), M(b)]));
const ERITME_OF = new Map();
for (const [a, b] of Object.entries(ERITME)) if (!ERITME_OF.has(b)) ERITME_OF.set(b, a);

export const esyaAd = (id) => {
  const t = Object.values(ESYA).find((e) => e.id === id || e.ham === id);
  if (t) return t.ad;
  const TR = { stick: "Çubuk", torch: "Meşale", crafting_table: "Çalışma masası", chest: "Sandık", furnace: "Fırın", ladder: "Merdiven",
    barrel: "Fıçı", oak_planks: "Meşe tahta", glass: "Cam", glass_pane: "Cam panel", charcoal: "Odun kömürü", iron_nugget: "Demir parçası",
    bread: "Ekmek", paper: "Kağıt", book: "Kitap", bucket: "Kova", rail: "Ray", smooth_stone: "Pürüzsüz taş", stone: "Taş" };
  const k = id.replace(/^minecraft:/, "");
  if (TR[k]) return TR[k];
  if (id === FIRIN) return "Aqualit Fırın";
  if (id === "aqualit:aqualit_kablo") return "Aqualit Kablo";
  if (id === "aqualit:aqualit_aktarim") return "Uzaktan Aktarım Bloğu";
  return k.replace(/^aqualit:/, "").replace(/_/g, " ");
};

// ======================================================================= plan
/**
 * Bir eşyayı n tane elde etmenin planı. stok: Map(id -> adet) (sandıklar + çanta).
 * Dönen: { al: {id: n}, adimlar: [{tur:"craft"|"erit", tarif|girdi, kez, cikti, adet}], eksik: {id: n}, masa, firin }
 */
export function planla(id, n, stok, yeni = true) {
  const s = new Map(stok);
  const P = { al: {}, adimlar: [], eksik: {}, masa: false, firin: false };
  const grupSec = (g, need) => {
    const re = GRUP[g];
    let best = null, bn = 0;
    for (const [k, v] of s) if (re.test(k) && v > bn) { best = k; bn = v; }
    if (best && bn >= need) return best;
    if (g === "#tahta") {
      // tahta yoksa: stoktaki kütüğün tahtası
      for (const [k, v] of s) if (GRUP["#kutuk"].test(k) && v > 0) return TAHTA_OF(k);
      return best ?? "minecraft:oak_planks";
    }
    if (g === "#komur") return best ?? "minecraft:coal";
    if (g === "#tas") return best ?? "minecraft:cobblestone";
    if (g === "#kum") return best ?? "minecraft:sand";
    if (g === "#kutuk") return best ?? "minecraft:oak_log";
    if (g === "#yun") return best ?? "minecraft:white_wool";
    return best;
  };
  const gerek = (id, n, derin) => {
    if (n <= 0) return;
    if (id.startsWith("#")) id = grupSec(id, n);
    const var_ = derin === 0 && yeni ? 0 : s.get(id) ?? 0;   // "10 meşale yap": 10 yeni meşale
    const kullan = Math.min(var_, n);
    if (kullan > 0) {
      s.set(id, var_ - kullan);
      P.al[id] = (P.al[id] ?? 0) + kullan;
    }
    let kalan = n - kullan;
    if (kalan <= 0) return;
    if (derin > 8) { P.eksik[id] = (P.eksik[id] ?? 0) + kalan; return; }
    // tahta: hangi ağaçtan olursa
    let tarif = TARIF_OF.get(id);
    if (!tarif && /_planks$/.test(id)) tarif = { cikti: id, adet: 4, girdi: { [id.replace("_planks", "_log")]: 1 }, masa: false };
    if (tarif) {
      const kez = Math.ceil(kalan / tarif.adet);
      for (const [g, m] of Object.entries(tarif.girdi)) gerek(g, m * kez, derin + 1);
      P.adimlar.push({ tur: "craft", tarif, kez, cikti: tarif.cikti, adet: tarif.adet * kez });
      if (tarif.masa) P.masa = true;
      const fazla = tarif.adet * kez - kalan;
      if (fazla > 0) s.set(id, (s.get(id) ?? 0) + fazla);
      return;
    }
    const girdi = ERITME_OF.get(id);
    if (girdi) {
      gerek(girdi, kalan, derin + 1);
      P.adimlar.push({ tur: "erit", girdi, cikti: id, kez: kalan, adet: kalan });
      P.firin = true;
      return;
    }
    P.eksik[id] = (P.eksik[id] ?? 0) + kalan;
  };
  gerek(id, n, 0);
  return P;
}
export function planYazi(P, hedef, n) {
  const sat = [];
  const al = Object.entries(P.al);
  if (al.length) sat.push(`§7Sandıklardan:§r ${al.map(([id, m]) => `${m} ${esyaAd(id)}`).join(", ")}`);
  P.adimlar.forEach((a, i) => sat.push(`§b${i + 1}.§r ${a.tur === "craft" ? `Üret: ${a.adet} ${esyaAd(a.cikti)}${a.tarif.masa ? " (çalışma masası)" : ""}` : `Erit: ${a.kez} ${esyaAd(a.girdi)} → ${esyaAd(a.cikti)} (Aqualit Fırın)`}`));
  const ek = Object.entries(P.eksik);
  if (ek.length) sat.push(`§eEksik:§r ${ek.map(([id, m]) => `${m} ${esyaAd(id)}`).join(", ")}`);
  return `§l${n} ${esyaAd(hedef)}§r için plan:\n${sat.join("\n") || "§7Hazır, sandıkta var."}`;
}

// ======================================================================= stok
export function stok(owner, org) {
  const d = ORG.dizin(owner, true);
  const s = new Map();
  for (const [id, ls] of d.esya) s.set(id, ls.reduce((a, b) => a + b.n, 0));
  if (org) for (const [id, n] of org.contents()) s.set(id, (s.get(id) ?? 0) + n);
  return s;
}

// ======================================================================= uygulama
function bloklar(org, typeId, r = 24) {
  const c = V.floor(org.home ?? org.loc);
  const res = safe(() => org.dim.getBlocks(new BlockVolume({ x: c.x - r, y: c.y - 4, z: c.z - r }, { x: c.x + r, y: c.y + 4, z: c.z + r }),
    { includeTypes: [typeId] }, true));
  const out = [];
  if (res) for (const p of safe(() => [...res.getBlockLocationIterator()], []) ?? []) out.push({ x: p.x, y: p.y, z: p.z });
  return out.sort((a, b) => V.dist(a, org.loc) - V.dist(b, org.loc));
}
const yakinBlok = (org, typeId, r = 16) => org._bilinen?.[typeId]?.find((p) => safe(() => org.dim.getBlock(p)?.typeId) === typeId)
  ?? (org._bilinen ??= {}, (org._bilinen[typeId] = bloklar(org, typeId, r)))[0];

/** Üssün yanında boş bir yer bulup bloğu koyar. */
function koy(org, typeId) {
  const c = V.floor(org.home ?? org.loc);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
    for (const dy of [0, 1, -1]) {
      const p = { x: c.x + dx, y: c.y + dy, z: c.z + dz };
      const b = safe(() => org.dim.getBlock(p));
      const alt = safe(() => org.dim.getBlock({ x: p.x, y: p.y - 1, z: p.z }));
      if (!b || !alt) continue;
      if (!safe(() => b.isAir, false) || safe(() => alt.isAir, true) || safe(() => alt.isLiquid, false)) continue;
      safe(() => b.setType(typeId));
      if (safe(() => b.typeId) === typeId) {
        (org._bilinen ??= {})[typeId] = [p, ...(org._bilinen[typeId] ?? [])];
        safe(() => org.dim.playSound("dig.stone", p));
        return p;
      }
    }
  }
  return null;
}

/** Plandaki malzemeyi sandıklardan çantaya alır. Alınamayan: {id: n} */
function* malzemeAl(org, al) {
  const owner = org.owner;
  const istek = { ...al };
  for (const [id, n] of Object.entries(istek)) {
    const zaten = org.count(id);
    istek[id] = Math.max(0, n - zaten);
  }
  const d = ORG.dizin(owner, true);
  const kaynak = new Map();
  for (const [id, n] of Object.entries(istek)) {
    if (n <= 0) continue;
    for (const e of d.esya.get(id) ?? []) {
      let ls = kaynak.get(e.cid);
      if (!ls) kaynak.set(e.cid, (ls = []));
      ls.push(id);
    }
  }
  for (const [cid, ids] of kaynak) {
    if (acikMi(cid)) continue;
    const h = getSandik(cid);
    if (!h) continue;
    org.setStatus("Malzeme alıyor");
    yield* org.travelTo(standSpot(h) ?? h.location, { near: 2 });
    const k = new UnitContainer(cid);
    for (let L = 0; L < k.size; L++) {
      const it = k.getItem(L);
      if (!it || !ids.includes(it.typeId) || !(istek[it.typeId] > 0)) continue;
      const m = Math.min(istek[it.typeId], it.amount);
      const parca = it.clone();
      parca.amount = m;
      const rest = org.addStack(parca);
      const alinan = m - (rest?.amount ?? 0);
      if (alinan >= it.amount) k.setItem(L);
      else if (alinan > 0) { it.amount -= alinan; k.setItem(L, it); }
      istek[it.typeId] -= alinan;
    }
    yield* wait(3);
  }
  return Object.fromEntries(Object.entries(istek).filter(([, n]) => n > 0));
}

function ekle(org, id, n) {
  let left = n;
  while (left > 0) {
    const max = safe(() => new ItemStack(id, 1).maxAmount, 64);
    const st = new ItemStack(id, Math.min(left, max));
    const rest = org.addStack(st);
    if (rest) safe(() => org.dim.spawnItem(rest, org.loc));
    left -= st.amount;
  }
}

/** Planı uygular; hedef: oyuncu kimliği (ona getirir) ya da yok (sandığa koyar). */
export function* uretIsi(org, hedefId, n, kim) {
  const owner = org.owner;
  const P = planla(hedefId, n, stok(owner, org));
  const ek = Object.entries(P.eksik);
  if (ek.length) {
    const atanan = [];
    for (const [id, m] of ek) {
      const t = Object.entries(ESYA).find(([, e]) => e.id === id || e.ham === id);
      if (t?.[1].kaynak && ORG.eksigiTopla(owner, { anahtar: t[0], ...t[1] }, m, org)) atanan.push(`${m} ${esyaAd(id)}`);
    }
    ORG.konus(owner, `${n} ${esyaAd(hedefId)} için eksik: ${ek.map(([id, m]) => `${m} ${esyaAd(id)}`).join(", ")}.${atanan.length ? " Toplatıyorum; gelince yeniden dene ya da \"tekrar\" yaz." : ""}`, org);
    return false;
  }
  const kalan = yield* malzemeAl(org, P.al);
  if (Object.keys(kalan).length) {
    ORG.konus(owner, `Malzemenin bir kısmını alamadım (sandık açık olabilir): ${Object.entries(kalan).map(([id, m]) => `${m} ${esyaAd(id)}`).join(", ")}.`, org);
    return false;
  }
  for (const a of P.adimlar) {
    if (a.tur === "craft") {
      if (a.tarif.masa) {
        let m = yakinBlok(org, MASA);
        if (!m && org.count(MASA) > 0) { org.take(MASA, 1); m = koy(org, MASA); }
        if (!m) {
          ORG.konus(owner, "Üretim için çalışma masası lazım; üssüme bir tane koyar mısın? (ya da \"çalışma masası yap\" yaz)", org);
          return false;
        }
        org.setStatus(`Çalışma masasında ${esyaAd(a.cikti)} yapıyor`);
        yield* org.travelTo(m, { near: 2 });
        org.face(m);
      } else org.setStatus(`${esyaAd(a.cikti)} yapıyor`);
      // girdileri çantadan düş
      for (const [g, adet] of Object.entries(a.tarif.girdi)) {
        let gerek = adet * a.kez;
        if (g.startsWith("#")) {
          for (const [id, var_] of org.contents()) {
            if (gerek <= 0) break;
            if (!GRUP[g].test(id)) continue;
            gerek -= org.take(id, Math.min(var_, gerek));
          }
        } else gerek -= org.take(g, gerek);
        if (gerek > 0) {
          ORG.konus(owner, `${esyaAd(a.cikti)} yaparken ${gerek} ${g.startsWith("#") ? g.slice(1) : esyaAd(g)} eksik kaldı.`, org);
          return false;
        }
      }
      org.setAct("place");
      for (let i = 0; i < Math.min(4, a.kez); i++) {
        safe(() => org.dim.playSound("block.crafting_table.use", org.loc, { volume: 0.6 }));
        yield* wait(5);
      }
      org.setAct("none");
      ekle(org, a.cikti, a.adet);
    } else {
      const f = yield* firinHazirla(org);
      if (!f) return false;
      org.setStatus(`Aqualit Fırın'da ${esyaAd(a.girdi)} eritiyor`);
      yield* org.travelTo(f, { near: 2 });
      org.face(f);
      const alinan = org.take(a.girdi, a.kez);
      if (alinan < a.kez) {
        ORG.konus(owner, `Eritmek için ${a.kez - alinan} ${esyaAd(a.girdi)} eksik.`, org);
        if (alinan) ekle(org, a.girdi, alinan);
        return false;
      }
      firinYak(org.dim, f, true);
      // çok hızlı elektrikli fırın: 4 eşya / tik
      for (let i = 0; i < a.kez; i += 4) {
        if (i % 16 === 0) safe(() => org.dim.playSound("block.furnace.lit", f, { volume: 0.5, pitch: 1.6 }));
        yield;
      }
      firinYak(org.dim, f, false);
      safe(() => org.dim.playSound("random.fizz", f, { volume: 0.4, pitch: 1.8 }));
      ekle(org, a.cikti, a.adet);
    }
  }
  // teslim
  const pl = kim && world.getAllPlayers().find((p) => p.id === kim);
  if (pl) {
    org.setStatus(`${esyaAd(hedefId)} getiriyor`);
    yield* org.travelTo(V.floor(pl.location), { near: 2 });
    let m = org.take(hedefId, n);
    const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
    const ver = m;
    while (m > 0) {
      const max = safe(() => new ItemStack(hedefId, 1).maxAmount, 64);
      const st = new ItemStack(hedefId, Math.min(m, max));
      const rest = inv ? safe(() => inv.addItem(st)) : st;
      if (rest) safe(() => pl.dimension.spawnItem(rest, pl.location));
      m -= st.amount;
    }
    ORG.konus(owner, `${ver} ${esyaAd(hedefId)} hazır, sana getirdim.`, org);
  } else {
    yield* ORG.sandigaKoy(org);
    ORG.konus(owner, `${n} ${esyaAd(hedefId)} yaptım, sandığa koydum.`, org);
  }
  return true;
}

/** Aqualit Fırın: üssünde yoksa çantadan/sandıktan alıp koyar, o da yoksa yapar. */
function* firinHazirla(org) {
  let f = yakinBlok(org, FIRIN);
  if (f) return f;
  if (org.count(FIRIN) < 1) {
    const kalan = yield* malzemeAl(org, { [FIRIN]: 1 });
    if (Object.keys(kalan).length) {
      const P = planla(FIRIN, 1, stok(org.owner, org));
      if (Object.keys(P.eksik).length) {
        ORG.konus(org.owner, `Eritmek için Aqualit Fırın lazım. Yapmak için eksik: ${Object.entries(P.eksik).map(([id, m]) => `${m} ${esyaAd(id)}`).join(", ")}.`, org);
        return null;
      }
      const ok = yield* uretIsi(org, FIRIN, 1, null);
      if (!ok) return null;
      yield* malzemeAl(org, { [FIRIN]: 1 });
    }
  }
  if (org.take(FIRIN, 1) < 1) return null;
  f = koy(org, FIRIN);
  if (f) ORG.konus(org.owner, "Üssüme Aqualit Fırın koydum (yalnız ben kullanabilirim, çok hızlı eritir).", org);
  return f;
}
export function firinYak(dim, p, yan) {
  const b = safe(() => dim.getBlock(p));
  if (!b || b.typeId !== FIRIN) return;
  safe(() => b.setPermutation(b.permutation.withState("aqualit:yanik", yan)));
}

// ======================================================================= komut bağlantısı
/** dil.js adımı: craft (yap/üret), eritme, fırın kur. */
export function uretimKomutu(pl, a) {
  const owner = pl.id;
  const org = ORG.enYakinOrg(owner, pl.location);
  if (!org) return ORG.konus(owner, "Üretim için bir Organizatör robotu lazım.");
  if (a.eylem === "firin") {
    (org._isler ??= []).push(function* (o) { yield* firinHazirla(o); });
    return ORG.konus(owner, "Aqualit Fırın kuruyorum.", org);
  }
  const e = a.esyalar?.[0];
  if (!e) return ORG.konus(owner, "Ne yapayım? (ör. \"10 meşale yap\")", org);
  const n = a.miktarlar?.[0] ?? a.miktar ?? 1;
  // eritme: "demiri erit" -> ham demiri külçeye
  if (a.eylem === "eritme") {
    const cikti = e.id && ERITME[e.ham ?? ""] ? e.id : e.id;
    if (!cikti) return ORG.konus(owner, `${e.ad} eritilmez.`, org);
    const ham = e.ham ?? ERITME_OF.get(cikti);
    const varHam = stok(owner, org).get(ham) ?? 0;
    const kac = a.miktarlar?.[0] ?? a.miktar ?? varHam;
    if (!kac) return ORG.konus(owner, `Eritilecek ${esyaAd(ham ?? cikti)} yok.`, org);
    (org._isler ??= []).push(function* (o) { yield* uretIsi(o, cikti, kac, null); });
    return ORG.konus(owner, `${kac} ${esyaAd(ham ?? cikti)} eritiyorum.`, org);
  }
  const id = e.id ?? null;
  if (!id) return ORG.konus(owner, `"${e.ad}" çok genel; hangisini yapayım? (ör. "demir kazma", "meşale")`, org);
  const P = planla(id, n, stok(owner, org));
  ORG.konus(owner, planYazi(P, id, n), org);
  (org._isler ??= []).push(function* (o) { yield* uretIsi(o, id, n, a.yer === "ben" || a.bana ? pl.id : null); });
  return [];
}
