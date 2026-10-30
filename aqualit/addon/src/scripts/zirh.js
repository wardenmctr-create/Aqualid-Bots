// Aqualit Robotları — Kabuk zırhı (Kabuk Zırhları v1.2.1 ile birleşik), Aqualit zırh seti,
// büyü kitapları, ağaç kabuğu ve kabuk büyü kitabı ganimeti.
// Taş / derin kayrak zırhın özel özelliği yok (v0.2.8): oyunun kendi zırhı gibi çalışır; burada yalnız
// eski sürümlerden kalan açıklama/veri satırları temizlenir.
//
// Kabuk zırhı: gerçek dayanıklılık (miğfer 40, göğüslük 60, pantolon 55, bot 45), koruma 1+2+1+1 = 5.
// Etki payları: göğüslük .75, pantolon .50, miğfer .25, bot .25; toplam pay en çok 1.
//   hız  = (0.20 + 0.05 × Hafif Adımlar) × pay      düşüş = (0.30 + 0.05 × Esnek Lifler) × pay
// Normal kabuk yanıcıdır (ateşte %15 fazladan hasar); Kızıl/Çarpık Nether kabuğu ateş hasarını azaltır (tam sette %50).
// Reçine Koruması kitabı (I-III): normal kabukta fazladan hasarı %15 -> %10 -> %5 -> %0'a indirir,
// Nether kabukta ateş korumasını %50 -> %60 -> %70 -> %80'e çıkarır.
// Kabuk büyü kitapları üretilemez; yalnız doğal sandıklardan (ilk açılışta) çıkar.
import { world, system, ItemStack, ItemTypes } from "@minecraft/server";
import { TREES, TREE_NAME, ENCH, INCOMPAT, BARK, STONE, AQ_SET, NETHER, BARK_MAX, BARK_SHARE } from "./zirh_data.js";
import { safe } from "./util.js";
import { isCreative, giveItem, consumeHand } from "./place.js";
import { unitIdAt } from "./sandik.js";

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const SLOTS = ["Head", "Chest", "Legs", "Feet"];
const FIRE = new Set(["fire", "fireTick", "lava", "campfire", "soulCampfire", "magma"]);
const NAME_TO_KEY = Object.fromEntries(Object.entries(ENCH).map(([k, e]) => [e.ad, k]));

// ---- ayarlanabilir değerler
export const BARK_CFG = {
  speed: 0.20, speedPerLevel: 0.05,       // tam pay hız bonusu, Hafif Adımlar seviye başına
  fall: 0.30, fallPerLevel: 0.05,         // tam pay düşüş azaltma, Esnek Lifler seviye başına
  fireExtra: [0.15, 0.10, 0.05, 0],       // normal kabuk: Reçine Koruması 0..III ile ateşte fazladan hasar
  netherFire: [0.50, 0.60, 0.70, 0.80],   // Nether kabuğu: Reçine Koruması 0..III ile tam pay ateş koruması (lav bağışıklığı yok)
  lootChance: 0.16,                       // doğal sandık ilk açılışında kabuk kitabı çıkma olasılığı
  loot: [["esnek_lifler", 20], ["hafif_adimlar", 20], ["orman_golgesi", 18], ["recine_korumasi", 18],
    ["dusus_asinmasi", 18], ["son_kabuk", 6]],
};

export const isBark = (id) => !!id && !!BARK[id];
export const isStone = (id) => !!id && !!STONE[id];
export const isNetherBark = (id) => isBark(id) && NETHER.some((k) => id.endsWith(`_${k}`));
const shareOf = (id) => BARK_SHARE[BARK[id]] ?? 0;

const state = new Map();
function st(p) {
  let s = state.get(p.id);
  if (!s) {
    s = { lastSet: 0, lastSetU: 0, regenCd: 0, aqFull: false };
    state.set(p.id, s);
  }
  return s;
}
world.afterEvents.playerLeave?.subscribe((ev) => state.delete(ev.playerId));

function eqOf(p) {
  return safe(() => p.getComponent("minecraft:equippable"));
}
function bar(p, text) {
  safe(() => p.onScreenDisplay.setActionBar(text));
}

