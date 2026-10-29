// Aqualit Robotları — sahte dünyada uçtan uca deneme
// Kullanım: node sim.mjs [senaryo]
import * as MC from "./node_modules/@minecraft/server/index.js";
import * as UI from "./node_modules/@minecraft/server-ui/index.js";

const { world, system, ItemStack, BlockPermutation } = MC;

// ---------------------------------------------------------------- arazi
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}
const GROUND = 64;
function terrain(x, y, z) {
  if (y <= -63) return "minecraft:bedrock";
  if (y > GROUND) return "minecraft:air";
  if (y === GROUND) return "minecraft:grass_block";
  if (y > GROUND - 3) return "minecraft:dirt";
  const r = hash(x, y, z);
  if (y < 0) {
    if (r < 0.003) return "minecraft:deepslate_diamond_ore";
    if (r < 0.01) return "minecraft:deepslate_iron_ore";
    return "minecraft:deepslate";
  }
  if (r < 0.012) return "minecraft:iron_ore";
  if (r < 0.024) return "minecraft:coal_ore";
  if (r < 0.027) return "aqualit:aqualit_ore";
  if (y < 20 && r < 0.03) return "minecraft:lava";
  return "minecraft:stone";
}
const ow = MC.__makeDimension("overworld", terrain);
MC.__makeDimension("nether", () => "minecraft:netherrack");
MC.__makeDimension("the_end", () => "minecraft:air");
const set = (p, t, states) => ow.setBlockPermutation(p, BlockPermutation.resolve(t, states ?? {}));

// kum alanı, gölet, ağaçlar, taş makinesi, fırın
for (let x = 10; x <= 15; x++) for (let z = -2; z <= 3; z++) set({ x, y: GROUND, z }, "minecraft:sand");
for (let x = -14; x <= -12; x++) for (let z = 6; z <= 8; z++) set({ x, y: GROUND, z }, "minecraft:water", { liquid_depth: 0 });
function tree(x, z, h = 5) {
  for (let y = 1; y <= h; y++) set({ x, y: GROUND + y, z }, "minecraft:oak_log");
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = h - 1; dy <= h + 1; dy++) {
    const p = { x: x + dx, y: GROUND + dy, z: z + dz };
    if (ow._cell(p).type === "minecraft:air") set(p, "minecraft:oak_leaves");
  }
}
tree(8, -9); tree(12, -12, 6); tree(4, -14);
// taş makinesi: su | taş | lav
set({ x: -6, y: GROUND + 1, z: -6 }, "minecraft:water");
set({ x: -5, y: GROUND + 1, z: -6 }, "minecraft:cobblestone");
set({ x: -4, y: GROUND + 1, z: -6 }, "minecraft:lava");
set({ x: 3, y: GROUND + 1, z: 3 }, "minecraft:furnace");
// taş makinesi yeniden taş üretsin
system.runInterval(() => {
  const p = { x: -5, y: GROUND + 1, z: -6 };
  if (ow._cell(p).type === "minecraft:air" && Math.random() < 0.2) set(p, "minecraft:cobblestone");
}, 5);
// ekinler büyüsün
system.runInterval(() => {
  for (const [k, c] of ow.cells) {
    if (["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"].includes(c.type)) {
      if ((c.states.growth ?? 0) < 7 && Math.random() < 0.3) c.states.growth = (c.states.growth ?? 0) + 1;
    }
  }
}, 100);
// fırınlar erit (1 kömür = 8 eşya, gerçek oyundaki gibi)
const FV = { "minecraft:coal": 8, "minecraft:charcoal": 8, "minecraft:coal_block": 80, "minecraft:oak_planks": 1.5,
  "minecraft:oak_log": 1.5, "minecraft:stick": 0.5, "minecraft:blaze_rod": 12 };
system.runInterval(() => {
  const R = { "minecraft:raw_iron": "minecraft:iron_ingot", "minecraft:sand": "minecraft:glass", "aqualit:raw_aqualit": "aqualit:aqualit_ingot",
    "minecraft:raw_copper": "minecraft:copper_ingot", "minecraft:raw_gold": "minecraft:gold_ingot", "minecraft:clay_ball": "minecraft:brick" };
  for (const c of ow.furnaces.values()) {
    const inp = c.getItem(0);
    if (!inp || !R[inp.typeId]) continue;
    const out = c.getItem(2);
    if (out && (out.typeId !== R[inp.typeId] || out.amount >= 64)) continue;
    if (!(c._burn > 0.01)) {
      const fuel = c.getItem(1);
      if (!fuel || !FV[fuel.typeId]) continue;
      fuel.amount -= 1; c.setItem(1, fuel.amount > 0 ? fuel : undefined);
      c._burn = (c._burn > 0 ? c._burn : 0) + FV[fuel.typeId];
    }
    c._burn -= 1;
    inp.amount -= 1; c.setItem(0, inp.amount > 0 ? inp : undefined);
    c.setItem(2, out ? Object.assign(out, { amount: out.amount + 1 }) : new ItemStack(R[inp.typeId], 1));
  }
}, 40);

// ---------------------------------------------------------------- eklentiyi yükle
const player = MC.__makePlayer("Kral", ow, { x: 0.5, y: GROUND + 1, z: -3.5 });
const comps = { item: {}, block: {} };
await import("./scripts/main.js");
system.beforeEvents.startup.fire({
  itemComponentRegistry: { registerCustomComponent: (n, c) => (comps.item[n] = c) },
  blockComponentRegistry: { registerCustomComponent: (n, c) => (comps.block[n] = c) },
  customCommandRegistry: { registerCommand() {}, registerEnum() {} },
});
world.afterEvents.worldLoad.fire({});
const brain = await import("./scripts/brain.js");
const Kaynak = () => kaynakMod.Kaynak;
const kaynakMod = await import("./scripts/kaynak.js");
const store = await import("./scripts/store.js");

function ticks(n, until) {
  for (let i = 0; i < n; i++) {
    system.tick();
    if (until && i % 20 === 0 && until()) return i;
  }
  return n;
}
function give(id, n = 1, slot = 0) {
  player._inv.setItem(slot, new ItemStack(id, n));
  player.selectedSlotIndex = slot;
}
function useOn(itemId, block, face = "Up", params) {
  const item = player._inv.getItem(player.selectedSlotIndex) ?? new ItemStack(itemId, 1);
  const name = { "aqualit:robot_madenci": "aqualit:robot_item" }[itemId];
  const compName = Object.keys(comps.item).find((k) => k === (params?.comp ?? "aqualit:robot_item"));
  comps.item[compName].onUseOn({ source: player, block: ow.getBlock(block), blockFace: face, itemStack: item,
    usedOnBlockPermutation: ow.getBlock(block).permutation }, { params: params?.p ?? {} });
}
function myBots() {
  return [...brain.bots.values()].filter((b) => b.owner === player.id);
}
// sandığın bütün sayfaları (yeni Aqualit sandığı) ya da eski varlık sandığı
const cont = (ch) => ch.getComponent("minecraft:inventory").container;
function chestTotals(ch) {
  const m = {};
  const c = cont(ch);
  for (let i = 0; i < c.size; i++) {
    const s = c.getItem(i);
    if (s) m[s.typeId] = (m[s.typeId] ?? 0) + s.amount;
  }
  return m;
}
const amt = (ch, id) => chestTotals(ch)[id] ?? 0;
const safe = (f, d) => { try { return f(); } catch { return d; } };
let fails = 0;
function check(cond, msg) {
  if (cond) console.log("  ✔", msg);
  else {
    console.log("  ✘", msg);
    fails++;
  }
}

const scenario = process.argv[2] ?? "all";
const run = (name) => scenario === "all" || scenario === name;

// ---------------------------------------------------------------- 1) madenci
if (run("madenci")) {
  console.log("== Madenci: 6 demir");
  give("aqualit:robot_madenci");
  useOn("aqualit:robot_madenci", { x: 0, y: GROUND, z: 0 }, "Up", { comp: "aqualit:robot_item", p: { type: "madenci", model: 1 } });
  ticks(5);
  const bot = myBots().find((b) => b.type === "madenci");
  check(!!bot, "robot doğdu");
  check(!!bot?.homeChest(), "madenci sandığı yanında");
  check(player._inv.total("aqualit:task_remote") === 1, "görev kumandası verildi");
  bot.task = { type: "madenci", mode: "normal", items: [{ key: "demir", amount: 6 }], bonus: "al", finish: "chest", maxDist: 48 };
  bot.saveTask();
  brain.startTask(bot);
  const used = ticks(20 * 60 * 30, () => bot.task?.done);
  const ch = bot.homeChest();
  const tot = chestTotals(ch);
  console.log("  sandık:", JSON.stringify(tot), "süre(sn):", Math.round(used / 20), "konum:", JSON.stringify(MC.world.getEntity(bot.id)?.location));
  check((tot["minecraft:raw_iron"] ?? 0) >= 6, "en az 6 ham demir sandıkta");
  check(bot.task?.done === true, "görev bitti işaretlendi");
  const msgs = store.getJSON(world, `aq:msgs:${player.id}`, []);
  check(msgs.some((m) => m.text.includes("Görev tamamlandı")), "telsize tamamlandı mesajı geldi");
}

// ---------------------------------------------------------------- 2) kürekçi + eritme
if (run("kurekci")) {
  console.log("== Kürekçi: 12 kum, fırında cam");
  give("aqualit:robot_kurekci");
  useOn("aqualit:robot_kurekci", { x: 6, y: GROUND, z: 2 }, "Up", { comp: "aqualit:robot_item", p: { type: "kurekci", model: 1 } });
  ticks(5);
  const bot = myBots().find((b) => b.type === "kurekci");
  const ch = bot.homeChest();
  cont(ch).addItem(new ItemStack("minecraft:coal", 16));
  bot.task = { type: "kurekci", items: [{ key: "kum", amount: 12 }], finish: "smelt", maxDist: 32 };
  bot.saveTask();
  brain.startTask(bot);
  const used = ticks(20 * 60 * 30, () => bot.task?.done);
  const tot = chestTotals(ch);
  console.log("  sandık:", JSON.stringify(tot), "süre(sn):", Math.round(used / 20));
  check((tot["minecraft:glass"] ?? 0) + (tot["minecraft:sand"] ?? 0) >= 12, "12 kum/cam sandıkta");
  check((tot["minecraft:glass"] ?? 0) > 0, "kumun bir kısmı cama dönüştü");
}

// ---------------------------------------------------------------- 3) oduncu
if (run("oduncu")) {
  console.log("== Oduncu: 10 meşe kütüğü");
  give("aqualit:robot_oduncu");
  useOn("aqualit:robot_oduncu", { x: 6, y: GROUND, z: -5 }, "Up", { comp: "aqualit:robot_item", p: { type: "oduncu", model: 1 } });
  ticks(5);
  const bot = myBots().find((b) => b.type === "oduncu");
  bot.addItem("minecraft:oak_sapling", 2);
  bot.task = { type: "oduncu", items: [{ key: "mese", amount: 10 }], replant: true, leaves: false, finish: "chest", maxDist: 32 };
  bot.saveTask();
  brain.startTask(bot);
  const used = ticks(20 * 60 * 30, () => bot.task?.done);
  const tot = chestTotals(bot.homeChest());
  console.log("  sandık:", JSON.stringify(tot), "süre(sn):", Math.round(used / 20));
  check((tot["minecraft:oak_log"] ?? 0) >= 10, "10 kütük sandıkta");
  const saplings = [...ow.cells.values()].filter((c) => c.type === "minecraft:oak_sapling").length;
  check(saplings >= 1, `kesilen yere fidan dikildi (${saplings})`);
}

// ---------------------------------------------------------------- 4) çiftçi
if (run("ciftci")) {
  console.log("== Çiftçi: 8 buğday, tarla yoksa kur");
  give("aqualit:robot_ciftci");
  useOn("aqualit:robot_ciftci", { x: -9, y: GROUND, z: 4 }, "Up", { comp: "aqualit:robot_item", p: { type: "ciftci", model: 1 } });
  ticks(5);
  const bot = myBots().find((b) => b.type === "ciftci");
  cont(bot.homeChest()).addItem(new ItemStack("minecraft:wheat_seeds", 20));
  bot.task = { type: "ciftci", items: [{ key: "bugday", amount: 8 }], makeFarm: true, finish: "chest", maxDist: 24 };
  bot.saveTask();
  brain.startTask(bot);
  const used = ticks(20 * 60 * 40, () => bot.task?.done);
  const tot = chestTotals(bot.homeChest());
  const farmland = [...ow.cells.values()].filter((c) => c.type === "minecraft:farmland").length;
  console.log("  sandık:", JSON.stringify(tot), "tarla:", farmland, "süre(sn):", Math.round(used / 20));
  check(farmland >= 4, "tarla açıldı");
  check((tot["minecraft:wheat"] ?? 0) >= 8, "8 buğday sandıkta");
}

// ---------------------------------------------------------------- 5) skyblock
if (run("skyblock")) {
  console.log("== Madenci skyblock: 20 taş");
  give("aqualit:robot_madenci");
  useOn("aqualit:robot_madenci", { x: -3, y: GROUND, z: -3 }, "Up", { comp: "aqualit:robot_item", p: { type: "madenci", model: 1 } });
  ticks(5);
  const bot = myBots().filter((b) => b.type === "madenci").pop();
  bot.task = { type: "madenci", mode: "skyblock", items: [{ key: "tas", amount: 20 }], finish: "chest" };
  bot.saveTask();
  brain.startTask(bot);
  const used = ticks(20 * 60 * 20, () => bot.task?.done);
  const tot = chestTotals(bot.homeChest());
  console.log("  sandık:", JSON.stringify(tot), "süre(sn):", Math.round(used / 20));
  check((tot["minecraft:cobblestone"] ?? 0) >= 20, "20 taş sandıkta");
}

// ---------------------------------------------------------------- 6) kılıçlı + arayüzler
if (run("kilicli")) {
  console.log("== Kılıçlı + ayar dişlisi + komut çubuğu");
  give("aqualit:robot_kilicli_3");
  useOn("aqualit:robot_kilicli_3", { x: 2, y: GROUND, z: -6 }, "Up", { comp: "aqualit:robot_item", p: { type: "kilicli", model: 3 } });
  ticks(5);
  const bot = myBots().find((b) => b.type === "kilicli");
  check(!!bot, "kılıçlı doğdu");
  check(bot.e._events.includes("aqualit:as_kilicli"), "kılıçlı bileşenleri açıldı");
  check(!!bot.e._effects.health_boost, "can takviyesi uygulandı");
  // ayar dişlisi: seviye 5'e çek, değerleri sıfırla
  const kui = await import("./scripts/ui/kilicli_ui.js");
  UI.answers.push((f) => ({ canceled: false, formValues: [4, true, 300, 6, 7, 300, 40, false] }));
  await kui.gearForm(player, bot);
  check(bot.model === 5 && bot.e._props["aqualit:model"] === 5, "seviye 5 oldu");
  const st = JSON.parse(bot.e._dp["aq:stats"]);
  check(st.ciddiyet === 40 && st.can === 300, "ciddiyet ve can kaydedildi");
  UI.answers.push((f) => ({ canceled: false, selection: 2 })); // Burada bekle
  await kui.rodRobot(player, bot);
  check(bot.mode === "stay", "mod: burada bekle");
  UI.answers.push((f) => ({ canceled: false, formValues: [12] }));
  UI.answers.unshift((f) => ({ canceled: false, selection: 1 }));
  await kui.rodRobot(player, bot);
  ticks(400);
  check(bot.mode === "guard", "mod: bölge koru");
}

