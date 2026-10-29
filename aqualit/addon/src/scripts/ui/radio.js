// Aqualit Robotları — Robot Telsizi
import { world } from "@minecraft/server";
import { menu, modal, confirm } from "./forms.js";
import { Robots, Chests, getJSON, setJSON, setProp } from "../store.js";
import { bots, botByRid, commandReturn, commandStop, commandResume } from "../brain.js";
import { messages, unreadCount, markAllRead, markRead, answer, clearMessages, timeAgo } from "../messages.js";
import { TYPE_NAME, robotIcon, CHEST_NAME, CHEST_ICON, distText, DIST_OPTS, DIST_LABELS, distIndex } from "../constants.js";
import { V, fmtPos, direction, dimName, safe } from "../util.js";
import { describeTask, inventoryText, renameRobot } from "./task.js";
import { pickupRobot } from "../place.js";
import { startWatch } from "./tracker.js";
import { rodRobot } from "./kilicli_ui.js";
import { barOn, setBar, sendLocation } from "../konum.js";
import { bagMenu, EDIT_RANGE } from "./canta.js";

function liveInfo(player, r) {
  const b = botByRid(r.rid);
  const pos = b ? b.loc : r.pos;
  const dim = b ? b.dim.id : r.dim;
  const status = b ? b.status : (r.status ?? "?") + " §8(uzakta)";
  let where = "";
  if (pos && dim === player.dimension.id) {
    const d = Math.round(V.dist(player.location, pos));
    where = `${d} blok ${direction(player.location, pos).arrow}`;
  } else if (pos) where = dimName(dim);
  return { b, pos, dim, status, where };
}

export async function openRadio(player) {
  const list = Robots.list(player.id);
  const unread = unreadCount(player.id);
  const btns = [{ text: `§lMesajlar§r ${unread ? `§e(${unread} yeni)` : "§8(yeni yok)"}`, icon: "textures/items/book_writable", act: "msgs" }];
  for (const r of list) {
    const info = liveInfo(player, r);
    btns.push({ text: `${r.name} §8· ${TYPE_NAME[r.type] ?? ""}\n§7${info.status} §8${info.where}`,
      icon: robotIcon(r.type, r.model), act: "robot", r });
  }
  if (list.length > 1) btns.push({ text: "Hepsini hemen geri çağır", icon: "textures/items/compass_item", act: "allback" });
  btns.push({ text: "Sandıklarım", icon: "textures/items/aqualit_chest", act: "chests" });
  btns.push({ text: `Konum çubuğunda robotlar: ${barOn(player) ? "§aAÇIK" : "§cKAPALI"}`, icon: "textures/items/compass_item", act: "bar" });
  const body = list.length ? `§7${list.length} robotun var.` : "§7Henüz robotun yok. Robot eşyasını yere kullanarak robot koyabilirsin.";
  const c = await menu(player, "§lRobot Telsizi", body, btns);
  if (!c) return;
  if (c.act === "msgs") return openMessages(player);
  if (c.act === "robot") return radioEntry(player, c.r);
  if (c.act === "allback") {
    let n = 0;
    for (const b of bots.values()) if (b.owner === player.id && b.type !== "kilicli") {
      commandReturn(b, false);
      n++;
    }
    return player.sendMessage(`§s${n} robot§r eve dönüyor.`);
  }
  if (c.act === "chests") return openChests(player);
  if (c.act === "bar") {
    setBar(player, !barOn(player));
    player.sendMessage(`§sKonum çubuğu:§r robotlar ${barOn(player) ? "§agösteriliyor" : "§cgizlendi"}§r.`);
    return openRadio(player);
  }
}

export async function radioRobot(player, bot) {
  const r = Robots.get(player.id, bot.rid) ?? { rid: bot.rid, name: bot.name, type: bot.type, model: bot.model };
  return radioEntry(player, r);
}