// ====================================================================== kabuk: soy -> kabuk düşer
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  if (ev.isFirstEvent === false) return;
  const item = ev.itemStack;
  if (!item || !safe(() => item.hasTag("minecraft:is_axe"), false)) return;
  const block = ev.block;
  const tree = TREES[block.typeId];
  if (!tree) return;
  const pos = { x: block.x, y: block.y, z: block.z };
  const dim = block.dimension;
  system.run(() => {
    // yalnız blok gerçekten soyulduysa (kütük -> soyulmuş kütük) 1 kabuk; soyulmuş gövde yeniden kabuk vermez
    const b = safe(() => dim.getBlock(pos));
    if (!b || !b.typeId.startsWith("minecraft:stripped_")) return;
    safe(() => dim.spawnItem(new ItemStack(`aqualit:kabuk_${tree}`, 1), { x: pos.x + 0.5, y: pos.y + 0.6, z: pos.z + 0.5 }));
  });
});

// ====================================================================== kabuk zırhı büyüleri (açıklama satırlarında)
export function readBark(item) {
  const out = { ench: {}, oldWear: null };
  const lore = safe(() => item.getLore(), []) ?? [];
  for (const raw of lore) {
    const line = raw.replace(/§./g, "");
    const m = line.match(/^Dayanıklılık: (\d+)\/(\d+)/);
    if (m) {
      out.oldWear = Math.max(0, Number(m[2]) - Number(m[1])) / Math.max(1, Number(m[2]));
      continue;
    }
    const e = line.match(/^(.+) (I|II|III|IV|V)$/);
    if (e && NAME_TO_KEY[e[1]]) out.ench[NAME_TO_KEY[e[1]]] = ROMAN.indexOf(e[2]);
  }
  return out;
}

function enchLines(ench) {
  return Object.entries(ench).filter(([k, l]) => l > 0 && ENCH[k]).map(([k, l]) => `§d${ENCH[k].ad} ${ROMAN[l]}`);
}

export function writeBark(item, d) {
  const head = isNetherBark(item.typeId) ? "§7Nether kabuğu · ateşe dayanıklı" : "§7Kabuk zırhı · hız ve düşüş";
  safe(() => item.setLore([head, ...enchLines(d.ench)]));
}

/** v0.2.6 eşyası: açıklamadaki eski dayanıklılığı gerçek dayanıklılığa taşır. Değiştiyse true. */
export function migrateBark(item) {
  if (!isBark(item?.typeId)) return false;
  const d = readBark(item);
  if (d.oldWear === null) return false;
  const dur = safe(() => item.getComponent("minecraft:durability"));
  if (dur) {
    const max = dur.maxDurability || BARK_MAX[BARK[item.typeId]] || 40;
    safe(() => { dur.damage = Math.min(max - 1, Math.max(dur.damage, Math.round(max * d.oldWear))); });
  }
  writeBark(item, d);
  return true;
}

/** Giyili kabuk parçaları: { pieces, ench (en yüksek seviyeler), share, normal, nether }. */
export function barkInfo(eq) {
  const pieces = [];
  const ench = {};
  let normal = 0, nether = 0;
  for (const slot of SLOTS) {
    const item = safe(() => eq.getEquipment(slot));
    if (!isBark(item?.typeId)) continue;
    pieces.push({ slot, item });
    for (const [k, l] of Object.entries(readBark(item).ench)) ench[k] = Math.max(ench[k] ?? 0, l);
    if (isNetherBark(item.typeId)) nether += shareOf(item.typeId);
    else normal += shareOf(item.typeId);
  }
  const sum = normal + nether;
  const k = sum > 1 ? 1 / sum : 1; // toplam pay 1 ile sınırlı; karışık sette oranlar korunur
  return { pieces, ench, share: Math.min(1, sum), normal: normal * k, nether: nether * k };
}

export function barkSpeed(info) {
  if (!info.pieces.length) return 0;
  return (BARK_CFG.speed + BARK_CFG.speedPerLevel * (info.ench.hafif_adimlar ?? 0)) * info.share;
}
export function barkFall(info) {
  if (!info.pieces.length) return 0;
  return (BARK_CFG.fall + BARK_CFG.fallPerLevel * (info.ench.esnek_lifler ?? 0)) * info.share;
}
/** Ateş hasarı çarpanı: normal pay yanıcı, Nether payı koruyucu; ikisini de Reçine Koruması iyileştirir. */
export function barkFire(info) {
  const r = Math.min(3, info.ench.recine_korumasi ?? 0);
  return Math.max(0, 1 + BARK_CFG.fireExtra[r] * info.normal - BARK_CFG.netherFire[r] * info.nether);
}