// ---------------------------------------------------------------- 7) arayüz akışları
if (run("ui")) {
  console.log("== Arayüz: kumanda ile görev verme, telsiz, takip ekranı, sandık");
  give("aqualit:robot_kurekci");
  useOn("aqualit:robot_kurekci", { x: 9, y: GROUND, z: 6 }, "Up", { comp: "aqualit:robot_item", p: { type: "kurekci", model: 1 } });
  ticks(5);
  const bot = myBots().filter((b) => b.type === "kurekci").pop();
  const task = await import("./scripts/ui/task.js");
  // robot menüsü -> görev ver -> kum seç -> devam -> miktar -> seçenekler
  UI.answers.push((f) => ({ canceled: false, selection: 0 }));            // Görev ver
  UI.answers.push((f) => ({ canceled: false, selection: 1 }));            // Kum
  UI.answers.push((f) => ({ canceled: false, selection: 0 }));            // Devam
  UI.answers.push((f) => ({ canceled: false, formValues: [4] }));         // 16
  UI.answers.push((f) => ({ canceled: false, formValues: [0, 0] }));      // sandığa getir, 32 blok
  await task.robotMenu(player, bot);
  check(bot.task?.items?.[0]?.key === "kum" && bot.task.items[0].amount === 16, "kumandayla görev verildi (16 kum)");
  check(bot.jobName === "gorev", "robot göreve başladı");
  const radio = await import("./scripts/ui/radio.js");
  UI.answers.push((f) => ({ canceled: false, selection: 0 }));            // Mesajlar
  UI.answers.push((f) => ({ canceled: true, cancelationReason: "UserClosed" }));
  await radio.openRadio(player);
  check(true, "telsiz açıldı");
  const tracker = await import("./scripts/ui/tracker.js");
  UI.answers.push(async (f) => {
    const zoomBtn = f.items.find((i) => i.t === "button" && String(i.v).includes("Uzaklaştır"));
    zoomBtn.cb();
    const map = f.items.find((i) => i.t === "label").v.getData();
    check(map.split("\n").length === 15, "takip ekranı haritası 15 satır");
    check(map.includes("§c█"), "haritada oyuncu işareti var");
  });
  await tracker.openTracker(player);
  const chest = (await import("./scripts/ui/chest.js"));
  let chestBtns = null;
  UI.answers.push((f) => {
    chestBtns = f.buttons.map((b) => b.text);
    return { canceled: false, selection: f.buttons.findIndex((b) => b.text.includes("İçindekiler")) };
  });
  UI.answers.push((f) => ({ canceled: true }));
  await chest.chestMenu(player, bot.homeChest());
  check(chestBtns?.some((t) => t.includes("Kapasite")) && UI.answers.length === 0, "sandık paneli açıldı, İçindekiler gösterildi");
  ticks(20 * 60 * 10, () => bot.task?.done);
  check(bot.task?.done, "kumandayla verilen görev bitti");
}

// ---------------------------------------------------------------- 8) kapalı robot ve tamir kiti
if (run("heykel")) {
  console.log("== Kapalı robot: ölümcül hasar -> heykel, kır -> eşya, koy -> blok, kitle onar");
  give("aqualit:robot_kilicli_1");
  useOn("aqualit:robot_kilicli_1", { x: -2, y: GROUND, z: 8 }, "Up", { comp: "aqualit:robot_item", p: { type: "kilicli", model: 1 } });
  ticks(5);
  const bot = myBots().filter((b) => b.type === "kilicli").pop();
  const rid = bot.rid, name = bot.name;
  const ev = world.beforeEvents.entityHurt.fire({ hurtEntity: bot.e, damage: 999, damageSource: { cause: "entityAttack" }, cancel: false });
  check(ev.cancel === true, "ölümcül hasar iptal edildi");
  ticks(3);
  const pos = { x: -2, y: GROUND + 1, z: 8 };
  check(ow._cell(pos).type === "aqualit:kapali_robot", "robot heykele dönüştü");
  check(ow._cell(pos).states["aqualit:tur"] === "kilicli_1", "heykel türü kilicli_1");
  // poz değiştir
  player._inv.setItem(player.selectedSlotIndex, undefined);
  comps.block["aqualit:statue"].onPlayerInteract({ player, block: ow.getBlock(pos), dimension: ow });
  ticks(2);
  check(ow._cell(pos).states["aqualit:poz"] === "oturuyor", "dokununca poz değişti");
  // kır -> eşya
  ticks(20);
  world.beforeEvents.playerBreakBlock.fire({ block: ow.getBlock(pos), dimension: ow, player, itemStack: undefined, cancel: false });
  const perm = ow.getBlock(pos).permutation;
  ow.setBlockType(pos, "minecraft:air");
  world.afterEvents.playerBreakBlock.fire({ block: ow.getBlock(pos), dimension: ow, player, brokenBlockPermutation: perm });
  const slot = player._inv.slots.findIndex((s) => s && s.typeId === "aqualit:kapali_kilicli_1");
  check(slot >= 0, "heykel eşyası envantere geldi");
  check(player._inv.slots[slot]?._dp["aq:rid"] === rid, "eşya robotun kimliğini taşıyor");
  // geri koy
  ticks(20);
  player.selectedSlotIndex = slot;
  useOn("aqualit:kapali_kilicli_1", { x: -2, y: GROUND, z: 8 }, "Up", { comp: "aqualit:statue_item", p: { variant: "kilicli_1" } });
  ticks(2);
  check(ow._cell(pos).type === "aqualit:kapali_robot", "heykel yeniden kondu");
  // tamir kiti ile basılı tut
  give("aqualit:tamir_kiti", 1, 1);
  player.getBlockFromViewDirection = () => ({ block: ow.getBlock(pos) });
  world.afterEvents.playerStartBreakingBlock.fire({ player, block: ow.getBlock(pos), heldItemStack: player._inv.getItem(1) });
  ticks(40);
  check(ow._cell(pos).type === "minecraft:air", "heykel kalktı");
  const revived = myBots().find((b) => b.rid === rid);
  check(!!revived && revived.name === name, "robot aynı adla uyandı");
  check(player._inv.getItem(1)?._dur.damage === 1, "kitin 1 hakkı harcandı (4 kaldı)");
}

// ---------------------------------------------------------------- 9) yakıt yetmezse
if (run("eritme")) {
  console.log("== Eritme: yakıt az (1 kömür, 12 kum)");
  give("aqualit:robot_kurekci");
  useOn("aqualit:robot_kurekci", { x: 7, y: GROUND, z: 5 }, "Up", { comp: "aqualit:robot_item", p: { type: "kurekci", model: 1 } });
  ticks(5);
  const bot = myBots().filter((b) => b.type === "kurekci").pop();
  for (const c of ow.furnaces.values()) { c.setItem(0, undefined); c.setItem(1, undefined); c.setItem(2, undefined); c._burn = 0; }
  const ch = bot.homeChest();
  for (const c of [...brain.bots.values()].map((b) => b.homeChest()).filter(Boolean)) {
    const cc = cont(c); for (let i = 0; i < cc.size; i++) if (cc.getItem(i)?.typeId === "minecraft:coal") cc.setItem(i, undefined);
  }
  cont(ch).addItem(new ItemStack("minecraft:coal", 1));
  bot.addItem("minecraft:sand", 12);
  bot.task = { type: "kurekci", items: [{ key: "kum", amount: 1 }], finish: "smelt", maxDist: 8 };
  bot.prog = { got: { kum: 12 } };
  bot.saveTask();
  brain.startTask(bot);
  const used = ticks(20 * 60 * 20, () => bot.task?.done);
  const tot = chestTotals(ch);
  console.log("  sandık:", JSON.stringify(tot), "süre(sn):", Math.round(used / 20));
  check((tot["minecraft:glass"] ?? 0) === 8, "1 kömürle 8 cam");
  check((tot["minecraft:sand"] ?? 0) >= 4 && (tot["minecraft:sand"] ?? 0) + (tot["minecraft:glass"] ?? 0) >= 12, "erimeyen kumlar geri alındı");
  check(used < 20 * 60 * 3, "fırında boşuna beklemedi");
}

