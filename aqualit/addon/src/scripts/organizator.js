// Aqualit Robotları — Organizatör (v0.4.0)
// Sahibinin bütün Aqualit sandıklarını yönetir (başkasınınkine asla dokunmaz): eşya dizini ve "Nerede?", türe göre düzenleme,
// yarım yığın birleştirme, istek aracılığı (sandıktan getir; yoksa uygun robota toplat), yazıyla verilen görevleri
// (dil.js) robotlara dağıtma, görev zincirleri ve koşullar, gün özeti, üs çevresinde yere düşmüş eşyaları toplama.
// Aynı oyuncunun birden çok Organizatörü varsa işi paylaşırlar (en yakın olan alır, dizin ortaktır).
import { world, system, ItemStack } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import { Chests, getJSON, setJSON } from "./store.js";
import { UnitContainer, acikMi, standSpot, getSandik } from "./sandik.js";
import { bots, startTask, commandStop, commandResume, commandReturn } from "./brain.js";
import { ESYA, anla, adimYazi, kosulYazi, turAdi, YARDIM, cogul } from "./dil.js";
import { setMode, guardZone } from "./kilicli.js";
import { YAPI } from "./yapi_bilgi.js";
import { sendMessage } from "./messages.js";
import { Yerler } from "./harita.js";
import * as B from "./blocks.js";

export const ORG = "toplayici";
const AD = "Organizatör";

// ======================================================================= eşya sınıfları (sandık türü)
const SINIF = [
  ["kilicli", /_sword$|_helmet$|_chestplate$|_leggings$|_boots$|^minecraft:(bow|crossbow|arrow|tipped_arrow|spectral_arrow|shield|trident|totem_of_undying|ender_pearl|gunpowder|bone|string|rotten_flesh|spider_eye)$|^aqualit:(tamir_kiti|kabuk_.*|buyu_.*)$/],
  ["madenci", /^minecraft:(coal|charcoal|raw_(iron|gold|copper)|iron_ingot|gold_ingot|copper_ingot|iron_nugget|gold_nugget|diamond|emerald|lapis_lazuli|redstone|quartz|amethyst_shard|ancient_debris|netherite_scrap|netherite_ingot|cobblestone|stone|cobbled_deepslate|deepslate|tuff|granite|diorite|andesite|obsidian|flint|.*_ore|coal_block|iron_block|gold_block|diamond_block|emerald_block|lapis_block|redstone_block|copper_block|raw_iron_block|raw_gold_block|raw_copper_block)$|^aqualit:(raw_aqualit|aqualit_ingot|aqualit_block|.*aqualit_ore)$/],
  ["kurekci", /^minecraft:(sand|red_sand|gravel|dirt|coarse_dirt|rooted_dirt|clay_ball|clay|mud|soul_sand|soul_soil|snowball|snow|podzol|mycelium|grass_block)$/],
  ["oduncu", /_log$|_wood$|_planks$|_sapling$|_leaves$|_stem$|_hyphae$|^minecraft:(stick|apple|bamboo_block|propagule)$/],
  ["ciftci", /^minecraft:(wheat|wheat_seeds|carrot|potato|poisonous_potato|baked_potato|beetroot|beetroot_seeds|melon_slice|melon_seeds|pumpkin|pumpkin_seeds|sugar_cane|bamboo|cocoa_beans|sweet_berries|glow_berries|nether_wart|bread|egg|hay_block|sugar|cake|cookie|pumpkin_pie|milk_bucket|honey_bottle|.*beef|.*porkchop|.*chicken|.*mutton|.*rabbit|.*cod|.*salmon|leather|feather|white_wool)$/],
  ["insaatci", /_bricks?$|_stairs$|_slab$|_wall$|_fence$|_fence_gate$|_door$|_trapdoor$|glass|_pane$|concrete|terracotta|_wool$|_carpet$|^minecraft:(torch|lantern|soul_lantern|bookshelf|brick_block|sandstone|red_sandstone|smooth_stone|quartz_block|ladder|chain|iron_bars)$/],
];
/** Eşya hangi tür sandığa gider. */
export function sinifOf(id) {
  for (const [tur, re] of SINIF) if (re.test(id)) return tur;
  return "genel";
}

// ======================================================================= kayıt
const O = { istekler: new Map(), zincir: new Map(), dizin: new Map(), son: new Map(), gecmis: new Map() };
const kayitAnahtar = (owner) => `aq:org:${owner}`;
function hafiza(owner) {
  return getJSON(world, kayitAnahtar(owner), { zincir: [], son: null, gecmis: [], ozet: 0, uyari: {} });
}
function hafizaYaz(owner, h) {
  if (h.gecmis.length > 20) h.gecmis = h.gecmis.slice(-20);
  setJSON(world, kayitAnahtar(owner), h);
}
export function orgListesi(owner) {
  return [...bots.values()].filter((b) => b.valid && b.type === ORG && (!owner || b.owner === owner));
}
/** İşi en yakın (ya da en boş) Organizatör alır. */
export function enYakinOrg(owner, pos) {
  const ls = orgListesi(owner);
  if (!ls.length) return null;
  return ls.sort((a, b) => (O.istekler.get(a.id)?.length ?? 0) - (O.istekler.get(b.id)?.length ?? 0)
    || (pos ? V.dist(a.loc, pos) - V.dist(b.loc, pos) : 0))[0];
}
function oyuncu(owner) {
  return world.getAllPlayers().find((p) => p.id === owner);
}
/** Organizatör adına sahibine konuşur (Organizatör yoksa oyuncuya düz mesaj). */
export function konus(owner, text, org) {
  const o = org ?? orgListesi(owner)[0];
  // sohbet ekranına (konuşma gibi) ve telsiz kaydına
  safe(() => oyuncu(owner)?.sendMessage(`§d[${o?.name ?? AD}]§r ${text}`));
  if (o) safe(() => sendMessage(owner, o.entry, text, { kind: "org" }));
}

