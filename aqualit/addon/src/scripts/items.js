// Aqualit Robotları — özel eşya bileşenleri, alet davranışları, cevher düşüşleri
import { world, system, ItemStack, BlockPermutation, GameMode } from "@minecraft/server";
import { radarMenu, hizMenu, otopilotMenu, tirmanMenu } from "./kesif_radar.js";
import { telefonAc } from "./org_ui.js";
import { H } from "./kayit.js";
import { spawnKesif } from "./kesif.js";
import { safe, rand, V, log, fire } from "./util.js";
import { spawnRobotFromItem, isCreative } from "./place.js";
import { ROBOT_ID, CHEST_ID } from "./constants.js";
import { getProp } from "./store.js";
import { getBot } from "./brain.js";
import { onKilicliHit } from "./kilicli.js";
import * as UI from "./ui/index.js";
import { placeStatueFromItem, statueInteract, healRobot, KIT_ID } from "./statue.js";
import { applyBook } from "./zirh.js";

const lastUse = new Map();
function debounce(player, ticks = 8) {
  const t = system.currentTick;
  const prev = lastUse.get(player.id) ?? -100;
  if (t - prev < ticks) return false;
  lastUse.set(player.id, t);
  return true;
}

function isPlayer(e) {
  return safe(() => e.typeId === "minecraft:player", false);
}

// ------------------------------------------------------------------ cihaz açma
export function useDevice(player, kind, opts = {}) {
  if (!debounce(player)) return;
  system.run(() => {
    try {
      switch (kind) {
        case "remote": return fire(() => UI.remoteFromAir(player));
        case "radio": return fire(() => UI.openRadio(player));
        case "tracker": return fire(() => UI.openTracker(player));
        case "rod": return player.isSneaking ? UI.rodComeHere(player) : fire(() => UI.openRod(player));
        case "zone": return fire(() => UI.zoneMenu(player));
        case "gear": return fire(() => UI.gearFromAir(player));
        case "donusum": return player.sendMessage("§7Dönüşüm Kiti'ni Keşif'e basılı tutarak kullan (binmişken de kullanabilirsin).");
        case "radar": return fire(() => radarMenu(player));
        case "hiz": return fire(() => hizMenu(player));
        case "otopilot": return fire(() => otopilotMenu(player));
        case "tirman": return fire(() => tirmanMenu(player));
        case "telefon": return fire(() => telefonAc(player));
      }
    } catch (e) {
      log("cihaz hatası", kind, e, e?.stack);
    }
  });
}

// Bileşenler kayit.js'te oyun açılırken kaydolur; burası yalnız işleyicileri H tablosuna koyar.
{
  const reg = { registerCustomComponent: (ad, o) => (H[ad] = o) };
  const ev = { itemComponentRegistry: reg, blockComponentRegistry: reg };
  reg.registerCustomComponent("aqualit:robot_item", {
    onUseOn(e, p) {
      const pl = e.source;
      if (!isPlayer(pl) || !debounce(pl, 10)) return;
      const block = e.block, face = e.blockFace, item = e.itemStack;
      if (p.params?.type === "kesif") return system.run(() => safe(() => spawnKesif(pl, block, face)));
      system.run(() => safe(() => spawnRobotFromItem(pl, block, face, p.params ?? {}, item), undefined));
    },
  });
  reg.registerCustomComponent("aqualit:device", {
    onUse(e, p) {
      useDevice(e.source, p.params?.kind);
    },
    onUseOn(e, p) {
      const kind = p.params?.kind;
      const pl = e.source;
      if (!isPlayer(pl)) return;
      if (kind === "zone") {
        if (!debounce(pl, 6)) return;
        const b = e.block;
        system.run(() => UI.zoneCorner(pl, 1, { x: b.x, y: b.y, z: b.z }));
        return;
      }
      useDevice(pl, kind);
    },
  });
  reg.registerCustomComponent("aqualit:statue_item", {
    onUseOn(e, p) {
      const pl = e.source;
      if (!isPlayer(pl) || !debounce(pl, 10)) return;
      const block = e.block, face = e.blockFace, item = e.itemStack;
      system.run(() => safe(() => placeStatueFromItem(pl, block, face, p.params ?? {}, item)));
    },
  });
  reg.registerCustomComponent("aqualit:buyu", {
    onUse(e, p) {
      const pl = e.source;
      if (!isPlayer(pl) || !debounce(pl, 10)) return;
      const key = p.params?.key;
      system.run(() => safe(() => applyBook(pl, key)));
    },
  });
  reg.registerCustomComponent("aqualit:repair_kit", {
    onUse(e) {
      const pl = e.source;
      if (!isPlayer(pl) || !debounce(pl, 10)) return;
      system.run(() => safe(() => pl.onScreenDisplay.setActionBar("§7Kapalı robota basılı tut: uyandırır. Çalışan robota dokun: onarır.")));
    },
  });
  ev.blockComponentRegistry.registerCustomComponent("aqualit:statue", {
    onPlayerInteract(e) {
      const pl = e.player;
      if (!pl || !debounce(pl, 5)) return;
      const block = e.block;
      system.run(() => safe(() => statueInteract(pl, block)));
    },
  });
  reg.registerCustomComponent("aqualit:tool", {
    onMineBlock(e, p) {
      const pl = e.source;
      if (!isPlayer(pl) || isCreative(pl)) return;
      system.run(() => damageHeld(pl, p.params?.kind === "sword" ? 2 : 1));
    },
    onUseOn(e, p) {
      const pl = e.source;
      if (!isPlayer(pl)) return;
      const kind = p.params?.kind;
      const block = e.block;
      system.run(() => toolUse(pl, kind, block, e.blockFace));
    },
  });
}