// ====================================================================== giyili parçalar, eski taş zırh verisi
function wornItems(eq) {
  return SLOTS.map((slot) => ({ slot, item: safe(() => eq.getEquipment(slot)) }));
}

/** v0.2.7 ve öncesi taş zırh: "kırılma hakkı" açıklaması ve gizli verisi silinir. Değiştiyse true. */
export function migrateStone(item) {
  if (!isStone(item?.typeId)) return false;
  const lore = safe(() => item.getLore(), []) ?? [];
  const used = safe(() => item.getDynamicProperty("aq:used"), undefined);
  const ench = safe(() => item.getDynamicProperty("aq:ench"), undefined);
  if (!lore.length && used === undefined && ench === undefined) return false;
  safe(() => item.setLore([]));
  safe(() => item.setDynamicProperty("aq:used", undefined));
  safe(() => item.setDynamicProperty("aq:ench", undefined));
  return true;
}

// ====================================================================== hız (karada ve suda) — tek hareket denetleyicisi
// Kabuk zırhı ve Aqualit seti hızı yalnız buradan değişir; iksir etkisi varken ya da başka bir şey
// değeri değiştirdiyse dokunulmaz, zırh çıkınca bizim koyduğumuz değer geri alınır.
function applySpeed(p, s, land, water) {
  const m = safe(() => p.getComponent("minecraft:movement"));
  const u = safe(() => p.getComponent("minecraft:underwater_movement"));
  const fx = safe(() => p.getEffect("speed") || p.getEffect("slowness"), undefined);
  const free = !fx && !p.isSprinting && !p.isSneaking;
  const set = (comp, bonus, key) => {
    if (!comp) return;
    const def = comp.defaultValue;
    const cur = comp.currentValue;
    const want = def * (1 + bonus);
    const ours = Math.abs(cur - def) < 1e-4 || (s[key] && Math.abs(cur - s[key]) < 1e-4);
    if (bonus > 0 && free && ours) {
      if (Math.abs(cur - want) > 1e-4) safe(() => comp.setCurrentValue(want));
      s[key] = want;
    } else if ((bonus <= 0 || fx) && s[key]) {
      if (Math.abs(cur - s[key]) < 1e-4) safe(() => comp.resetToDefaultValue());
      s[key] = 0;
    }
  };
  set(m, land, "lastSet");
  set(u, water, "lastSetU");
}

// ====================================================================== oyuncu döngüsü

function tickPlayer(p, t) {
  const s = st(p);
  const eq = eqOf(p);
  if (!eq) return;
  for (const w of wornItems(eq)) {
    const id = w.item?.typeId;
    if (isStone(id)) {
      if (migrateStone(w.item)) safe(() => eq.setEquipment(w.slot, w.item));
      continue;
    }
    if (isBark(id)) {
      // eski sürümden kalan yığın: 1'i giyili kalsın, gerisi tek tek envantere
      if (w.item.amount > 1) {
        const n = w.item.amount;
        const one = w.item.clone();
        one.amount = 1;
        safe(() => eq.setEquipment(w.slot, one));
        for (let i = 1; i < n; i++) giveItem(p, one.clone());
        w.item = one;
      }
      // eski açıklama dayanıklılığı -> gerçek dayanıklılık
      if (migrateBark(w.item)) safe(() => eq.setEquipment(w.slot, w.item));
    }
  }
  // envanterdeki eski kabuk ve taş zırhları (5 sn'de bir)
  if (t % 100 === 0) migrateInventory(p);
  // Aqualit seti
  if (t % 40 === 0) {
    s.aqFull = AQ_SET.every((id, i) => safe(() => eq.getEquipment(SLOTS[i])?.typeId) === id);
    if (s.aqFull) {
      safe(() => p.addEffect("haste", 80, { amplifier: 0, showParticles: false }));
      safe(() => p.addEffect("water_breathing", 80, { amplifier: 0, showParticles: false }));
    }
  }
  const info = barkInfo(eq);
  const inWater = safe(() => p.isInWater, false);
  const land = barkSpeed(info);
  applySpeed(p, s, land, land + (s.aqFull && inWater ? 0.4 : 0));
  // Orman Gölgesi: eğilirken kısa görünmezlik (seviye arttıkça biraz daha uzun)
  const og = info.ench.orman_golgesi ?? 0;
  if (og > 0 && p.isSneaking && t % 35 === 0) {
    safe(() => p.addEffect("invisibility", 40 + 10 * og, { amplifier: 0, showParticles: false }));
  }
}

