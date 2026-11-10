// Aqualit Robotları — Evcil mini dronlar (v0.4.0)
// Eşyayı basılı tut: dron omzunda süzülür (eşya eksilir). Drona dokun: eşyaya döner. Başka evcil dronu çıkarırsan
// önceki eşyaya döner. Ölünce dron envanterine geri gelir; oyundan çıkıp girince omzunda yine belirir.
import { world, system, ItemStack } from "@minecraft/server";
import { safe, V } from "./util.js";

export const EVCIL_ID = "aqualit:evcil";
export const TURLER = ["mimar", "kesif", "madenci", "kurekci", "ciftci", "oduncu", "kilicli", "organizator", "portalci", "yardimci"];
const ADLAR = { mimar: "Mimar", kesif: "Keşif", madenci: "Madenci", kurekci: "Kürekçi", ciftci: "Çiftçi", oduncu: "Oduncu",
  kilicli: "Kılıçlı", organizator: "Organizatör", portalci: "Portalcı", yardimci: "Organizatör Yardımcısı" };
const KEY = "aq:evcil";            // oyuncuda: omzundaki dronun türü
const GERI = "aq:evcil_geri";      // öldüyse: dirilince verilecek tür
const aktif = new Map();           // oyuncu kimliği -> { e, tur }

const esyaId = (tur) => `aqualit:evcil_${tur}`;

function esyaVer(pl, tur) {
  const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
  const st = new ItemStack(esyaId(tur), 1);
  const kalan = inv ? safe(() => inv.addItem(st), st) : st;
  if (kalan) safe(() => pl.dimension.spawnItem(kalan, pl.location));
}

/** Omuz noktası: oyuncunun sağ omzunun biraz üstü (baktığı yöne göre döner). */
export function omuz(pl) {
  const l = pl.location;
  const yaw = (safe(() => pl.getRotation().y, 0) * Math.PI) / 180;
  const sag = { x: -Math.cos(yaw), z: -Math.sin(yaw) };
  const egik = safe(() => pl.isSneaking, false) ? -0.3 : 0;
  return { x: l.x + sag.x * 0.5, y: l.y + 1.62 + egik, z: l.z + sag.z * 0.5 };
}

function cikar(pl, tur) {
  geriAl(pl, true);
  const dim = pl.dimension;
  const e = safe(() => dim.spawnEntity(EVCIL_ID, omuz(pl)));
  if (!e) return false;
  safe(() => e.setProperty("aqualit:tur", Math.max(0, TURLER.indexOf(tur))));
  safe(() => e.setDynamicProperty("aq:owner", pl.id));
  safe(() => e.nameTag = "");
  aktif.set(pl.id, { e, tur, pl });
  safe(() => pl.setDynamicProperty(KEY, tur));
  return true;
}

/** Omuzdaki dronu kaldırır; esya: eşyasını geri ver. */
export function geriAl(pl, esya = true) {
  const a = aktif.get(pl.id);
  if (!a) return;
  aktif.delete(pl.id);
  safe(() => a.e.remove());
  safe(() => pl.setDynamicProperty(KEY, undefined));
  if (esya) esyaVer(pl, a.tur);
}

/** Eşyayı kullanınca: dron omuza çıkar, eşya eksilir. */
export function evcilKullan(pl, tur, slot = pl.selectedSlotIndex) {
  if (!TURLER.includes(tur)) return;
  const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
  const it = safe(() => inv.getItem(slot));
  if (!it || it.typeId !== esyaId(tur)) return;
  if (it.amount > 1) { it.amount -= 1; safe(() => inv.setItem(slot, it)); } else safe(() => inv.setItem(slot, undefined));
  if (!cikar(pl, tur)) return esyaVer(pl, tur);
  safe(() => pl.playSound("random.pop", { pitch: 1.4 }));
  safe(() => pl.onScreenDisplay.setActionBar(`§bEvcil ${ADLAR[tur]} dronun omzunda §7· geri almak için ona dokun`));
}

export function evcilOf(pl) { return aktif.get(pl.id); }

// omuzda süzül
system.runInterval(() => {
  for (const [pid, a] of aktif) {
    const pl = a.pl;
    if (!pl || !safe(() => pl.isValid, false)) { safe(() => a.e.remove()); aktif.delete(pid); continue; }
    if (!safe(() => a.e.isValid, false)) {           // kaybolduysa (yığın boşaldı vb.) yeniden çıkar
      aktif.delete(pid);
      cikar(pl, a.tur);
      continue;
    }
    const hedef = omuz(pl);
    const rot = safe(() => pl.getRotation(), { x: 0, y: 0 });
    if (safe(() => a.e.dimension.id) !== pl.dimension.id || V.dist(a.e.location, hedef) > 0.05) {
      safe(() => a.e.teleport(hedef, { dimension: pl.dimension, rotation: { x: 0, y: rot.y } }));
    } else safe(() => a.e.setRotation({ x: 0, y: rot.y }));
  }
}, 1);

// drona dokun: eşyaya döner (yalnız sahibi)
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (safe(() => ev.target.typeId) !== EVCIL_ID) return;
  ev.cancel = true;
  const pl = ev.player, e = ev.target;
  system.run(() => {
    const a = aktif.get(pl.id);
    if (a && a.e === e) return geriAl(pl, true);
    if (safe(() => e.getDynamicProperty("aq:owner")) === pl.id) safe(() => e.remove());
  });
});

// ölünce: dron kalkar, dirilince eşyası envantere gelir
world.afterEvents.entityDie.subscribe((ev) => {
  const pl = ev.deadEntity;
  if (safe(() => pl.typeId) !== "minecraft:player") return;
  const a = aktif.get(pl.id);
  if (!a) return;
  geriAl(pl, false);
  safe(() => pl.setDynamicProperty(GERI, a.tur));
});
world.afterEvents.playerSpawn.subscribe((ev) => {
  const pl = ev.player;
  system.runTimeout(() => {
    const geri = safe(() => pl.getDynamicProperty(GERI));
    if (typeof geri === "string") {
      safe(() => pl.setDynamicProperty(GERI, undefined));
      esyaVer(pl, geri);
      safe(() => pl.sendMessage(`§bEvcil ${ADLAR[geri] ?? ""} dronun envanterine döndü.`));
      return;
    }
    // oyundan çıkıp girdiyse: omzundaki dron yeniden belirir
    const tur = safe(() => pl.getDynamicProperty(KEY));
    if (ev.initialSpawn && typeof tur === "string" && !aktif.has(pl.id)) cikar(pl, tur);
  }, 10);
});
world.afterEvents.playerLeave.subscribe((ev) => {
  const a = aktif.get(ev.playerId);
  if (a) { safe(() => a.e.remove()); aktif.delete(ev.playerId); }   // KEY durur: girince geri gelir
});

// açılışta sahipsiz kalmış evcil dronları temizle (dünya yeniden açılınca)
world.afterEvents.worldLoad?.subscribe(() => {
  system.runTimeout(() => {
    for (const d of ["overworld", "nether", "the_end"]) {
      for (const e of safe(() => world.getDimension(d).getEntities({ type: EVCIL_ID }), []) ?? []) {
        if (![...aktif.values()].some((a) => a.e === e)) safe(() => e.remove());
      }
    }
  }, 5);
});