// ======================================================================= eşya dizini (bütün sandıklar)
/** Sahibinin bütün sandıklarındaki eşyalar: id -> [{cid, n}], toplam, sandık başına boş yer. 60 tikte bir yenilenir. */
export function dizin(owner, taze = false) {
  const c = O.dizin.get(owner);
  if (c && !taze && system.currentTick - c.t < 60) return c;
  const esya = new Map();
  const sandiklar = [];
  for (const ch of Chests.list(owner)) {
    const k = safe(() => new UnitContainer(ch.cid));
    if (!k?.isValid) continue;
    let bos = 0;
    for (let L = 0; L < k.size; L++) {
      const it = k.getItem(L);
      if (!it) { bos++; continue; }
      let ls = esya.get(it.typeId);
      if (!ls) esya.set(it.typeId, (ls = []));
      const e = ls.find((x) => x.cid === ch.cid);
      if (e) e.n += it.amount;
      else ls.push({ cid: ch.cid, n: it.amount });
    }
    sandiklar.push({ ...ch, bos, boyut: k.size });
  }
  const d = { t: system.currentTick, esya, sandiklar };
  O.dizin.set(owner, d);
  return d;
}
/** Bir eşya tanımının (dil.js ESYA) eşleştiği kimlikler. */
export function eslesir(tanim, id) {
  if (!tanim) return false;
  if (tanim.id && (id === tanim.id || id === tanim.ham)) return true;
  for (const k of tanim.ids ?? []) if (typeof k === "string" ? k === id : k.test(id)) return true;
  return false;
}
export function say(owner, tanim) {
  const d = dizin(owner);
  let n = 0;
  for (const [id, ls] of d.esya) if (eslesir(tanim, id)) for (const e of ls) n += e.n;
  return n;
}
/** "Nerede?" cevabı: hangi sandıkta kaç tane. */
export function nerede(owner, tanim, pos) {
  const d = dizin(owner, true);
  const bul = [];
  for (const [id, ls] of d.esya) {
    if (!eslesir(tanim, id)) continue;
    for (const e of ls) {
      const ch = d.sandiklar.find((s) => s.cid === e.cid);
      let r = bul.find((x) => x.cid === e.cid);
      if (!r) bul.push((r = { cid: e.cid, ad: ch?.name ?? "Sandık", pos: ch?.pos, n: 0, ids: new Set() }));
      r.n += e.n;
      r.ids.add(id);
    }
  }
  bul.sort((a, b) => b.n - a.n);
  const toplam = bul.reduce((a, b) => a + b.n, 0);
  return { toplam, sandiklar: bul.map((b) => ({ ...b, uzak: pos && b.pos ? Math.round(V.dist(pos, b.pos)) : null })) };
}
const esyaAdi = (id) => {
  const t = Object.values(ESYA).find((e) => e.id === id);
  return t?.ad ?? id.replace(/^[a-z]+:/, "").replace(/_/g, " ");
};

// ======================================================================= istekler (aracılık)
/**
 * Bir eşya isteği: { owner, kim: oyuncu/robot kimliği, tanim (dil.js ESYA girdisi), n, neden }.
 * En yakın Organizatör sandıktan alıp getirir; sandıkta yoksa uygun robota toplatır, o da yoksa sahibine söyler.
 */
export function iste(owner, istek) {
  const kim = istek.kim ? (oyuncu(owner)?.id === istek.kim ? oyuncu(owner) : [...bots.values()].find((b) => b.id === istek.kim)) : null;
  const pos = kim ? (kim.loc ?? kim.location) : null;
  const org = enYakinOrg(owner, pos);
  const mevcut = say(owner, istek.tanim);
  if (!org) {
    if (mevcut < istek.n) return eksigiTopla(owner, istek.tanim, istek.n - mevcut, null);
    konus(owner, `Sandıklarda ${mevcut} ${istek.tanim.ad} var ama getirecek Organizatör yok. Bir Organizatör robotu koyarsan ben getiririm.`);
    return false;
  }
  let q = O.istekler.get(org.id);
  if (!q) O.istekler.set(org.id, (q = []));
  q.push({ ...istek, t: system.currentTick });
  return true;
}
/** Sandıkta yetmeyen eşyayı uygun iş robotuna toplatır. Toplanacak eşya, görev verilen robot sayısı. */
export function eksigiTopla(owner, tanim, n, org) {
  const kay = tanim?.kaynak;
  if (!kay) {
    konus(owner, `${tanim?.ad ?? "Bu eşya"} sandıklarda yok ve onu toplayabilecek bir robotum yok. Bulursan sandığa koy, ben dağıtırım.`, org);
    return 0;
  }
  const [tur, key] = kay;
  const aday = [...bots.values()].filter((b) => b.valid && b.owner === owner && b.type === tur)
    .sort((a, b) => (bosta(a) ? 0 : 1) - (bosta(b) ? 0 : 1));
  const b = aday[0];
  if (!b) {
    konus(owner, `${n} ${tanim.ad} lazım ama hiç ${turAdi(tur)} robotun yok.`, org);
    return 0;
  }
  if (!bosta(b)) {
    konus(owner, `${n} ${tanim.ad} lazım; ${b.name} şu an meşgul, işi bitince ona yaptıracağım.`, org);
    bekleyenGorev(owner, b.id, () => gorevVer(b, key, n));
    return 0;
  }
  gorevVer(b, key, n);
  konus(owner, `Sandıklarda yeterli ${tanim.ad} yok; ${b.name} ${n} tane toplamaya gitti.`, org);
  return 1;
}
const bekleyen = [];
function bekleyenGorev(owner, botId, fn) {
  bekleyen.push({ owner, botId, fn, t: system.currentTick });
}
export function bosta(b) {
  if (b.type === "kilicli") return true;
  return !b.task || b.task.done || b.task.paused;
}