function migrateInventory(p) {
  const inv = safe(() => p.getComponent("minecraft:inventory")?.container);
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) {
    const it = safe(() => inv.getItem(i));
    if (isStone(it?.typeId)) {
      if (migrateStone(it)) safe(() => inv.setItem(i, it));
      continue;
    }
    if (!isBark(it?.typeId)) continue;
    if (it.amount > 1) {
      const one = it.clone();
      one.amount = 1;
      migrateBark(one);
      safe(() => inv.setItem(i, one));
      for (let k = 1; k < it.amount; k++) giveItem(p, one.clone());
    } else if (migrateBark(it)) safe(() => inv.setItem(i, it));
  }
}

system.runInterval(() => {
  const t = system.currentTick;
  for (const p of world.getAllPlayers()) safe(() => tickPlayer(p, t));
}, 5);

// ====================================================================== hasar
world.beforeEvents.entityHurt.subscribe((ev) => {
  const p = ev.hurtEntity;
  if (safe(() => p.typeId) !== "minecraft:player") return;
  const eq = eqOf(p);
  if (!eq) return;
  const info = barkInfo(eq);
  if (info.pieces.length) barkHurt(ev, p, info, ev.damageSource?.cause);
});

function barkHurt(ev, p, info, cause) {
  const raw = ev.damage;
  let dmg = raw;
  if (cause === "fall") dmg = raw * (1 - barkFall(info));
  else if (FIRE.has(cause)) dmg = raw * barkFire(info);
  // Son Kabuk: ölümcül darbede bir kez kurtarır, büyülü parça parçalanır
  if ((info.ench.son_kabuk ?? 0) > 0) {
    const hp = safe(() => p.getComponent("minecraft:health")?.currentValue, 20);
    if (dmg >= hp) {
      const special = info.pieces.find((w) => (readBark(w.item).ench.son_kabuk ?? 0) > 0);
      if (special) {
        ev.cancel = true;
        system.run(() => lastStand(p, special.slot, special.item.typeId));
        return;
      }
    }
  }
  if (dmg !== raw) ev.damage = dmg;
  if (cause === "fall") {
    const ench = { ...info.ench };
    system.run(() => safe(() => extraWear(p, ench, raw)));
  }
}

function lastStand(p, slot, id) {
  const eq = eqOf(p);
  if (!eq || safe(() => eq.getEquipment(slot)?.typeId) !== id) return;
  safe(() => eq.setEquipment(slot, undefined));
  safe(() => p.playSound("random.break"));
  safe(() => p.dimension.playSound("dig.wood", p.location));
  safe(() => p.addEffect("regeneration", 60, { amplifier: 1 }));
  safe(() => p.sendMessage("§6Son Kabuk seni kurtardı! Büyülü parça parçalandı."));
}

/**
 * Oyun düşüşte zırhı aşındırmaz; kabuk zırhı düşüşü karşıladığı için aşınır (Düşüş Aşınması azaltır,
 * Kırılmazlık büyüsü şansı böler).
 */
