// Aqualit Robotları — Kapalı Robot (heykel bloğu), pozlar, Aqualit Tamir Kiti
import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { ROBOT_ID, TYPE_NAME } from "./constants.js";
import { getBot, bots } from "./brain.js";
import { createRobot, giveItem, isCreative, consumeHand } from "./place.js";
import { Robots, getProp, setProp } from "./store.js";
import { sendMessage } from "./messages.js";
import { V, safe, fmtPos, log } from "./util.js";
import { isPassableType } from "./blocks.js";

export const STATUE_ID = "aqualit:kapali_robot";
export const KIT_ID = "aqualit:tamir_kiti";
export const POSES = ["ayakta", "oturuyor", "el_salliyor", "kosuyor", "zafer", "dusunuyor"];
const POSE_NAMES = { ayakta: "Ayakta", oturuyor: "Oturuyor", el_salliyor: "El sallıyor", kosuyor: "Koşuyor",
  zafer: "Zafer", dusunuyor: "Düşünüyor" };
const KEYS = ["aq:rid", "aq:name", "aq:owner", "aq:ownerName", "aq:type", "aq:model", "aq:chest", "aq:home",
  "aq:homeDim", "aq:stats", "aq:task", "aq:maxd"];
const REPAIR_TICKS = 30;

export function variantOf(type, model) {
  return type === "kilicli" ? `kilicli_${Math.min(5, Math.max(1, model || 1))}` : type;
}
export function parseVariant(v) {
  if (String(v).startsWith("kilicli_")) return { type: "kilicli", model: Number(v.split("_")[1]) || 1 };
  return { type: v || "madenci", model: 1 };
}
/** Yaw'dan blok yönü (heykelin önü bu yöne bakar). */
function dirOfYaw(yaw) {
  const i = ((Math.round(yaw / 90) % 4) + 4) % 4;
  return ["south", "west", "north", "east"][i];
}

function statueName(data) {
  const { type, model } = parseVariant(data.variant ?? variantOf(data["aq:type"], data["aq:model"]));
  return data["aq:name"] || (type === "kilicli" ? `Kılıçlı (Seviye ${model})` : `${TYPE_NAME[type]} robot`);
}

function blockData(block) {
  const dp = safe(() => block.getComponent("minecraft:dynamic_properties"));
  const out = {};
  for (const k of KEYS) {
    const v = safe(() => dp?.get(k));
    if (v !== undefined) out[k] = v;
  }
  out.variant = safe(() => block.permutation.getState("aqualit:tur"), "madenci");
  out.pose = safe(() => block.permutation.getState("aqualit:poz"), "ayakta");
  return out;
}

function writeBlockData(block, data) {
  const dp = safe(() => block.getComponent("minecraft:dynamic_properties"));
  if (!dp) return;
  for (const k of KEYS) if (data[k] !== undefined) safe(() => dp.set(k, data[k]));
}

function itemFromData(data) {
  const v = data.variant ?? variantOf(data["aq:type"], data["aq:model"]);
  const it = new ItemStack(`aqualit:kapali_${v}`, 1);
  for (const k of KEYS) if (data[k] !== undefined) safe(() => it.setDynamicProperty(k, data[k]));
  if (data.pose) safe(() => it.setDynamicProperty("aq:pose", data.pose));
  if (data["aq:name"]) it.nameTag = `§7${data["aq:name"]} §8(kapalı)`;
  safe(() => it.setLore(["§7Kapalı robot heykeli", "§7Tamir Kiti ile basılı tut: uyanır"]));
  return it;
}