// ------------------------------------------------------------------ alet: dayanıklılık
function damageHeld(player, amount) {
  const eq = safe(() => player.getComponent("minecraft:equippable"));
  const it = safe(() => eq.getEquipment("Mainhand"));
  if (!it) return;
  const dur = safe(() => it.getComponent("minecraft:durability"));
  if (!dur) return;
  const unb = safe(() => it.getComponent("minecraft:enchantable")?.getEnchantment("unbreaking")?.level, 0) ?? 0;
  if (unb > 0 && Math.random() > 1 / (unb + 1)) return;
  const nd = dur.damage + amount;
  if (nd >= dur.maxDurability) {
    safe(() => eq.setEquipment("Mainhand", undefined));
    safe(() => player.playSound("random.break"));
    return;
  }
  dur.damage = nd;
  safe(() => eq.setEquipment("Mainhand", it));
}

const STRIP_OK = (t) => (t.endsWith("_log") || t.endsWith("_wood") || t.endsWith("_stem") || t.endsWith("_hyphae")
  || t === "minecraft:bamboo_block") && !t.includes("stripped");

function toolUse(player, kind, block, face) {
  if (!block) return;
  const t = block.typeId;
  const above = safe(() => block.above(1)?.typeId, "minecraft:air");
  let done = false;
  if (kind === "axe" && STRIP_OK(t)) {
    const nt = t.replace("minecraft:", "minecraft:stripped_");
    const axis = safe(() => block.permutation.getState("pillar_axis"), "y");
    done = !!safe(() => {
      block.setPermutation(BlockPermutation.resolve(nt, { pillar_axis: axis }));
      return true;
    }, false);
    if (done) safe(() => player.dimension.playSound("use.wood", block.location));
  } else if (kind === "shovel" && ["minecraft:grass_block", "minecraft:dirt", "minecraft:podzol", "minecraft:mycelium",
    "minecraft:coarse_dirt", "minecraft:dirt_with_roots"].includes(t) && above === "minecraft:air" && face !== "Down") {
    done = !!safe(() => {
      block.setType("minecraft:grass_path");
      return true;
    }, false);
    if (done) safe(() => player.dimension.playSound("step.grass", block.location));
  } else if (kind === "hoe" && ["minecraft:grass_block", "minecraft:dirt", "minecraft:grass_path", "minecraft:coarse_dirt",
    "minecraft:dirt_with_roots"].includes(t) && above === "minecraft:air" && face !== "Down") {
    done = !!safe(() => {
      if (t === "minecraft:coarse_dirt" || t === "minecraft:dirt_with_roots") block.setType("minecraft:dirt");
      else block.setType("minecraft:farmland");
      return true;
    }, false);
    if (done) safe(() => player.dimension.playSound("use.gravel", block.location));
  }
  if (done && !isCreative(player)) damageHeld(player, 1);
}

// ------------------------------------------------------------------ cevher: oyuncu kırınca
const AQ_ORES = new Set(["aqualit:aqualit_ore", "aqualit:deepslate_aqualit_ore"]);
const GOOD_PICKS = new Set(["minecraft:iron_pickaxe", "minecraft:diamond_pickaxe", "minecraft:netherite_pickaxe",
  "aqualit:aqualit_pickaxe"]);