// ---------------------------------------------------------------- 10) zırhlar
if (run("zirh")) {
  console.log("== Zırhlar: kabuk soyma, kabuk zırhı, taş zırh, Aqualit seti, büyü kitapları");
  const Z = await import("./scripts/zirh.js");
  const eq = player.getComponent("minecraft:equippable");
  // 1) kütük soy -> kabuk (normal ve Nether); soyma olmadıysa ya da kütük zaten soyulmuşsa kabuk yok
  const AXE = () => new ItemStack("minecraft:iron_axe", 1);
  const drops = (id) => world.entities.filter((e) => e.isValid && e.typeId === "minecraft:item" && e._item?.typeId === id).length;
  const strip = (blk, stripped, pos) => {
    set(pos, blk);
    world.beforeEvents.playerInteractWithBlock.fire({ player, block: ow.getBlock(pos), itemStack: AXE(), isFirstEvent: true, cancel: false });
    if (stripped) set(pos, stripped);
    ticks(2);
  };
  const logPos = { x: 20, y: GROUND + 1, z: 20 };
  strip("minecraft:oak_log", "minecraft:stripped_oak_log", logPos);
  check(drops("aqualit:kabuk_mese") === 1, "meşe kütüğü soyulunca 1 meşe kabuğu düştü");
  strip("minecraft:crimson_stem", "minecraft:stripped_crimson_stem", { x: 22, y: GROUND + 1, z: 20 });
  check(drops("aqualit:kabuk_kizil_nether") === 1, "kızıl gövde soyulunca Kızıl Nether kabuğu düştü");
  strip("minecraft:warped_hyphae", "minecraft:stripped_warped_hyphae", { x: 24, y: GROUND + 1, z: 20 });
  check(drops("aqualit:kabuk_carpik_nether") === 1, "çarpık hif soyulunca Çarpık Nether kabuğu düştü");
  world.beforeEvents.playerInteractWithBlock.fire({ player, block: ow.getBlock(logPos), itemStack: AXE(), isFirstEvent: true, cancel: false });
  ticks(2);
  check(drops("aqualit:kabuk_mese") === 1, "soyulmuş kütük yeniden kabuk vermedi");
  strip("minecraft:birch_log", null, { x: 26, y: GROUND + 1, z: 20 });
  check(drops("aqualit:kabuk_hus") === 0, "blok soyulmadıysa kabuk düşmedi");
  set({ x: 28, y: GROUND + 1, z: 20 }, "minecraft:spruce_log");
  world.beforeEvents.playerInteractWithBlock.fire({ player, block: ow.getBlock({ x: 28, y: GROUND + 1, z: 20 }), itemStack: AXE(), isFirstEvent: false, cancel: false });
  set({ x: 28, y: GROUND + 1, z: 20 }, "minecraft:stripped_spruce_log");
  ticks(2);
  check(drops("aqualit:kabuk_ladin") === 0, "basılı tutma tekrarı (isFirstEvent=false) ikinci kabuk vermedi");

  // 2) hız: parça payları 75/50/25/25, toplam en çok %20
  const mv = () => player.getComponent("minecraft:movement").currentValue;
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const wear = (slot, id) => eq.setEquipment(slot, id ? new ItemStack(id, 1) : undefined);
  const strip4 = () => { for (const s of ["Head", "Chest", "Legs", "Feet"]) eq.setEquipment(s, undefined); };
  const fullSet = (t) => { wear("Head", `aqualit:kabuk_migferi_${t}`); wear("Chest", `aqualit:kabuk_zirhi_${t}`);
    wear("Legs", `aqualit:kabuk_pantolonu_${t}`); wear("Feet", `aqualit:kabuk_botu_${t}`); };
  const hurt = (damage, cause, extra = {}) => world.beforeEvents.entityHurt.fire({ hurtEntity: player, damage, damageSource: { cause, ...extra }, cancel: false });
  const dmgOf = (slot) => eq.getEquipment(slot)?.getComponent("minecraft:durability").damage;
  player._inv.slots.fill(undefined);
  wear("Chest", "aqualit:kabuk_zirhi_mese"); ticks(6);
  check(near(mv(), 0.115), "yalnız göğüslük: hız %15");
  strip4(); wear("Head", "aqualit:kabuk_migferi_hus"); ticks(6);
  check(near(mv(), 0.105), "yalnız miğfer: hız %5");
  strip4(); wear("Legs", "aqualit:kabuk_pantolonu_ladin"); ticks(6);
  check(near(mv(), 0.11), "yalnız pantolon: hız %10");
  strip4(); wear("Chest", "aqualit:kabuk_zirhi_mese"); wear("Feet", "aqualit:kabuk_botu_kiraz"); ticks(6);
  check(near(mv(), 0.12), "göğüslük + bot (farklı türler): hız %20");
  strip4(); fullSet("mese"); ticks(6);
  check(near(mv(), 0.12), "tam set: hız %20'de kaldı (üstüne çıkmadı)");
  player.addEffect("speed", 100, { amplifier: 0 }); ticks(6);
  check(near(mv(), 0.1), "hız iksiri varken kabuk bonusu geri çekildi");
  delete player._effects.speed; ticks(6);
  check(near(mv(), 0.12), "iksir bitince kabuk bonusu geri geldi");

  // 3) düşüş: tam set %30, tek göğüslük %22,5; düşüşte ek aşınma
  let ev = hurt(10, "fall");
  check(near(ev.damage, 7), "tam sette düşüş hasarı %30 azaldı");
  ticks(2);
  check(["Head", "Chest", "Legs", "Feet"].every((s) => dmgOf(s) === 1), "düşüş bütün parçaları 1 aşındırdı");
  check(eq.getEquipment("Chest").getComponent("minecraft:durability").maxDurability === 60 && eq.getEquipment("Legs").getComponent("minecraft:durability").maxDurability === 55, "gerçek dayanıklılık (göğüslük 60, pantolon 55)");
  strip4(); wear("Chest", "aqualit:kabuk_zirhi_mese");
  ev = hurt(10, "fall");
  check(near(ev.damage, 7.75), "tek göğüslükte düşüş hasarı %22,5 azaldı");
  ticks(2);

  // 4) ateş: normal kabuk +%15; Nether kabuğu %50 korur; ateşte fazladan aşınma yok; karışık set
  strip4(); fullSet("mese"); ticks(2);
  ev = hurt(2, "fire");
  check(near(ev.damage, 2.3), "normal kabuk ateşte %15 fazla hasar aldı");
  ticks(2);
  check(dmgOf("Chest") === 0, "normal kabuk ateşte fazladan aşınmadı");
  strip4(); fullSet("kizil_nether"); ticks(2);
  ev = hurt(2, "fire");
  check(near(ev.damage, 1), "tam Kızıl Nether setinde ateş hasarı %50 azaldı");
  ev = hurt(4, "lava");
  check(near(ev.damage, 2) && !ev.cancel, "lavda da %50 (bağışıklık yok)");
  strip4(); wear("Chest", "aqualit:kabuk_zirhi_carpik_nether"); wear("Legs", "aqualit:kabuk_pantolonu_mese"); ticks(2);
  ev = hurt(2, "fire");
  check(near(ev.damage, 1.52), "karışık set (Nether göğüslük + normal pantolon): ateş ×0,76");

  // 5) Reçine Koruması: Nether'de %50 -> %80, normalde %15 -> %0
  strip4(); fullSet("carpik_nether"); ticks(2);
  give("aqualit:buyu_recine_korumasi", 4, 0);
  for (let i = 0; i < 3; i++) Z.applyBook(player, "recine_korumasi");
  check(Z.readBark(eq.getEquipment("Chest")).ench.recine_korumasi === 3, "Reçine Koruması III göğüslüğe işlendi");
  check(player._inv.total("aqualit:buyu_recine_korumasi") === 1, "3 kitap harcandı");
  check(Z.applyBook(player, "recine_korumasi") === false && player._inv.total("aqualit:buyu_recine_korumasi") === 1, "IV olmadı, kitap harcanmadı");
  ev = hurt(2, "fire");
  check(near(ev.damage, 0.4), "Nether + Reçine Koruması III: ateş koruması %80");
  strip4(); fullSet("mese"); ticks(2);
  give("aqualit:buyu_recine_korumasi", 3, 0);
  Z.applyBook(player, "recine_korumasi");
  ev = hurt(2, "fire");
  check(near(ev.damage, 2.2), "normal kabuk + Reçine Koruması I: fazladan ateş hasarı %10");
  Z.applyBook(player, "recine_korumasi");
  ev = hurt(2, "fire");
  check(near(ev.damage, 2.1), "normal kabuk + Reçine Koruması II: fazladan ateş hasarı %5");
  Z.applyBook(player, "recine_korumasi");
  ev = hurt(2, "fire");
  check(near(ev.damage, 2), "normal kabuk + Reçine Koruması III: fazladan ateş hasarı %0");
  strip4(); wear("Chest", "aqualit:kabuk_zirhi_kizil_nether"); ticks(2);
  give("aqualit:buyu_recine_korumasi", 1, 0);
  Z.applyBook(player, "recine_korumasi");
  ev = hurt(2, "fire");
  check(near(ev.damage, 2 * (1 - 0.6 * 0.75)), "tek Nether göğüslük + Reçine I: koruma %60 × 0,75 pay");

  // 6) diğer kabuk büyüleri
  strip4(); fullSet("ladin"); ticks(2);
  give("aqualit:buyu_esnek_lifler", 1, 0);
  Z.applyBook(player, "esnek_lifler");
  ev = hurt(10, "fall");
  check(near(ev.damage, 6.5), "Esnek Lifler I: düşüşte %35 koruma");
  give("aqualit:buyu_hafif_adimlar", 3, 0);
  for (let i = 0; i < 3; i++) Z.applyBook(player, "hafif_adimlar");
  ticks(6);
  check(near(mv(), 0.135), "Hafif Adımlar III: tam sette hız %35");
  give("aqualit:buyu_orman_golgesi", 1, 1);
  player.selectedSlotIndex = 1;
  check(Z.applyBook(player, "orman_golgesi") === false && !Z.readBark(eq.getEquipment("Chest")).ench.orman_golgesi, "Orman Gölgesi ile Hafif Adımlar bir arada olmadı");
  strip4(); wear("Chest", "aqualit:kabuk_zirhi_akasya"); ticks(2);
  Z.applyBook(player, "orman_golgesi");
  check(Z.readBark(eq.getEquipment("Chest")).ench.orman_golgesi === 1, "Orman Gölgesi I işlendi");
  player.isSneaking = true; ticks(40); player.isSneaking = false;
  check(!!player._effects.invisibility, "Orman Gölgesi: eğilirken görünmezlik");
  delete player._effects.invisibility;
  give("aqualit:buyu_dusus_asinmasi", 3, 0);
  for (let i = 0; i < 3; i++) Z.applyBook(player, "dusus_asinmasi");
  const rnd0 = Math.random;
  Math.random = () => 0.5;   // %75 azaltmayla aşınma şansı %25 -> 0.5'te aşınmaz
  hurt(8, "fall"); ticks(2);
  Math.random = rnd0;
  check(dmgOf("Chest") === 0, "Düşüş Aşınması III: düşüşte aşınma azaldı");

  // 7) Son Kabuk: ölümcül darbede bir kez kurtarır, büyülü parça parçalanır
  give("aqualit:buyu_son_kabuk", 1, 0);
  Z.applyBook(player, "son_kabuk");
  const zombie = ow.spawnEntity("minecraft:zombie", { x: 21, y: GROUND + 1, z: 21 });
  player._hp = { currentValue: 5, effectiveMax: 20 };
  ev = hurt(3, "entityAttack", { damagingEntity: zombie });
  check(!ev.cancel, "ölümcül olmayan darbe engellenmedi");
  ev = hurt(30, "entityAttack", { damagingEntity: zombie });
  check(ev.cancel === true, "Son Kabuk ölümcül darbeyi engelledi");
  ticks(2);
  check(!eq.getEquipment("Chest") && !!player._effects.regeneration, "Son Kabuk'lu parça parçalandı");
  ev = hurt(30, "entityAttack", { damagingEntity: zombie });
  check(!ev.cancel, "Son Kabuk bir kez çalıştı");
  player._hp = { currentValue: 20, effectiveMax: 20 };
  delete player._effects.regeneration;

  // 8) v0.2.6'dan kalan eşyalar: açıklamadaki eski dayanıklılık gerçek dayanıklılığa taşınır, büyüler kalır
  strip4();
  const old = new ItemStack("aqualit:kabuk_zirhi_mese", 1);
  old.setLore(["§7Kabuk zırhı · hız ve düşüş", "§dEsnek Lifler II", "§7Dayanıklılık: §f18§7/27"]);
  eq.setEquipment("Chest", old);
  const oldInv = new ItemStack("aqualit:kabuk_migferi_hus", 1);
  oldInv.setLore(["§7Kabuk zırhı · hız ve düşüş", "§7Dayanıklılık: §f9§7/27"]);
  player._inv.slots.fill(undefined);
  player._inv.setItem(5, oldInv);
  ticks(105);
  const mig = eq.getEquipment("Chest");
  check(mig.getComponent("minecraft:durability").damage === 20 && Z.readBark(mig).ench.esnek_lifler === 2
    && !mig.getLore().some((l) => l.includes("Dayanıklılık")), "giyili eski zırh taşındı (9/27 aşınma -> 20/60, büyü korundu)");
  const migInv = player._inv.getItem(5);
  check(migInv.getComponent("minecraft:durability").damage === 27 && !migInv.getLore().some((l) => l.includes("Dayanıklılık")), "envanterdeki eski miğfer taşındı (18/27 -> 27/40)");
  strip4(); player._inv.slots.fill(undefined); ticks(6);
  check(near(mv(), 0.1), "zırh çıkınca hız normale döndü");

  // 9) kabuk kitabı ganimeti: doğal sandık ilk açılışta, bir kez; oyuncunun koyduğu sandıkta yok
  const chestPos = { x: 30, y: GROUND + 1, z: 30 };
  set(chestPos, "minecraft:chest");
  const books = (p) => ow.getBlock(p).getComponent("minecraft:inventory").container.slots.filter((x) => x?.typeId.startsWith("aqualit:buyu_")).length;
  const open = (p) => { world.afterEvents.blockContainerOpened.fire({ block: ow.getBlock(p), dimension: ow }); };
  Math.random = () => 0.01;
  open(chestPos); ticks(3);
  check(books(chestPos) === 1, "doğal sandık ilk açılışta 1 kabuk kitabı verdi");
  open(chestPos); ticks(3);
  check(books(chestPos) === 1, "aynı sandık yeniden açılınca kitap çoğalmadı");
  const placedPos = { x: 33, y: GROUND + 1, z: 30 };
  set(placedPos, "minecraft:barrel");
  world.afterEvents.playerPlaceBlock.fire({ player, block: ow.getBlock(placedPos), dimension: ow });
  open(placedPos); ticks(3);
  Math.random = rnd0;
  check(books(placedPos) === 0, "oyuncunun koyduğu varilde kitap çıkmadı");
  const seen = {};
  for (let i = 0; i < 1000; i++) { const k = Z.pickLoot(i / 1000); seen[k] = (seen[k] ?? 0) + 1; }
  const barkKeys = ["esnek_lifler", "hafif_adimlar", "orman_golgesi", "recine_korumasi", "dusus_asinmasi", "son_kabuk"];
  console.log("  ganimet dağılımı (1000):", JSON.stringify(seen));
  check(barkKeys.every((k) => seen[k] > 0) && Object.keys(seen).length === 6, "6 kabuk kitabının hepsi ganimette çıkabiliyor");

  // 10) ayrı Kabuk Zırhları paketi de açıksa uyarı
  MC.ItemTypes._extra.add("kabuk:kabuk_mese");
  world.afterEvents.playerSpawn.fire({ player, initialSpawn: true });
  ticks(90);
  MC.ItemTypes._extra.clear();
  check(player.messages.some((m) => m.includes("Kabuk Zırhları")), "çifte kurulum uyarısı verildi");
  // 9) taş ve derin kayrak zırh: özel özellik yok (oyunun deri zırhı gibi); eski sürüm verisi temizlenir
  const tasSet = (k) => { eq.setEquipment("Head", new ItemStack(`aqualit:${k}_migfer`, 1)); eq.setEquipment("Chest", new ItemStack(`aqualit:${k}_zirh`, 1));
    eq.setEquipment("Legs", new ItemStack(`aqualit:${k}_pantolon`, 1)); eq.setEquipment("Feet", new ItemStack(`aqualit:${k}_bot`, 1)); };
  tasSet("tas");
  ticks(6);
  ev = hurt(7, "entityAttack", { damagingEntity: zombie });
  check(!ev.cancel && ev.damage === 7, "tam taş sette büyük darbe artık engellenmiyor");
  ev = hurt(9, "projectile");
  check(!ev.cancel && ev.damage === 9, "ok darbesi de engellenmiyor");
  ticks(2);
  check(["Head", "Chest", "Legs", "Feet"].every((s) => eq.getEquipment(s)), "taş set kırılmadı, üstünde duruyor");
  check(near(mv(), 0.1), "taş zırh hız vermiyor");
  check(eq.getEquipment("Chest").getLore().length === 0, "taş göğüslüğe açıklama yazılmadı");
  strip4();
  tasSet("derin_kayrak");
  ticks(6);
  check(["Head", "Chest", "Legs", "Feet"].every((s) => eq.getEquipment(s)), "taş set çıkar çıkmaz derin kayrak giyildi (bekleme yok)");
  strip4();
  const oldStone = new ItemStack("aqualit:derin_kayrak_zirh", 1);
  oldStone.setLore(["§7Tam sette büyük darbeyi keser", "§dYankı I", "§7Kırılma hakkı: §f1§7/2"]);
  oldStone.setDynamicProperty("aq:used", 1);
  oldStone.setDynamicProperty("aq:ench", JSON.stringify({ yanki: 1 }));
  eq.setEquipment("Chest", oldStone);
  const oldStoneInv = new ItemStack("aqualit:tas_migfer", 1);
  oldStoneInv.setLore(["§7Tam sette büyük darbeyi keser"]);
  player._inv.slots.fill(undefined);
  player._inv.setItem(3, oldStoneInv);
  ticks(105);
  const cleaned = eq.getEquipment("Chest");
  check(cleaned.getLore().length === 0 && cleaned.getDynamicProperty("aq:used") === undefined
    && cleaned.getDynamicProperty("aq:ench") === undefined, "giyili eski taş zırhın açıklaması ve verisi silindi");
  check(player._inv.getItem(3).getLore().length === 0, "envanterdeki eski taş miğferin açıklaması silindi");
  give("aqualit:buyu_esnek_lifler", 1, 0);
  check(Z.applyBook(player, "esnek_lifler") === false && player._inv.total("aqualit:buyu_esnek_lifler") === 1, "taş zırha kabuk büyüsü işlenmedi, kitap harcanmadı");
  strip4();
  player._inv.slots.fill(undefined);
  // 10) Aqualit seti
  eq.setEquipment("Head", new ItemStack("aqualit:aqualit_helmet", 1));
  eq.setEquipment("Chest", new ItemStack("aqualit:aqualit_chestplate", 1));
  eq.setEquipment("Legs", new ItemStack("aqualit:aqualit_leggings", 1));
  eq.setEquipment("Feet", new ItemStack("aqualit:aqualit_boots", 1));
  ticks(45);
  check(!!player._effects.haste && !!player._effects.water_breathing, "tam sette Çabukluk ve su altında nefes");
  player.isInWater = true;
  ticks(10);
  check(Math.abs(player.getComponent("minecraft:underwater_movement").currentValue - 0.028) < 1e-6, "suda Yunus Lütfü: yüzme hızı %40");
  player._hp = { currentValue: 5, effectiveMax: 20 };
  world.afterEvents.entityHurt.fire({ hurtEntity: player, damage: 3, damageSource: { cause: "entityAttack" } });
  check(!!player._effects.regeneration, "can %30 altında Can Yenilenmesi");
  player.isInWater = false;
  player._hp = { currentValue: 20, effectiveMax: 20 };
}