/** İş robotuna toplama görevi (Görev Kumandası'ndakiyle aynı biçim). */
export function gorevVer(b, key, n, ek = {}) {
  const amount = Math.max(1, Math.round(n));
  let T = null;
  if (b.type === "madenci") {
    if (key === "*") T = { type: "madenci", mode: "normal", items: [{ key: "komur", amount }, { key: "demir", amount }], bonus: "al", finish: "chest", stone: false, maxDist: b.maxDist ?? 256 };
    else if (key === "tas") T = { type: "madenci", mode: "normal", items: [{ key: "komur", amount: Math.max(4, amount >> 3) }], bonus: "al", finish: "chest", stone: true, maxDist: b.maxDist ?? 256 };
    else if (B.ORE_BY_KEY[key]) T = { type: "madenci", mode: "normal", items: [{ key, amount }], bonus: "al", finish: ek.erit ? "smelt" : "chest", stone: false, maxDist: b.maxDist ?? 256 };
  } else if (b.type === "kurekci" && B.SHOVEL_BY_KEY[key]) {
    T = { type: "kurekci", items: [{ key, amount }], finish: ek.erit ? "smelt" : "chest", maxDist: b.maxDist ?? 128 };
  } else if (b.type === "ciftci" && B.CROP_BY_KEY?.[key]) {
    T = { type: "ciftci", items: [{ key, amount }], makeFarm: false, finish: "chest", maxDist: b.maxDist ?? 128 };
  } else if (b.type === "oduncu" && B.LOG_BY_KEY?.[key]) {
    T = { type: "oduncu", items: [{ key, amount }], replant: true, leaves: false, finish: "chest", maxDist: b.maxDist ?? 128 };
  }
  if (!T) return false;
  b.task = T;
  b.saveTask();
  startTask(b);
  return true;
}

/** İsteği yerine getirir (Organizatör'ün işi): sandıktan al, götür, ver. */
function* istekIsi(org, ist) {
  const owner = org.owner;
  const d = nerede(owner, ist.tanim, org.loc);
  if (!d.toplam) {
    eksigiTopla(owner, ist.tanim, ist.n, org);
    return;
  }
  let kalan = ist.n;
  for (const s of d.sandiklar) {
    if (kalan <= 0) break;
    if (acikMi(s.cid)) continue;
    const h = getSandik(s.cid);
    if (!h) continue;
    org.setStatus(`${ist.tanim.ad} almaya gidiyor`);
    yield* org.travelTo(standSpot(h) ?? h.location, { near: 2 });
    const k = new UnitContainer(s.cid);
    for (let L = 0; L < k.size && kalan > 0; L++) {
      const it = k.getItem(L);
      if (!it || !eslesir(ist.tanim, it.typeId)) continue;
      const al = Math.min(kalan, it.amount);
      const parca = it.clone();
      parca.amount = al;
      const rest = org.addStack(parca);
      const alinan = al - (rest?.amount ?? 0);
      if (alinan <= 0) break;
      if (alinan >= it.amount) k.setItem(L);
      else {
        it.amount -= alinan;
        k.setItem(L, it);
      }
      kalan -= alinan;
    }
    org.setAct("carry");
    yield* wait(4);
  }
  const verilen = ist.n - kalan;
  if (!verilen) return;
  // götür
  const hedef = () => oyuncu(owner)?.id === ist.kim ? oyuncu(owner) : [...bots.values()].find((b) => b.id === ist.kim);
  const h = hedef();
  if (h) {
    org.setStatus(`${h.name ?? "sahibine"} ${ist.tanim.ad} götürüyor`);
    for (let i = 0; i < 3; i++) {
      const p = h.location ?? h.loc;
      yield* org.travelTo(V.floor(p), { near: 2 });
      if (V.dist(org.loc, h.location ?? h.loc) < 4) break;
    }
  }
  org.setAct("none");
  let teslim = 0;
  for (const [id, n] of org.contents()) {
    if (!eslesir(ist.tanim, id)) continue;
    let m = Math.min(n, verilen - teslim);
    if (m <= 0) break;
    m = org.take(id, m);
    if (!m) continue;
    teslim += m;
    if (h?.typeId === "minecraft:player") {
      const inv = safe(() => h.getComponent("minecraft:inventory")?.container);
      let left = m;
      while (left > 0) {
        const max = safe(() => new ItemStack(id, 1).maxAmount, 64);
        const st = new ItemStack(id, Math.min(left, max));
        const rest = inv ? safe(() => inv.addItem(st)) : st;
        if (rest) safe(() => h.dimension.spawnItem(rest, h.location));
        left -= st.amount;
      }
    } else if (h) {
      const left = h.addItem(id, m);
      if (left) safe(() => org.dim.spawnItem(new ItemStack(id, left), org.loc));
    } else safe(() => org.dim.spawnItem(new ItemStack(id, m), org.loc));
  }
  safe(() => org.dim.playSound("random.pop", org.loc, { pitch: 1.3 }));
  const kisi = h?.typeId === "minecraft:player" ? "sana" : h?.name ? `${h.name} adlı robota` : "bıraktım:";
  konus(owner, `${teslim} ${ist.tanim.ad} ${kisi} getirdim${kalan > 0 ? ` (sandıklarda ancak bu kadar vardı; ${kalan} eksik)` : ""}.`, org);
  if (kalan > 0) eksigiTopla(owner, ist.tanim, kalan, org);
}

