// Aqualit Robotları — Takip Ekranı (canlı dijital harita) ve canlı izleme
import { system, world } from "@minecraft/server";
import { CustomForm, ObservableString } from "@minecraft/server-ui";
import { menu } from "./forms.js";
import { Robots, Chests } from "../store.js";
import { bots, botByRid } from "../brain.js";
import { TYPE_NAME, robotIcon } from "../constants.js";
import { V, safe, log, direction, dimName, fmtPos } from "../util.js";

const W = 23, H = 15;
const ZOOMS = [1, 2, 4, 8, 16, 32, 64];
const CELL = "█";

function colorOf(t) {
  if (!t) return "§0";
  if (t.includes("water") || t.includes("kelp") || t.includes("seagrass") || t.includes("bubble")) return "§9";
  if (t.includes("lava") || t.includes("magma")) return "§6";
  if (t.includes("leaves") || t.includes("vine") || t.includes("azalea")) return "§2";
  if (t.includes("grass_block") || t.includes("moss") || t.includes("short_grass") || t.includes("fern") || t.includes("lily")) return "§a";
  if (t.includes("snow") || t.includes("ice")) return "§f";
  if (t.includes("sand") || t.includes("sandstone")) return "§e";
  if (t.includes("log") || t.includes("planks") || t.includes("wood") || t.includes("dirt") || t.includes("farmland")
    || t.includes("podzol") || t.includes("mud")) return "§6";
  if (t.includes("netherrack") || t.includes("nether") || t.includes("crimson")) return "§4";
  if (t.includes("warped")) return "§3";
  if (t.includes("end_stone") || t.includes("purpur")) return "§e";
  if (t.includes("deepslate") || t.includes("blackstone") || t.includes("basalt") || t.includes("obsidian")) return "§8";
  if (t.includes("ore")) return "§s";
  if (t.includes("stone") || t.includes("gravel") || t.includes("andesite") || t.includes("diorite") || t.includes("granite")
    || t.includes("tuff") || t.includes("cobble")) return "§7";
  return "§7";
}

function robotsFor(player) {
  const list = Robots.list(player.id);
  return list.map((r) => {
    const b = botByRid(r.rid);
    return { r, b, pos: b ? b.loc : r.pos, dim: b ? b.dim.id : r.dim, status: b ? b.status : r.status };
  }).filter((x) => x.pos);
}