export function extraWear(p, ench, raw) {
  const eq = eqOf(p);
  if (!eq) return;
  const chance = 1 - Math.min(0.9, 0.25 * (ench.dusus_asinmasi ?? 0));
  const add = raw > 12 ? 2 : 1;
  for (const w of wornItems(eq)) {
    if (!isBark(w.item?.typeId)) continue;
    const unb = safe(() => w.item.getComponent("minecraft:enchantable")?.getEnchantment("unbreaking")?.level, 0) ?? 0;
    if (Math.random() >= chance / (1 + unb)) continue;
    const d = safe(() => w.item.getComponent("minecraft:durability"));
    if (!d || d.unbreakable) continue;
    if (d.damage + add >= d.maxDurability) {
      safe(() => eq.setEquipment(w.slot, undefined));
      safe(() => p.playSound("random.break"));
      bar(p, "§cKabuk zırh parçan parçalandı.");
      continue;
    }
    safe(() => { d.damage += add; });
    safe(() => eq.setEquipment(w.slot, w.item));
  }
}

// Aqualit seti: can %30'un altına düşünce 5 sn Can Yenilenmesi (60 sn'de bir)
world.afterEvents.entityHurt.subscribe((ev) => {
  const p = ev.hurtEntity;
  if (safe(() => p.typeId) !== "minecraft:player") return;
  const s = st(p);
  if (!s.aqFull) return;
  const h = safe(() => p.getComponent("minecraft:health"));
  if (!h || h.currentValue <= 0 || h.currentValue / h.effectiveMax >= 0.3) return;
  const t = system.currentTick;
  if (s.regenCd > t) return;
  s.regenCd = t + 1200;
  safe(() => p.addEffect("regeneration", 100, { amplifier: 1 }));
  bar(p, "§bAqualit zırhın seni iyileştiriyor!");
});

// ====================================================================== büyü kitapları (tek işleyici: items.js -> aqualit:buyu)
/** Kabuk büyü kitabını giyili kabuk zırhına işler (önce göğüslük). Başarılıysa kitabı harcar, true döner. */
export function applyBook(p, key) {
  const e = ENCH[key];
  if (!e) return false;
  const eq = eqOf(p);
  if (!eq) return false;
  const info = barkInfo(eq);
  const pick = info.pieces.find((x) => x.slot === "Chest") ?? info.pieces[0];
  if (!pick) {
    p.sendMessage("§cBu büyü için kabuk zırhından bir parça giymelisin.");
    return false;
  }
  const piece = pick.item;
  migrateBark(piece);
  const d = readBark(piece);
  // uyumsuzluk: giyili bütün parçalara bakılır
  for (const [a, b] of INCOMPAT) {
    const other = key === a ? b : key === b ? a : null;
    if (other && (info.ench[other] ?? 0) > 0) {
      p.sendMessage(`§c${e.ad}, ${ENCH[other].ad} ile aynı zırhta olamaz.`);
      return false;
    }
  }
  const cur = d.ench[key] ?? 0;
  if (cur >= e.max) {
    p.sendMessage(`§e${e.ad} zaten en yüksek seviyede (${ROMAN[e.max]}).`);
    return false;
  }
  d.ench[key] = cur + 1;
  writeBark(piece, d);
  safe(() => eq.setEquipment(pick.slot, piece));
  if (!isCreative(p)) consumeHand(p);
  safe(() => p.playSound("random.levelup", { pitch: 1.3 }));
  safe(() => p.dimension.spawnParticle("minecraft:totem_particle", { x: p.location.x, y: p.location.y + 1, z: p.location.z }));
  p.sendMessage(`§d${e.ad} ${ROMAN[cur + 1]}§r zırhına işlendi.`);
  return true;
}

// ====================================================================== kabuk kitabı ganimeti (doğal sandıklar)
// Oyunun ganimet tablolarına dokunulmaz: bir sandık/varil ilk kez açıldığında (oyunun kendi ganimeti
// dolduktan sonra) %16 olasılıkla boş bir yuvaya 1 kabuk kitabı konur. Oyuncunun koyduğu sandıklar ve
// daha önce açılmış sandıklar işaretlenir; işaretler 64×64 bölge başına tek dünya özelliğinde tutulur.
const LOOT_BLOCKS = new Set(["minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel"]);
const MARK_MAX = 30000;
const regionKey = (dimId, pos) => `aq:sandik:${dimId.replace("minecraft:", "")}:${pos.x >> 6}:${pos.z >> 6}`;
const posTag = (pos) => `;${pos.x},${pos.y},${pos.z}:`;

