// Aqualit Robotları — Organizatör üssü (v0.4.0)
// Aqualit Kablo: komşu kablolara, Aqualit Bloğu'na, Fırın'a ve Aktarım Bloğu'na kendiliğinden bağlanır.
// Aqualit Fırın: elektriklidir; bir Aqualit Bloğu'na doğrudan ya da kabloyla bağlıysa çok hızlı eritir. Yalnız
// Organizatör kullanır. Uzaktan Aktarım Bloğu: yanındaki (3 blok) sandıklara Organizatör eşyayı uzaktan ışınlar.
// Organizatör Platformu: 9x9 tek parça mod yapısı; ortası Organizatör'ün yeri, paneline dokun: üs menüsü.
import { world, system, BlockVolume, ItemStack } from "@minecraft/server";
import { safe, V, log } from "./util.js";
import { menu } from "./ui/forms.js";
import { consumeHand } from "./place.js";

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
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (safe(() => ev.target.typeId) !== PLATFORM) return;
  ev.cancel = true;
  const pl = ev.player, e = ev.target;
  system.run(async () => {
    const r = await menu(pl, "§lOrganizatör Platformu", usDurumu(e.dimension, V.floor(e.location)), [
      { text: "§lOrganizatör'le konuş§r\n§7Telefon ekranı", v: "tel" },
      { text: "Organizatör'ü platforma çağır", v: "cagir" },
      { text: "§7Platformu kaldır (eşyaya dönüştür)", v: "al" },
    ]);
    if (!r) return;
    if (r.v === "tel") return (await import("./org_ui.js")).telefonAc(pl);
    if (r.v === "cagir") return orguYerlestir(pl.id, e);
    if (r.v === "al") {
      safe(() => e.remove());
      const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
      const it = new ItemStack("aqualit:org_platform", 1);
      if (safe(() => inv.addItem(it), it)) safe(() => pl.dimension.spawnItem(it, pl.location));
    }
  });
});
