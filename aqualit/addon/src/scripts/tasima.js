// v0.5.0: Robotlar kendi sandıklarını taşıyabilir. Organizatör "merkez çok dağınık, sandıklarınızı alın getirin" derse:
// işi olmayanlar hemen sandığını alıp (Portalcı çırağı varsa uçarak) Organizatör'ün merkezinin çevresine koyar; işi
// olanlar not alır, işi bitince getirir. Sandık içindekilerle taşınır (robotun sınırsız çantasında). Oyunda denenmedi.
import { ItemStack } from "@minecraft/server";
import { safe, V, wait } from "./util.js";
import { bots, startJob } from "./brain.js";
import { sandigiKaldir, placeChestBlock, getSandik, standSpot } from "./sandik.js";
import { setProp, setJSON } from "./store.js";
import { CHEST_ITEM } from "./constants.js";

const bosMu = (t) => !t || /^minecraft:(air|cave_air|short_grass|tall_grass|fern|snow_layer|dandelion|poppy)$/.test(t);
const katiMi = (t) => !!t && !bosMu(t) && !/water|lava/.test(t);

/** Merkezin çevresinde sandık için boş yer (halka halka; robot sırasına göre farklı yer). */
export function sandikYeri(dim, merkez, sira = 0) {
  const tut = new Set();
  let n = 0;
  for (let r = 5; r <= 14; r += 2) {
    for (let a = 0; a < 360; a += 30) {
      const t = ((a + r * 7) * Math.PI) / 180;
      const x = Math.floor(merkez.x + r * Math.cos(t)), z = Math.floor(merkez.z + r * Math.sin(t));
      const k = `${x},${z}`;
      if (tut.has(k)) continue;
      tut.add(k);
      for (let dy = 3; dy >= -3; dy--) {
        const y = Math.floor(merkez.y) + dy;
        const alt = safe(() => dim.getBlock({ x, y: y - 1, z })?.typeId);
        const ust = safe(() => dim.getBlock({ x, y, z })?.typeId);
        const ust2 = safe(() => dim.getBlock({ x, y: y + 1, z })?.typeId);
        if (katiMi(alt) && bosMu(ust) && bosMu(ust2)) {
          if (n++ >= sira) return { x, y, z };
          break;
        }
      }
    }
  }
  return null;
}

/** Robot sandığını merkeze taşır. */
export function* sandikTasi(bot, merkez, sira = 0) {
  const h = bot.homeChest?.();
  if (!h) { bot.say("Taşıyacak sandığım yok."); return; }
  const eski = V.floor(h.location);
  if (V.hdist(eski, merkez) <= 16) { bot.say("Sandığım zaten merkeze yakın."); return; }
  const dim = bot.dim;
  bot.setStatus("Sandığını taşıyor");
  yield* bot.travelTo(standSpot(h) ?? eski, { near: 2.5 });
  const veri = safe(() => sandigiKaldir(bot.chestId));
  if (!veri) { bot.say("Sandığımı kaldıramadım."); return; }
  // içindekiler robotun çantasına (sınırsız çanta)
  const tasinan = {};
  for (const it of veri.items) {
    if (it.typeId === "minecraft:chest") continue;            // eklenen kapasite: yeni sandıkta yeniden eklenmez
    tasinan[it.typeId] = (tasinan[it.typeId] ?? 0) + it.amount;
    const rest = bot.addStack(it);
    if (rest) safe(() => dim.spawnItem(rest, bot.loc));
  }
  // yolda robot yüklü alandan çıkıp yeniden yüklenirse kaldığı yerden sürsün diye kayıt
  const kayit = { merkez, sira, kind: veri.kind, name: veri.name, access: veri.access, owner: veri.owner ?? bot.owner, tasinan };
  setJSON(bot.e, "aq:tasinan", kayit);
  safe(() => bot.holdTool(CHEST_ITEM[veri.kind] ?? CHEST_ITEM.genel));
  safe(() => dim.playSound("random.chestclosed", bot.loc));
  bot.say("Sandığımı aldım, merkeze götürüyorum.");
  yield* sandikKoy(bot, kayit);
}