// ======================================================================= düzenleme
/** Sandıkları türe göre düzenler, yarım yığınları birleştirir. Açık sandıklara dokunmaz. */
export function* duzenleIsi(org, sessiz = false) {
  const owner = org.owner;
  const d = dizin(owner, true);
  const yakin = d.sandiklar.filter((s) => s.dim === org.dim.id && s.pos && V.dist(s.pos, org.loc) < 96);
  if (!yakin.length) {
    if (!sessiz) org.say("Düzenlenecek Aqualit sandığın yok (yakınımda).");
    return { tasindi: 0, birlesti: 0 };
  }
  const turSandik = (tur) => yakin.filter((s) => s.kind === tur && s.bos > 0).sort((a, b) => V.dist(a.pos, org.loc) - V.dist(b.pos, org.loc))[0];
  const genel = () => turSandik("genel") ?? turSandik("toplayici");
  let tasindi = 0, birlesti = 0;
  org.setStatus("Sandıkları düzenliyor");
  for (const s of yakin) {
    if (acikMi(s.cid)) continue;
    const h = getSandik(s.cid);
    if (!h) continue;
    // 1) yanlış sandıktakileri topla
    const k = new UnitContainer(s.cid);
    const tasinacak = [];
    for (let L = 0; L < k.size; L++) {
      const it = k.getItem(L);
      if (!it) continue;
      const tur = sinifOf(it.typeId);
      if (tur === s.kind) continue;
      if (s.kind === "genel" || s.kind === "toplayici") {
        if (tur === "genel" || !turSandik(tur)) continue;   // genel sandıktan yalnız kendi sandığı olanlar çıkar
      }
      const hedef = turSandik(tur) ?? (s.kind !== "genel" && s.kind !== "toplayici" ? genel() : null);
      if (!hedef || hedef.cid === s.cid) continue;
      tasinacak.push({ L, it, hedef });
    }
    if (tasinacak.length) {
      yield* org.travelTo(standSpot(h) ?? h.location, { near: 2 });
      org.setAct("carry");
      const kk = new UnitContainer(s.cid);
      const yuk = [];
      for (const t of tasinacak) {
        const it = kk.getItem(t.L);
        if (!it || it.typeId !== t.it.typeId) continue;
        kk.setItem(t.L);
        yuk.push({ it, hedef: t.hedef });
      }
      // hedef sandıklara götür
      const gruplar = new Map();
      for (const y of yuk) {
        let g = gruplar.get(y.hedef.cid);
        if (!g) gruplar.set(y.hedef.cid, (g = []));
        g.push(y.it);
      }
      for (const [cid, items] of gruplar) {
        const hh = getSandik(cid);
        if (!hh) continue;
        yield* org.travelTo(standSpot(hh) ?? hh.location, { near: 2 });
        const hk = new UnitContainer(cid);
        for (const it of items) {
          const rest = acikMi(cid) ? it : hk.addItem(it);
          tasindi += it.amount - (rest?.amount ?? 0);
          if (rest) {
            const back = new UnitContainer(s.cid).addItem(rest);
            if (back) safe(() => org.dim.spawnItem(back, org.loc));
          }
        }
        safe(() => org.dim.playSound("random.chestclosed", hh.location, { volume: 0.5 }));
        yield* wait(3);
      }
      org.setAct("none");
    }
    // 2) yarım yığınları birleştir ve sırala
    birlesti += sikistir(s.cid);
    yield;
  }
  O.dizin.delete(owner);
  if (!sessiz || tasindi) konus(owner, `Sandıkları düzenledim: ${tasindi} eşya yerine kondu, ${birlesti} yarım yığın birleştirildi.`, org);
  return { tasindi, birlesti };
}
/** Sandığın içini türe göre sıralar ve yarım yığınları birleştirir. Birleşen yığın sayısı. */
export function sikistir(cid) {
  if (acikMi(cid)) return 0;
  const k = new UnitContainer(cid);
  if (!k.isValid) return 0;
  const hepsi = [];
  let once = 0;
  for (let L = 0; L < k.size; L++) {
    const it = k.getItem(L);
    if (!it) continue;
    once++;
    hepsi.push(it);
    k.setItem(L);
  }
  hepsi.sort((a, b) => sinifOf(a.typeId).localeCompare(sinifOf(b.typeId)) || a.typeId.localeCompare(b.typeId));
  for (const it of hepsi) {
    const rest = k.addItem(it);
    if (rest) {
      const d = getSandik(cid);
      safe(() => d?.dimension?.spawnItem(rest, d.location));
    }
  }
  let sonra = 0;
  for (let L = 0; L < k.size; L++) if (k.getItem(L)) sonra++;
  return Math.max(0, once - sonra);
}

