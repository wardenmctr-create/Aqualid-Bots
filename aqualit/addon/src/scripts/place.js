// Aqualit Robotları — robot çağırma, sandık yerleştirme, robotu toplama
import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { V, DIRS4, yawOf, safe, log } from "./util.js";
import { ROBOT_ID, CHEST_ID, TYPE_NAME, CHEST_ITEM, CHEST_NAME, robotItemId, MAX_ROBOTS_PER_PLAYER } from "./constants.js";
import { Robots, Chests, getProp, setProp, getJSON, setJSON } from "./store.js";
import { getBot, bots } from "./brain.js";
import { isPassableType, isSupportType } from "./blocks.js";
import { placeChestBlock, pickupUnit, setPlacedHook, Sandik, CHEST_BLOCK, standSpot } from "./sandik.js";
import { defaultStats } from "./kilicli.js";

const FACE = {
  Up: { x: 0, y: 1, z: 0 }, Down: { x: 0, y: -1, z: 0 }, North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 }, East: { x: 1, y: 0, z: 0 }, West: { x: -1, y: 0, z: 0 },
};

export function isCreative(p) {
  return safe(() => p.getGameMode() === GameMode.Creative, false);
}

/** Oyuncunun elindeki eşyadan 1 azalt (yaratıcı modda dokunma). */
export function consumeHand(player) {
  if (isCreative(player)) return;
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (!inv) return;
  const slot = player.selectedSlotIndex;
  const it = inv.getItem(slot);
  if (!it) return;
  if (it.amount <= 1) inv.setItem(slot, undefined);
  else {
    it.amount -= 1;
    inv.setItem(slot, it);
  }
}

export function giveItem(player, stack) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  const rest = inv ? safe(() => inv.addItem(stack), stack) : stack;
  if (rest) safe(() => player.dimension.spawnItem(rest, player.location));
}

export function hasItem(player, id) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === id) return true;
  return false;
}

function cellFree(dim, p) {
  const t = safe(() => dim.getBlock(p)?.typeId, null);
  if (!t || !isPassableType(t)) return false;
  const ents = safe(() => dim.getEntitiesAtBlockLocation(p), []);
  return !ents.some((e) => e.typeId === CHEST_ID || e.typeId === ROBOT_ID);
}

/** Sandık için: boş, altı sağlam ve yanında başka sandık yok (birleşmesin). */
function chestSpotFree(dim, p) {
  if (!standFree(dim, p)) return false;
  for (const d of DIRS4) {
    if (safe(() => dim.getBlock(V.add(p, d))?.typeId) === CHEST_BLOCK) return false;
  }
  return true;
}

function standFree(dim, p) {
  if (!cellFree(dim, p)) return false;
  const below = safe(() => dim.getBlock({ x: p.x, y: p.y - 1, z: p.z })?.typeId, null);
  return !!below && isSupportType(below);
}

// ------------------------------------------------------------------ sandık
/** Robotun yanına Aqualit sandığı (gerçek sandık bloğu) koyar; önü oyuncuya bakar. Tutamaç döndürür. */
export function spawnChest(player, pos, kind, opts = {}) {
  const dim = opts.dim ?? player.dimension;
  const h = placeChestBlock(dim, pos, kind, { id: player.id, name: player.name }, player.location, { name: opts.name ?? "" });
  if (h) safe(() => dim.playSound("random.chestclosed", h.location));
  return h;
}

/** Yeni konan sandığı, sandığı olmayan aynı türdeki robotlara bağla (sandık eşyası oyunun kendisiyle konur). */
function linkNewChest(h, player) {
  const kind = h.getProperty("aqualit:kind");
  if (kind === "genel") return;
  let linked = 0;
  for (const b of bots.values()) {
    if (b.owner !== player.id || b.type !== kind) continue;
    if (b.homeChest()) continue;
    linkRobotToChest(b, h);
    linked++;
  }
  if (linked) player.sendMessage(`§s${CHEST_NAME[kind]}§r ${linked} robota bağlandı.`);
}
setPlacedHook(linkNewChest);