// ------------------------------------------------------------------ robot -> heykel
export function robotToStatue(bot) {
  const e = bot.e;
  const dim = e.dimension;
  const loc = e.location;
  let pos = V.floor({ x: loc.x, y: loc.y + 0.3, z: loc.z });
  for (let i = 0; i < 3; i++) {
    const t = safe(() => dim.getBlock(pos)?.typeId, "minecraft:air");
    if (t === "minecraft:air" || (isPassableType(t) && !t.includes("water"))) break;
    pos = { x: pos.x, y: pos.y + 1, z: pos.z };
  }
  const variant = variantOf(bot.type, bot.model);
  const yaw = safe(() => e.getRotation().y, 0);
  const data = {
    "aq:rid": bot.rid, "aq:name": bot.name, "aq:owner": bot.owner, "aq:ownerName": bot.ownerName,
    "aq:type": bot.type, "aq:model": bot.model, "aq:chest": bot.chestId || undefined, "aq:home": bot.home,
    "aq:homeDim": bot.homeDim, "aq:stats": getProp(e, "aq:stats", undefined), "aq:task": getProp(e, "aq:task", undefined),
    "aq:maxd": bot.maxDist, variant,
  };
  // çantasındakiler yere dökülür
  const inv = bot.inv;
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it) safe(() => dim.spawnItem(it, { x: loc.x, y: loc.y + 0.5, z: loc.z }));
      inv.setItem(i, undefined);
    }
  }
  bots.delete(e.id);
  safe(() => e.remove());
  const ok = safe(() => {
    dim.setBlockPermutation(pos, BlockPermutation.resolve(STATUE_ID, {
      "aqualit:tur": variant, "aqualit:poz": "ayakta", "minecraft:cardinal_direction": dirOfYaw(yaw),
    }));
    return true;
  }, false);
  if (ok) {
    writeBlockData(dim.getBlock(pos), data);
  } else {
    safe(() => dim.spawnItem(itemFromData(data), loc));
  }
  safe(() => dim.playSound("aqualit.robot.death", loc, { volume: 1.0 }));
  safe(() => dim.playSound("random.anvil_land", loc, { volume: 0.35, pitch: 1.6 }));
  safe(() => dim.spawnParticle("minecraft:large_explosion", V.mid(pos)));
  if (bot.owner) {
    Robots.upsert(bot.owner, { rid: bot.rid, eid: "", status: "Kapalı (heykel)", pos, dim: dim.id, upd: Date.now() });
    sendMessage(bot.owner, bot.entry, `Canım bitti, kapandım (${fmtPos(pos)}). Aqualit Tamir Kiti ile bana basılı tutarsan uyanırım.`);
  }
}

// ölümcül hasarı yakala: robot ölmez, heykele dönüşür
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (safe(() => e.typeId) !== ROBOT_ID) return;
  const hp = safe(() => e.getComponent("minecraft:health")?.currentValue, 0) ?? 0;
  if (ev.damage >= hp) {
    ev.cancel = true;
    const id = e.id;
    system.run(() => {
      const ent = safe(() => world.getEntity(id));
      const b = ent ? getBot(ent) : undefined;
      if (b && b.valid) robotToStatue(b);
    });
  }
});

// yedek: yine de ölürse (komut, boşluk) heykel eşyası bırak
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (safe(() => e.typeId) !== ROBOT_ID) return;
  const data = {};
  for (const k of KEYS) {
    const v = getProp(e, k, undefined);
    if (v !== undefined) data[k] = v;
  }
  if (!data["aq:type"]) return;
  data.variant = variantOf(data["aq:type"], data["aq:model"]);
  const loc = safe(() => e.location);
  const dim = safe(() => e.dimension);
  if (!loc || !dim) return;
  system.run(() => safe(() => dim.spawnItem(itemFromData(data), loc)));
  if (data["aq:owner"]) {
    sendMessage(data["aq:owner"], { rid: data["aq:rid"], name: data["aq:name"], type: data["aq:type"] },
      "Kapandım ve heykel eşyası olarak yere düştüm. Beni yere koyup Tamir Kiti ile onarabilirsin.");
  }
});

