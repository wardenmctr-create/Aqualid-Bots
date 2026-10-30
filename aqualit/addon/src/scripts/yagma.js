// Aqualit Robotları — Yağma: robot bir alandaki sandık, fıçı, dağıtıcı ve çömlekleri boşaltır, yerdeki eşyaları
// (deneme anahtarları dahil) toplar, anahtarı varsa deneme odası kasasını açar.
// Sahibinin Aqualit sandıklarına ve evinin/sandıklarının 24 blok çevresine asla dokunmaz.
import { world, ItemStack } from "@minecraft/server";
import { V, wait, safe } from "./util.js";
import { getJSON, setJSON, Chests } from "./store.js";
import { unitIdAt } from "./sandik.js";
import { finishJob, keepFor } from "./jobs.js";
import { YAPI, islerOf, dokunma } from "./yapi_bilgi.js";

export const KAPLAR = ["minecraft:chest", "minecraft:barrel", "minecraft:trapped_chest", "minecraft:dispenser",
  "minecraft:dropper", "minecraft:hopper"];
export const KIRILAN = ["minecraft:decorated_pot"];          // kırınca içindekini döker
export const KASA = ["minecraft:vault"];
const ANAHTAR = "minecraft:trial_key";
const UGURSUZ_ANAHTAR = "minecraft:ominous_trial_key";
const KORUMA = 24;                                            // üssün çevresi: dokunulmaz

/** Bu yer yağmalanabilir mi? (Aqualit sandığı değil, sahibinin üssünden uzak) */
export function yagmalanabilir(bot, p) {
  if (safe(() => unitIdAt(bot.dim.id, p))) return false;
  if (bot.home && bot.homeDim === bot.dim.id && V.hdist(p, bot.home) < KORUMA) return false;
  for (const c of Chests.list(bot.owner)) {
    if (c.dim === bot.dim.id && c.pos && V.hdist(c.pos, p) < KORUMA) return false;
  }
  return true;
}

function kasaAcildi(dimId, p) {
  return !!getJSON(world, "aq:kasa", {})[`${dimId}:${p.x},${p.y},${p.z}`];
}
function kasaIsaretle(dimId, p) {
  const m = getJSON(world, "aq:kasa", {});
  m[`${dimId}:${p.x},${p.y},${p.z}`] = Date.now();
  const keys = Object.keys(m);
  if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete m[k];
  setJSON(world, "aq:kasa", m);
}

/** Kasa ödülü: oyunun kendi ganimet tablosundan (LootTableManager). */
function kasaGanimeti(ugursuz) {
  const lm = safe(() => world.getLootTableManager());
  if (!lm) return [];
  const yollar = ugursuz
    ? ["chests/trial_chambers/reward_ominous", "loot_tables/chests/trial_chambers/reward_ominous.json"]
    : ["chests/trial_chambers/reward", "loot_tables/chests/trial_chambers/reward.json"];
  for (const y of yollar) {
    const t = safe(() => lm.getLootTable(y));
    if (!t) continue;
    const items = safe(() => lm.generateLootFromTable(t));
    if (items) return items;
  }
  return [];
}

/** Bir kabı robotun çantasına boşaltır; çanta dolarsa durur. Taşınan adet. */
function bosalt(bot, cc) {
  let n = 0;
  for (let i = 0; i < cc.size; i++) {
    const it = cc.getItem(i);
    if (!it) continue;
    const rest = bot.addStack(it.clone());
    const moved = it.amount - (rest ? rest.amount : 0);
    n += moved;
    if (!rest) cc.setItem(i, undefined);
    else {
      it.amount = rest.amount;
      cc.setItem(i, it);
      bot.full = true;
      break;
    }
  }
  return n;
}

/**
 * Yağma işi (jeneratör). T: {merkez, dim, r, sefer?} — sefer: true ise iş bitince eve dönmez (Keşif götürür).
 * Dönen sayaç: {kap, comlek, kasa, esya}
 */