// ---------------------------------------------------------------- 11) kılıçlı güçleri (V3)
if (run("guc")) {
  console.log("== Kılıçlı güçleri: 5 güç, enerji, ciddiyet, seviye kilidi, otomatik seçim");
  const P = await import("./scripts/powers.js");
  const K = await import("./scripts/kilicli.js");
  const G = GROUND + 1;
  give("aqualit:robot_kilicli_5");
  useOn("aqualit:robot_kilicli_5", { x: 40, y: GROUND, z: 40 }, "Up", { comp: "aqualit:robot_item", p: { type: "kilicli", model: 5 } });
  ticks(5);
  const bot = myBots().filter((b) => b.type === "kilicli").pop();
  check(bot && bot.model === 5, "seviye 5 kılıçlı doğdu");
  check(P.unlocked(1).length === 0 && P.unlocked(2).length === 1 && P.unlocked(3).length === 2
    && P.unlocked(4).length === 4 && P.unlocked(5).length === 5, "güçler seviyelere göre açılıyor (0/1/2/4/5)");
  player.teleport({ x: 41.5, y: G, z: 41.5 });
  const st0 = K.getStats(bot);
  K.applyStats(bot, { ...st0, guc: false }, false); // elle denemeler: kendi başına güç kullanmasın
  ticks(40);
  check(!bot.pw?.cast && Math.round(bot.pw.energy) === bot.pw.max, "düşman yokken güç kullanmıyor, enerji dolu");
  const reset = () => { bot.pw.cd = {}; bot.pw.energy = bot.pw.max; };
  const mobs = [];
  const spawn = (id, x, z) => { const e = ow.spawnEntity(id, { x: x + 0.5, y: G, z: z + 0.5 }); mobs.push(e); return e; };
  const clear = () => { for (const m of mobs) m.remove(); mobs.length = 0; };
  const bl = () => bot.e.location;

  // 1) Elektrik kancası: uzaktaki iskeleti kendine çeker
  let sk = spawn("minecraft:skeleton", 50, 40);
  check(P.usePower(bot, "kanca"), "kanca kullanıldı");
  ticks(35);
  const kb = sk._kb[0];
  check(!!kb && kb.h.x < 0 && (sk._damage ?? 0) > 0, "kanca iskeleti robota doğru çekti ve çarptı");
  check(bot.pw.energy === bot.pw.max - P.POWERS.kanca.maliyet + (bot.pw.max / 120) * 3 || bot.pw.energy < bot.pw.max, "kanca enerji harcadı");
  check(!P.usePower(bot, "kanca"), "kanca bekleme süresindeyken tekrar kullanılamıyor");
  clear(); reset();

  // 2) Yıldırım kılıcı: vuruş yakındaki düşmanlara zincirleme atlar
  const z1 = spawn("minecraft:zombie", 42, 40), z2 = spawn("minecraft:zombie", 44, 41), z3 = spawn("minecraft:zombie", 60, 60);
  check(P.usePower(bot, "yildirim_kilici"), "yıldırım kılıcı kullanıldı");
  ticks(32);
  check(bot.pw.sword > system.currentTick, "kılıç 8 saniye şimşek yüklü");
  world.afterEvents.entityHurt.fire({ hurtEntity: z1, damage: 15, damageSource: { cause: "entityAttack", damagingEntity: bot.e } });
  check((z2._damage ?? 0) > 0 && !(z3._damage > 0), "şimşek yakındaki zombiye atladı, uzaktakine atlamadı");
  clear(); reset();

  // 3) Gölge adım: iskeletin arkasında belirir
  sk = spawn("minecraft:skeleton", 49, 40);
  check(P.usePower(bot, "golge_adim"), "gölge adım kullanıldı");
  ticks(12);
  const d = Math.hypot(bl().x - sk.location.x, bl().z - sk.location.z);
  check(d < 3, `gölge adımla iskeletin yanına ışınlandı (${d.toFixed(1)} blok)`);
  check((sk._damage ?? 0) > 0, "arkadan vuruş yaptı");
  clear(); reset();
  bot.e.teleport({ x: 40.5, y: G, z: 40.5 });
  player.teleport({ x: 41.5, y: G, z: 41.5 });

  // 4) Elektrik kubbe: sahibe direnç, içeri gireni çarpar, gelen oku durdurur
  check(P.usePower(bot, "kubbe"), "kubbe açıldı");
  ticks(22);
  check(!!bot.pw.dome, "kubbe aktif");
  const zin = spawn("minecraft:zombie", 43, 40);
  const arrow = ow.spawnEntity("minecraft:arrow", { x: 45.2, y: G + 1, z: 40.5 });
  arrow._vel = { x: -1.5, y: 0, z: 0 };
  ticks(12);
  check(!!player._effects.resistance, "kubbe içindeki sahibe direnç verildi");
  check((zin._damage ?? 0) > 0 && zin._kb.length > 0, "kubbeye giren zombi çarpıldı ve itildi");
  check(!arrow.isValid, "kubbeye gelen ok durduruldu");
  ticks(220);
  check(!bot.pw.dome, "kubbe 10 saniye sonra kapandı");
  clear(); reset();

  // 5) Gök gürültüsü: gökten yıldırımlar, alan hasarı
  const zs = [spawn("minecraft:zombie", 45, 42), spawn("minecraft:zombie", 46, 38), spawn("minecraft:creeper", 37, 44)];
  check(P.usePower(bot, "gok_gurultusu"), "gök gürültüsü kullanıldı");
  ticks(60);
  check(zs.every((z) => (z._damage ?? 0) >= 10), "her düşmana yıldırım düştü");
  check(ow.sounds.includes("ambient.weather.lightning.impact"), "yıldırım sesi çaldı");
  check(bot.e._props["aqualit:act"] === "none", "güç bitince hareket normale döndü");
  clear(); reset();

  // 6) Ciddiyet sınırı ve seviye kilidi
  for (let i = 0; i < 4; i++) spawn("minecraft:zombie", 42 + i, 43);
  spawn("minecraft:skeleton", 50, 41);
  K.applyStats(bot, { ...K.getStats(bot), ciddiyet: 20 }, false);
  let ctx = P.analyze(bot);
  let pick = P.choose(bot, ctx);
  check(!pick || P.POWERS[pick].ciddiyet <= 20, `ciddiyet 20'de yalnızca hafif güç seçiliyor (${pick ?? "yok"})`);
  K.applyStats(bot, { ...K.getStats(bot), ciddiyet: 100, model: 2 }, false);
  pick = P.choose(bot, P.analyze(bot));
  check(!pick || P.POWERS[pick].model <= 2, `seviye 2'de sadece seviye 2 gücü (${pick ?? "yok"})`);
  check(!P.usePower(bot, "gok_gurultusu"), "seviye 2'de gök gürültüsü kilitli");

  // 7) Otomatik: kalabalıkta robot gücü kendisi seçip kullanır
  K.applyStats(bot, { ...K.getStats(bot), model: 5, guc: true, tarz: "saldirgan" }, false);
  reset();
  const used = new Set();
  for (let i = 0; i < 400; i++) {
    system.tick();
    if (bot.pw.castName) used.add(bot.pw.castName);
  }
  check(used.size >= 1, `kalabalıkta kendi başına güç kullandı: ${[...used].join(", ")}`);
  K.applyStats(bot, { ...K.getStats(bot), guc: false }, false);
  reset();
  const before = bot.pw.energy;
  ticks(100);
  check(!bot.pw.castName && bot.pw.energy >= before, "güçler kapalıyken kendi başına kullanmıyor");
  clear();
}

// ---------------------------------------------------------------- 12) çökme: suyu olmayan yerde çiftçi + yük testi
function timedTicks(n, until) {
  let worst = 0, total = 0;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    system.tick();
    const dt = performance.now() - t0;
    total += dt;
    if (dt > worst) worst = dt;
    if (until && i % 20 === 0 && until()) return { worst, avg: total / (i + 1), n: i + 1 };
  }
  return { worst, avg: total / n, n };
}
if (run("cokme")) {
  console.log("== Çökme: suyu olmayan yerde çiftçi, kalabalık robotlar");
  // su olmayan düz alan (gölden çok uzakta)
  give("aqualit:robot_ciftci");
  useOn("aqualit:robot_ciftci", { x: 300, y: GROUND, z: 300 }, "Up", { comp: "aqualit:robot_item", p: { type: "ciftci", model: 1 } });
  ticks(5);
  const fb = myBots().filter((b) => b.type === "ciftci").pop();
  cont(fb.homeChest()).addItem(new ItemStack("minecraft:wheat_seeds", 32));
  fb.task = { type: "ciftci", items: [{ key: "bugday", amount: 4 }], finish: "chest", maxDist: 32 };
  fb.saveTask();
  brain.startTask(fb);
  const r1 = timedTicks(20 * 60 * 3);
  const msgs = store.getJSON(world, `aq:msgs:${player.id}`, []).filter((m) => m.text.includes("su"));
  console.log(`  en uzun tik ${r1.worst.toFixed(1)} ms, ortalama ${r1.avg.toFixed(2)} ms, su mesajı: ${msgs.length}`);
  check(r1.worst < 250, "suyu olmayan yerde dünya kilitlenmedi (tik < 250 ms)");
  check(msgs.length <= 2, "'su yok' mesajı tekrar tekrar gelmiyor");
  let water = 0;
  for (const [k, c] of ow.cells) if (c.type === "minecraft:water" && Math.abs(c.x ?? Number(k.split(",")[0]) - 300) < 20) water++;
  check(water >= 1, "çiftçi suyu kendisi getirdi (Aqualit kova numarası)");
  // yük testi: 12 robot aynı anda çalışır
  const kinds = [["madenci", { key: "demir", amount: 8 }], ["oduncu", { key: "mese", amount: 10 }],
    ["kurekci", { key: "kum", amount: 10 }], ["ciftci", { key: "bugday", amount: 6 }]];
  const crowd = [];
  for (let i = 0; i < 12; i++) {
    const [type, item] = kinds[i % 4];
    const x = -20 + (i % 6) * 7, z = 20 + Math.floor(i / 6) * 8;
    give(`aqualit:robot_${type}`);
    useOn(`aqualit:robot_${type}`, { x, y: GROUND, z }, "Up", { comp: "aqualit:robot_item", p: { type, model: 1 } });
    ticks(12);
    const b = myBots().filter((r) => r.type === type).pop();
    if (type === "ciftci") cont(b.homeChest()).addItem(new ItemStack("minecraft:wheat_seeds", 16));
    if (type === "kurekci") cont(b.homeChest()).addItem(new ItemStack("minecraft:coal", 8));
    b.task = { type, mode: "normal", items: [item], bonus: "al", finish: "chest", maxDist: 48 };
    b.saveTask();
    brain.startTask(b);
    crowd.push(b);
  }
  const r2 = timedTicks(20 * 60 * 4);
  const done = crowd.filter((b) => b.task?.done).length;
  console.log(`  12 robot: en uzun tik ${r2.worst.toFixed(1)} ms, ortalama ${r2.avg.toFixed(2)} ms, biten görev ${done}/12`);
  check(r2.worst < 120, "12 robot birlikteyken en uzun tik 120 ms altında");
  check(done >= 6, "kalabalıkta da görevler ilerliyor");
}

// ---------------------------------------------------------------- 13) kılıçlı takım: tamir kiti, geri çekilme, yardım
if (run("takim")) {
  console.log("== Kılıçlı takım: kit taşıma, kendini onarma, geri çekilme, arkadaş onarma, heykel uyandırma");
  const S = await import("./scripts/statue.js");
  const K = await import("./scripts/kilicli.js");
  const G = GROUND + 1;
  give("aqualit:robot_kilicli_3");
  useOn("aqualit:robot_kilicli_3", { x: 60, y: GROUND, z: 60 }, "Up", { comp: "aqualit:robot_item", p: { type: "kilicli", model: 3 } });
  ticks(12);
  const kb = myBots().filter((b) => b.type === "kilicli").pop();
  check(kb.e._events.includes("aqualit:fight_on"), "eski robotlar için savaş grubu açıldı");
  K.applyStats(kb, { ...K.getStats(kb), guc: false }, false);
  player.teleport({ x: 61.5, y: G, z: 61.5 });
  // sağlamken kit verilirse çantasına alır
  give("aqualit:tamir_kiti");
  S.healRobot(player, kb);
  check(S.kitCharges(kb) === 5, "sağlam kılıçlıya verilen kit çantaya girdi (5 hak)");
  // can azalınca kitle kendini onarır
  kb.e._hp = { currentValue: 5, effectiveMax: 40 };
  ticks(60);
  check(kb.e._hp.currentValue === 40 && S.kitCharges(kb) === 4, "canı azalınca kitle kendini onardı (4 hak kaldı)");
  // kit bitince geri çekilir, toparlanınca döner
  kb.e.setDynamicProperty("aq:kits", 0);
  kb.e._hp = { currentValue: 6, effectiveMax: 40 };
  ticks(20);
  check(kb.e._events.includes("aqualit:retreat_on") && !!kb.e._effects.regeneration, "kiti yokken geri çekildi ve toparlanıyor");
  kb.e._hp.currentValue = 36;
  ticks(20);
  check(kb.e._events.lastIndexOf("aqualit:fight_on") > kb.e._events.lastIndexOf("aqualit:retreat_on"), "toparlanınca savaşa döndü");
  // yaralı arkadaşı onarır
  kb.e.setDynamicProperty("aq:kits", 3);
  give("aqualit:robot_madenci");
  useOn("aqualit:robot_madenci", { x: 66, y: GROUND, z: 60 }, "Up", { comp: "aqualit:robot_item", p: { type: "madenci", model: 1 } });
  ticks(12);
  const mate = myBots().filter((b) => b.type === "madenci").pop();
  mate.e._hp = { currentValue: 4, effectiveMax: 20 };
  ticks(200, () => mate.e._hp.currentValue === 20);
  check(mate.e._hp.currentValue === 20 && S.kitCharges(kb) === 2, "yaralanan madenciyi kitle onardı");
  // saldırıya uğrayan arkadaşa yardıma koşar
  const z = ow.spawnEntity("minecraft:zombie", { x: 80.5, y: G, z: 60.5 });
  mate.e.teleport({ x: 79.5, y: G, z: 60.5 });
  world.afterEvents.entityHurt.fire({ hurtEntity: mate.e, damage: 2, damageSource: { cause: "entityAttack", damagingEntity: z } });
  ticks(160, () => Math.hypot(kb.e.location.x - z.location.x, kb.e.location.z - z.location.z) <= 5);
  const dz = Math.hypot(kb.e.location.x - z.location.x, kb.e.location.z - z.location.z);
  check(dz <= 6, `saldırıya uğrayan arkadaşına yardıma koştu (${dz.toFixed(1)} blok)`);
  z.remove();
  // kapanan robotu uyandırır
  mate.e.teleport({ x: 64.5, y: G, z: 64.5 });
  ticks(2);
  world.beforeEvents.entityHurt.fire({ hurtEntity: mate.e, damage: 999, damageSource: { cause: "entityAttack" }, cancel: false });
  ticks(3);
  const statuePos = { x: 64, y: G, z: 64 };
  check(ow._cell(statuePos).type === "aqualit:kapali_robot", "madenci kapandı, heykele döndü");
  kb.e.teleport({ x: 60.5, y: G, z: 60.5 });
  ticks(400, () => ow._cell(statuePos).type !== "aqualit:kapali_robot");
  check(ow._cell(statuePos).type !== "aqualit:kapali_robot" && myBots().some((b) => b.type === "madenci" && b.valid),
    "kılıçlı kapanan madenciyi kitle uyandırdı");
}