/** Taşınan sandığı merkezin çevresine koyar (yarıda kaldıysa robot yeniden yüklenince de buradan sürer). */
export function* sandikKoy(bot, kayit) {
  const dim = bot.dim;
  const { merkez, sira } = kayit;
  let yer = sandikYeri(dim, merkez, sira) ?? { x: Math.floor(merkez.x) + 6, y: Math.floor(merkez.y), z: Math.floor(merkez.z) };
  let vardi = false;
  for (let deneme = 0; deneme < 3 && !vardi; deneme++) {
    yield* bot.travelTo({ x: yer.x + 0.5, y: yer.y, z: yer.z + 1.5 }, { near: 2.5 });
    vardi = V.hdist(bot.loc, yer) <= 6;
  }
  // ulaşamadıysa sandığı kaybetmesin: olduğu yere koyar
  if (!vardi) yer = sandikYeri(dim, bot.loc, 0) ?? V.floor(bot.loc);
  const koy = (p) => safe(() => placeChestBlock(dim, p, kayit.kind, kayit.owner, merkez, { name: kayit.name, access: kayit.access }));
  let yeni = koy(yer);
  if (!yeni) { yer = sandikYeri(dim, bot.loc, 1) ?? yer; yeni = koy(yer); }
  if (!yeni) { bot.say("Sandığı koyacak yer bulamadım; eşyalar çantamda."); return; }
  if (!vardi) bot.say("Merkeze ulaşamadım, sandığımı şimdilik buraya koydum.");
  yield* wait(4);
  // eşyaları yeni sandığa geri koy
  const cc = safe(() => yeni.getComponent("minecraft:inventory")?.container);
  for (const [id, n] of Object.entries(kayit.tasinan ?? {})) {
    let kalan = bot.take(id, n);
    const max = safe(() => new ItemStack(id, 1).maxAmount, 64) ?? 64;
    while (kalan > 0) {
      const k = Math.min(kalan, max);
      const rest = safe(() => cc.addItem(new ItemStack(id, k)), null);
      kalan -= k - (rest?.amount ?? 0);
      if (rest) { bot.addItem(id, rest.amount); break; }
    }
  }
  bot.chestId = yeni.id;
  setProp(bot.e, "aq:chest", yeni.id);
  setJSON(bot.e, "aq:tasinan", undefined);
  if (bot.sonrakiIs) bot.sonrakiIs.__tasimaVar = false;
  const ev = { x: yer.x + 0.5, y: yer.y, z: yer.z + 1.5 };
  bot.home = ev;
  setProp(bot.e, "aq:home", ev);
  setProp(bot.e, "aq:homeDim", dim.id);
  safe(() => bot.holdTool());
  bot.updateIndex(true);
  bot.say(vardi ? "Sandığımı merkeze getirdim!" : "Sandığımı koydum.", { force: true });
  bot.setStatus("Hazır");
}
// brain.js: robot yeniden yüklenince yarım kalan taşımayı sürdürür
globalThis.__aqTasima = { sandikKoy };

/** Organizatör çağrısı: sahibin robotları sandıklarını merkeze getirsin. { hemen, sonra } sayıları. */
export function sandiklariTopla(owner, merkez, dimId) {
  let hemen = 0, sonra = 0, sira = 0;
  for (const b of bots.values()) {
    if (b.owner !== owner || !b.valid || b.type === "toplayici" || b.dim.id !== dimId) continue;
    const h = b.homeChest?.();
    if (!h || V.hdist(h.location, merkez) <= 16) continue;
    const s = sira++;
    const is = (bb) => sandikTasi(bb, merkez, s);
    const bos = !b.task || b.task.done || b.jobName === "bekleme";
    if (bos) {
      startJob(b, is(b), "tasima");
      b.say("Tamam, sandığımı merkeze getiriyorum.");
      hemen++;
    } else {
      (b.sonrakiIs ??= []).push(is);
      b.say("Not aldım: işim bitince sandığımı merkeze getireceğim.");
      sonra++;
    }
  }
  return { hemen, sonra };
}