// ======================================================================= Organizatör'ün işi (jobs.js çağırır)
export function* organizatorIsi(org) {
  org.say("Organizatör hazır! Telefondan ya da bana dokunup yazıyla görev verebilirsin.", { force: false });
  let sonDuzen = system.currentTick;
  for (;;) {
    // 1) istekler
    const q = O.istekler.get(org.id);
    if (q?.length) {
      const ist = q.shift();
      try {
        yield* istekIsi(org, ist);
      } catch (e) {
        org.say("Bir isteği yerine getiremedim.");
      }
      continue;
    }
    // 2) düzenleme isteği ya da 5 dakikada bir
    if (org._duzenle || system.currentTick - sonDuzen > 20 * 300) {
      const sessiz = !org._duzenle;
      org._duzenle = false;
      sonDuzen = system.currentTick;
      yield* duzenleIsi(org, sessiz);
      continue;
    }
    // 3) üs işleri (org_us.js bağlar)
    if (org._isler?.length) {
      const is = org._isler.shift();
      try {
        yield* is(org);
      } catch (e) {
        org.say("Bir işi yarıda bıraktım.");
      }
      continue;
    }
    // 4) boşta: eve dön, çevrede yere düşmüş eşya varsa topla ve sandığa koy
    if (org.home && V.dist(org.loc, org.home) > 6) {
      org.setStatus("Üsse dönüyor");
      yield* org.travelTo(org.home, { near: 3 });
    }
    const yerde = safe(() => org.dim.getEntities({ type: "minecraft:item", location: org.home ?? org.loc, maxDistance: 16 }), []) ?? [];
    if (yerde.length && !org.isFull()) {
      org.setStatus("Yerdeki eşyaları topluyor");
      for (const it of yerde.slice(0, 6)) {
        if (!safe(() => it.isValid, false)) continue;
        yield* org.travelTo(V.floor(it.location), { near: 1 });
        org.pickupItems(3);
      }
      yield* org.deposit(() => 0);
      continue;
    }
    if (org.contents().size) {
      yield* org.deposit(() => 0);
    }
    org.setStatus("Hazır, görev bekliyor");
    org.setMove("none");
    yield* wait(40);
  }
}

// ======================================================================= komutları çalıştırma
/** Komutun robot seçimini gerçek robotlara çevirir. */
export function robotlariBul(owner, sec, oyuncuPos, kesifListesi = () => []) {
  if (!sec || sec.bos) return [];
  const hepsiRobot = [...bots.values()].filter((b) => b.valid && b.owner === owner && b.type !== ORG);
  const kesifler = kesifListesi().filter((k) => k.owner === owner);
  const no = (b) => Number(/-(\d+)$/.exec(b.name ?? "")?.[1] ?? NaN);
  let out = [];
  for (const id of sec.idler ?? []) {
    const b = hepsiRobot.find((x) => x.id === id) ?? kesifler.find((k) => k.e.id === id);
    if (b) out.push(b);
  }
  for (const t of sec.turler ?? []) {
    const havuz = t === "kesif" ? kesifler : t === ORG ? orgListesi(owner) : hepsiRobot.filter((b) => b.type === t);
    const numara = sec.numaralar?.[t];
    if (numara?.length) out.push(...havuz.filter((b) => numara.includes(no(b))));
    else if (sec.hepsi || sec.cogul) out.push(...havuz);
    else {
      // tek robot: boşta olan ve oyuncuya en yakın
      const s = [...havuz].sort((a, b) => (bosta(a) ? 0 : 1) - (bosta(b) ? 0 : 1)
        || (oyuncuPos ? V.dist(a.loc, oyuncuPos) - V.dist(b.loc, oyuncuPos) : 0));
      if (s[0]) out.push(s[0]);
    }
  }
  if (sec.hepsi && !(sec.turler ?? []).length) out = [...hepsiRobot];
  return [...new Set(out)];
}