// ---------------------------------------------------------------- 14) görüş mesafesi: uzaktaki ağaç ve su
if (run("uzak")) {
  console.log("== Görüş mesafesi: 90 blok ötedeki ağaç, keşifle bulunan ağaç, uzaktan su getirme");
  const tree2 = (x, z, h = 5) => {
    for (let y = 1; y <= h; y++) set({ x, y: GROUND + y, z }, "minecraft:oak_log");
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = h - 1; dy <= h + 1; dy++) {
      const p = { x: x + dx, y: GROUND + dy, z: z + dz };
      if (ow._cell(p).type === "minecraft:air") set(p, "minecraft:oak_leaves");
    }
  };
  // 1) 90 blok ötede tek ağaç (yüklü alan taraması bulmalı)
  tree2(290, 200); tree2(293, 204);
  give("aqualit:robot_oduncu");
  useOn("aqualit:robot_oduncu", { x: 200, y: GROUND, z: 200 }, "Up", { comp: "aqualit:robot_item", p: { type: "oduncu", model: 1 } });
  ticks(12);
  const lb = myBots().filter((b) => b.type === "oduncu").pop();
  lb.task = { type: "oduncu", items: [{ key: "mese", amount: 6 }], replant: false, finish: "chest", maxDist: 128 };
  lb.saveTask();
  brain.startTask(lb);
  const r1 = timedTicks(20 * 60 * 12, () => lb.task?.done);
  const tot = chestTotals(lb.homeChest());
  console.log(`  kütük: ${tot["minecraft:oak_log"] ?? 0}, süre ${(r1.n / 20).toFixed(0)} sn, en uzun tik ${r1.worst.toFixed(1)} ms`);
  if (process.env.DBG) for (const m of store.getJSON(world, `aq:msgs:${player.id}`, []).slice(-8)) console.log("   ·", m.text);
  check((tot["minecraft:oak_log"] ?? 0) >= 6, "90 blok ötedeki ağaçları bulup kesti ve sandığa getirdi");
  check(Kaynak().list(player.id, "agac", "minecraft:overworld").length >= 1, "ağaçların yeri hafızaya yazıldı");
  // 2) 220 blok ötede ağaç: keşifle bulmalı (Sınırsız)
  tree2(-80, -300 + 220);
  give("aqualit:robot_oduncu");
  useOn("aqualit:robot_oduncu", { x: -80, y: GROUND, z: -300 }, "Up", { comp: "aqualit:robot_item", p: { type: "oduncu", model: 1 } });
  ticks(12);
  const lb2 = myBots().filter((b) => b.type === "oduncu").pop();
  lb2.task = { type: "oduncu", items: [{ key: "mese", amount: 3 }], replant: false, finish: "chest", maxDist: 100000 };
  lb2.saveTask();
  brain.startTask(lb2);
  const r2 = timedTicks(20 * 60 * 40, () => lb2.task?.done);
  const tot2 = chestTotals(lb2.homeChest());
  console.log(`  keşif: kütük ${tot2["minecraft:oak_log"] ?? 0}, süre ${(r2.n / 20).toFixed(0)} sn, en uzun tik ${r2.worst.toFixed(1)} ms`);
  if (process.env.DBG) {
    for (const m of store.getJSON(world, `aq:msgs:${player.id}`, []).slice(-6)) console.log("   ·", m.text);
    console.log("   konum", JSON.stringify(lb2.e.location), "durum", lb2.status, "keşif", JSON.stringify(lb2.prog.explore));
  }
  check((tot2["minecraft:oak_log"] ?? 0) >= 3, "220 blok ötedeki ağacı keşfe çıkıp buldu, kesip getirdi");
  check(r2.worst < 250, "uzak aramada da oyun kilitlenmedi");
}

// ---------------------------------------------------------------- 15) robot çantası: Türkçe adlar, resimler, al/koy
if (run("canta")) {
  console.log("== Robot çantası: adlar oyuncunun dilinde, eşya resimleri, adet seçerek al ve koy");
  const C = await import("./scripts/ui/canta.js");
  give("aqualit:robot_madenci");
  useOn("aqualit:robot_madenci", { x: 20, y: GROUND, z: 40 }, "Up", { comp: "aqualit:robot_item", p: { type: "madenci", model: 1 } });
  ticks(12);
  const b = myBots().filter((r) => r.type === "madenci").pop();
  b.inv.addItem(new ItemStack("minecraft:raw_iron", 40));
  b.inv.addItem(new ItemStack("minecraft:oak_log", 10));
  player.teleport({ x: 21.5, y: GROUND + 1, z: 41.5 });
  for (let i = 0; i < player._inv.size; i++) player._inv.setItem(i, undefined);
  player._inv.addItem(new ItemStack("minecraft:cobblestone", 20));
  let seen = null;
  UI.answers.push((f) => {
    seen = f.buttons;
    return { canceled: false, selection: seen.findIndex((x) => JSON.stringify(x.text).includes("raw_iron")) };
  });
  UI.answers.push((f) => ({ canceled: false, formValues: [15] }));                      // 15 tane al
  UI.answers.push((f) => ({ canceled: false, selection: 0 }));                          // Eşya koy
  UI.answers.push((f) => ({ canceled: false, selection: 0 }));                          // kırık taş
  UI.answers.push((f) => ({ canceled: false, formValues: [5] }));                       // 5 tane koy
  UI.answers.push((f) => ({ canceled: true }));                                         // kapat
  await C.bagMenu(player, { title: "çanta", container: () => b.inv, canEdit: () => true });
  const ironBtn = seen.find((x) => JSON.stringify(x.text).includes("raw_iron"));
  check(ironBtn && JSON.stringify(ironBtn.text).includes("translate") && ironBtn.icon === "textures/items/raw_iron",
    "eşya adı oyuncunun dilinde (çeviri anahtarı), yanında eşyanın resmi");
  check(player._inv.total("minecraft:raw_iron") === 15 && b.inv.total("minecraft:raw_iron") === 25, "çantadan 15 ham demir alındı");
  check(b.inv.total("minecraft:cobblestone") === 5 && player._inv.total("minecraft:cobblestone") === 15, "çantaya 5 kırık taş konuldu");
}

// ---------------------------------------------------------------- 16) boş zaman işleri
if (run("bos")) {
  console.log("== Boş zaman işleri: ham maden eritme, tamir kiti yapma, hasat, eksik haberi");
  give("aqualit:robot_madenci");
  useOn("aqualit:robot_madenci", { x: 100, y: GROUND, z: 100 }, "Up", { comp: "aqualit:robot_item", p: { type: "madenci", model: 1 } });
  ticks(12);
  const mb = myBots().filter((r) => r.type === "madenci").pop();
  const ch = mb.homeChest();
  set({ x: Math.floor(mb.home.x) + 2, y: GROUND + 1, z: Math.floor(mb.home.z) }, "minecraft:furnace");
  cont(ch).addItem(new ItemStack("minecraft:raw_iron", 6));
  cont(ch).addItem(new ItemStack("minecraft:coal", 4));
  cont(ch).addItem(new ItemStack("aqualit:aqualit_ingot", 1));
  cont(ch).addItem(new ItemStack("minecraft:iron_ingot", 2));
  cont(ch).addItem(new ItemStack("minecraft:redstone", 1));
  const r = timedTicks(20 * 60 * 8, () => amt(ch, "minecraft:iron_ingot") >= 6 && amt(ch, "aqualit:tamir_kiti") >= 1);
  console.log(`  sandık: demir külçe ${amt(ch, "minecraft:iron_ingot")}, ham demir ${amt(ch, "minecraft:raw_iron")}, kit ${amt(ch, "aqualit:tamir_kiti")}, süre ${(r.n / 20).toFixed(0)} sn`);
  check(amt(ch, "minecraft:raw_iron") === 0 && amt(ch, "minecraft:iron_ingot") >= 6, "görev yokken ham demirleri fırında eritti");
  check(amt(ch, "aqualit:tamir_kiti") >= 1, "malzeme varken tamir kiti yapıp sandığa koydu");
  // çiftçi: olgun buğdayı toplar
  give("aqualit:robot_ciftci");
  useOn("aqualit:robot_ciftci", { x: 130, y: GROUND, z: 100 }, "Up", { comp: "aqualit:robot_item", p: { type: "ciftci", model: 1 } });
  ticks(12);
  const fb = myBots().filter((x) => x.type === "ciftci").pop();
  for (let dx = 3; dx <= 5; dx++) {
    set({ x: 130 + dx, y: GROUND, z: 104 }, "minecraft:farmland");
    set({ x: 130 + dx, y: GROUND + 1, z: 104 }, "minecraft:wheat", { growth: 7 });
  }
  const r2 = timedTicks(20 * 60 * 2, () => amt(fb.homeChest(), "minecraft:wheat") >= 3);
  check(amt(fb.homeChest(), "minecraft:wheat") >= 3, `boş zamanında olgun buğdayı topladı (${amt(fb.homeChest(), "minecraft:wheat")})`);
  // boş zaman işleri kapalıyken bir şey yapmaz
  mb.e.setDynamicProperty("aq:bos", false);
  cont(ch).addItem(new ItemStack("minecraft:raw_iron", 3));
  ticks(20 * 60 * 2);
  check(amt(ch, "minecraft:raw_iron") === 3, "boş zaman işleri kapalıyken dokunmadı");
}

// ---------------------------------------------------------------- 17) konum çubuğu: robot kafaları, gönderilen konum
if (run("konum")) {
  console.log("== Konum çubuğu: robotlar kafa resimleriyle çubukta, gönderilen konum iğnesi");
  const KN = await import("./scripts/konum.js");
  give("aqualit:robot_oduncu");
  useOn("aqualit:robot_oduncu", { x: -40, y: GROUND, z: 30 }, "Up", { comp: "aqualit:robot_item", p: { type: "oduncu", model: 1 } });
  ticks(12);
  const b = myBots().filter((r) => r.type === "oduncu").pop();
  b.updateIndex(true);
  player.teleport({ x: -60.5, y: GROUND + 1, z: 30.5 });
  ticks(45);
  const wps = player.locatorBar.getAllWaypoints();
  const mine = wps.find((w) => w.entity === b.e);
  check(!!mine, "robot konum çubuğunda işaret olarak göründü");
  check(JSON.stringify(mine?.textureSelector).includes("textures/ui/aqualit_bas/bas_oduncu"), "işaret robotun kafa resmi");
  KN.sendLocation(b, "Buradayım!");
  const pins = player.locatorBar.getAllWaypoints().filter((w) => JSON.stringify(w.textureSelector).includes("pin_oduncu"));
  check(pins.length === 1, "robot konum gönderince çubukta iğne çıktı");
  const sentAt = { ...b.e.location };
  player.teleport({ x: sentAt.x + 1, y: sentAt.y, z: sentAt.z });
  ticks(45);
  check(!player.locatorBar.getAllWaypoints().some((w) => JSON.stringify(w.textureSelector).includes("pin_oduncu")), "konuma varınca iğne kalktı");
  KN.setBar(player, false);
  check(player.locatorBar.getAllWaypoints().length === 0, "telsizden kapatınca çubuktan kalktılar");
  KN.setBar(player, true);
}

// ---------------------------------------------------------------- 18) epik güç efektleri (v0.2.5)
if (run("efekt")) {
  console.log("== Kılıçlı güç efektleri: şimşek, zincir, kubbe varlığı, hayalet, gökten yıldırım");
  const P = await import("./scripts/powers.js");
  const K = await import("./scripts/kilicli.js");
  const FXM = await import("./scripts/fx.js");
  const PL = MC.__particles;
  const G = GROUND + 1;
  give("aqualit:robot_kilicli_5");
  useOn("aqualit:robot_kilicli_5", { x: 80, y: GROUND, z: 80 }, "Up", { comp: "aqualit:robot_item", p: { type: "kilicli", model: 5 } });
  ticks(5);
  const bot = myBots().filter((b) => b.type === "kilicli" && b.e.location.x > 70).pop();
  check(!!bot, "seviye 5 kılıçlı hazır");
  K.applyStats(bot, { ...K.getStats(bot), guc: false }, false);
  player.teleport({ x: 81.5, y: G, z: 81.5 });
  const reset = () => { bot.pw.cd = {}; bot.pw.energy = bot.pw.max; };
  const mobs = [];
  const spawn = (id, x, z) => { const e = ow.spawnEntity(id, { x: x + 0.5, y: G, z: z + 0.5 }); mobs.push(e); return e; };
  const clear = () => { for (const m of mobs) m.remove(); mobs.length = 0; };
  const since = (t0) => PL.log.filter((x) => x.tick > t0);
  const count = (list, name) => list.filter((x) => x.name === name).length;
  const fxEnts = () => world.entities.filter((e) => e.typeId === "aqualit:fx" && e.isValid);
  ticks(20);

  // 1) kanca: zincir uçar, kilitlenir, gergin zincir hedefi izler
  let t0 = system.currentTick;
  let sk = spawn("minecraft:skeleton", 90, 80);
  check(P.usePower(bot, "kanca"), "kanca kullanıldı");
  ticks(35);
  let L = since(t0);
  check(count(L, "aqualit:zincir") >= 20, `elektrikli zincir çizildi (${count(L, "aqualit:zincir")} parça)`);
  check(count(L, "aqualit:simsek") >= 6 && count(L, "aqualit:parlama") >= 4, "kilitlenmede şimşek ve ışık patlaması");
  check(ow.sounds.includes("aqualit.power.chain"), "zincir sesi çaldı");
  clear(); reset();

  // 2) yıldırım kılıcı: halkalar, gökten kılıca kalın yıldırım, 8 sn çatırtı
  t0 = system.currentTick;
  check(P.usePower(bot, "yildirim_kilici"), "yıldırım kılıcı kullanıldı");
  ticks(30);
  L = since(t0);
  check(count(L, "aqualit:enerji_halka") >= 5, "enerji halkaları yükseldi");
  check(L.some((x) => x.name === "aqualit:simsek" && x.vars["variable.kalin"] >= 0.18), "gökten kılıca kalın yıldırım indi");
  check(count(L, "aqualit:sok_dalgasi") >= 1, "kılıç çakınca şok dalgası");
  const t1 = system.currentTick;
  ticks(60);
  check(count(since(t1), "aqualit:simsek") >= 15, "kılıç güç boyunca çatırdıyor");
  check(ow.sounds.includes("aqualit.power.blade") && ow.sounds.includes("aqualit.power.thunder"), "kılıç ve gök sesi çaldı");
  const za = spawn("minecraft:zombie", 82, 80), zb = spawn("minecraft:zombie", 84, 81);
  const t2 = system.currentTick;
  world.afterEvents.entityHurt.fire({ hurtEntity: za, damage: 10, damageSource: { cause: "entityAttack", damagingEntity: bot.e } });
  check(PL.log.some((x) => x.tick === t2 && x.name === "aqualit:simsek" && x.vars["variable.kalin"] >= 0.09), "vuruştan zincir şimşek çıktı");
  check((zb._damage ?? 0) > 0, "zincir şimşek yandaki zombiye atladı");
  clear(); reset();
  ticks(120);

  // 3) gölge adım: hayalet kalır ve silinir, duman izi
  t0 = system.currentTick;
  sk = spawn("minecraft:skeleton", 89, 80);
  check(P.usePower(bot, "golge_adim"), "gölge adım kullanıldı");
  ticks(3);
  const ghost = fxEnts().find((e) => e._props["aqualit:fx"] === "hayalet");
  check(!!ghost, "geride gölge hayaleti kaldı");
  check(ghost && Math.abs(ghost.location.x - 80.5) < 1.5, "hayalet çıkış noktasında");
  ticks(14);
  check(ghost && !ghost.isValid, "hayalet kayboldu");
  L = since(t0);
  check(count(L, "aqualit:golge_duman") >= 3 && count(L, "aqualit:parlama") >= 2, "duman izi ve ışık patlamaları");
  check(ow.sounds.includes("aqualit.power.shadow"), "gölge sesi çaldı");
  clear(); reset();
  bot.e.teleport({ x: 80.5, y: G, z: 80.5 });

  // 4) kubbe: efekt varlığı açılır, robotu izler, çöküp kaybolur
  t0 = system.currentTick;
  check(P.usePower(bot, "kubbe"), "kubbe kullanıldı");
  ticks(10);
  const dome = fxEnts().find((e) => e._props["aqualit:fx"] === "kubbe");
  check(!!dome, "altıgen enerji kubbesi açıldı");
  check(count(since(t0), "aqualit:sok_dalgasi") >= 1, "kubbe açılırken şok dalgası");
  bot.e.teleport({ x: 83.5, y: G, z: 80.5 });
  ticks(3);
  check(dome && Math.abs(dome.location.x - 83.5) < 0.01, "kubbe robotu izliyor");
  const arrow = ow.spawnEntity("minecraft:arrow", { x: 88.6, y: G + 1, z: 80.5 });
  arrow._vel = { x: -1.5, y: 0, z: 0 };
  ticks(8);
  check(!arrow.isValid, "ok kalkana çarpıp yok oldu");
  ticks(190);
  check(dome && dome.isValid && dome._props["aqualit:boy"] < 1, "süre bitince kubbe çöküyor");
  ticks(10);
  check(dome && !dome.isValid && !bot.pw.dome, "kubbe kayboldu");
  check(count(since(t0), "aqualit:kubbe_parilti") >= 40, "kubbe yüzeyinde pırıltılar");
  clear(); reset();

  // 5) gök gürültüsü: bulut şimşekleri, gökten yıldırımlar, sarsıntı ve ışık
  t0 = system.currentTick;
  const zs = [spawn("minecraft:zombie", 86, 83), spawn("minecraft:zombie", 87, 77), spawn("minecraft:creeper", 77, 85)];
  player._cam.shakes.length = 0; player._cam.fades.length = 0;
  check(P.usePower(bot, "gok_gurultusu"), "gök gürültüsü kullanıldı");
  ticks(60);
  L = since(t0);
  const sky = L.filter((x) => x.name === "aqualit:simsek" && x.vars["variable.kalin"] >= 0.2);
  check(sky.length >= 40, `gökten kalın yıldırımlar indi (${sky.length} parça)`);
  check(count(L, "aqualit:sok_dalgasi") >= 4, "her vuruşta şok dalgası");
  check(player._cam.shakes.length >= 1 && player._cam.fades.length >= 1, "yakındaki oyuncuya sarsıntı ve ışık");
  check(zs.every((z) => (z._damage ?? 0) >= 10), "her düşman yıldırımla vuruldu");
  check(ow.sounds.filter((x) => x === "aqualit.power.thunder").length >= 3, "her vuruşta gök gürültüsü sesi");
  clear(); reset();

  // genel: parçacık bütçesi, artık efekt varlığı yok
  check(PL.max <= 280, `tik başına parçacık sınırı aşılmadı (en çok ${PL.max})`);
  check(fxEnts().length === 0, "hiç artık efekt varlığı kalmadı");
  const stray = ow.spawnEntity("aqualit:fx", { x: 70, y: G, z: 70 }, { spawnEvent: "aqualit:as_kubbe" });
  FXM.fxCleanup();
  check(!stray.isValid, "açılışta kalmış efekt varlıkları temizleniyor");
}