export function chestMark(dimId, pos) {
  const s = safe(() => world.getDynamicProperty(regionKey(dimId, pos)), undefined);
  if (typeof s !== "string") return null;
  const i = s.indexOf(posTag(pos));
  return i < 0 ? null : s.charAt(i + posTag(pos).length);
}

export function setChestMark(dimId, pos, flag) {
  const key = regionKey(dimId, pos);
  const tag = posTag(pos);
  let s = safe(() => world.getDynamicProperty(key), undefined);
  s = typeof s === "string" ? s : "";
  const i = s.indexOf(tag);
  if (i >= 0) s = s.slice(0, i) + s.slice(i + tag.length + 1);
  if (flag) s += tag + flag;
  if (s.length > MARK_MAX) s = s.slice(s.indexOf(";", s.length - MARK_MAX));
  safe(() => world.setDynamicProperty(key, s.length ? s : undefined));
}

/** Betikle yerleştirilen sandıkları da işaretlemek için (ör. Mimar robotu). */
export function markPlacedChest(dim, pos) {
  setChestMark(dim.id, { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) }, "p");
}

export function pickLoot(r = Math.random()) {
  const total = BARK_CFG.loot.reduce((n, x) => n + x[1], 0);
  let acc = 0;
  for (const [k, w] of BARK_CFG.loot) {
    acc += w / total;
    if (r < acc) return k;
  }
  return BARK_CFG.loot[BARK_CFG.loot.length - 1][0];
}

world.afterEvents.playerPlaceBlock?.subscribe((ev) => {
  const b = ev.block;
  if (!LOOT_BLOCKS.has(safe(() => b.typeId))) return;
  setChestMark(b.dimension.id, { x: b.x, y: b.y, z: b.z }, "p");
});
world.afterEvents.playerBreakBlock?.subscribe((ev) => {
  if (!LOOT_BLOCKS.has(safe(() => ev.brokenBlockPermutation.type.id))) return;
  setChestMark(ev.dimension.id, { x: ev.block.x, y: ev.block.y, z: ev.block.z }, undefined);
});

export function onContainerOpened(block) {
  if (!block || !LOOT_BLOCKS.has(safe(() => block.typeId))) return;
  const dim = block.dimension;
  const pos = { x: block.x, y: block.y, z: block.z };
  if (unitIdAt(dim.id, pos)) return;          // Aqualit sandığı (oyunun tuzaklı sandığı üstüne kurulu): ganimet yok
  if (chestMark(dim.id, pos)) return;
  setChestMark(dim.id, pos, "o");
  // çift sandığın öbür yarısı da açılmış sayılır
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const q = { x: pos.x + dx, y: pos.y, z: pos.z + dz };
    if (safe(() => dim.getBlock(q)?.typeId) === block.typeId && !chestMark(dim.id, q)) setChestMark(dim.id, q, "o");
  }
  system.runTimeout(() => {
    if (Math.random() >= BARK_CFG.lootChance) return;
    const b = safe(() => dim.getBlock(pos));
    const c = safe(() => b?.getComponent("minecraft:inventory")?.container);
    if (!c) return;
    const empty = [];
    for (let i = 0; i < c.size; i++) if (!safe(() => c.getItem(i))) empty.push(i);
    if (!empty.length) return;
    safe(() => c.setItem(empty[Math.floor(Math.random() * empty.length)], new ItemStack(`aqualit:buyu_${pickLoot()}`, 1)));
  }, 2);
}

if (world.afterEvents.blockContainerOpened) {
  world.afterEvents.blockContainerOpened.subscribe((ev) => safe(() => onContainerOpened(ev.block)));
} else {
  world.afterEvents.playerInteractWithBlock?.subscribe((ev) => {
    if (ev.isFirstEvent === false) return;
    safe(() => onContainerOpened(ev.block));
  });
}

// ====================================================================== çifte kurulum uyarısı
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  if (!safe(() => ItemTypes.get("kabuk:kabuk_mese"), undefined)) return;
  system.runTimeout(() => safe(() => ev.player.sendMessage(
    "§6Uyarı:§r Ayrı §fKabuk Zırhları§r paketi de açık. Kabuk zırhları artık Aqualit'in içinde; "
    + "kabuklar iki kez düşmesin diye o paketi bu dünyadan kaldır.")), 80);
});