function renderMap(player, st) {
  const dim = player.dimension;
  const z = ZOOMS[st.zoom];
  const rows = [];
  const marks = new Map();
  const mark = (pos, code) => {
    const i = Math.round((pos.x - st.cx) / z) + (W >> 1);
    const j = Math.round((pos.z - st.cz) / z) + (H >> 1);
    if (i >= 0 && i < W && j >= 0 && j < H) marks.set(`${i},${j}`, code);
  };
  for (const c of Chests.list(player.id)) if (c.dim === dim.id) mark(c.pos, "§u");
  for (const x of st.robots) if (x.dim === dim.id) mark(x.pos, x.r.rid === st.sel ? "§d" : "§b");
  mark(player.location, "§c");
  for (let j = 0; j < H; j++) {
    let row = "";
    let last = "";
    for (let i = 0; i < W; i++) {
      let code = marks.get(`${i},${j}`);
      if (!code) {
        const x = Math.floor(st.cx + (i - (W >> 1)) * z);
        const zz = Math.floor(st.cz + (j - (H >> 1)) * z);
        const top = safe(() => dim.getTopmostBlock({ x, z: zz }));
        code = colorOf(top?.typeId);
      }
      row += (code !== last ? code : "") + CELL;
      last = code;
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function fitZoom(player, st) {
  let far = 8;
  for (const x of st.robots) if (x.dim === player.dimension.id) far = Math.max(far, V.hdist(x.pos, player.location));
  for (let i = 0; i < ZOOMS.length; i++) if ((W >> 1) * ZOOMS[i] >= far + 2) return i;
  return ZOOMS.length - 1;
}

export async function openTracker(player) {
  const st = {
    robots: robotsFor(player),
    cx: Math.floor(player.location.x),
    cz: Math.floor(player.location.z),
    zoom: 0,
    sel: "",
  };
  st.zoom = fitZoom(player, st);
  let form;
  try {
    const map = new ObservableString(renderMap(player, st));
    const info = new ObservableString("");
    const updInfo = () => {
      const z = ZOOMS[st.zoom];
      const lines = [`§7Ölçek: §f1 kare = ${z} blok  §7Merkez: §f${st.cx}, ${st.cz}`,
        "§c█§7 sen  §b█§7 robot  §d█§7 seçili  §u█§7 sandık"];
      const s = st.robots.find((x) => x.r.rid === st.sel);
      if (s) lines.push(`§d${s.r.name}§7: ${s.status} · ${fmtPos(s.pos)} · ${dimName(s.dim)}`);
      info.setData(lines.join("\n"));
    };
    updInfo();
    const redraw = () => {
      map.setData(renderMap(player, st));
      updInfo();
    };
    form = new CustomForm(player, "§lTakip Ekranı");
    form.label(map);
    form.label(info);
    const step = () => Math.max(2, Math.floor((W >> 2) * ZOOMS[st.zoom]));
    form.button("§l+ Yakınlaştır", () => { st.zoom = Math.max(0, st.zoom - 1); redraw(); });
    form.button("§l− Uzaklaştır", () => { st.zoom = Math.min(ZOOMS.length - 1, st.zoom + 1); redraw(); });
    form.button("↑ Kuzey", () => { st.cz -= step(); redraw(); });
    form.button("↓ Güney", () => { st.cz += step(); redraw(); });
    form.button("← Batı", () => { st.cx -= step(); redraw(); });
    form.button("→ Doğu", () => { st.cx += step(); redraw(); });
    form.button("Beni ortala", () => { st.cx = Math.floor(player.location.x); st.cz = Math.floor(player.location.z); redraw(); });
    form.divider();
    for (const x of st.robots) {
      form.button(`${x.r.name} §8(${TYPE_NAME[x.r.type] ?? ""})`, () => {
        st.sel = x.r.rid;
        if (x.dim === player.dimension.id) {
          st.cx = Math.floor(x.pos.x);
          st.cz = Math.floor(x.pos.z);
        }
        redraw();
      });
    }
    form.button("§sSeçili robotu canlı izle", () => {
      const b = st.sel ? botByRid(st.sel) : undefined;
      if (!b) {
        player.sendMessage("§7Önce listeden yüklü bir robot seç.");
        return;
      }
      form.close();
      system.run(() => startWatch(player, b));
    });
    form.closeButton();
    const timer = system.runInterval(() => {
      if (!safe(() => form.isShowing(), false)) return;
      st.robots = robotsFor(player);
      redraw();
    }, 40);
    await form.show();
    system.clearRun(timer);
  } catch (e) {
    log("takip ekranı (canlı) açılamadı, liste gösteriliyor", e);
    return trackerList(player);
  }
}

/** Yedek: basit liste görünümü. */
export async function trackerList(player) {
  const list = robotsFor(player);
  if (!list.length) return player.sendMessage("§7Takip edilecek robot yok.");
  const btns = list.map((x) => {
    const same = x.dim === player.dimension.id;
    const d = same ? `${Math.round(V.dist(player.location, x.pos))} blok ${direction(player.location, x.pos).arrow} ${direction(player.location, x.pos).name}` : dimName(x.dim);
    return { text: `${x.r.name}\n§7${x.status} · ${d}`, icon: robotIcon(x.r.type, x.r.model), x };
  });
  const c = await menu(player, "§lTakip Ekranı", "§7Bir robota dokun: canlı izle.", btns);
  if (!c) return;
  const b = botByRid(c.x.r.rid);
  if (b) startWatch(player, b);
  else player.sendMessage(`§7${c.x.r.name} şu an yüklü değil. Son konumu: ${fmtPos(c.x.pos)}`);
}

// ------------------------------------------------------------------ canlı izleme
const watching = new Map(); // oyuncu kimliği -> {bot, run}

export function startWatch(player, bot) {
  stopWatch(player, false);
  if (!bot || !bot.valid) return player.sendMessage("§cRobot şu an yüklü değil.");
  const run = system.runInterval(() => {
    if (!safe(() => player.isValid, false) || !bot.valid) {
      stopWatch(player, true);
      return;
    }
    const l = bot.loc;
    const yaw = (safe(() => bot.e.getRotation().y, 0) * Math.PI) / 180;
    const cam = { x: l.x + Math.sin(yaw) * 2.6, y: l.y + 1.7, z: l.z - Math.cos(yaw) * 2.6 };
    safe(() => player.camera.setCamera("minecraft:free", {
      location: cam,
      facingLocation: { x: l.x, y: l.y + 0.7, z: l.z },
      easeOptions: { easeTime: 0.25, easeType: "Linear" },
    }));
    safe(() => player.onScreenDisplay.setActionBar(`§sCanlı izleme · ${bot.name}§r §7${bot.status} · çıkmak için eğil`));
  }, 5);
  watching.set(player.id, { bot, run });
  safe(() => player.camera.fade({ fadeTime: { fadeInTime: 0.2, holdTime: 0.1, fadeOutTime: 0.3 }, fadeColor: { red: 0.02, green: 0.25, blue: 0.22 } }));
  player.sendMessage(`§s${bot.name}§r canlı izleniyor. Çıkmak için eğil.`);
}

export function stopWatch(player, notify = true) {
  const w = watching.get(player.id);
  if (!w) return;
  system.clearRun(w.run);
  watching.delete(player.id);
  safe(() => player.camera.clear());
  if (notify) safe(() => player.onScreenDisplay.setActionBar("§7Canlı izleme kapandı."));
}

world.afterEvents.playerLeave?.subscribe((ev) => watching.delete(ev.playerId));