/** Telefonun / Organizatör'ün anladığı adımı çalıştırır. Dönen: etkilenen robot kimlikleri. */
export function adimCalistir(pl, a, ek = {}) {
  const owner = pl.id;
  const robotlar = robotlariBul(owner, a.robotlar, pl.location, ek.kesifListesi);
  const ids = robotlar.map((b) => b.id ?? b.e?.id);
  const yerPos = () => {
    if (a.koordinat) return { x: a.koordinat.x, y: a.koordinat.y ?? pl.location.y, z: a.koordinat.z };
    if (a.yer === "ben") return { ...pl.location };
    if (a.yer === "ev") return null;
    if (a.yapi) return Yerler.enYakin(owner, a.yapi, pl.dimension.id, pl.location)?.pos ?? null;
    return null;
  };
  const yok = (ne) => konus(owner, `${ne} bulamadım. ${a.robotlar?.bos ? "Hangi robot yapsın?" : "Robotun adını ya da numarasını kontrol et."}`);
  switch (a.eylem) {
    case "topla": {
      if (!a.esyalar?.length) return konus(owner, "Ne toplanacağını anlamadım (ör. \"madenci 20 demir getirsin\").");
      const isciler = robotlar.filter((b) => b.type !== "kilicli" && b.type !== "insaatci" && !b.e?.typeId?.includes("kesif"));
      if (!isciler.length) {
        // robot yok: uygun robot bulunur
        for (let i = 0; i < a.esyalar.length; i++) eksigiTopla(owner, a.esyalar[i], a.miktarlar?.[i] ?? a.miktar ?? 32, null);
        return [];
      }
      const verildi = [];
      for (const b of isciler) {
        const items = [];
        a.esyalar.forEach((e, i) => {
          const kay = e.kaynak;
          if (!kay || kay[0] !== b.type) return;
          const n = Math.ceil((a.miktarlar?.[i] ?? a.miktar ?? 32) / isciler.filter((x) => x.type === b.type).length);
          items.push({ key: kay[1], amount: n, ad: e.ad });
        });
        if (!items.length) {
          konus(owner, `${b.name} bunu toplayamaz (${a.esyalar.map((e) => e.ad).join(", ")} için ${a.esyalar.map((e) => turAdi(e.kaynak?.[0] ?? "")).join("/") || "robot yok"}).`);
          continue;
        }
        if (items.length === 1) gorevVer(b, items[0].key, items[0].amount);
        else {
          gorevVer(b, items[0].key, items[0].amount);
          if (b.task?.items) for (const it of items.slice(1)) if (!b.task.items.some((x) => x.key === it.key)) b.task.items.push({ key: it.key, amount: it.amount });
          b.saveTask();
        }
        verildi.push(`${b.name}: ${items.map((x) => `${x.amount} ${x.ad}`).join(", ")}`);
      }
      if (verildi.length) konus(owner, `Görevler verildi → ${verildi.join(" · ")}`);
      return ids;
    }
    case "ver": {
      const e = a.esyalar?.[0];
      if (!e) return konus(owner, "Ne getireyim?");
      iste(owner, { kim: pl.id, tanim: e, n: a.miktarlar?.[0] ?? a.miktar ?? (e.ids ? 8 : 16), neden: "oyuncu" });
      konus(owner, `${a.miktarlar?.[0] ?? a.miktar ?? ""} ${e.ad} getiriyorum.`.replace(/\s+/g, " "));
      return [];
    }
    case "sor": {
      const e = a.esyalar?.[0];
      if (!e) return konus(owner, "Neyi arayayım?");
      const r = nerede(owner, e, pl.location);
      if (!r.toplam) return konus(owner, `Sandıklarında hiç ${e.ad} yok.${e.kaynak ? ` İstersen ${turAdi(e.kaynak[0])} toplasın: "${turAdi(e.kaynak[0]).toLowerCase()} 32 ${e.ad.toLowerCase()} getirsin" yaz.` : ""}`);
      const yer = r.sandiklar.slice(0, 4).map((s) => `${s.ad}: ${s.n}${s.uzak !== null ? ` (${s.uzak} blok)` : ""}`).join(" · ");
      return konus(owner, `Toplam ${r.toplam} ${e.ad} → ${yer}`);
    }
    case "duzenle": {
      const org = enYakinOrg(owner, pl.location);
      if (!org) return konus(owner, "Sandıkları düzenlemek için bir Organizatör robotu lazım.");
      org._duzenle = true;
      return konus(owner, "Sandıkları düzenlemeye başlıyorum.", org);
    }
    case "durum": return konus(owner, durumYazi(owner, ek.kesifListesi));
    case "dur":
      if (!robotlar.length) return yok("Durdurulacak robotu");
      for (const b of robotlar) if (b.type === "kilicli") setMode(b, "stay"); else if (b.task) commandStop(b);
      return konus(owner, `${robotlar.map((b) => b.name).join(", ")} durdu.`);
    case "devam":
      for (const b of robotlar) if (b.task) commandResume(b);
      return konus(owner, robotlar.length ? `${robotlar.map((b) => b.name).join(", ")} işe devam ediyor.` : "Devam edecek robot yok.");
    case "don":
      for (const b of robotlar) {
        if (b.type === "kilicli") setMode(b, "follow");
        else if (b.e?.typeId === "aqualit:kesif") ek.kesifEveDon?.(b);
        else commandReturn(b, false);
      }
      return konus(owner, robotlar.length ? `${robotlar.map((b) => b.name).join(", ")} eve dönüyor.` : "Dönecek robot bulamadım.");
    case "bekle":
      for (const b of robotlar) {
        if (b.type === "kilicli") setMode(b, "stay");
        else if (b.task) commandStop(b);
      }
      return konus(owner, `${robotlar.map((b) => b.name).join(", ") || "Kimse"} yerinde bekliyor.`);
    case "takip": case "gel":
      for (const b of robotlar) {
        if (b.type === "kilicli") setMode(b, "follow");
        else if (b.e?.typeId === "aqualit:kesif") ek.kesifTakip?.(b, pl);
        else {
          b.task = { type: b.type, mode: "takip", kim: pl.id, ad: pl.name };
          b.saveTask();
          startTask(b);
        }
      }
      return konus(owner, robotlar.length ? `${robotlar.map((b) => b.name).join(", ")} peşinden geliyor.` : "Takip edecek robot bulamadım.");
    case "koru": case "saldir": {
      const kl = robotlar.filter((b) => b.type === "kilicli");
      const p = a.yer === "ev" ? null : yerPos() ?? pl.location;
      for (const b of kl) guardZone(b, p ?? b.home ?? pl.location, a.eylem === "saldir" ? 24 : 16);
      if (!kl.length) return konus(owner, "Korumayı yalnız Kılıçlı robotlar yapabilir.");
      return konus(owner, `${kl.map((b) => b.name).join(", ")} ${a.eylem === "saldir" ? "çevredeki canavarlara saldırıyor" : "bölgeyi koruyor"}.`);
    }
    case "yagma": {
      const p = yerPos();
      if (!p) return konus(owner, a.yapi ? `${YAPI[a.yapi]?.ad ?? a.yapi} yerini bilmiyorum; önce Keşif bulsun ("keşif ${YAPI[a.yapi]?.ad?.toLowerCase() ?? ""} bulsun").` : "Nereyi yağmalayalım?");
      const isciler = robotlar.filter((b) => b.type !== "kilicli" && b.type !== "insaatci" && b.task !== undefined);
      for (const b of isciler) {
        b.task = { type: b.type, mode: "yagma", merkez: V.floor(p), dim: pl.dimension.id, r: a.yapi ? 32 : 16, ad: a.yapi ? YAPI[a.yapi]?.ad : "seçilen yer", tur: a.yapi, finish: "chest" };
        b.saveTask();
        startTask(b);
      }
      return konus(owner, isciler.length ? `${isciler.map((b) => b.name).join(", ")} yağmaya gitti.` : "Yağma için iş robotu seç (madenci, oduncu...).");
    }
    case "sefer": return ek.sefer?.(pl, a, robotlar) ?? konus(owner, "Sefer için bir Keşif lazım.");
    case "bul": case "kesfet": return ek.kesif?.(pl, a, robotlar) ?? konus(owner, "Bunu Keşif yapabilir; bir Keşif robotun yok.");
    case "insa": return ek.insa?.(pl, a, robotlar) ?? konus(owner, "İnşa için bir Mimar lazım.");
    case "git": {
      const p = yerPos();
      if (!p) return konus(owner, "Nereye gidilsin? (koordinat ya da \"yanıma\")");
      for (const b of robotlar) {
        if (b.type === "kilicli") guardZone(b, p, 8);
        else {
          b.task = { type: b.type, mode: "git", hedef: V.floor(p), ad: a.koordinat ? `${p.x}, ${p.z}` : "hedef" };
          b.saveTask();
          startTask(b);
        }
      }
      return konus(owner, `${robotlar.map((b) => b.name).join(", ") || "Kimse"} yola çıktı.`);
    }
    case "eritme": case "craft": case "us": case "firin": return ek.uretim?.(pl, a) ?? konus(owner, "Bunu Organizatör üssünde yapabilirim.");
    default:
      return konus(owner, `"${a.eylem}" işini henüz yapamıyorum.`);
  }
}

