// v0.5.0: Rampa. Rampa eşyası bir bloğa dokunarak konunca baktığın yöne doğru rampa kurulur: varsayılan 2 blok
// kalınlık (genişlik), 10 blok uzunluk, 6 blok yükseklik. Rampa Ayarlayıcı: basılı tut → kalınlık/uzunluk/yükseklik;
// bir rampaya dokun → o rampayı kaldırır (Rampa eşyası geri verilir). Rampa yarım blok kalın eğik plaka (altı boş).
// Bloklar gen/rampa.py. Oyunda denenmedi.
import { BlockPermutation, ItemStack, GameMode } from "@minecraft/server";
import { safe, V } from "./util.js";
import { Prefs } from "./store.js";
import { modal } from "./ui/forms.js";

export const RAMPA_VARSAYILAN = { k: 2, u: 10, y: 6 };
const YONLER = [
  { ad: "south", d: { x: 0, z: 1 } }, { ad: "west", d: { x: -1, z: 0 } },
  { ad: "north", d: { x: 0, z: -1 } }, { ad: "east", d: { x: 1, z: 0 } },
];
const BOS = /^minecraft:(air|cave_air|short_grass|tall_grass|fern|large_fern|snow_layer|water|flowing_water|dandelion|poppy|.*_flower|.*_tulip|dead_bush|vine)$/;

export function rampaAyari(pl) {
  return { ...RAMPA_VARSAYILAN, ...(Prefs.get(pl.id).rampa ?? {}) };
}

/** Oyuncunun bakış yönüne en yakın 4 yön. */
function yonOf(pl) {
  const yaw = safe(() => pl.getRotation().y, 0) ?? 0;
  const i = Math.round((((yaw % 360) + 360) % 360) / 90) % 4;
  return YONLER[i];
}

/** Rampayı kurar. Konan blok sayısı. */
export function rampaKur(dim, bas, yon, ayar) {
  const L = Math.max(2, Math.min(64, ayar.u)), W = Math.max(1, Math.min(9, ayar.k)), H = Math.max(1, Math.min(32, ayar.y));
  const e = Math.max(1, Math.min(8, Math.round((H / L) * 8)));        // eğim: blok başına e/8
  const r = e / 8;
  const yan = { x: -yon.d.z, z: yon.d.x };
  const sol = -Math.floor((W - 1) / 2);
  let n = 0;
  const koy = (p, perm) => {
    const t = safe(() => dim.getBlock(p)?.typeId, null);
    if (!t || !(BOS.test(t) || t.startsWith("aqualit:rampa"))) return;
    safe(() => dim.getBlock(p).setPermutation(perm));
    n++;
  };
  // rampa yarım blok kalın eğik bir plaka: altı boş; plakanın alttaki bloğa taşan kısmı 'alt' parçası
  const KALINLIK = 8;
  for (let i = 0; i < L; i++) {
    const h = i * r;
    const yb = Math.floor(h + 1e-6);
    const k = Math.min(14, Math.round(((h - yb) * 16) / 2) * 2);
    const perm = (parca) => safe(() => BlockPermutation.resolve(`aqualit:rampa_e${e}`, { "aqualit:kayma": `k${k}`, "aqualit:parca": parca, "minecraft:cardinal_direction": yon.ad }));
    const ust = perm("ust"), alt = k < KALINLIK ? perm("alt") : null;
    for (let w = 0; w < W; w++) {
      const x = bas.x + yon.d.x * i + yan.x * (sol + w), z = bas.z + yon.d.z * i + yan.z * (sol + w);
      if (ust) koy({ x, y: bas.y + yb, z }, ust);
      if (alt) koy({ x, y: bas.y + yb - 1, z }, alt);
    }
  }
  safe(() => dim.playSound("random.anvil_land", bas, { volume: 0.5, pitch: 1.4 }));
  return n;
}

/** Rampa eşyasıyla bir bloğa dokunuldu. */
export function rampaEsyasi(pl, block, face) {
  const ust = face === "Up" || !face;
  const bas = ust ? { x: block.x, y: block.y + 1, z: block.z } : { x: block.x, y: block.y, z: block.z };
  const ayar = rampaAyari(pl);
  const yon = yonOf(pl);
  const n = rampaKur(pl.dimension, bas, yon, ayar);
  if (!n) return safe(() => pl.sendMessage("§eRampa buraya kurulamadı (önü dolu)."));
  if (safe(() => pl.getGameMode(), "") !== GameMode.Creative && safe(() => pl.getGameMode(), "") !== "Creative") {
    const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
    const it = safe(() => inv.getItem(pl.selectedSlotIndex));
    if (it?.typeId === "aqualit:rampa") {
      if (it.amount > 1) { it.amount -= 1; safe(() => inv.setItem(pl.selectedSlotIndex, it)); } else safe(() => inv.setItem(pl.selectedSlotIndex, undefined));
    }
  }
  safe(() => pl.onScreenDisplay.setActionBar(`§eRampa kuruldu §7· ${ayar.k} kalınlık · ${ayar.u} uzunluk · ${ayar.y} yükseklik`));
}

/** Ayarlayıcı: basılı tut → ölçüler. */
export async function rampaAyarMenu(pl) {
  const a = rampaAyari(pl);
  const v = await modal(pl, "§lRampa Ayarlayıcı", [
    { type: "slider", label: "Kalınlık (genişlik, blok)", min: 1, max: 9, step: 1, value: a.k },
    { type: "slider", label: "Uzunluk (blok)", min: 2, max: 40, step: 1, value: a.u },
    { type: "slider", label: "Yükseklik (blok)", min: 1, max: 32, step: 1, value: a.y },
  ], "Kaydet");
  if (!v) return;
  const pr = Prefs.get(pl.id);
  pr.rampa = { k: Number(v[0]), u: Number(v[1]), y: Math.min(Number(v[2]), Number(v[1])) };
  Prefs.set(pl.id, pr);
  pl.sendMessage(`§eRampa ölçüleri:§r ${pr.rampa.k} kalınlık, ${pr.rampa.u} uzunluk, ${pr.rampa.y} yükseklik${Number(v[2]) > Number(v[1]) ? " §7(en dik 45°: yükseklik uzunluğu geçemez)" : ""}`);
}

/** Ayarlayıcıyla rampaya dokununca: bağlı bütün rampa bloklarını kaldır, Rampa eşyasını geri ver. */
export function rampaKaldir(pl, block) {
  const dim = pl.dimension;
  const bas = { x: block.x, y: block.y, z: block.z };
  const gor = new Set([`${bas.x},${bas.y},${bas.z}`]);
  const kuyruk = [bas];
  let n = 0;
  while (kuyruk.length && n < 4000) {
    const p = kuyruk.shift();
    const t = safe(() => dim.getBlock(p)?.typeId, "");
    if (!t?.startsWith("aqualit:rampa")) continue;
    safe(() => dim.setBlockType(p, "minecraft:air"));
    n++;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dy && !dz) continue;
      const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
      const k = `${q.x},${q.y},${q.z}`;
      if (!gor.has(k)) { gor.add(k); kuyruk.push(q); }
    }
  }
  if (!n) return false;
  const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
  const it = new ItemStack("aqualit:rampa", 1);
  if (safe(() => inv.addItem(it), it)) safe(() => dim.spawnItem(it, pl.location));
  safe(() => pl.onScreenDisplay.setActionBar(`§eRampa kaldırıldı §7(${n} blok)`));
  void V;
  return true;
}
