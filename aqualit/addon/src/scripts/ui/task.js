// Aqualit Robotları — Görev Kumandası: robota görev verme
import { system } from "@minecraft/server";
import { menu, modal, pickMany, confirm, AMOUNTS, amountIndex } from "./forms.js";
import { TYPE_NAME, TYPE_TOOL, robotIcon, DIST_OPTS, DIST_LABELS, distIndex, distText } from "../constants.js";
import * as B from "../blocks.js";
import { startTask, commandStop, commandResume, commandReturn, bots } from "../brain.js";
import { pickupRobot } from "../place.js";
import { fmtPos, safe, V } from "../util.js";
import { setProp, getProp } from "../store.js";
import { rodRobot } from "./kilicli_ui.js";
import { bagMenu, EDIT_RANGE } from "./canta.js";
import { mimarMenu, yapi } from "../mimar.js";
import { Yerler } from "../harita.js";
import { YAPI, ikon, takipHedefiSec } from "../kesif_ai.js";

const TOOL_ICON = {
  madenci: "textures/items/aqualit_pickaxe", kurekci: "textures/items/aqualit_shovel",
  ciftci: "textures/items/aqualit_hoe", oduncu: "textures/items/aqualit_axe", kilicli: "textures/items/aqualit_sword",
  insaatci: "textures/items/robot_insaatci",
};

function catalog(type) {
  if (type === "madenci") return { list: B.ORES, by: B.ORE_BY_KEY, word: "maden" };
  if (type === "kurekci") return { list: B.SHOVEL, by: B.SHOVEL_BY_KEY, word: "blok" };
  if (type === "ciftci") return { list: B.CROPS, by: B.CROP_BY_KEY, word: "ürün" };
  if (type === "oduncu") return { list: B.LOGS, by: B.LOG_BY_KEY, word: "kütük" };
  return { list: [], by: {}, word: "" };
}

export function describeTask(bot) {
  const T = bot.task;
  if (!T) return "Görev yok";
  if (T.mode === "skyblock") return `Taş makinesinden ${T.items?.[0]?.amount ?? 0} taş`;
  if (T.mode === "yagma") return `Yağma: ${T.ad ?? "seçilen yer"} (${T.r} blok çevre)`;
  if (T.mode === "takip") return `${T.ad} takip ediliyor`;
  if (T.type === "insaatci") {
    const y = yapi(T.yapi);
    const pct = y ? Math.min(100, Math.floor(((bot.prog?.done ?? 0) * 100) / Math.max(1, y.blok))) : 0;
    return `${y?.ad ?? T.yapi} inşası${T.done ? "" : ` %${pct}`}${T.free ? " (malzemesiz)" : ""}`;
  }
  const { by } = catalog(bot.type);
  const parts = (T.items ?? []).map((i) => {
    const got = bot.prog?.got?.[i.key] ?? 0;
    return `${by[i.key]?.name ?? i.key} ${T.done ? i.amount : got}/${i.amount}`;
  });
  return parts.join(", ") || "Görev yok";
}

export function inventoryText(bot) {
  const m = bot.contents();
  if (!m.size) return "§7Çantası boş.";
  return [...m].map(([id, n]) => `§f${n} §7${id.replace("minecraft:", "").replace("aqualit:", "").replace(/_/g, " ")}`).join("\n");
}