export function durumYazi(owner, kesifListesi = () => []) {
  const rs = [...bots.values()].filter((b) => b.valid && b.owner === owner);
  if (!rs.length) return "Hiç robotun yok.";
  const sat = rs.slice(0, 12).map((b) => `§s${b.name}§r: ${b.status ?? "?"}`);
  const k = kesifListesi().filter((x) => x.owner === owner).map((x) => `§s${x.name}§r: ${x.status}`);
  const d = dizin(owner);
  let top = 0, bos = 0;
  for (const s of d.sandiklar) { bos += s.bos; top += s.boyut; }
  return [`${rs.length} robot, ${d.sandiklar.length} sandık (${top ? Math.round((100 * (top - bos)) / top) : 0}% dolu)`, ...sat, ...k].join("\n");
}

// ======================================================================= görev zinciri ve koşullar
/** Anlaşılan komutu sıraya koyar: sıra "sonra" ise öncekiler bitince, koşul varsa koşul gerçekleşince başlar. */
export function zincirKur(pl, sonuc, ek) {
  const owner = pl.id;
  const h = hafiza(owner);
  const z = { id: Date.now().toString(36), adimlar: sonuc.adimlar.map((a) => ({ a, durum: "bekliyor", ids: [] })), t: system.currentTick };
  O.zincir.set(owner, [...(O.zincir.get(owner) ?? []), z]);
  h.son = { metin: sonuc.metin, adimlar: sonuc.adimlar };
  h.gecmis.push(sonuc.metin);
  hafizaYaz(owner, h);
  zincirIlerlet(pl, z, ek);
  return z;
}
function kosulTamam(owner, k) {
  if (!k) return true;
  if (k.tur === "esya_az") return say(owner, ESYA[k.esya]) < k.n;
  if (k.tur === "esya_cok") return say(owner, ESYA[k.esya]) > k.n;
  const t = safe(() => world.getTimeOfDay(), 0);
  if (k.tur === "gece") return t >= 13000 && t < 23000;
  if (k.tur === "gunduz") return t >= 23000 || t < 1000;
  if (k.tur === "can") {
    const p = oyuncu(owner);
    const c = safe(() => p.getComponent("minecraft:health"));
    return !!c && c.currentValue <= c.effectiveMax * 0.4;
  }
  return true;
}
function bitti(ids) {
  return ids.every((id) => {
    const b = [...bots.values()].find((x) => x.id === id);
    return !b || !b.valid || b.type === "kilicli" || !b.task || b.task.done;
  });
}
function zincirIlerlet(pl, z, ek) {
  const owner = pl.id;
  for (let i = 0; i < z.adimlar.length; i++) {
    const s = z.adimlar[i];
    if (s.durum === "bitti") continue;
    if (s.durum === "calisiyor") {
      if (bitti(s.ids) || system.currentTick - s.t > 20 * 60 * 20) s.durum = "bitti";
      else if (z.adimlar[i + 1]?.a.sira !== "ayni") return;
      continue;
    }
    // bekliyor: öncekiler bitti mi (ya da aynı anda mı)?
    const once = z.adimlar.slice(0, i).filter((x) => x.durum !== "bitti");
    if (once.length && s.a.sira !== "ayni") return;
    if (!kosulTamam(owner, s.a.kosul)) {
      if (!s.bildirildi) {
        s.bildirildi = true;
        konus(owner, `Bekliyorum: ${kosulYazi(s.a.kosul)} → ${adimYazi(s.a, (t) => YAPI[t]?.ad ?? t)}`);
      }
      return;
    }
    s.durum = "calisiyor";
    s.t = system.currentTick;
    s.ids = adimCalistir(pl, s.a, ek) || [];
    if (!Array.isArray(s.ids)) s.ids = [];
  }
  // hepsi bitti
  if (z.adimlar.every((s) => s.durum === "bitti")) {
    O.zincir.set(owner, (O.zincir.get(owner) ?? []).filter((x) => x !== z));
    if (z.adimlar.length > 1) konus(owner, "Görev zinciri tamamlandı.");
  }
}
export function zincirler(owner) {
  return O.zincir.get(owner) ?? [];
}
export function zincirIptal(owner) {
  O.zincir.set(owner, []);
}
export function sonKomut(owner) {
  return hafiza(owner).son;
}
export function gecmis(owner) {
  return hafiza(owner).gecmis;
}

