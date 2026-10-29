// Aqualit Robotları — Aqualit sandığı paneli (eğil + sandığa basılı tut)
import { GameMode } from "@minecraft/server";
import { menu, modal, confirm } from "./forms.js";
import { getJSON, setJSON, getProp, Chests, Robots } from "../store.js";
import { CHEST_NAME, TYPE_NAME } from "../constants.js";
import { pickupChest } from "../place.js";
import { safe, fire } from "../util.js";
import { bagMenu, EDIT_RANGE } from "./canta.js";
import { Sandik, loadUnit, summary, addCapacity, roomForChests, setOpenPage, setPanelHook, CAP } from "../sandik.js";

function kindOf(ch) {
  return safe(() => ch.getProperty("aqualit:kind"), "genel");
}
const creative = (p) => safe(() => p.getGameMode() === GameMode.Creative, false);

export async function chestMenu(player, ch) {
  const owner = getProp(ch, "aq:owner", "");
  if (owner && owner !== player.id) {
    return player.sendMessage(`§cBu sandık ${getProp(ch, "aq:ownerName", "başka bir oyuncu")}'ya ait.`);
  }
  const kind = kindOf(ch);
  const name = ch.nameTag || CHEST_NAME[kind];
  const isNew = ch instanceof Sandik;
  const sm = isNew ? summary(ch.id) : null;
  const body = sm
    ? `§7${sm.double ? "Çift" : "Tek"} sandık · §f${sm.used}/${sm.cap}§7 yuva dolu · §f${sm.pages}§7 sayfa\n`
      + `§7Dokun: aç · Basılı tut: kır (içindekiler düşer) · Eğil + basılı tut: bu panel`
    : "§7Sandığa normal dokununca açılır. Bu menü robot ayarları içindir.";
  const btns = [{ text: "§lİçindekiler§r\n§7Bütün sayfalar, al ve koy", icon: "textures/items/aqualit_chest", act: "list" }];
  if (sm) {
    btns.push({ text: `§lKapasite§r §8(${sm.cap}/${sm.max})\n§7Sandık ekle: +${CAP.perChest} yuva`, icon: "textures/items/locked_slot", act: "cap" });
    if (sm.pages > 1) btns.push({ text: "Açılış sayfası\n§7Sandık hangi sayfada açılsın", icon: "textures/items/sayfa_ileri", act: "page" });
  }
  btns.push({ text: "§lErişim§r\n§7Hangi robotlar kullanabilir", icon: "textures/items/name_tag", act: "access" });
  btns.push({ text: "İsim ver", icon: "textures/items/name_tag", act: "name" });
  btns.push({ text: "§cSandığı kaldır§r\n§7İçindekiler ve sandık sana verilir", act: "pick" });
  const c = await menu(player, `§l${name}`, body, btns);
  if (!c) return;
  if (c.act === "access") return accessForm(player, ch);
  if (c.act === "list") return contentsMenu(player, ch);
  if (c.act === "cap") return capacityForm(player, ch);
  if (c.act === "page") return pageForm(player, ch);
  if (c.act === "name") {
    const v = await modal(player, "Sandığa isim ver", [{ type: "text", label: "İsim", placeholder: name, value: ch.nameTag }], "Kaydet");
    if (!v) return;
    ch.nameTag = String(v[0] ?? "").slice(0, 24);
    if (!isNew) Chests.upsert(player.id, { cid: getProp(ch, "aq:cid", ""), name: ch.nameTag });
    return;
  }
  if (c.act === "pick") {
    if (await confirm(player, "Sandığı kaldır", "Sandık eşyaya dönüşsün mü? Bütün sayfalardaki eşyalar envanterine gelir, sığmayan yere düşer.", "Kaldır")) {
      pickupChest(player, ch);
    }
  }
}

function countChests(player) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  let n = 0;
  if (inv) for (let i = 0; i < inv.size; i++) {
    const it = safe(() => inv.getItem(i));
    if (it?.typeId === "minecraft:chest") n += it.amount;
  }
  return n;
}
function takeChests(player, n) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  if (!inv) return 0;
  let left = n;
  for (let i = 0; i < inv.size && left > 0; i++) {
    const it = safe(() => inv.getItem(i));
    if (it?.typeId !== "minecraft:chest") continue;
    const use = Math.min(left, it.amount);
    left -= use;
    if (use >= it.amount) inv.setItem(i, undefined);
    else {
      it.amount -= use;
      inv.setItem(i, it);
    }
  }
  return n - left;
}