function canHarvest(item) {
  if (!item) return false;
  if (GOOD_PICKS.has(item.typeId)) return true;
  return safe(() => item.hasTag("minecraft:is_pickaxe") && (item.hasTag("minecraft:iron_tier")
    || item.hasTag("minecraft:diamond_tier") || item.hasTag("minecraft:netherite_tier")), false);
}

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const t = ev.brokenBlockPermutation.type.id;
  if (!AQ_ORES.has(t)) return;
  const player = ev.player;
  if (isCreative(player)) return;
  const item = ev.itemStackBeforeBreak;
  if (!canHarvest(item)) return;
  const ench = safe(() => item.getComponent("minecraft:enchantable"));
  const silk = safe(() => !!ench?.getEnchantment("silk_touch"), false);
  const fortune = safe(() => ench?.getEnchantment("fortune")?.level ?? 0, 0) ?? 0;
  const loc = { x: ev.block.x + 0.5, y: ev.block.y + 0.3, z: ev.block.z + 0.5 };
  const dim = ev.dimension;
  if (silk) {
    safe(() => dim.spawnItem(new ItemStack(t, 1), loc));
    return;
  }
  const mult = Math.max(1, Math.floor(Math.random() * (fortune + 2)));
  safe(() => dim.spawnItem(new ItemStack("aqualit:raw_aqualit", mult), loc));
  const orbs = rand(2, 4);
  for (let i = 0; i < orbs; i++) safe(() => dim.spawnEntity("minecraft:xp_orb", loc));
});

// ------------------------------------------------------------------ varlık etkileşimi
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const target = ev.target;
  const tid = safe(() => target.typeId);
  if (tid !== ROBOT_ID && tid !== CHEST_ID) return;
  const player = ev.player;
  const itemId = ev.itemStack?.typeId ?? "";
  if (tid === CHEST_ID) {
    if (player.isSneaking && !itemId) {
      ev.cancel = true;
      system.run(() => fire(() => UI.chestMenu(player, target)));
    }
    return;
  }
  // robot
  const devices = {
    "aqualit:task_remote": "remote", "aqualit:robot_radio": "radio", "aqualit:robot_tracker": "tracker",
    "aqualit:command_rod": "rod", "aqualit:tuning_gear": "gear", [KIT_ID]: "kit",
  };
  const kind = devices[itemId];
  if (!kind) return;
  ev.cancel = true;
  if (!debounce(player)) return;
  system.run(() => {
    const owner = getProp(target, "aq:owner", "");
    const bot = getBot(target);
    if (!bot) return;
    if (owner && owner !== player.id && kind !== "tracker") {
      player.sendMessage(`§cBu robot ${getProp(target, "aq:ownerName", "başka bir oyuncu")}'ya ait.`);
      return;
    }
    switch (kind) {
      case "remote": return fire(() => UI.robotMenu(player, bot));
      case "radio": return fire(() => UI.radioRobot(player, bot));
      case "tracker": return fire(() => UI.startWatch(player, bot));
      case "rod": return fire(() => UI.rodRobot(player, bot));
      case "gear": return bot.type === "kilicli" ? fire(() => UI.gearForm(player, bot)) : player.sendMessage("§cAyar dişlisi yalnızca kılıçlı robotlarda çalışır.");
      case "kit": return healRobot(player, bot);
    }
  });
});

// sandık kapağı animasyonu
world.afterEvents.entityContainerOpened?.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) === CHEST_ID) safe(() => ev.entity.setProperty("aqualit:open", true));
});
world.afterEvents.entityContainerClosed?.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) === CHEST_ID) safe(() => ev.entity.setProperty("aqualit:open", false));
});

// kılıçlı vuruş animasyonu
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const d = ev.damagingEntity;
  if (safe(() => d.typeId) !== ROBOT_ID) return;
  const b = getBot(d);
  if (b && b.type === "kilicli") onKilicliHit(b);
});

// bölge seçici: basılı tutunca 2. köşe, blok kırılmasın
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  if (ev.itemStack?.typeId === "aqualit:zone_selector") ev.cancel = true;
});
world.afterEvents.playerStartBreakingBlock.subscribe((ev) => {
  if (ev.heldItemStack?.typeId !== "aqualit:zone_selector") return;
  const b = ev.block;
  const p = ev.player;
  if (!debounce(p, 6)) return;
  system.run(() => UI.zoneCorner(p, 2, { x: b.x, y: b.y, z: b.z }));
});

// canlı izlemeden çıkış: eğil
world.afterEvents.entityStartSneaking?.subscribe((ev) => {
  if (isPlayer(ev.entity)) UI.stopWatch(ev.entity, true);
});