// ---------------------------------------------------------------- 19) mini Keşif: araçlara dönüşüp binme ve sürme
if (run("kesif")) {
  console.log("== Mini Keşif: yerleştirme, dönüşüm, binme, sürme, matkap, sahiplik, toplama");
  const KS = await import("./scripts/kesif.js");
  const G = GROUND + 1;
  give("aqualit:robot_kesif");
  useOn("aqualit:robot_kesif", { x: -80, y: GROUND, z: -80 }, "Up", { comp: "aqualit:robot_item", p: { type: "kesif", model: 1 } });
  ticks(3);
  const k = world.entities.find((e) => e.typeId === "aqualit:kesif" && e.isValid);
  check(!!k && k._dp["aq:sahip"] === player.id, "Keşif yerleşti, sahibi oyuncu");
  check(!player._inv.getItem(player.selectedSlotIndex), "eşya harcandı");
  let ev = { target: k, player, cancel: false };
  world.beforeEvents.playerInteractWithEntity.fire(ev);
  check(ev.cancel, "robotken dokununca menü açılıyor (binmiyor)");
  check(!KS.transform(k, "denizalti", player), "karada denizaltı olmuyor");
  check(KS.transform(k, "ucak", player), "uçağa dönüşme başladı");
  check(k._props["aqualit:gecis"] === true, "önce katlanma animasyonu");
  ticks(12);
  check(k._props["aqualit:form"] === "ucak" && !k._props["aqualit:gecis"], "uçak oldu");
  ticks(20);
  check(ow.sounds.includes("aqualit.kesif.transform") && ow.sounds.includes("aqualit.kesif.lock") && ow.sounds.includes("aqualit.kesif.plane"),
    "dönüşüm, kilit ve motor sesleri çaldı");
  k.getComponent("minecraft:rideable").addRider(player);
  player._rot = { x: 0, y: 0 }; player._mv = { x: 0, y: 1 };
  ticks(2);
  check(Math.abs(k._vel.z - 1.1) < 0.01 && Math.abs(k._vel.x) < 0.01, `uçak ileri gidiyor (hız ${k._vel.z.toFixed(2)})`);
  player._rot = { x: -30, y: 90 };
  ticks(2);
  check(k._vel.y > 0.4 && k._vel.x < -0.8 && k._props["aqualit:egim"] < -20, "yukarı bakınca tırmanıyor, burnu kalkıyor, batıya dönüyor");
  player._mv = { x: 0, y: 0 }; k.isOnGround = false;
  ticks(2);
  check(Math.abs(k._vel.y + 0.08) < 0.01, "gaz yokken süzülerek alçalıyor");
  k.getComponent("minecraft:rideable").ejectRider(player); player.isOnGround = false;
  ticks(2);
  check(!!player._effects.slow_falling, "havada uçaktan inince yavaş düşüş verildi");
  player.isOnGround = true; k.isOnGround = true;
  // arazi aracı
  check(KS.transform(k, "arazi", player), "arazi aracına dönüşme");
  ticks(30);
  k.getComponent("minecraft:rideable").addRider(player);
  player._rot = { x: 0, y: 0 }; player._mv = { x: 0, y: 1 }; k._vel = { x: 0, y: 0, z: 0 };
  ticks(2);
  check(Math.abs(k._vel.z - 0.55) < 0.01 && k._vel.y === 0, "arazi aracı ileri gidiyor, yerçekimi korunuyor");
  // matkap: düz ileri kazar
  k.getComponent("minecraft:rideable").ejectRider(player);
  KS.transform(k, "matkap", player); ticks(30);
  const kl = k.location;
  const bx = Math.floor(kl.x), by = Math.floor(kl.y), bz = Math.floor(kl.z);
  for (let d = 1; d <= 2; d++) for (let l = -1; l <= 1; l++) for (let h = 0; h <= 2; h++) set({ x: bx + l, y: by + h, z: bz + d }, "minecraft:stone");
  set({ x: bx, y: by, z: bz + 2 }, "minecraft:bedrock");
  k.getComponent("minecraft:rideable").addRider(player);
  player._rot = { x: 0, y: 0 }; player._mv = { x: 0, y: 1 };
  ticks(8);
  let air = 0;
  for (let d = 1; d <= 2; d++) for (let l = -1; l <= 1; l++) for (let h = 0; h <= 2; h++) air += ow._cell({ x: bx + l, y: by + h, z: bz + d }).type === "minecraft:air" ? 1 : 0;
  check(air === 17, `matkap önündeki 3x3x2 taşı kazdı (${air}/17)`);
  check(ow._cell({ x: bx, y: by, z: bz + 2 }).type === "minecraft:bedrock", "katman kayasına dokunmadı");
  k._dp["aq:kaz"] = "dikey";
  ticks(8);
  check(ow._cell({ x: bx, y: by - 1, z: bz }).type === "minecraft:air", "aşağı kazma modunda altını kazdı");
  check(Math.abs(k._vel.z) < 0.01, "aşağı kazarken ilerlemiyor");
  // sahiplik
  const guest = MC.__makePlayer("Misafir", ow, { x: kl.x + 2, y: G, z: kl.z });
  k.getComponent("minecraft:rideable").ejectRider(player);
  ev = { target: k, player: guest, cancel: false };
  world.beforeEvents.playerInteractWithEntity.fire(ev);
  check(ev.cancel, "başka oyuncu sahibi yokken binemiyor");
  k.getComponent("minecraft:rideable").addRider(guest);
  ticks(2);
  check(!guest._ridingOn, "zorla binen misafir indirildi");
  // binerken telsiz menüsü
  k.getComponent("minecraft:rideable").addRider(player);
  ev = { source: player, itemStack: new ItemStack("aqualit:robot_radio", 1), cancel: false };
  world.beforeEvents.itemUse.fire(ev);
  check(ev.cancel, "binerken telsiz Keşif menüsünü açıyor");
  // robota dönünce yolcular iner, toplayınca eşya geri gelir
  KS.transform(k, "robot", player); ticks(30);
  check(k._props["aqualit:form"] === "robot" && !player._ridingOn, "robota dönünce yolcular indi");
  guest.remove();
}