async function radioEntry(player, r) {
  const info = liveInfo(player, r);
  const b = info.b;
  if (b && b.type === "kilicli") return rodRobot(player, b);
  const body = [
    `§7Tür: §f${TYPE_NAME[r.type] ?? "?"}`,
    `§7Durum: §f${info.status}`,
    b ? `§7Görev: §f${b.task && !b.task.done ? describeTask(b) : "yok"}` : "",
    info.pos ? `§7Konum: §f${fmtPos(info.pos)} §8(${dimName(info.dim)}) ${info.where}` : "",
    b ? `§7En fazla uzaklık: §f${distText(b.maxDist)}` : "§8Robot şu an yüklü değil; komutlar o bölge yüklenince uygulanır.",
  ].filter(Boolean).join("\n");
  const btns = [
    { text: "§lHemen geri dön§r\n§7Ne yapıyorsa bırakıp döner", icon: "textures/items/compass_item", act: "back" },
    { text: "§lAcil işin yoksa geri dön§r\n§7Yakındaki güzel şeyleri alıp döner", icon: "textures/items/recovery_compass_item", act: "soft" },
    { text: `Fazla uzaklaşma §8(${b?.maxDist ?? "?"} blok)`, icon: "textures/items/map_empty", act: "dist" },
  ];
  if (b?.task && !b.task.done) btns.push(b.task.paused
    ? { text: "Görevi sürdür", icon: "textures/items/clock_item", act: "resume" }
    : { text: "Görevi durdur", icon: "textures/items/clock_item", act: "stop" });
  btns.push({ text: "Canlı izle", icon: "textures/items/spyglass", act: "watch" });
  btns.push({ text: "Çantası", icon: "textures/items/aqualit_chest", act: "inv" });
  btns.push({ text: "Konumunu gönder", icon: "textures/items/map_filled", act: "loc" });
  btns.push({ text: "İsim ver", icon: "textures/items/name_tag", act: "name" });
  btns.push({ text: "Robotu topla", icon: robotIcon(r.type, r.model), act: "pick" });
  btns.push({ text: "§cListeden sil§r\n§7Kaybolan robot kaydını kaldırır", act: "forget" });
  const c = await menu(player, `§l${r.name}`, body, btns);
  if (!c) return;
  if (!b && !["forget"].includes(c.act)) {
    if (c.act === "back" || c.act === "soft") queueCommand(player, r, c.act);
    else player.sendMessage("§7Robot şu an yüklü değil. Yanına gidince tekrar dene.");
    return;
  }
  switch (c.act) {
    case "back": return commandReturn(b, false);
    case "soft": return commandReturn(b, true);
    case "dist": {
      const v = await modal(player, "Fazla uzaklaşma", [
        { type: "dropdown", label: "Sandığından en fazla ne kadar uzaklaşsın?", items: DIST_LABELS, value: distIndex(b.maxDist) },
      ], "Kaydet");
      if (!v) return;
      const d = DIST_OPTS[v[0]] ?? 128;
      b.maxDist = d;
      setProp(b.e, "aq:maxd", d);
      if (b.task) {
        b.task.maxDist = d;
        b.saveTask();
      }
      return player.sendMessage(`§s${b.name}§r artık sandığından en fazla §f${distText(d)}§r uzaklaşacak.`);
    }
    case "stop": commandStop(b); return player.sendMessage(`§s${b.name}§r durdu.`);
    case "resume": commandResume(b); return player.sendMessage(`§s${b.name}§r devam ediyor.`);
    case "watch": return startWatch(player, b);
    case "inv":
      await bagMenu(player, { title: `§l${b.name} · çanta`, container: () => b.inv,
        canEdit: () => V.dist(player.location, b.loc) <= EDIT_RANGE && player.dimension === b.dim });
      return radioEntry(player, r);
    case "loc": return sendLocation(b, "Buradayım!");
    case "name": return renameRobot(player, b);
    case "pick": {
      if (V.dist(player.location, b.loc) > 12) return player.sendMessage("§cRobotu toplamak için yanına git.");
      if (await confirm(player, "Robotu topla", `§f${b.name}§r eşyaya dönüşsün mü?`, "Topla")) pickupRobot(player, b);
      return;
    }
    case "forget": {
      if (await confirm(player, "Kaydı sil", `§f${r.name}§r telsiz listesinden silinsin mi? (Robot dünyada duruyorsa yüklendiğinde geri gelir.)`, "Sil")) {
        Robots.remove(player.id, r.rid);
      }
    }
  }
}

function queueCommand(player, r, cmd) {
  const k = `aq:pending:${r.rid}`;
  setJSON(world, k, { cmd, t: Date.now() });
  player.sendMessage(`§7Komut kaydedildi; §s${r.name}§7 bölgesi yüklenince uygulanacak.`);
}

export async function openMessages(player) {
  const list = messages(player.id).slice().reverse().slice(0, 40);
  const btns = [];
  for (const m of list) {
    const flag = m.confirm && m.state === "new" ? "§e● onay bekliyor §r" : m.state === "new" ? "§b● §r" : "";
    const short = m.text.length > 38 ? m.text.slice(0, 36) + "…" : m.text;
    btns.push({ text: `${flag}§f${m.from}§7: ${short}\n§8${timeAgo(m.t)}`, icon: m.type ? robotIcon(m.type, 1) : undefined, m });
  }
  btns.push({ text: "Hepsini okundu yap", act: "read" });
  btns.push({ text: "§cMesajları temizle", act: "clear" });
  const c = await menu(player, "§lTelsiz · Mesajlar", list.length ? "" : "§7Mesaj yok.", btns);
  if (!c) return;
  if (c.act === "read") {
    markAllRead(player.id);
    return openMessages(player);
  }
  if (c.act === "clear") {
    clearMessages(player.id);
    return openMessages(player);
  }
  const m = c.m;
  if (m.confirm && m.state === "new") {
    const yes = m.confirm.yes ?? "Evet";
    const no = m.confirm.no ?? "Hayır";
    const r = await menu(player, `§l${m.from}`, `§f${m.text}`, [{ text: `§a${yes}`, v: true }, { text: `§c${no}`, v: false }, { text: "Sonra" }]);
    if (r && r.v !== undefined) {
      answer(player.id, m.id, r.v);
      player.sendMessage(`§sTelsiz:§r ${m.from} → ${r.v ? yes : no}`);
    }
  } else {
    if (m.state === "new") markRead(player.id, m.id);
    await menu(player, `§l${m.from}`, `§f${m.text}\n\n§8${timeAgo(m.t)}`, [{ text: "Geri" }]);
  }
  return openMessages(player);
}

async function openChests(player) {
  const list = Chests.list(player.id);
  if (!list.length) return player.sendMessage("§7Henüz robot sandığın yok.");
  const btns = list.map((c) => {
    const d = c.dim === player.dimension.id ? `${Math.round(V.dist(player.location, c.pos))} blok ${direction(player.location, c.pos).arrow}` : dimName(c.dim);
    return { text: `${c.name || CHEST_NAME[c.kind]}\n§7${fmtPos(c.pos)} · ${d}`, icon: CHEST_ICON[c.kind] };
  });
  await menu(player, "Sandıklarım", "§7Sandığa dokun: açılır · basılı tut: kırılır · eğil + basılı tut: sandık paneli.", btns);
}