export function linkRobotToChest(b, ch) {
  b.chestId = ch.id;
  setProp(b.e, "aq:chest", ch.id);
  // yeni sandık bir blok: robot sandığın önündeki boş hücreyi ev bilir
  const at = ch instanceof Sandik ? standSpot(ch) : ch.location;
  const home = { x: at.x, y: at.y, z: at.z };
  b.home = home;
  b.homeDim = ch.dimension.id;
  setProp(b.e, "aq:home", home);
  setProp(b.e, "aq:homeDim", ch.dimension.id);
  b.resetTrail();
  b.updateIndex(true);
}

// ------------------------------------------------------------------ robot
/** Eşyada (ya da heykelde) saklanan robot bilgisi. */
export function readItemData(itemStack) {
  const g = (k) => safe(() => itemStack?.getDynamicProperty(k));
  return { rid: g("aq:rid"), name: g("aq:name"), chest: g("aq:chest"), stats: g("aq:stats"), task: g("aq:task"),
    home: g("aq:home"), homeDim: g("aq:homeDim"), maxd: g("aq:maxd"), owner: g("aq:owner"), ownerName: g("aq:ownerName"),
    type: g("aq:type"), model: g("aq:model"), pose: g("aq:pose") };
}

/** Robot varlığını oluşturur ve kurar. data: {type, model, rid?, name?, chest?, stats?, task?, home?, homeDim?, maxd?} */
export function createRobot(player, dim, pos, data, opts = {}) {
  const type = data.type ?? "madenci";
  const model = data.model ?? 1;
  const yaw = yawOf(player.location.x - (pos.x + 0.5), player.location.z - (pos.z + 0.5));
  const e = dim.spawnEntity(ROBOT_ID, { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 }, { initialRotation: yaw });
  safe(() => e.setProperty("aqualit:type", type));
  safe(() => e.setProperty("aqualit:model", model));
  const rid = data.rid || `R${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
  const name = data.name || `${TYPE_NAME[type]}-${Robots.nextNumber(player.id, type)}`;
  setProp(e, "aq:owner", player.id);
  setProp(e, "aq:ownerName", player.name);
  setProp(e, "aq:rid", rid);
  setProp(e, "aq:name", name);
  setProp(e, "aq:type", type);
  setProp(e, "aq:model", model);
  setProp(e, "aq:maxd", typeof data.maxd === "number" ? data.maxd : 64);
  const home = data.home && data.chest ? data.home : { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 };
  setProp(e, "aq:home", home);
  setProp(e, "aq:homeDim", data.home && data.chest ? data.homeDim ?? dim.id : dim.id);
  if (data.chest) setProp(e, "aq:chest", data.chest);
  if (type === "kilicli") {
    const st = data.stats ? safe(() => JSON.parse(data.stats)) : null;
    setJSON(e, "aq:stats", st && st.model === model ? st : defaultStats(model));
  }
  if (data.task) setProp(e, "aq:task", data.task);
  e.nameTag = name;
  safe(() => e.getComponent("minecraft:tameable")?.tame(player));
  safe(() => e.triggerEvent(type === "kilicli" ? "aqualit:as_kilicli" : "aqualit:as_worker"));

  // sandık: kayıtlı sandık yoksa yanına yeni sandık koy
  let chest;
  if (type !== "kilicli" && !data.chest && opts.makeChest !== false) {
    const away = V.sub(pos, V.floor(player.location));
    const order = DIRS4.slice().sort((a, b) => (b.x * away.x + b.z * away.z) - (a.x * away.x + a.z * away.z));
    let cpos = null;
    for (const d of order) {
      const c = V.add(pos, d);
      if (chestSpotFree(dim, c)) {
        cpos = c;
        break;
      }
    }
    if (cpos) chest = spawnChest(player, cpos, type, { name: "" });
    if (!chest) {
      giveItem(player, new ItemStack(CHEST_ITEM[type], 1));
      player.sendMessage(`§eSandığı koyacak yer yoktu; §s${CHEST_NAME[type]}§e envanterine verildi.`);
    }
  }
  system.runTimeout(() => {
    const b = getBot(e);
    if (!b) return;
    b.reload();
    if (chest) linkRobotToChest(b, chest);
    b.holdTool();
    b.setAct("boot");
    safe(() => e.dimension.playSound("beacon.activate", e.location, { pitch: 1.8, volume: 0.6 }));
    system.runTimeout(() => b.setAct("none"), 30);
    b.updateIndex(true);
    if (type !== "kilicli" && b.task && !b.task.done) {
      // yarım kalmış görev: robot uyanınca beklesin, sahibi sürdürsün
      b.task.paused = true;
      b.saveTask();
    }
  }, 2);
  return { e, name, rid };
}

export function spawnRobotFromItem(player, block, face, params, itemStack) {
  const dim = player.dimension;
  const off = FACE[face] ?? FACE.Up;
  const pos = V.add({ x: block.x, y: block.y, z: block.z }, off);
  if (!cellFree(dim, pos)) {
    player.sendMessage("§cRobotu buraya koyamazsın, yer dolu.");
    return;
  }
  if (Robots.list(player.id).length >= MAX_ROBOTS_PER_PLAYER) {
    player.sendMessage(`§cEn fazla ${MAX_ROBOTS_PER_PLAYER} robotun olabilir.`);
    return;
  }
  const data = readItemData(itemStack);
  data.type = params.type ?? "madenci";
  data.model = params.model ?? 1;
  const { name } = createRobot(player, dim, pos, data);
  consumeHand(player);
  if (!hasItem(player, "aqualit:task_remote")) {
    giveItem(player, new ItemStack("aqualit:task_remote", 1));
    player.sendMessage("§sGörev Kumandası§r envanterine eklendi.");
  }
  const tip = data.type === "kilicli"
    ? "Seni takip edip koruyacak. Komut Çubuğu ile mod seçebilirsin."
    : "Görev Kumandası ile ona dokunup görev ver.";
  player.sendMessage(`§s${name}§r hazır! ${tip}`);
}

/** Robotu eşyaya çevir; envanteri sandığına ya da oyuncuya verir. */
export function pickupRobot(player, b) {
  const e = b.e;
  const inv = b.inv;
  const chestC = safe(() => b.homeChest()?.getComponent("minecraft:inventory")?.container);
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (!it) continue;
      let rest = chestC ? safe(() => chestC.addItem(it), it) : it;
      if (rest) giveItem(player, rest);
      inv.setItem(i, undefined);
    }
  }
  const item = new ItemStack(robotItemId(b.type, b.model), 1);
  safe(() => item.setDynamicProperty("aq:rid", b.rid));
  safe(() => item.setDynamicProperty("aq:name", b.name));
  if (b.chestId) safe(() => item.setDynamicProperty("aq:chest", b.chestId));
  const st = getProp(e, "aq:stats", undefined);
  if (st) safe(() => item.setDynamicProperty("aq:stats", st));
  item.nameTag = `§s${b.name}`;
  safe(() => item.setLore([`§7${TYPE_NAME[b.type]} robot`, "§7Yere koyunca uyanır"]));
  giveItem(player, item);
  Robots.upsert(b.owner, { rid: b.rid, eid: "", status: "Eşya olarak çantada", pos: V.floor(player.location),
    dim: player.dimension.id, upd: Date.now() });
  bots.delete(e.id);
  safe(() => e.remove());
}

/** Sandığı kaldır: içindekileri oyuncuya ver, sandık eşyasını geri ver. */
export function pickupChest(player, ch) {
  if (ch instanceof Sandik) return pickupUnit(player, ch.id);
  const c = safe(() => ch.getComponent("minecraft:inventory")?.container);
  if (c) {
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it) giveItem(player, it);
      c.setItem(i, undefined);
    }
  }
  const kind = safe(() => ch.getProperty("aqualit:kind"), "genel");
  giveItem(player, new ItemStack(CHEST_ITEM[kind] ?? CHEST_ITEM.genel, 1));
  Chests.remove(player.id, getProp(ch, "aq:cid", ""));
  safe(() => ch.remove());
}