// ------------------------------------------------------------------ heykel eşyası -> blok
const FACE = {
  Up: { x: 0, y: 1, z: 0 }, Down: { x: 0, y: -1, z: 0 }, North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 }, East: { x: 1, y: 0, z: 0 }, West: { x: -1, y: 0, z: 0 },
};

export function placeStatueFromItem(player, block, face, params, itemStack) {
  const dim = player.dimension;
  const pos = V.add({ x: block.x, y: block.y, z: block.z }, FACE[face] ?? FACE.Up);
  const t = safe(() => dim.getBlock(pos)?.typeId, null);
  if (!t || !(t === "minecraft:air" || isPassableType(t))) {
    player.sendMessage("§cHeykeli buraya koyamazsın, yer dolu.");
    return;
  }
  const data = {};
  for (const k of KEYS) {
    const v = safe(() => itemStack?.getDynamicProperty(k));
    if (v !== undefined) data[k] = v;
  }
  const variant = params.variant ?? "madenci";
  const { type, model } = parseVariant(variant);
  data["aq:type"] = data["aq:type"] ?? type;
  data["aq:model"] = data["aq:model"] ?? model;
  if (!data["aq:owner"]) {
    data["aq:owner"] = player.id;
    data["aq:ownerName"] = player.name;
  }
  const pose = safe(() => itemStack?.getDynamicProperty("aq:pose"), "ayakta") ?? "ayakta";
  const yaw = safe(() => player.getRotation().y, 0) + 180;
  const ok = safe(() => {
    dim.setBlockPermutation(pos, BlockPermutation.resolve(STATUE_ID, {
      "aqualit:tur": variant, "aqualit:poz": POSES.includes(pose) ? pose : "ayakta",
      "minecraft:cardinal_direction": dirOfYaw(yaw),
    }));
    return true;
  }, false);
  if (!ok) return;
  writeBlockData(dim.getBlock(pos), data);
  consumeHand(player);
  safe(() => dim.playSound("random.anvil_land", pos, { volume: 0.3, pitch: 1.8 }));
  if (data["aq:rid"] && data["aq:owner"]) {
    Robots.upsert(data["aq:owner"], { rid: data["aq:rid"], status: "Kapalı (heykel)", pos, dim: dim.id, upd: Date.now() });
  }
}

// ------------------------------------------------------------------ heykel kırılınca eşya ver
const pendingBreak = new Map();
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  if (ev.block.typeId !== STATUE_ID) return;
  if (ev.itemStack?.typeId === KIT_ID) {
    ev.cancel = true; // kitle basılı tutmak = onarım, kırma değil
    return;
  }
  pendingBreak.set(`${ev.dimension.id}|${ev.block.x},${ev.block.y},${ev.block.z}`, blockData(ev.block));
});
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  if (ev.brokenBlockPermutation.type.id !== STATUE_ID) return;
  const k = `${ev.dimension.id}|${ev.block.x},${ev.block.y},${ev.block.z}`;
  const data = pendingBreak.get(k) ?? { variant: safe(() => ev.brokenBlockPermutation.getState("aqualit:tur"), "madenci") };
  pendingBreak.delete(k);
  giveItem(ev.player, itemFromData(data));
  if (data["aq:rid"] && data["aq:owner"]) {
    Robots.upsert(data["aq:owner"], { rid: data["aq:rid"], status: "Kapalı (çantada)", upd: Date.now() });
  }
});

// ------------------------------------------------------------------ poz değiştir (boş el)
export function statueInteract(player, block) {
  const held = safe(() => player.getComponent("minecraft:equippable")?.getEquipment("Mainhand"));
  if (held?.typeId === KIT_ID) {
    safe(() => player.onScreenDisplay.setActionBar("§eOnarmak için kitle robota §lbasılı tut§r§e."));
    return;
  }
  if (held) return;
  const cur = safe(() => block.permutation.getState("aqualit:poz"), "ayakta");
  const next = POSES[(POSES.indexOf(cur) + 1) % POSES.length];
  safe(() => block.setPermutation(block.permutation.withState("aqualit:poz", next)));
  safe(() => player.dimension.playSound("random.click", block.location, { pitch: 1.4, volume: 0.5 }));
  safe(() => player.onScreenDisplay.setActionBar(`§7Poz: §f${POSE_NAMES[next]}`));
}