export function* yagmaIsi(bot, T) {
  const say = { kap: 0, comlek: 0, kasa: 0, esya: 0 };
  const r = T.r ?? 32;
  const merkez = T.merkez;
  if (V.hdist(bot.loc, merkez) > r) {
    bot.setStatus("Yağma yerine gidiyor");
    const ok = yield* bot.travelTo(merkez, { near: 4 });
    if (!ok && V.hdist(bot.loc, merkez) > r + 8) {
      bot.say("Yağmalanacak yere ulaşamadım.");
      return say;
    }
  }
  const tipler = [...KAPLAR, ...KIRILAN, ...KASA];
  const bitti = new Set();
  const bekleyen = new Set();            // anahtar bekleyen kasalar
  for (let tur = 0; tur < 60; tur++) {
    bot.setStatus(`Yağmalıyor (${say.kap} kap, ${say.comlek} çömlek, ${say.kasa} kasa)`);
    const list = (yield* bot.scanFar(tipler, merkez, r, Math.max(16, r), 24,
      (p) => !bitti.has(V.key(p)) && yagmalanabilir(bot, p)));
    if (!list.length) break;
    const p = list[0];
    bitti.add(V.key(p));
    const b = safe(() => bot.dim.getBlock(p));
    const t = safe(() => b?.typeId);
    if (!b || !t) continue;
    const ok = yield* bot.goTo(p, { range: 2, maxNodes: 2500, radius: 40, dig: bot.type === "madenci" });
    if (!ok && V.dist(bot.loc, p) > 3.5) continue;
    bot.face(p);
    bot.setAct("place");
    yield* wait(8);
    if (KIRILAN.includes(t)) {
      safe(() => bot.dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`));
      yield* wait(6);
      say.esya += bot.pickupItems(4);
      say.comlek++;
    } else if (KASA.includes(t)) {
      if (kasaAcildi(bot.dim.id, p)) continue;
      const ugursuz = !!safe(() => b.permutation.getState("ominous"));
      const anahtar = ugursuz ? UGURSUZ_ANAHTAR : ANAHTAR;
      if (bot.take(anahtar, 1) < 1) {
        if (!bekleyen.size) bot.say(ugursuz ? "Uğursuz kasa buldum ama uğursuz anahtarım yok." : "Kasa buldum ama anahtarım yok; anahtar bulursam açarım.");
        bekleyen.add(V.key(p));
        continue;
      }
      safe(() => bot.dim.playSound("block.vault.open_shutter", p));
      for (const it of kasaGanimeti(ugursuz)) {
        const rest = bot.addStack(it);
        if (rest) safe(() => bot.dim.spawnItem(rest, bot.loc));
        say.esya += it.amount;
      }
      kasaIsaretle(bot.dim.id, p);
      say.kasa++;
    } else {
      const cc = safe(() => b.getComponent("minecraft:inventory")?.container);
      if (!cc) continue;
      safe(() => bot.dim.playSound(t.includes("barrel") ? "block.barrel.open" : "random.chestopen", p, { volume: 0.6 }));
      const n = bosalt(bot, cc);
      if (n) {
        say.kap++;
        say.esya += n;
      }
      safe(() => bot.dim.playSound(t.includes("barrel") ? "block.barrel.close" : "random.chestclosed", p, { volume: 0.6 }));
    }
    // yerdeki eşyalar (çömlek kırıntıları, mob düşürdükleri, anahtarlar)
    say.esya += bot.pickupItems(6);
    bot.setAct("none");
    // anahtar bulduysa bekleyen kasalar yeniden denenir
    if (bekleyen.size && (bot.count(ANAHTAR) || bot.count(UGURSUZ_ANAHTAR))) {
      for (const k of bekleyen) bitti.delete(k);
      bekleyen.clear();
    }
    if (bot.isFull()) {
      if (T.sefer) {
        bot.say("Çantam doldu; Keşif dönünce sandığa koyacağım.");
        break;
      }
      bot.say("Çantam doldu, sandığa boşaltıp geri geleceğim.");
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      yield* bot.travelTo(merkez, { near: 4 });
    }
    yield;
  }
  bot.setAct("none");
  return say;
}

export function yagmaOzet(say) {
  const p = [];
  if (say.kap) p.push(`${say.kap} sandık/fıçı`);
  if (say.comlek) p.push(`${say.comlek} çömlek`);
  if (say.kasa) p.push(`${say.kasa} kasa`);
  return p.length ? `${p.join(", ")} yağmaladım (${say.esya} eşya).` : "Yağmalanacak bir şey bulamadım.";
}

/** Görev Kumandası'ndan verilen yağma görevi: yağmala, eve dön, sandığa koy. */
export function* yagmaGorevi(bot) {
  const T = bot.task;
  const say = T.tur ? yield* yapiIsleri(bot, { pos: T.merkez, tur: T.tur }, T.r) : yield* yagmaIsi(bot, T);
  return yield* finishJob(bot, { keep: keepFor(bot), message: `Görev tamamlandı: ${yagmaOzet(say)}` });
}

// ======================================================================= yapıya özel işler (yapi_bilgi.js → isler)

const ARKEO = {
  col_tapinagi: ["archaeology/desert_pyramid"], col_kuyusu: ["archaeology/desert_well"],
  okyanus_harabesi: ["archaeology/ocean_ruin_warm", "archaeology/ocean_ruin_cold"],
  iz_harabesi: ["archaeology/trail_ruins_common", "archaeology/trail_ruins_rare"],
};
function tablodan(yollar) {
  const lm = safe(() => world.getLootTableManager());
  if (!lm) return [];
  for (const y of yollar) {
    for (const yol of [y, `loot_tables/${y}.json`]) {
      const t = safe(() => lm.getLootTable(yol));
      const items = t && safe(() => lm.generateLootFromTable(t));
      if (items) return items;
    }
  }
  return [];
}

/** Bulduğu her bloğa gider, işini yapar (fn), yerdekileri toplar. Yapılan adet. */
function* herBirine(bot, merkez, r, tipler, tur, fn, durum) {
  let n = 0;
  const bitti = new Set();
  for (let i = 0; i < 400; i++) {
    const list = yield* bot.scanFar(tipler, merkez, r, Math.max(16, r), 8,
      (p) => !bitti.has(V.key(p)) && yagmalanabilir(bot, p));
    if (!list.length) break;
    const p = list[0];
    bitti.add(V.key(p));
    const b = safe(() => bot.dim.getBlock(p));
    if (!b || dokunma(tur, b.typeId)) continue;
    bot.setStatus(durum);
    const ok = yield* bot.goTo(p, { range: 2, maxNodes: 2000, radius: 40, dig: bot.type === "madenci" });
    if (!ok && V.dist(bot.loc, p) > 3.5) continue;
    bot.face(p);
    bot.setAct(bot.workAct());
    yield* wait(6);
    if (fn(b, p)) n++;
    yield* wait(2);
    bot.pickupItems(4);
    bot.setAct("none");
    if (bot.isFull()) break;
  }
  return n;
}
const kir = (bot, p) => safe(() => bot.dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`));

export const ISLER = {
  /** Çöl tapınağı: basınç levhası ve altındaki TNT'ler sökülür (TNT çantaya). */
  *tuzak_tnt(bot, yer, r) {
    let n = yield* herBirine(bot, yer.pos, r, ["minecraft:stone_pressure_plate"], yer.tur, (b, p) => (kir(bot, p), true), "Tuzağı söküyor");
    n += yield* herBirine(bot, yer.pos, r, ["minecraft:tnt"], yer.tur, (b, p) => {
      safe(() => b.setType("minecraft:air"));
      bot.addItem("minecraft:tnt", 1);
      return true;
    }, "TNT'leri söküyor");
    if (n) bot.say(`Çöl tapınağının TNT tuzağını söktüm (${n} parça).`);
    return n;
  },
  /** Orman tapınağı: tel ve kancalar kesilir. */
  *tuzak_ip(bot, yer, r) {
    const n = yield* herBirine(bot, yer.pos, r, ["minecraft:trip_wire", "minecraft:tripwire_hook"], yer.tur, (b, p) => (kir(bot, p), true), "Tel tuzaklarını kesiyor");
    if (n) bot.say(`Tel tuzaklarını kestim (${n}).`);
    return n;
  },
  /** Şüpheli kum/çakıl: fırçalar gibi oyunun arkeoloji ganimet tablosundan eşya çıkarır. */
  *arkeoloji(bot, yer, r) {
    const yol = ARKEO[yer.tur] ?? ["archaeology/desert_pyramid"];
    return yield* herBirine(bot, yer.pos, r, ["minecraft:suspicious_sand", "minecraft:suspicious_gravel"], yer.tur, (b, p) => {
      const kum = b.typeId.includes("sand");
      for (const it of tablodan(yol)) {
        const rest = bot.addStack(it);
        if (rest) safe(() => bot.dim.spawnItem(rest, bot.loc));
      }
      safe(() => b.setType(kum ? "minecraft:sand" : "minecraft:gravel"));
      safe(() => bot.dim.playSound(kum ? "brush.sand" : "brush.gravel", p));
      return true;
    }, "Arkeoloji: fırçalıyor");
  },
  *altin(bot, yer, r) {
    return yield* herBirine(bot, yer.pos, r, ["minecraft:gold_block"], yer.tur, (b, p) => (kir(bot, p), true), "Altın blokları söküyor");
  },
  *sunger(bot, yer, r) {
    return yield* herBirine(bot, yer.pos, r, ["minecraft:wet_sponge", "minecraft:sponge"], yer.tur, (b, p) => (kir(bot, p), true), "Süngerleri topluyor");
  },
  /** Nether siğili: olgunları toplar, yerine yenisini diker (tarla kalsın). */
  *sigil(bot, yer, r) {
    return yield* herBirine(bot, yer.pos, r, ["minecraft:nether_wart"], yer.tur, (b, p) => {
      if ((safe(() => b.permutation.getState("age"), 0) ?? 0) < 3) return false;
      kir(bot, p);
      safe(() => bot.dim.getBlock(p)?.setType("minecraft:nether_wart"));   // yeniden dik: tarla sürsün
      return true;
    }, "Nether siğili topluyor");
  },
  *kemik(bot, yer, r) {
    return yield* herBirine(bot, yer.pos, r, ["minecraft:bone_block"], yer.tur, (b, p) => (kir(bot, p), true), "Kemik blokları söküyor");
  },
  *ametist(bot, yer, r) {
    return yield* herBirine(bot, yer.pos, r, ["minecraft:amethyst_cluster"], yer.tur, (b, p) => (kir(bot, p), true), "Ametist topluyor");
  },
  /** Maden ocağı: sandıklı vagonları boşaltır. */
  *vagon(bot, yer, r) {
    let n = 0;
    const list = safe(() => bot.dim.getEntities({ type: "minecraft:chest_minecart", location: yer.pos, maxDistance: r }), []) ?? [];
    for (const v of list) {
      const ok = yield* bot.goTo(V.floor(v.location), { range: 2, maxNodes: 2000, radius: 40, dig: bot.type === "madenci" });
      if (!ok && V.dist(bot.loc, v.location) > 3.5) continue;
      const cc = safe(() => v.getComponent("minecraft:inventory")?.container);
      if (cc && bosalt(bot, cc)) n++;
      if (bot.isFull()) break;
    }
    return n;
  },
  *yagma(bot, yer, r, ek = {}) {
    return yield* yagmaIsi(bot, { merkez: yer.pos, r, sefer: ek.sefer });
  },
};

/** Bir yapıda, yapının gerektirdiği işleri sırayla yapar. Dönen: yağma sayacı (+ özel işler). */
export function* yapiIsleri(bot, yer, r, ek = {}) {
  const say = { kap: 0, comlek: 0, kasa: 0, esya: 0, ozel: 0 };
  const tur = YAPI[yer.tur] ? yer.tur : null;
  if (tur && YAPI[tur].not && !ek.sessiz) bot.say(`${YAPI[tur].ad}: ${YAPI[tur].not}`);
  if (V.hdist(bot.loc, yer.pos) > r + 4) {
    bot.setStatus(`${tur ? YAPI[tur].ad : "Yağma yeri"} yolunda`);
    const ok = yield* bot.travelTo(yer.pos, { near: 4 });
    if (!ok && V.hdist(bot.loc, yer.pos) > r + 8) {
      bot.say("Yapıya ulaşamadım.");
      return say;
    }
  }
  for (const is of tur ? islerOf(tur) : ["yagma"]) {
    const fn = ISLER[is];
    if (!fn) continue;
    const r1 = yield* fn(bot, yer, r, ek);
    if (r1 && typeof r1 === "object") for (const k of Object.keys(say)) say[k] += r1[k] ?? 0;
    else say.ozel += r1 ?? 0;
    if (bot.isFull() && ek.sefer) break;
  }
  return say;
}