/** Görev kumandası ile robota dokununca açılan menü. */
export async function robotMenu(player, bot) {
  if (bot.type === "kilicli") return rodRobot(player, bot);
  const T = bot.task;
  const active = T && !T.done && !T.paused;
  const body = [
    `§7Tür: §f${TYPE_NAME[bot.type]} robot`,
    `§7Durum: §f${bot.status}`,
    `§7Görev: §f${T && !T.done ? describeTask(bot) : "yok"}${T?.paused ? " §e(durduruldu)" : ""}`,
    `§7Konum: §f${fmtPos(bot.loc)}`,
    `§7En fazla uzaklık: §f${distText(bot.maxDist)}`,
  ].join("\n");
  const btns = [{ text: "§lGörev ver", icon: TOOL_ICON[bot.type], act: "task" }];
  if (bot.type !== "insaatci") btns.push({ text: "§lYağmala§r\n§7Sandık, fıçı, çömlek, kasa boşaltır", icon: "textures/blocks/barrel_side", act: "yagma" });
  const takipte = T?.mode === "takip" && !T.done;
  btns.push(takipte
    ? { text: "§l§cTakibi bırak§r\n§7Eve döner", icon: "textures/ui/cancel", act: "takip_birak" }
    : { text: "§lBeni takip et§r\n§7Peşinden gelir", icon: "textures/items/lead", act: "takip" });
  if (!takipte) btns.push({ text: "§lBirini takip et§r\n§7Başka bir robotun, Keşif'in ya da oyuncunun peşinden gider", icon: "textures/items/lead", act: "takip_biri" });
  if (active) btns.push({ text: "Görevi durdur", icon: "textures/items/clock_item", act: "stop" });
  else if (T && !T.done) btns.push({ text: "Görevi sürdür", icon: "textures/items/clock_item", act: "resume" });
  btns.push({ text: "Çantası", icon: "textures/items/aqualit_chest", act: "inv" });
  btns.push({ text: "Hemen geri dön", icon: "textures/items/compass_item", act: "back" });
  const bos = getProp(bot.e, "aq:bos", true) !== false;
  btns.push({ text: `Boş zaman işleri: ${bos ? "§aAÇIK" : "§cKAPALI"}§r\n§7Görev yokken eritme, kit yapma, hasat`, icon: "textures/items/clock_item", act: "bos" });
  btns.push({ text: "İsim ver", icon: "textures/items/name_tag", act: "name" });
  btns.push({ text: "Robotu topla", icon: robotIcon(bot.type, bot.model), act: "pick" });
  const r = await menu(player, `§l${bot.name}`, body, btns);
  if (!r) return;
  switch (r.act) {
    case "task": return giveTask(player, bot);
    case "yagma": return yagmaTask(player, bot);
    case "takip":
      bot.task = { type: bot.type, mode: "takip", kim: player.id, ad: player.name };
      bot.saveTask();
      startTask(bot);
      return player.sendMessage(`§s${bot.name}§r seni takip ediyor.`);
    case "takip_biri": {
      const h = await takipHedefiSec(player, bot.id, `${bot.name} · birini takip et`);
      if (!h || !bot.valid) return;
      bot.task = { type: bot.type, mode: "takip", kim: h.id, ad: h.ad };
      bot.saveTask();
      startTask(bot);
      return player.sendMessage(`§s${bot.name}§r artık ${h.ad} adlı hedefi takip ediyor.`);
    }
    case "takip_birak":
      if (bot.task) {
        bot.task.done = true;
        bot.saveTask();
      }
      commandReturn(bot, false);
      return player.sendMessage(`§s${bot.name}§r takibi bıraktı, eve dönüyor.`);
    case "stop": commandStop(bot); return player.sendMessage(`§s${bot.name}§r görevi durdurdu.`);
    case "resume": commandResume(bot); return player.sendMessage(`§s${bot.name}§r göreve devam ediyor.`);
    case "inv": {
      await bagMenu(player, { title: `§l${bot.name} · çanta`, container: () => bot.inv,
        canEdit: () => V.dist(player.location, bot.loc) <= EDIT_RANGE });
      return robotMenu(player, bot);
    }
    case "back": return commandReturn(bot, false);
    case "bos": {
      const on = getProp(bot.e, "aq:bos", true) === false;
      setProp(bot.e, "aq:bos", on);
      player.sendMessage(`§s${bot.name}§r: boş zaman işleri ${on ? "§aaçık" : "§ckapalı"}§r.`);
      return robotMenu(player, bot);
    }
    case "name": return renameRobot(player, bot);
    case "pick": {
      if (V.dist(player.location, bot.loc) > 12) return player.sendMessage("§cRobotu toplamak için yanına git.");
      const ok = await confirm(player, "Robotu topla", `§f${bot.name}§r eşyaya dönüşsün mü? Çantasındakiler sandığına konur.`, "Topla");
      if (ok) pickupRobot(player, bot);
      return;
    }
  }
}

export async function renameRobot(player, bot) {
  const v = await modal(player, "İsim ver", [{ type: "text", label: "Robotun yeni adı", placeholder: bot.name, value: bot.name }], "Kaydet");
  if (!v) return;
  const name = String(v[0] ?? "").trim().slice(0, 24);
  if (!name) return;
  bot.name = name;
  setProp(bot.e, "aq:name", name);
  bot.e.nameTag = name;
  bot.updateIndex(true);
  player.sendMessage(`§sRobotun yeni adı: §f${name}`);
}

/** Türüne göre görev sihirbazı. */
export async function giveTask(player, bot) {
  if (bot.type === "insaatci") return mimarMenu(player, bot, (b, plan) => beginTask(player, b, plan));
  let task = null;
  if (bot.type === "madenci") task = await minerTask(player, bot);
  else if (bot.type === "kurekci") task = await diggerTask(player, bot);
  else if (bot.type === "ciftci") task = await farmerTask(player, bot);
  else if (bot.type === "oduncu") task = await lumberTask(player, bot);
  if (!task) return;
  beginTask(player, bot, task);
}