// ---------------------------------------------------------------- 21) Aqualit sandığı (v0.2.9)
if (run("sandik")) {
  console.log("== Aqualit sandığı: dokun-aç, sayfalar, kapasite, çift sandık, sahiplik, kırma, kaldırma, taşıma");
  const SK = await import("./scripts/sandik.js");
  const CU = await import("./scripts/ui/chest.js");
  const PL = await import("./scripts/place.js");
  const { CHEST_ITEM } = await import("./scripts/constants.js");
  const G = GROUND + 1;
  const OW = "minecraft:overworld";
  const OPPS = { north: "south", south: "north", east: "west", west: "east" };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const view = (p) => ow._chest(p);
  const filled = (c) => { let n = 0; for (let i = 0; i < c.size; i++) if (c.getItem(i)) n++; return n; };
  const count = (c, id) => { let n = 0; for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === id) n++; return n; };
  const findSlot = (c, id) => { for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === id) return i; return -1; };
  const MK = ["aqualit:sayfa_ileri", "aqualit:sayfa_geri", "aqualit:kilitli_yuva"];
  const markersIn = (c) => MK.reduce((n, id) => n + count(c, id), 0);
  const playerMarkers = (pl) => markersIn(pl._inv) + (pl._cursor && MK.includes(pl._cursor.typeId) ? 1 : 0);
  const deposOf = (p) => world.entities.filter((e) => e.isValid && e.typeId === "aqualit:sandik_depo" && e._dp["aq:blk"] === SK.idOf(OW, p));
  const sameTotals = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  function takeDrops(p, r = 1.3) {
    const m = {};
    for (const e of world.entities) {
      if (!e.isValid || e.typeId !== "minecraft:item" || e.dimension !== ow) continue;
      if (Math.hypot(e.location.x - (p.x + 0.5), e.location.z - (p.z + 0.5)) > r || Math.abs(e.location.y - p.y) > 2) continue;
      m[e._item.typeId] = (m[e._item.typeId] ?? 0) + e._item.amount;
      e.remove();
    }
    return m;
  }
  function lookAt(pl, at) {
    const dx = at.x + 0.5 - pl.location.x, dz = at.z + 0.5 - pl.location.z;
    pl.setRotation({ x: 30, y: (Math.atan2(-dx, dz) * 180) / Math.PI });
  }
  // oyun sandığı oyuncuya döndürür (bakışın tersi); deneme dünyasında yön durumu ters de olabilir
  let FLIP = false;
  function frontFor(pl) {
    const y = (pl.getRotation().y * Math.PI) / 180;
    const fx = Math.sin(y), fz = -Math.cos(y);
    return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? "east" : "west") : (fz > 0 ? "south" : "north");
  }
  /** Oyuncu sandık eşyasıyla zemine dokunur; oyun (block_placer) tuzaklı sandığı koyar. kind null: sıradan tuzaklı sandık */
  function place(pl, kind, at, opts = {}) {
    pl.teleport(opts.from ?? { x: at.x + 0.5, y: G, z: at.z + 3.5 });
    if (opts.yaw !== undefined) pl.setRotation({ x: 30, y: opts.yaw });
    else lookAt(pl, at);
    const ev = { player: pl, block: ow.getBlock({ x: at.x, y: at.y - 1, z: at.z }), blockFace: "Up", faceLocation: { x: 0.5, y: 1, z: 0.5 },
      itemStack: new ItemStack(kind ? CHEST_ITEM[kind] : "minecraft:trapped_chest", 1), isFirstEvent: true, cancel: false };
    world.beforeEvents.playerInteractWithBlock.fire(ev);
    if (ev.cancel) {
      ticks(2);
      return false;
    }
    const front = frontFor(pl);
    set(at, "minecraft:trapped_chest", { "minecraft:cardinal_direction": FLIP ? OPPS[front] : front });
    if (opts.pair) MC.__pairChests(ow, opts.pair, at);
    if (!opts.noEvent) world.afterEvents.playerPlaceBlock.fire({ player: pl, block: ow.getBlock(at), dimension: ow });
    ticks(4);
    return true;
  }
  const open = (pl, at) => world.afterEvents.blockContainerOpened.fire({ block: ow.getBlock(at), dimension: ow, openSource: { entity: pl } });
  const close = (pl, at) => world.afterEvents.blockContainerClosed.fire({ block: ow.getBlock(at), dimension: ow, closeSource: { entity: pl } });
  const sess = (uid) => SK._test.sessions.get(uid);
  player.gameMode = "Survival";
  player.isSneaking = false;
  player._cursor = undefined;
  player._inv.slots.fill(undefined);

  // --- 1) koyma ve kayıt
  const A = { x: 500, y: G, z: 500 };
  check(place(player, "genel", A, { noEvent: true }), "Aqualit sandığı kondu (oyunun kendi sandığı olarak)");
  const uidA = SK.unitIdAt(OW, A);
  const uA = SK.loadUnit(uidA);
  check(!!uA && uA.owner === player.id && uA.kind === "genel" && uA.blocks.length === 1 && !uA.double, "sandık kaydedildi: sahibi, türü, tek sandık");
  check(world.getDynamicProperty("aq:sandik_ters") === false, "ilk koymada sandığın yönü ölçüldü");
  const dA = deposOf(A);
  check(dA.length === 1 && dA[0]._props["aqualit:kind"] === "genel", "sandığın önüne amblem plakası kondu");
  check(dA.length === 1 && Math.abs(dA[0].location.z - (A.z + 0.945)) < 0.01 && Math.abs(dA[0].location.x - (A.x + 0.5)) < 0.01,
    "plaka sandığın ön yüzünde (oyuncuya bakan yüz)");
  check(store.Chests.list(player.id).some((c) => c.cid === uidA), "sandık telsizin sandık listesinde");

  // --- 2) tek sayfa: dokun-aç, al-koy, kapat
  const hA = SK.getSandik(uidA);
  for (let i = 0; i < 3; i++) cont(hA).addItem(new ItemStack("minecraft:cobblestone", 64));
  check(filled(view(A)) === 0, "kapalı sandığın kendisi boş (eşyalar sandığın deposunda)");
  const rnd = Math.random;
  Math.random = () => 0;                  // kabuk kitabı ganimeti çıkacak olsaydı kesin çıksın
  open(player, A);
  let vc = view(A);
  check(filled(vc) === 3 && vc.getItem(0)?.typeId === "minecraft:cobblestone" && markersIn(vc) === 0, "açınca eşyalar sandıkta; tek sayfada ok yok");
  vc.setItem(0, undefined);
  vc.setItem(5, new ItemStack("minecraft:diamond", 3));
  ticks(3);
  Math.random = rnd;
  check(![...Array.from({ length: vc.size }, (_, i) => vc.getItem(i))].some((it) => it?.typeId.startsWith("aqualit:buyu_")),
    "Aqualit sandığına doğal sandık ganimeti (kabuk kitabı) konmuyor");
  close(player, A);
  let t = chestTotals(hA);
  check(filled(view(A)) === 0 && t["minecraft:cobblestone"] === 128 && t["minecraft:diamond"] === 3, "kapanınca alınan/konan eşyalar depoya işlendi");

  // --- 3) kapasite (panel): 3 normal sandık = +81 yuva
  player._inv.setItem(0, new ItemStack("minecraft:chest", 5));
  let capMax = null;
  UI.answers.push((f) => ({ canceled: false, selection: f.buttons.findIndex((b) => b.text.includes("Kapasite")) }));
  UI.answers.push((f) => { capMax = f.fields[0].max; return { canceled: false, formValues: [3] }; });
  await CU.chestMenu(player, hA);
  let sm = SK.summary(uidA);
  check(capMax === 5 && sm.cap === 108 && sm.pages === 5 && player._inv.total("minecraft:chest") === 2,
    `panelden 3 sandık eklendi: ${sm.cap} yuva, ${sm.pages} sayfa, envanterde 2 sandık kaldı`);

  // --- 4) sayfalar
  open(player, A);
  vc = view(A);
  let s = sess(uidA);
  check(!!s && s.lay.pages === 5 && vc.getItem(26)?.typeId === "aqualit:sayfa_ileri" && vc.getItem(18)?.typeId === "aqualit:sayfa_geri",
    "çok sayfada sağ altta ▶, sol altta ◀ var");
  check(String(vc.getItem(26)?.nameTag).includes("2/5") && vc.getItem(5)?.typeId === "minecraft:diamond", "ok sonraki sayfayı yazıyor (2/5), eşyalar yerinde");
  vc.setItem(3, new ItemStack("minecraft:gold_ingot", 5));
  let mk = vc.getItem(26);
  vc.setItem(26, undefined);
  player._inv.addItem(mk);                 // ▶'a dokundu: ok envantere geçti
  ticks(1);
  check(sess(uidA).page === 1 && String(vc.getItem(26)?.nameTag).includes("3/5") && player._inv.total("aqualit:sayfa_ileri") === 0,
    "▶ ile 2. sayfaya geçildi, ok oyuncudan geri alındı");
  check(!vc.getItem(3) && !vc.getItem(5), "2. sayfa boş açıldı");
  vc.setItem(0, new ItemStack("minecraft:emerald", 7));
  mk = vc.getItem(18);
  vc.setItem(18, undefined);
  player._cursor = mk;                     // ◀ imleçle tutuldu (klasik arayüz)
  ticks(1);
  check(sess(uidA).page === 0 && !player._cursor && vc.getItem(3)?.typeId === "minecraft:gold_ingot", "◀ ile 1. sayfaya dönüldü (imleçteki ok silindi)");
  check(SK._test.stores(SK.loadUnit(uidA))[0].c.getItem(25)?.typeId === "minecraft:emerald", "2. sayfadaki zümrüt depoda doğru yuvada");
  mk = vc.getItem(26);
  vc.setItem(26, new ItemStack("minecraft:stick", 1));
  player._cursor = mk;                     // oka eşya bırakıldı (yer değiştirme)
  ticks(1);
  check(sess(uidA).page === 0 && vc.getItem(26)?.typeId === "aqualit:sayfa_ileri" && !player._cursor && vc.getItem(0)?.typeId === "minecraft:stick",
    "oka bırakılan çubuk boş yuvaya kondu, ok geri geldi, sayfa değişmedi");
  mk = vc.getItem(18);
  vc.setItem(18, undefined);
  player._inv.addItem(mk);                 // 1. sayfadan ◀: son sayfaya
  ticks(1);
  check(sess(uidA).page === 4 && count(vc, "aqualit:kilitli_yuva") === 17, "son sayfada kapasite dışındaki 17 yuva kilitli");
  mk = vc.getItem(10);
  vc.setItem(10, undefined);
  player._inv.addItem(mk);
  ticks(1);
  check(vc.getItem(10)?.typeId === "aqualit:kilitli_yuva" && player._inv.total("aqualit:kilitli_yuva") === 0, "kilitli yuva işareti alınamıyor");
  mk = vc.getItem(12);
  vc.setItem(12, new ItemStack("minecraft:apple", 2));
  player._cursor = mk;
  ticks(1);
  check(vc.getItem(12)?.typeId === "aqualit:kilitli_yuva" && vc.getItem(0)?.typeId === "minecraft:apple" && !player._cursor,
    "kilitli yuvaya konan elma açık yuvaya taşındı");
  // açık sayfa robotlara da görünür
  check(cont(hA).getItem(100)?.typeId === "minecraft:apple", "robotlar açık sayfadaki eşyayı görüyor");
  cont(hA).setItem(101, new ItemStack("minecraft:bread", 4));
  check(vc.getItem(1)?.typeId === "minecraft:bread", "robotun açık sayfaya koyduğu ekmek oyuncunun ekranında");
  close(player, A);
  t = chestTotals(hA);
  check(t["minecraft:cobblestone"] === 128 && t["minecraft:diamond"] === 3 && t["minecraft:gold_ingot"] === 5 && t["minecraft:emerald"] === 7
    && t["minecraft:stick"] === 1 && t["minecraft:apple"] === 2 && t["minecraft:bread"] === 4, "kapanınca bütün sayfalar depoda");
  check(filled(view(A)) === 0 && playerMarkers(player) === 0 && SK.loadUnit(uidA).page === 4, "sandık boş, oyuncuda işaret yok, son sayfa hatırlandı");

  // --- 5) huni: ok çekilirse oklar kapanır; kapalıyken giren eşya depoya
  open(player, A);
  vc = view(A);
  vc.setItem(26, undefined);               // huni çekti (oyuncuda değil)
  ticks(1);
  check(sess(uidA)?.noNav === true && !vc.getItem(18) && player.actionbar.some((x) => x.includes("huni")), "ok huniye kaçınca oklar kapandı, uyarı verildi");
  close(player, A);
  view(A).setItem(4, new ItemStack("minecraft:iron_ingot", 4));
  t = chestTotals(hA);
  check(t["minecraft:iron_ingot"] === 4 && filled(view(A)) === 0, "kapalı sandığa giren eşya (huni) depoya alındı");

  // --- 6) sahiplik
  const guest = MC.__makePlayer("Komsu", ow, { x: A.x + 0.5, y: G, z: A.z + 2.5 });
  let ev = { player: guest, block: ow.getBlock(A), blockFace: "South", itemStack: undefined, isFirstEvent: true, cancel: false };
  world.beforeEvents.playerInteractWithBlock.fire(ev);
  ticks(1);
  check(ev.cancel && guest.actionbar.some((x) => x.includes("Kral")), "başkası sandığı açamıyor (sahibinin adı yazıyor)");
  ev = { player: guest, block: ow.getBlock(A), cancel: false };
  world.beforeEvents.playerBreakBlock.fire(ev);
  ticks(2);
  check(ev.cancel && ow._cell(A).type === "minecraft:trapped_chest" && !!SK.loadUnit(uidA), "başkası sandığı kıramıyor");
  guest.isSneaking = true;
  let n0 = UI.shown.length;
  world.afterEvents.playerStartBreakingBlock.fire({ player: guest, block: ow.getBlock(A) });
  ticks(2);
  await flush();
  check(UI.shown.length === n0, "başkası sandık panelini açamıyor");
  guest.isSneaking = false;
  check(!place(guest, "genel", { x: A.x - 1, y: G, z: A.z }), "başkasının sandığının yanına sandık konamıyor");

  // --- 7) eğil + basılı tut: panel (kırılmaz)
  player.teleport({ x: A.x + 0.5, y: G, z: A.z + 2.5 });
  player.isSneaking = true;
  n0 = UI.shown.length;
  let panelTitle = null;
  UI.answers.push((f) => { panelTitle = f._title; return { canceled: true }; });
  world.afterEvents.playerStartBreakingBlock.fire({ player, block: ow.getBlock(A) });
  ev = { player, block: ow.getBlock(A), cancel: false };
  world.beforeEvents.playerBreakBlock.fire(ev);
  ticks(2);
  await flush();
  check(ev.cancel && ow._cell(A).type === "minecraft:trapped_chest", "eğilip basılı tutunca sandık kırılmadı");
  check(UI.shown.length > n0 && String(panelTitle).includes("Aqualit"), "eğilip basılı tutunca sandık paneli açıldı");
  player.isSneaking = false;

  // --- 8) yan yana koyma kuralları
  check(!place(player, null, { x: A.x - 1, y: G, z: A.z }), "Aqualit sandığının yanına sıradan tuzaklı sandık konamıyor");
  check(!place(player, "madenci", { x: A.x, y: G, z: A.z - 1 }), "farklı türdeki sandık tek sandığın yanına konamıyor");

  // --- 9) çift sandık
  const B = { x: A.x + 1, y: G, z: A.z };
  check(place(player, "genel", B, { pair: A }), "aynı türden ikinci sandık yanına kondu");
  let uU = SK.loadUnit(SK.unitIdAt(OW, B));
  check(SK.unitIdAt(OW, B) === uidA && !!uU?.double && uU.blocks.length === 2, "iki sandık tek çift sandık oldu (eski kayıt)");
  check(!SK.loadUnit(SK.idOf(OW, B)) && SK.resolveId(SK.idOf(OW, B)) === uidA, "yeni yarının kaydı eskisine katıldı");
  check(store.Chests.list(player.id).filter((c) => c.cid === uidA || c.cid === SK.idOf(OW, B)).length === 1, "telsiz listesinde tek sandık");
  check(deposOf(A).length === 1 && deposOf(B).length === 1, "iki yarıda da amblem plakası var");
  sm = SK.summary(uidA);
  check(sm.double && sm.cap === 135 && sm.max === 500, `çift sandık: 54 + 3x27 = ${sm.cap} yuva (en çok ${sm.max})`);
  open(player, B);
  vc = view(B);
  s = sess(uidA);
  check(!!s && vc.size === 54 && s.lay.pages === 3 && vc.getItem(53)?.typeId === "aqualit:sayfa_ileri" && vc.getItem(45)?.typeId === "aqualit:sayfa_geri",
    "çift sandık 54 yuva, 3 sayfa, oklar alt köşelerde");
  check(s?.page === 2 && count(vc, "aqualit:kilitli_yuva") === 21, "son sayfada 21 kilitli yuva");
  mk = vc.getItem(53);
  vc.setItem(53, undefined);
  player._inv.addItem(mk);
  ticks(1);
  check(sess(uidA)?.page === 0 && vc.getItem(0)?.typeId === "minecraft:stick", "çift sandıkta sayfa çevriliyor (son sayfadan başa)");
  close(player, B);
  const extra = { x: A.x, y: G, z: A.z + 1 };
  check(place(player, "madenci", extra) && SK.loadUnit(SK.unitIdAt(OW, extra))?.blocks.length === 1 && SK.loadUnit(uidA).blocks.length === 2,
    "çift sandığın yanına başka tür konabiliyor (üçüncü sandık birleşmez)");
  SK.breakChestAt(ow, extra, player, { noItem: true });
  takeDrops(extra);

  // --- 10) çiftin yarısını kır (ikinci yarı)
  let before = chestTotals(SK.getSandik(uidA));
  ev = { player, block: ow.getBlock(B), cancel: false };
  world.beforeEvents.playerBreakBlock.fire(ev);
  ticks(2);
  uU = SK.loadUnit(uidA);
  check(ev.cancel && ow._cell(B).type === "minecraft:air" && !!uU && !uU.double && uU.blocks.length === 1, "çiftin yarısı kırıldı, kalan yarı tek sandık");
  check(sameTotals(chestTotals(SK.getSandik(uidA)), before), "eşyaların hepsi kalan yarıya geçti");
  let dr = takeDrops(B);
  check(dr[CHEST_ITEM.genel] === 1 && deposOf(B).length === 0 && !SK.unitIdAt(OW, B), "kırılan yarı: sandık eşyası düştü, plakası ve kaydı silindi");

  // --- 11) yeniden çift yap, ana yarıyı kır: kayıt kalan yarıya taşınır
  check(place(player, "genel", B, { pair: A }) && !!SK.loadUnit(uidA)?.double, "yarı yeniden kondu, yine çift");
  before = chestTotals(SK.getSandik(uidA));
  ev = { player, block: ow.getBlock(A), cancel: false };
  world.beforeEvents.playerBreakBlock.fire(ev);
  ticks(2);
  const uidB = SK.idOf(OW, B);
  uU = SK.loadUnit(uidB);
  check(ow._cell(A).type === "minecraft:air" && !!uU && uU.blocks.length === 1 && SK.unitIdAt(OW, B) === uidB, "ana yarı kırıldı: sandık kalan yarının kimliğine taşındı");
  check(SK.resolveId(uidA) === uidB && SK.getSandik(uidA)?.id === uidB, "eski kimlik yenisine yönleniyor (robot bağlantısı kopmaz)");
  check(sameTotals(chestTotals(SK.getSandik(uidB)), before), "eşyalar korundu");
  check(store.Chests.list(player.id).some((c) => c.cid === uidB) && !store.Chests.list(player.id).some((c) => c.cid === uidA), "telsiz listesi güncellendi");
  const al = store.getJSON(world, "aq:salias", {});
  check(!Object.entries(al).some(([k, v]) => k === v || al[v]), "yönlendirme listesinde döngü yok");
  takeDrops(A);

  // --- 12) tek sandığı kır: bütün sayfalar + eklenen sandıklar düşer
  before = chestTotals(SK.getSandik(uidB));
  ev = { player, block: ow.getBlock(B), cancel: false };
  world.beforeEvents.playerBreakBlock.fire(ev);
  ticks(3);
  dr = takeDrops(B);
  check(ow._cell(B).type === "minecraft:air" && !SK.loadUnit(uidB) && !SK.unitIdAt(OW, B), "tek sandık kırıldı, kaydı silindi");
  check(Object.entries(before).every(([id, n]) => dr[id] === n), "bütün sayfalardaki eşyalar yere düştü");
  check(dr["minecraft:chest"] === 3 && dr[CHEST_ITEM.genel] === 1, "eklenen 3 sandık ve Aqualit sandığı geri düştü");
  check(deposOf(B).length === 0 && !store.Chests.list(player.id).some((c) => c.cid === uidB) && SK.resolveId(uidA) === uidA,
    "plaka, telsiz kaydı ve yönlendirmeler silindi");

  // --- 12b) büyük kapasite: 128 yuvayı aşınca görünmez ek depo; çift olunca eşyaların yeri değişmez
  const E = { x: 530, y: G, z: 500 };
  check(place(player, "madenci", E), "Madenci sandığı kondu");
  const uidE = SK.unitIdAt(OW, E);
  const maxCap = async () => {
    player.gameMode = "Creative";
    UI.answers.push((f) => ({ canceled: false, selection: f.buttons.findIndex((b) => b.text.includes("Kapasite")) }));
    UI.answers.push((f) => ({ canceled: false, formValues: [f.fields[0].max] }));
    await CU.chestMenu(player, SK.getSandik(uidE));
    player.gameMode = "Survival";
  };
  await maxCap();
  sm = SK.summary(uidE);
  check(sm.cap === 200 && sm.pages === 8, `yaratıcı modda kapasite en çoğa çıktı: ${sm.cap} yuva, ${sm.pages} sayfa`);
  let uE = SK.loadUnit(uidE);
  check(!!uE.blocks[0].ek && world.entities.some((e) => e.isValid && e.typeId === "aqualit:sandik_ek" && e.id === uE.blocks[0].ek),
    "128 yuvayı aşınca görünmez ek depo kondu");
  cont(SK.getSandik(uidE)).setItem(150, new ItemStack("minecraft:diamond_block", 9));
  cont(SK.getSandik(uidE)).setItem(199, new ItemStack("minecraft:emerald_block", 2));
  check(SK._test.stores(SK.loadUnit(uidE))[1].c.getItem(150 - 128)?.typeId === "minecraft:diamond_block", "128'den sonraki yuvalar ek depoda");
  const E2 = { x: E.x + 1, y: G, z: E.z };
  check(place(player, "madenci", E2, { pair: E }) && !!SK.loadUnit(uidE)?.double, "ek depolu sandığın yanına ikinci yarı kondu, çift oldu");
  let cE = cont(SK.getSandik(uidE));
  check(cE.getItem(150)?.typeId === "minecraft:diamond_block" && cE.getItem(199)?.typeId === "minecraft:emerald_block",
    "çift olunca eşyalar aynı yuvada (sayfadaki yerleri değişmedi)");
  check(SK.summary(uidE).cap === 243, "çift sandık: 54 + 7x27 = 243 yuva");
  await maxCap();
  sm = SK.summary(uidE);
  uE = SK.loadUnit(uidE);
  check(sm.cap === 500 && sm.pages === 10 && uE.blocks.every((b) => !!b.ek), "çift sandık 500 yuvaya çıktı (10 sayfa), iki yarıda da ek depo var");
  cont(SK.getSandik(uidE)).setItem(499, new ItemStack("minecraft:gold_block", 3));
  open(player, E);
  vc = view(E);
  mk = vc.getItem(45);
  vc.setItem(45, undefined);
  player._inv.addItem(mk);
  ticks(1);
  check(sess(uidE)?.page === 9 && vc.getItem(31)?.typeId === "minecraft:gold_block" && count(vc, "aqualit:kilitli_yuva") === 20,
    "500. yuva son sayfada, kalan 20 yuva kilitli");
  close(player, E);
  // sahipsiz kalmış depo varlığı (geç yüklenip yerine yenisi konmuş): eşyaları sandığa geçer
  const dup = ow.spawnEntity("aqualit:sandik_depo", { x: E.x + 0.5, y: G + 0.25, z: E.z + 0.95 });
  dup._dp["aq:blk"] = SK.idOf(OW, E);
  dup._inv.addItem(new ItemStack("minecraft:lapis_lazuli", 33));
  world.afterEvents.entityLoad.fire({ entity: dup });
  ticks(12);
  check(!dup.isValid && amt(SK.getSandik(uidE), "minecraft:lapis_lazuli") === 33, "fazladan depo varlığının eşyaları sandığa geçti");
  const lone = ow.spawnEntity("aqualit:sandik_ek", { x: 540.5, y: G, z: 500.5 });
  lone._dp["aq:blk"] = SK.idOf(OW, { x: 540, y: G, z: 500 });
  lone._inv.addItem(new ItemStack("minecraft:redstone", 5));
  world.afterEvents.entityLoad.fire({ entity: lone });
  ticks(12);
  dr = takeDrops({ x: 540, y: G, z: 500 });
  check(!lone.isValid && dr["minecraft:redstone"] === 5, "sandığı olmayan depo varlığının eşyaları yere düştü");
  const deposAt = (p) => world.entities.filter((e) => e.isValid && /^aqualit:sandik_(depo|ek)$/.test(e.typeId) && e._dp["aq:blk"] === SK.idOf(OW, p)).length;
  before = chestTotals(SK.getSandik(uidE));
  world.beforeEvents.playerBreakBlock.fire({ player, block: ow.getBlock(E2), cancel: false });
  ticks(2);
  check(sameTotals(chestTotals(SK.getSandik(uidE)), before) && !SK.loadUnit(uidE).double && deposAt(E2) === 0,
    "ek depolu çiftin yarısı kırıldı: eşyalar korundu, o yarının iki depo varlığı kalktı");
  takeDrops(E2);
  before = chestTotals(SK.getSandik(uidE));
  world.beforeEvents.playerBreakBlock.fire({ player, block: ow.getBlock(E), cancel: false });
  ticks(3);
  dr = takeDrops(E);
  check(dr["minecraft:chest"] === 17 && Object.entries(before).every(([id, n]) => dr[id] === n) && deposAt(E) === 0,
    "kırınca her şey düştü (eklenen 17 sandık geri), bütün depo varlıkları kalktı");

  // --- 13) patlama, türlü sandıklar, panelden kaldırma
  const Cp = { x: 506, y: G, z: 500 };
  check(place(player, "toplayici", Cp), "Toplayıcı sandığı kondu");
  check(deposOf(Cp)[0]?._props["aqualit:kind"] === "toplayici" && SK.loadUnit(SK.unitIdAt(OW, Cp))?.kind === "toplayici", "plakada Toplayıcı amblemi");
  let kept = null;
  ev = { getImpactedBlocks: () => [ow.getBlock(Cp), ow.getBlock({ x: 506, y: GROUND - 1, z: 501 })], setImpactedBlocks: (l) => (kept = l), cancel: false };
  world.beforeEvents.explosion.fire(ev);
  check(kept?.length === 1 && kept[0].typeId !== "minecraft:trapped_chest", "patlama Aqualit sandığını kırmıyor");
  const hC = SK.sandikAt(ow, Cp);
  cont(hC).addItem(new ItemStack("minecraft:coal", 20));
  player._inv.slots.fill(undefined);
  UI.answers.push((f) => ({ canceled: false, selection: f.buttons.findIndex((b) => b.text.includes("kaldır")) }));
  UI.answers.push((f) => ({ canceled: false, selection: 0 }));
  await CU.chestMenu(player, hC);
  check(ow._cell(Cp).type === "minecraft:air" && !SK.unitIdAt(OW, Cp) && player._inv.total("minecraft:coal") === 20 && player._inv.total(CHEST_ITEM.toplayici) === 1,
    "panelden kaldırınca içindekiler ve sandık oyuncuya geldi");
  // yaratıcı modda kırınca sandık eşyası düşmez
  const Dp = { x: 506, y: G, z: 504 };
  place(player, "kilicli", Dp);
  player.gameMode = "Creative";
  world.beforeEvents.playerBreakBlock.fire({ player, block: ow.getBlock(Dp), cancel: false });
  ticks(2);
  dr = takeDrops(Dp);
  check(ow._cell(Dp).type === "minecraft:air" && !dr[CHEST_ITEM.kilicli], "yaratıcı modda kırınca sandık eşyası düşmüyor");
  player.gameMode = "Survival";

  // --- 14) eski varlık sandığını taşıma (robotu bağlı)
  const Mp = { x: 510, y: G, z: 500 };
  const old = ow.spawnEntity("aqualit:robot_chest", { x: Mp.x + 0.5, y: G, z: Mp.z + 0.5 }, { initialRotation: 0 });
  old._props["aqualit:kind"] = "oduncu";
  Object.assign(old._dp, { "aq:owner": player.id, "aq:ownerName": "Kral", "aq:cid": "eskiC1", "aq:kind": "oduncu",
    "aq:access": JSON.stringify({ allow: ["R1"], deny: [], only: true }) });
  old.nameTag = "Odun deposu";
  old._inv.addItem(new ItemStack("minecraft:oak_log", 40));
  old._inv.setItem(9, new ItemStack("minecraft:iron_axe", 1));
  store.Chests.upsert(player.id, { cid: "eskiC1", kind: "oduncu", dim: OW, pos: { ...Mp }, name: "Odun deposu" });
  const made = PL.createRobot(player, ow, { x: Mp.x + 2, y: G, z: Mp.z }, { type: "oduncu", model: 1, chest: old.id,
    home: { x: Mp.x + 0.5, y: G, z: Mp.z + 0.5 }, homeDim: OW });
  ticks(3);
  const rb = [...brain.bots.values()].find((b) => b.e === made.e);
  check(rb?.homeChest()?.id === old.id, "robot eski varlık sandığına bağlı");
  world.afterEvents.entityLoad.fire({ entity: old });
  ticks(7);
  const uidM = SK.idOf(OW, Mp);
  const uM = SK.loadUnit(uidM);
  check(!old.isValid && ow._cell(Mp).type === "minecraft:trapped_chest" && !!uM, "eski varlık sandığı yerinde gerçek sandığa dönüştü");
  check(uM?.kind === "oduncu" && uM.name === "Odun deposu" && uM.owner === player.id && uM.access?.only === true, "türü, adı, sahibi, erişim ayarı korundu");
  const tM = chestTotals(SK.getSandik(uidM));
  check(tM["minecraft:oak_log"] === 40 && tM["minecraft:iron_axe"] === 1, "eşyaları taşındı");
  check(SK.resolveId(old.id) === uidM && SK.resolveId("eskiC1") === uidM, "eski sandık kimlikleri yenisine yönleniyor");
  check(!store.Chests.list(player.id).some((c) => c.cid === "eskiC1") && store.Chests.list(player.id).some((c) => c.cid === uidM), "telsiz listesinde yeni sandık");
  check(ow._cell(Mp).states["minecraft:cardinal_direction"] === "south", "sandığın önü eski sandığın baktığı yöne bakıyor");
  const hb = rb?.homeChest();
  const hc = rb ? ow._cell({ x: Math.floor(rb.home.x), y: Math.floor(rb.home.y), z: Math.floor(rb.home.z) }).type : "";
  check(hb?.id === uidM && rb.chestId === uidM && hc === "minecraft:air"
    && Math.abs(rb.home.x - (Mp.x + 0.5)) + Math.abs(rb.home.z - (Mp.z + 0.5)) === 1, "robot yeni sandığa bağlandı, evi sandığın önündeki boş hücre");
  const old2 = ow.spawnEntity("aqualit:robot_chest", { x: 512.5, y: GROUND, z: 500.5 });
  check(SK.migrateOld(old2) === false && old2.isValid, "yeri doluysa eski sandık olduğu gibi kalıyor");
  old2.remove();
  safe(() => made.e.remove());
  brain.bots.delete(made.e.id);

  // --- 15) düşen işaretler, oyuncuda kalan işaretler
  const dropM = ow.spawnItem(new ItemStack("aqualit:sayfa_ileri", 1), { x: 500.5, y: G, z: 504.5 });
  world.afterEvents.entitySpawn.fire({ entity: dropM, cause: "Spawned" });
  check(!dropM.isValid, "yere düşen sayfa oku siliniyor");
  player._inv.setItem(20, new ItemStack("aqualit:kilitli_yuva", 1));
  ticks(101);
  check(player._inv.total("aqualit:kilitli_yuva") === 0, "sandık kapalıyken oyuncuda kalan işaret siliniyor");

  // --- 16) yön ölçümü: oyunun yön durumu ters çıkarsa
  world.setDynamicProperty("aq:sandik_ters", undefined);
  FLIP = true;
  const Fp = { x: 514, y: G, z: 506 };
  place(player, "genel", Fp, { yaw: -90 });          // yana bakarak koydu: ölçülmez
  check(world.getDynamicProperty("aq:sandik_ters") === undefined, "yana bakarak konan sandıkla yön ölçülmedi");
  SK.breakChestAt(ow, Fp, player, { noItem: true });
  takeDrops(Fp);
  const Fp2 = { x: 518, y: G, z: 506 };
  place(player, "genel", Fp2);
  check(world.getDynamicProperty("aq:sandik_ters") === true, "ters yön durumu ölçüldü");
  check(Math.abs((deposOf(Fp2)[0]?.location.z ?? 0) - (Fp2.z + 0.945)) < 0.01, "plaka yine oyuncuya bakan yüzde");
  const Sp = { x: 522, y: G, z: 506 };
  const hS = SK.placeChestBlock(ow, Sp, "genel", { id: player.id, name: player.name }, { x: Sp.x + 0.5, y: G, z: Sp.z + 4 });
  check(!!hS && ow._cell(Sp).states["minecraft:cardinal_direction"] === "north" && Math.abs((deposOf(Sp)[0]?.location.z ?? 0) - (Sp.z + 0.945)) < 0.01,
    "betikle konan sandık da ters dünyada doğru yöne bakıyor");
  FLIP = false;
  world.setDynamicProperty("aq:sandik_ters", false);
  guest.remove();
}

console.log(fails ? `\nBAŞARISIZ: ${fails}` : "\nTÜM DENEMELER GEÇTİ");
process.exit(fails ? 1 : 0);