async function capacityForm(player, h) {
  const u = loadUnit(h.id);
  if (!u) return;
  const sm = summary(h.id);
  const room = roomForChests(u);
  if (room <= 0) return player.sendMessage(`§eBu sandığın kapasitesi dolu (${sm.cap} yuva, en çok ${sm.max}).`);
  const free = creative(player);
  const have = free ? room : countChests(player);
  if (have <= 0) {
    return player.sendMessage(`§eEnvanterinde normal sandık yok. Her sandık +${CAP.perChest} yuva açar (şu an ${sm.cap}/${sm.max}).`);
  }
  const most = Math.min(room, have);
  let n = 1;
  if (most > 1) {
    const v = await modal(player, "Kapasite", [
      { type: "slider", label: `Şu an §f${sm.cap}§r yuva (en çok ${sm.max}). Kaç sandık eklensin? (her biri +${CAP.perChest})`,
        min: 1, max: most, value: most },
    ], "Ekle");
    if (!v) return;
    n = Math.max(1, Math.min(most, Number(v[0]) | 0));
  } else if (!(await confirm(player, "Kapasite", `1 sandık eklenip +${CAP.perChest} yuva açılsın mı? (şu an ${sm.cap}/${sm.max})`, "Ekle"))) return;
  const used = free ? n : takeChests(player, n);
  if (used <= 0) return;
  const gained = addCapacity(loadUnit(h.id), used);
  const after = summary(h.id);
  safe(() => player.playSound("random.levelup", { pitch: 1.6 }));
  player.sendMessage(`§sSandık kapasitesi §f${after.cap}§s yuvaya çıktı (+${gained}). Sayfa sayısı: ${after.pages}.`);
}

async function pageForm(player, h) {
  const u = loadUnit(h.id);
  const sm = summary(h.id);
  if (!u || !sm) return;
  const items = Array.from({ length: sm.pages }, (_, i) => `Sayfa ${i + 1}`);
  const v = await modal(player, "Açılış sayfası", [
    { type: "dropdown", label: "Sandık açılınca hangi sayfa görünsün?", items, value: Math.min(sm.pages - 1, u.page ?? 0) },
  ], "Kaydet");
  if (!v) return;
  setOpenPage(loadUnit(h.id), Number(v[0]) | 0);
  player.sendMessage(`§sSandık bir dahaki açılışta §fsayfa ${(Number(v[0]) | 0) + 1}§s ile açılacak.`);
}

async function accessForm(player, ch) {
  const kind = kindOf(ch);
  const acc = getJSON(ch, "aq:access", { allow: [], deny: [], only: false });
  const robots = Robots.list(player.id).filter((r) => r.type !== "kilicli" || kind === "genel" || kind === "kilicli");
  if (!robots.length) return player.sendMessage("§7Henüz robotun yok.");
  const fields = robots.map((r) => {
    const base = kind === "genel" || kind === r.type;
    const on = acc.deny?.includes(r.rid) ? false : acc.allow?.includes(r.rid) ? true : acc.only ? false : base;
    return { type: "toggle", label: `${r.name} §8(${TYPE_NAME[r.type] ?? ""})`, value: on };
  });
  fields.push({ type: "toggle", label: "§7Sadece işaretlediklerim kullanabilsin", value: !!acc.only });
  const v = await modal(player, `Erişim · ${ch.nameTag || CHEST_NAME[kind]}`, fields, "Kaydet");
  if (!v) return;
  const only = !!v[v.length - 1];
  const allow = [], deny = [];
  robots.forEach((r, i) => {
    const base = kind === "genel" || kind === r.type;
    if (v[i] && (!base || only)) allow.push(r.rid);
    if (!v[i] && base && !only) deny.push(r.rid);
  });
  setJSON(ch, "aq:access", { allow, deny, only });
  player.sendMessage("§sSandık erişimi kaydedildi.");
}

async function contentsMenu(player, ch) {
  return bagMenu(player, {
    title: "İçindekiler", empty: "Sandık boş.",
    container: () => safe(() => ch.getComponent("minecraft:inventory")?.container),
    canEdit: () => safe(() => Math.hypot(player.location.x - ch.location.x, player.location.z - ch.location.z), 99) <= EDIT_RANGE,
  });
}

// eğil + sandığa basılı tut -> panel
setPanelHook((p, h) => fire(() => chestMenu(p, h), "sandık paneli"));