function beginTask(player, bot, task) {
  bot.task = task;
  bot.saveTask();
  if (task.maxDist) {
    bot.maxDist = task.maxDist;
    setProp(bot.e, "aq:maxd", task.maxDist);
  }
  startTask(bot);
  player.sendMessage(`§s${bot.name}§r: Göreve başlıyorum! (${describeTask(bot)})`);
  safe(() => player.playSound("random.levelup", { pitch: 1.8, volume: 0.5 }));
}

/** Yağma görevi: yer ve çevre seçilir. */
async function yagmaTask(player, bot) {
  const btns = [{ text: "§lBulunduğum yer§r\n§7Senin çevren", icon: "textures/items/compass_item", v: "ben" }];
  for (const y of Yerler.list(player.id).filter((y) => y.dim === bot.dim.id && YAPI[y.tur]).slice(-20).reverse()) {
    btns.push({ text: `§l${y.ad}§r\n§7Keşif buldu · ${Math.round(V.hdist(y.pos, bot.loc))} blok`, icon: ikon(y.tur), y });
  }
  const r = await menu(player, `${bot.name} · yağma`, "Nereyi yağmalasın? Senin Aqualit sandıklarına ve üssünün 24 blok çevresine dokunmaz.\n§7Uzak yerler için Keşif'le sefer düzenlemek daha hızlı.", btns);
  if (!r) return;
  const o = await modal(player, `${bot.name} · yağma`, [
    { type: "dropdown", label: "Ne kadar çevresi?", items: ["16 blok", "32 blok", "48 blok"], value: 1 },
  ], "Başla");
  if (!o) return;
  const merkez = r.y ? r.y.pos : { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  beginTask(player, bot, { type: bot.type, mode: "yagma", merkez, dim: bot.dim.id, r: [16, 32, 48][o[0]] ?? 32,
    ad: r.y?.ad ?? "senin yanın", tur: r.y?.tur, finish: "chest" });
}

async function amounts(player, title, keys, by, def = 16) {
  const fields = keys.map((k) => ({ type: "dropdown", label: `§f${by[k].name}§7 — kaç tane?`, items: AMOUNTS.map(String),
    value: amountIndex(def) }));
  const v = await modal(player, title, fields, "Devam");
  if (!v) return undefined;
  return keys.map((k, i) => ({ key: k, amount: AMOUNTS[v[i]] ?? def }));
}

async function minerTask(player, bot) {
  const mode = await menu(player, "Madenci · görev türü", "Ne yapsın?", [
    { text: "§lMaden topla§r\n§7Seçtiğin madenleri arar ve kazar", icon: "textures/items/diamond", v: "normal" },
    { text: "§lSkyblock taş makinesi§r\n§7En yakın taş makinesinden taş kırar", icon: "textures/blocks/cobblestone", v: "skyblock" },
  ]);
  if (!mode) return null;
  if (mode.v === "skyblock") {
    const v = await modal(player, "Taş makinesi", [
      { type: "dropdown", label: "Kaç taş kırsın?", items: AMOUNTS.map(String), value: amountIndex(64) },
    ], "Başla");
    if (!v) return null;
    return { type: "madenci", mode: "skyblock", items: [{ key: "tas", amount: AMOUNTS[v[0]] }], finish: "chest" };
  }
  const inNether = bot.dim.id.includes("nether");
  const opts = B.ORES.filter((o) => !!o.nether === inNether || o.key === "aqualit" && !inNether).map((o) => ({
    key: o.key, name: o.name, icon: o.icon, note: o.nether ? "Nether" : `en iyi derinlik y=${o.y}`,
  }));
  const keys = await pickMany(player, "Madenci · hangi madenler?", "Toplanacak madenlere dokun, sonra Devam'a bas.", opts,
    (bot.task?.items ?? []).map((i) => i.key).filter((k) => B.ORE_BY_KEY[k]));
  if (!keys) return null;
  const items = await amounts(player, "Madenci · miktarlar", keys, B.ORE_BY_KEY, 16);
  if (!items) return null;
  const o = await modal(player, "Madenci · seçenekler", [
    { type: "dropdown", label: "Ararken güzel bir şey bulursa (elmas, altın...)", items: ["Al", "Alma", "Bana sor"], value: 0 },
    { type: "dropdown", label: "İş bitince", items: ["Hemen sandığa getir", "Fırında eritip sandığa koy"], value: 0 },
    { type: "toggle", label: "Kazdığı taşları da topla", value: false },
    { type: "dropdown", label: "Sandıktan en fazla uzaklık", items: DIST_LABELS, value: distIndex(bot.maxDist ?? 256) },
  ], "Başla");
  if (!o) return null;
  return {
    type: "madenci", mode: "normal", items,
    bonus: ["al", "alma", "sor"][o[0]] ?? "al",
    finish: o[1] === 1 ? "smelt" : "chest",
    stone: !!o[2],
    maxDist: DIST_OPTS[o[3]] ?? 256,
  };
}

async function diggerTask(player, bot) {
  const opts = B.SHOVEL.map((s) => ({ key: s.key, name: s.name, icon: s.icon, note: s.smeltName ? `fırında → ${s.smeltName}` : "" }));
  const keys = await pickMany(player, "Kürekçi · ne toplasın?", "Toplanacaklara dokun, sonra Devam'a bas.", opts);
  if (!keys) return null;
  const items = await amounts(player, "Kürekçi · miktarlar", keys, B.SHOVEL_BY_KEY, 64);
  if (!items) return null;
  const o = await modal(player, "Kürekçi · seçenekler", [
    { type: "dropdown", label: "İş bitince", items: ["Sandığa getir", "Fırında erit (kum → cam, kil → tuğla) ve sandığa koy"], value: 0 },
    { type: "dropdown", label: "Sandıktan en fazla uzaklık", items: DIST_LABELS, value: distIndex(bot.maxDist ?? 128) },
  ], "Başla");
  if (!o) return null;
  return { type: "kurekci", items, finish: o[0] === 1 ? "smelt" : "chest", maxDist: DIST_OPTS[o[1]] ?? 128 };
}

async function farmerTask(player, bot) {
  const opts = B.CROPS.map((c) => ({ key: c.key, name: c.name, icon: c.icon, note: c.plant ? "eker ve hasat eder" : "hasat eder" }));
  const keys = await pickMany(player, "Çiftçi · ne toplasın?", "Toplanacak ürünlere dokun, sonra Devam'a bas.", opts);
  if (!keys) return null;
  const items = await amounts(player, "Çiftçi · miktarlar", keys, B.CROP_BY_KEY, 32);
  if (!items) return null;
  const o = await modal(player, "Çiftçi · seçenekler", [
    { type: "toggle", label: "Yakında tarla yoksa yeni tarla aç (gerekirse su getirir)", value: true },
    { type: "dropdown", label: "Sandıktan en fazla uzaklık", items: DIST_LABELS, value: distIndex(bot.maxDist ?? 128) },
  ], "Başla");
  if (!o) return null;
  return { type: "ciftci", items, makeFarm: !!o[0], finish: "chest", maxDist: DIST_OPTS[o[1]] ?? 128 };
}

async function lumberTask(player, bot) {
  const inNether = bot.dim.id.includes("nether");
  const opts = B.LOGS.filter((l) => !!l.nether === inNether).map((l) => ({ key: l.key, name: l.name, icon: l.icon }));
  const keys = await pickMany(player, "Oduncu · hangi ağaçlar?", "Kesilecek ağaç türlerine dokun, sonra Devam'a bas.", opts);
  if (!keys) return null;
  const items = await amounts(player, "Oduncu · kaç kütük?", keys, B.LOG_BY_KEY, 32);
  if (!items) return null;
  const o = await modal(player, "Oduncu · seçenekler", [
    { type: "toggle", label: "Kestiği yere fidan dik", value: true },
    { type: "toggle", label: "Yaprakları da kır (fidan ve elma toplar)", value: false },
    { type: "dropdown", label: "Sandıktan en fazla uzaklık", items: DIST_LABELS, value: distIndex(bot.maxDist ?? 128) },
  ], "Başla");
  if (!o) return null;
  return { type: "oduncu", items, replant: !!o[0], leaves: !!o[1], finish: "chest", maxDist: DIST_OPTS[o[2]] ?? 128 };
}

/** Kumanda havaya kullanılınca: bakılan robot ya da yakındaki robotlar listesi. */
export async function remoteFromAir(player) {
  const hit = safe(() => player.getEntitiesFromViewDirection({ maxDistance: 12 }), []);
  for (const h of hit ?? []) {
    const e = h.entity;
    if (e?.typeId === "aqualit:robot") {
      const b = [...bots.values()].find((x) => x.id === e.id);
      if (b && b.owner === player.id) return robotMenu(player, b);
    }
  }
  const mine = [...bots.values()].filter((b) => b.owner === player.id && b.valid)
    .sort((a, b) => V.dist(a.loc, player.location) - V.dist(b.loc, player.location)).slice(0, 20);
  if (!mine.length) return player.sendMessage("§7Yüklü bir robotun yok. Robot koymak için robot eşyasını yere kullan.");
  const r = await menu(player, "Görev Kumandası", "Hangi robota görev vereceksin? (Robota kumandayla dokunarak da açabilirsin.)",
    mine.map((b) => ({ text: `${b.name}\n§7${b.status} · ${Math.round(V.dist(b.loc, player.location))} blok`,
      icon: robotIcon(b.type, b.model), b })));
  if (r) return robotMenu(player, r.b);
}