let EK = {};
/** Diğer modüllerin bağladığı işler (Keşif, Mimar, üretim, sefer). */
export function bagla(ek) {
  EK = { ...EK, ...ek };
}
export function ekler() {
  return EK;
}

// ======================================================================= Mimar ve diğer robotlar Organizatör'den ister
/** need: {eşya kimliği: adet} — sandıklarda olmayanlar için uygun robota toplatır. */
export function eksikleriIste(owner, need, kimden) {
  const tanimla = (id) => Object.entries(ESYA).find(([, e]) => e.id === id || e.ham === id || (e.ids ?? []).some((k) => (typeof k === "string" ? k === id : false)));
  const notlar = [];
  for (const [id, n] of Object.entries(need)) {
    const t = tanimla(id.includes(":") ? id : `minecraft:${id}`);
    if (!t) { notlar.push(esyaAdi(id)); continue; }
    eksigiTopla(owner, { anahtar: t[0], ...t[1] }, n, null);
  }
  if (notlar.length) konus(owner, `${kimden?.name ?? "Bir robot"} şunlara ihtiyaç duyuyor ama toplayabilecek robot yok: ${notlar.slice(0, 6).join(", ")}.`);
}

// ======================================================================= periyodik: zincirler, bekleyen görevler, gün özeti
system.runInterval(() => {
  const t = system.currentTick;
  if (t % 40 === 0) {
    for (const pl of world.getAllPlayers()) {
      for (const z of [...(O.zincir.get(pl.id) ?? [])]) safe(() => zincirIlerlet(pl, z, EK));
    }
    for (let i = bekleyen.length - 1; i >= 0; i--) {
      const w = bekleyen[i];
      const b = [...bots.values()].find((x) => x.id === w.botId);
      if (!b || !b.valid || t - w.t > 20 * 60 * 30) { bekleyen.splice(i, 1); continue; }
      if (bosta(b)) { bekleyen.splice(i, 1); safe(w.fn); }
    }
  }
  // gün özeti: sabah bir kez (Organizatörü olan oyunculara)
  if (t % 200 === 0) {
    const gun = Math.floor(safe(() => world.getAbsoluteTime(), 0) / 24000);
    const saat = safe(() => world.getTimeOfDay(), 0);
    if (saat < 1200 || saat > 23500) {
      for (const pl of world.getAllPlayers()) {
        if (!orgListesi(pl.id).length) continue;
        const h = hafiza(pl.id);
        if (h.ozet === gun) continue;
        h.ozet = gun;
        hafizaYaz(pl.id, h);
        safe(() => gunOzeti(pl));
      }
    }
  }
}, 1);

const AZ_UYARI = [["komur", 16], ["demir", 8], ["yemek", 8], ["mesale", 8]];
export function gunOzeti(pl) {
  const owner = pl.id;
  const d = dizin(owner, true);
  let toplam = 0;
  const sayim = [];
  for (const [id, ls] of d.esya) {
    const n = ls.reduce((a, b) => a + b.n, 0);
    toplam += n;
    sayim.push([id, n]);
  }
  sayim.sort((a, b) => b[1] - a[1]);
  let bos = 0, top = 0;
  for (const s of d.sandiklar) { bos += s.bos; top += s.boyut; }
  const az = AZ_UYARI.filter(([k, n]) => say(owner, ESYA[k]) < n).map(([k]) => ESYA[k].ad);
  const satir = [
    `§lGün özeti§r: ${d.sandiklar.length} sandıkta ${toplam} eşya, ${top ? Math.round((100 * (top - bos)) / top) : 0}% dolu.`,
    sayim.length ? `En çok: ${sayim.slice(0, 5).map(([id, n]) => `${n} ${esyaAdi(id)}`).join(", ")}.` : "",
    az.length ? `§eAzalanlar: ${az.join(", ")}.§r İstersen toplatayım.` : "",
    top && bos / top < 0.1 ? "§eSandıklar dolmak üzere; yeni bir Aqualit sandığı koy." : "",
  ].filter(Boolean);
  konus(owner, satir.join("\n"));
}

// test kancası
export const _test = { O, zincirIlerlet, kosulTamam };