// ------------------------------------------------------------------ tamir kiti
const repairing = new Map(); // oyuncu kimliği -> {pos, dimId, t, run}

function lookingAt(player, pos) {
  const hit = safe(() => player.getBlockFromViewDirection({ maxDistance: 7 }));
  const b = hit?.block;
  return !!b && b.x === pos.x && b.y === pos.y && b.z === pos.z;
}

function holdingKit(player) {
  return safe(() => player.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId) === KIT_ID;
}

export function startRepair(player, block) {
  cancelRepair(player, false);
  const pos = { x: block.x, y: block.y, z: block.z };
  const st = { pos, dimId: player.dimension.id, t: 0 };
  st.run = system.runInterval(() => {
    if (!safe(() => player.isValid, false) || !holdingKit(player) || !lookingAt(player, pos)) {
      cancelRepair(player, true);
      return;
    }
    const b = safe(() => player.dimension.getBlock(pos));
    if (!b || b.typeId !== STATUE_ID) {
      cancelRepair(player, false);
      return;
    }
    st.t += 2;
    const n = Math.min(10, Math.round((st.t / REPAIR_TICKS) * 10));
    safe(() => player.onScreenDisplay.setActionBar(`§sOnarılıyor §a${"▮".repeat(n)}§8${"▮".repeat(10 - n)}`));
    safe(() => player.dimension.spawnParticle("minecraft:villager_happy", { x: pos.x + Math.random(), y: pos.y + 0.4 + Math.random(), z: pos.z + Math.random() }));
    if (st.t % 6 === 0) safe(() => player.dimension.playSound("random.anvil_use", pos, { volume: 0.25, pitch: 1.6 + st.t / 60 }));
    if (st.t >= REPAIR_TICKS) {
      cancelRepair(player, false);
      revive(player, b);
    }
  }, 2);
  repairing.set(player.id, st);
}

export function cancelRepair(player, notify) {
  const st = repairing.get(player.id);
  if (!st) return;
  system.clearRun(st.run);
  repairing.delete(player.id);
  if (notify) safe(() => player.onScreenDisplay.setActionBar("§7Onarım yarıda kaldı."));
}

/** Kitin bir hakkını harca (5 kullanımlık; dayanıklılık çubuğu kalan hakkı gösterir). */
export function useKitCharge(player) {
  if (isCreative(player)) return;
  const eq = safe(() => player.getComponent("minecraft:equippable"));
  const it = safe(() => eq.getEquipment("Mainhand"));
  if (!it || it.typeId !== KIT_ID) return;
  const dur = safe(() => it.getComponent("minecraft:durability"));
  if (!dur) {
    consumeHand(player);
    return;
  }
  const nd = dur.damage + 1;
  if (nd >= dur.maxDurability) {
    safe(() => eq.setEquipment("Mainhand", undefined));
    safe(() => player.playSound("random.break"));
    player.sendMessage("§7Tamir kitinin son hakkı da bitti.");
    return;
  }
  dur.damage = nd;
  safe(() => eq.setEquipment("Mainhand", it));
  safe(() => player.onScreenDisplay.setActionBar(`§7Tamir kitinde §f${dur.maxDurability - nd}§7 hak kaldı.`));
}

/** Kılıçlı robot, sahibinin kapanmış robotunu kendi tamir kitiyle uyandırır. */
export function reviveByRobot(owner, block, byName) {
  return revive(owner, block, { kit: false, by: byName });
}

/** Bu heykel blok bu sahibin mi? */
export function statueOwner(block) {
  return blockData(block)["aq:owner"];
}

function revive(player, block, opts = {}) {
  const data = blockData(block);
  const owner = data["aq:owner"];
  if (owner && owner !== player.id) {
    player.sendMessage(`§cBu robot ${data["aq:ownerName"] ?? "başka bir oyuncu"}'ya ait; yalnızca sahibi uyandırabilir.`);
    return;
  }
  const { type, model } = parseVariant(data.variant);
  const pos = { x: block.x, y: block.y, z: block.z };
  const dim = block.dimension;
  safe(() => dim.setBlockType(pos, "minecraft:air"));
  const rdata = {
    type: data["aq:type"] ?? type, model: data["aq:model"] ?? model, rid: data["aq:rid"], name: data["aq:name"],
    chest: data["aq:chest"], stats: data["aq:stats"], task: data["aq:task"], home: data["aq:home"],
    homeDim: data["aq:homeDim"], maxd: data["aq:maxd"],
  };
  const { name } = createRobot(player, dim, pos, rdata, { makeChest: false });
  if (opts.kit !== false) useKitCharge(player);
  safe(() => dim.playSound("random.levelup", pos, { volume: 0.6, pitch: 1.4 }));
  player.sendMessage(opts.by ? `§s${name}§r uyandı! ${opts.by} onu tamir kitiyle onardı.` : `§s${name}§r uyandı! Canı tamamen doldu.`);
  return true;
}

/** Kılıçlı sağlamken elindeki tamir kitini ona ver: kitin kalan hakları robotun çantasına geçer. */
export function giveHeldKit(player, bot) {
  const eq = safe(() => player.getComponent("minecraft:equippable"));
  const it = safe(() => eq.getEquipment("Mainhand"));
  if (!it || it.typeId !== KIT_ID) return;
  const dur = safe(() => it.getComponent("minecraft:durability"));
  const charges = dur ? Math.max(1, dur.maxDurability - dur.damage) : 5;
  if (!isCreative(player)) safe(() => eq.setEquipment("Mainhand", undefined));
  const total = addKitCharges(bot, charges);
  safe(() => bot.dim.playSound("random.pop", bot.loc, { volume: 0.6, pitch: 1.3 }));
  bot.beep?.();
  player.sendMessage(`§s${bot.name}§r tamir kitini çantasına koydu. §7Toplam ${total} onarım hakkı var.`);
}

/** Robotun çantasındaki tamir hakları. */
export function kitCharges(bot) {
  return Number(getProp(bot.e, "aq:kits", 0)) || 0;
}
export function addKitCharges(bot, n) {
  const v = Math.max(0, kitCharges(bot) + n);
  setProp(bot.e, "aq:kits", v);
  return v;
}

/** Çalışan robotu kitle iyileştir. */
export function healRobot(player, bot) {
  const h = safe(() => bot.e.getComponent("minecraft:health"));
  if (!h) return;
  if (h.currentValue >= h.effectiveMax - 0.5) {
    if (bot.type === "kilicli") return giveHeldKit(player, bot);
    player.sendMessage(`§7${bot.name} zaten sağlam.`);
    return;
  }
  safe(() => h.resetToMaxValue());
  useKitCharge(player);
  safe(() => bot.dim.playSound("random.anvil_use", bot.loc, { volume: 0.4, pitch: 1.6 }));
  player.sendMessage(`§s${bot.name}§r onarıldı.`);
}

world.afterEvents.playerStartBreakingBlock.subscribe((ev) => {
  if (ev.heldItemStack?.typeId !== KIT_ID) return;
  if (ev.block.typeId !== STATUE_ID) return;
  const p = ev.player, b = ev.block;
  system.run(() => startRepair(p, b));
});
world.afterEvents.playerCancelBreakingBlock?.subscribe((ev) => {
  if (ev.heldItemStack?.typeId === KIT_ID) cancelRepair(ev.player, true);
});
