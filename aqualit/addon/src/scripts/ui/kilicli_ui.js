// Aqualit Robotları — Komut Çubuğu, Ayar Dişlisi, Bölge Seçici
import { system, world } from "@minecraft/server";
import { menu, modal, confirm } from "./forms.js";
import { bots } from "../brain.js";
import { getStats, applyStats, setMode, guardZone, defaultStats, modeName } from "../kilicli.js";
import { KILICLI_MODELS, DMG_TIERS, robotIcon } from "../constants.js";
import { Prefs, setProp } from "../store.js";
import { V, safe, fmtPos, clamp } from "../util.js";
import { renameRobot } from "./task.js";
import { POWERS, POWER_LIST, TARZ_AD, unlocked, usePower } from "../powers.js";
import { kitCharges, addKitCharges, KIT_ID } from "../statue.js";
import { isCreative } from "../place.js";
import { bagMenu, EDIT_RANGE } from "./canta.js";

function myKilicli(player) {
  return [...bots.values()].filter((b) => b.owner === player.id && b.type === "kilicli" && b.valid);
}

// ------------------------------------------------------------------ komut çubuğu
const MODES = [
  { v: "follow", text: "§lTakip et ve koru§r\n§7Seni izler, sana saldıranla savaşır", icon: "textures/items/aqualit_sword" },
  { v: "guard", text: "§lBölgeyi koru§r\n§7Seçtiğin bölgede bekler ve korur", icon: "textures/items/zone_selector" },
  { v: "stay", text: "§lBurada bekle§r\n§7Olduğu yerde durur", icon: "textures/items/clock_item" },
];

export async function openRod(player) {
  const list = myKilicli(player);
  if (!list.length) return player.sendMessage("§7Yüklü bir kılıçlı robotun yok.");
  const btns = MODES.map((m) => ({ ...m, all: true }));
  btns.push({ text: "§lYanıma gel§r\n§7Hepsi seni takip etmeye başlar", icon: "textures/items/compass_item", act: "come" });
  for (const b of list) {
    btns.push({ text: `${b.name} §8· Seviye ${b.model}\n§7${b.status}`, icon: robotIcon("kilicli", b.model), b });
  }
  const c = await menu(player, "§lKomut Çubuğu", `§7${list.length} kılıçlı robotun var. Komut hepsine ya da seçtiğine gider.`, btns);
  if (!c) return;
  if (c.b) return rodRobot(player, c.b);
  if (c.act === "come") return rodComeHere(player);
  return applyMode(player, list, c.v);
}

export async function rodRobot(player, b) {
  const s = getStats(b);
  const body = [`§7Seviye: §f${b.model} (${KILICLI_MODELS[b.model]?.renk})`, `§7Durum: §f${b.status}`,
    `§7Can: §f${s.can} · Hasar: ${s.hasar} · Hız: ${s.hiz}/10`,
    `§7Enerji: §f${Math.round(b.pw?.energy ?? s.enerji)}/${s.enerji} · Tarz: ${TARZ_AD[s.tarz] ?? "Dengeli"}`,
    `§7Tamir hakkı: §f${kitCharges(b)}`].join("\n");
  const btns = MODES.map((m) => ({ ...m }));
  btns.push({ text: "Güçler", icon: "textures/items/nether_star", act: "powers" });
  btns.push({ text: "Dövüş tarzı", icon: "textures/items/iron_sword", act: "style" });
  btns.push({ text: "Tamir kiti ver", icon: "textures/items/tamir_kiti", act: "kits" });
  btns.push({ text: "Çantası", icon: "textures/items/aqualit_chest", act: "bag" });
  btns.push({ text: "İsim ver", icon: "textures/items/name_tag", act: "name" });
  const c = await menu(player, `§l${b.name}`, body, btns);
  if (!c) return;
  if (c.act === "style") return styleForm(player, [b]);
  if (c.act === "powers") return powersMenu(player, b);
  if (c.act === "kits") return kitMenu(player, b);
  if (c.act === "bag") return bagMenu(player, { title: `§l${b.name} · çanta`, container: () => b.inv,
    canEdit: () => V.dist(player.location, b.loc) <= EDIT_RANGE });
  if (c.act === "name") return renameRobot(player, b);
  return applyMode(player, [b], c.v);
}

async function applyMode(player, list, mode) {
  if (mode === "guard") {
    const z = Prefs.get(player.id).zone;
    let center, radius;
    if (z && z.a && z.b && z.dim === player.dimension.id) {
      center = { x: Math.floor((z.a.x + z.b.x) / 2), y: Math.max(z.a.y, z.b.y), z: Math.floor((z.a.z + z.b.z) / 2) };
      radius = Math.max(4, Math.ceil(Math.max(Math.abs(z.a.x - z.b.x), Math.abs(z.a.z - z.b.z)) / 2));
    } else {
      const v = await modal(player, "Bölgeyi koru", [
        { type: "slider", label: "Seçili bölge yok. Bulunduğun yerin çevresinde kaç blok?", min: 4, max: 48, step: 2, value: 16 },
      ], "Koru");
      if (!v) return;
      center = V.floor(player.location);
      radius = v[0];
    }
    for (const b of list) guardZone(b, center, radius);
    return player.sendMessage(`§s${list.length} kılıçlı§r ${fmtPos(center)} çevresini (${radius} blok) korumaya gidiyor.`);
  }
  for (const b of list) setMode(b, mode, list.length > 1);
  if (list.length > 1) player.sendMessage(`§s${list.length} kılıçlı§r: ${modeName(mode)}.`);
}

export function rodComeHere(player) {
  const list = myKilicli(player);
  for (const b of list) setMode(b, "follow", true);
  player.sendMessage(list.length ? `§s${list.length} kılıçlı§r yanına geliyor.` : "§7Yüklü bir kılıçlı robotun yok.");
}

async function styleForm(player, list) {
  const s = getStats(list[0]);
  const styles = ["dengeli", "saldirgan", "gizli"];
  const v = await modal(player, "Dövüş tarzı", [
    { type: "dropdown", label: "Nasıl dövüşsün?\n§7Dengeli: saldırı ve savunmayı karıştırır.\nSaldırgan: önce saldırır, güçleri sık kullanır.\nGizli: ninja gibi, gölge adımı tercih eder.", items: ["Dengeli", "Saldırgan", "Gizli"], value: Math.max(0, styles.indexOf(s.tarz)) },
  ], "Kaydet");
  if (!v) return;
  for (const b of list) {
    const st = getStats(b);
    st.tarz = styles[v[0]];
    applyStats(b, st, false);
  }
  player.sendMessage("§sDövüş tarzı kaydedildi.");
}

/** Envanterdeki tamir kitlerini Kılıçlı'nın çantasına ver. */
export async function kitMenu(player, b) {
  const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
  const slots = [];
  for (let i = 0; i < (inv?.size ?? 0); i++) if (safe(() => inv.getItem(i)?.typeId) === KIT_ID) slots.push(i);
  const body = [`§7${b.name} çantasında §f${kitCharges(b)}§7 onarım hakkı var.`,
    `§7Envanterinde §f${slots.length}§7 tamir kiti var (her kit 5 hak).`,
    "§7Kılıçlı canı azalınca kendini, yaralanan robotlarını ve kapanıp heykele dönen robotlarını bu haklarla onarır."].join("\n");
  const btns = [];
  if (slots.length) btns.push({ text: "1 kit ver", n: 1 });
  if (slots.length > 1) btns.push({ text: `Hepsini ver (${slots.length})`, n: slots.length });
  btns.push({ text: "Tamam", n: 0 });
  const c = await menu(player, `§l${b.name} · Tamir kitleri`, body, btns);
  if (!c || !c.n) return;
  let added = 0;
  for (const i of slots.slice(0, c.n)) {
    const it = safe(() => inv.getItem(i));
    if (!it || it.typeId !== KIT_ID) continue;
    const dur = safe(() => it.getComponent("minecraft:durability"));
    added += dur ? Math.max(1, dur.maxDurability - dur.damage) : 5;
    if (!isCreative(player)) safe(() => inv.setItem(i, undefined));
  }
  const total = addKitCharges(b, added);
  b.beep?.();
  player.sendMessage(`§s${b.name}§r çantasına ${added} onarım hakkı koydu. §7Toplam: ${total}`);
}

const POWER_ICON = {
  kanca: "textures/items/fishing_rod_uncast",
  yildirim_kilici: "textures/items/iron_sword",
  golge_adim: "textures/items/ender_pearl",
  kubbe: "textures/items/totem",
  gok_gurultusu: "textures/items/trident",
};

export async function powersMenu(player, b) {
  const s = getStats(b);
  const pw = b.pw ?? {};
  const now = system.currentTick;
  const body = [
    `§7Enerji: §f${Math.round(pw.energy ?? s.enerji)}/${s.enerji} §8(göğüsteki kalp ışığı)`,
    `§7Durum ciddiyeti sınırı: §f${s.ciddiyet ?? 100}`,
    `§7Dövüş tarzı: §f${TARZ_AD[s.tarz] ?? "Dengeli"}`,
    `§7Güçler: ${s.guc === false ? "§ckapalı" : "§aaçık"}§7. Robot uygun anı kendisi seçer; dokunursan hemen kullanır.`,
    "§8Şimdilik 5 güç var, kalan 45 güç sonraki sürümlerde.",
  ].join("\n");
  const btns = POWER_LIST.map((key) => {
    const p = POWERS[key];
    const open = p.model <= b.model;
    const cd = Math.max(0, Math.ceil(((pw.cd?.[key] ?? 0) - now) / 20));
    const sub = !open ? `§8Seviye ${p.model}'de açılır`
      : p.ciddiyet > (s.ciddiyet ?? 100) ? `§6Kendi başına kullanmak için ciddiyet ${p.ciddiyet} gerekir`
      : cd ? `§7Bekleme: ${cd} sn` : `§7Enerji ${p.maliyet} · dokun: şimdi kullan`;
    return { text: `${open ? "§l" : "§8"}${p.ad}§r\n${sub}`, icon: POWER_ICON[key], key, open };
  });
  btns.push({ text: s.guc === false ? "§aGüçleri aç" : "§cGüçleri kapat", act: "toggle" });
  const c = await menu(player, `§l${b.name} · Güçler`, body, btns);
  if (!c) return;
  if (c.act === "toggle") {
    const st = getStats(b);
    st.guc = st.guc === false;
    applyStats(b, st, false);
    return player.sendMessage(`§s${b.name}§r: güçler ${st.guc ? "§aaçık" : "§ckapalı"}§r.`);
  }
  const p = POWERS[c.key];
  if (!c.open) return player.sendMessage(`§7${p.ad}, Seviye ${p.model}'de açılır.`);
  const ok = usePower(b, c.key);
  player.sendMessage(ok ? `§s${b.name}§r: ${p.ad}!`
    : `§7${p.ad} şu an kullanılamıyor (enerji az, bekleme sürüyor ya da yakında uygun düşman yok).`);
}

// ------------------------------------------------------------------ ayar dişlisi
export async function gearFromAir(player) {
  if (!player.isSneaking) {
    const hit = safe(() => player.getEntitiesFromViewDirection({ maxDistance: 16 }), []);
    for (const h of hit ?? []) {
      const b = [...bots.values()].find((x) => x.id === h.entity?.id);
      if (b && b.type === "kilicli") return gearForm(player, b);
    }
  }
  const list = myKilicli(player);
  if (!list.length) return player.sendMessage("§7Yüklü bir kılıçlı robotun yok.");
  const btns = list.map((b) => ({ text: `${b.name} §8· Seviye ${b.model}\n§7${b.status}`, icon: robotIcon("kilicli", b.model), b }));
  if (list.length > 1) btns.unshift({ text: "§lHepsini birden ayarla", icon: "textures/items/tuning_gear", all: true });
  const c = await menu(player, "§lKılıçlı Ayar Dişlisi", "§7Ayarlamak istediğin kılıçlıyı seç.", btns);
  if (!c) return;
  if (c.all) return gearForm(player, list[0], list);
  return gearForm(player, c.b);
}

export async function gearForm(player, b, group) {
  const list = group ?? [b];
  const s = getStats(b);
  const levels = [1, 2, 3, 4, 5].map((m) => `Seviye ${m} · ${KILICLI_MODELS[m].renk}`);
  const dmgIdx = DMG_TIERS.reduce((bi, t, i) => (Math.abs(t - s.hasar) < Math.abs(DMG_TIERS[bi] - s.hasar) ? i : bi), 0);
  const v = await modal(player, list.length > 1 ? `Ayar · ${list.length} kılıçlı` : `Ayar · ${b.name}`, [
    { type: "dropdown", label: "Seviye (model)", items: levels, value: clamp(b.model, 1, 5) - 1 },
    { type: "toggle", label: "Seviye değişirse can, hasar ve hızı o seviyenin değerlerine getir", value: true },
    { type: "slider", label: "Can", min: 20, max: 1000, step: 10, value: clamp(Math.round(s.can / 10) * 10, 20, 1000) },
    { type: "dropdown", label: "Kılıç hasarı", items: DMG_TIERS.map(String), value: dmgIdx },
    { type: "slider", label: "Hız", min: 1, max: 10, step: 1, value: clamp(s.hiz, 1, 10) },
    { type: "slider", label: "Enerji (güçler için)", min: 10, max: 1000, step: 10, value: clamp(s.enerji, 10, 1000) },
    { type: "slider", label: "Durum ciddiyeti (hangi güçleri kullanabilir)", min: 1, max: 100, step: 1, value: clamp(s.ciddiyet ?? 100, 1, 100) },
    { type: "toggle", label: "§cDurum ciddiyeti %101§r (güç güncellemesiyle çalışır)", value: !!s.mod101 },
  ], "Kaydet");
  if (!v) return;
  const [lvlIdx, resetToLevel, can, dmgI, hiz, enerji, ciddiyet, mod101] = v;
  for (const r of list) {
    const old = getStats(r);
    const model = lvlIdx + 1;
    let st = { ...old, can, hasar: DMG_TIERS[dmgI], hiz, enerji, ciddiyet, mod101: !!mod101, model };
    if (model !== old.model && resetToLevel) {
      const d = defaultStats(model);
      st = { ...st, can: d.can, hasar: d.hasar, hiz: d.hiz };
    }
    applyStats(r, st, true);
    r.updateIndex(true);
  }
  const open = unlocked(lvlIdx + 1);
  player.sendMessage(`§sAyarlar kaydedildi§r (${list.length} kılıçlı). §7Açık güçler: ${open.length ? open.join(", ") : "yok (Seviye 2'de açılır)"}`);
  safe(() => player.playSound("random.anvil_use", { volume: 0.4, pitch: 1.4 }));
}

// ------------------------------------------------------------------ bölge seçici
export function zoneCorner(player, n, pos) {
  const pr = Prefs.get(player.id);
  const z = pr.zone && pr.zone.dim === player.dimension.id ? pr.zone : { dim: player.dimension.id };
  if (n === 1) z.a = pos;
  else z.b = pos;
  pr.zone = z;
  Prefs.set(player.id, pr);
  const which = n === 1 ? "1. köşe (dokunma)" : "2. köşe (basılı tutma)";
  player.sendMessage(`§sBölge Seçici:§r ${which} → ${fmtPos(pos)}`);
  safe(() => player.playSound("random.orb", { pitch: n === 1 ? 1.2 : 1.6, volume: 0.5 }));
  if (z.a && z.b) showZone(player, z);
}

export function showZone(player, z) {
  const min = { x: Math.min(z.a.x, z.b.x), y: Math.min(z.a.y, z.b.y), z: Math.min(z.a.z, z.b.z) };
  const max = { x: Math.max(z.a.x, z.b.x) + 1, y: Math.max(z.a.y, z.b.y) + 1, z: Math.max(z.a.z, z.b.z) + 1 };
  const sx = max.x - min.x, sz = max.z - min.z;
  player.sendMessage(`§7Bölge: ${sx} × ${sz} blok. Komut Çubuğu → Bölgeyi koru ile kılıçlılara korut.`);
  let t = 0;
  const run = system.runInterval(() => {
    if (++t > 20 || !safe(() => player.isValid, false)) return system.clearRun(run);
    const y = max.y + 0.2;
    const pts = [];
    const stepX = Math.max(1, Math.floor(sx / 12)), stepZ = Math.max(1, Math.floor(sz / 12));
    for (let x = min.x; x <= max.x; x += stepX) pts.push({ x, y, z: min.z }, { x, y, z: max.z });
    for (let zz = min.z; zz <= max.z; zz += stepZ) pts.push({ x: min.x, y, z: zz }, { x: max.x, y, z: zz });
    for (const p of pts) safe(() => player.spawnParticle("minecraft:villager_happy", p));
  }, 10);
}

export async function zoneMenu(player) {
  const z = Prefs.get(player.id).zone;
  const has = z && z.a && z.b;
  const body = has ? `§7Seçili bölge: ${fmtPos(z.a)} → ${fmtPos(z.b)}` : "§7Bir bloğa dokun: 1. köşe. Bir bloğa basılı tut: 2. köşe.";
  const btns = [];
  if (has) btns.push({ text: "Bölgeyi göster", act: "show", icon: "textures/items/spyglass" });
  if (has) btns.push({ text: "Kılıçlılara bu bölgeyi korut", act: "guard", icon: "textures/items/aqualit_sword" });
  if (has) btns.push({ text: "§cBölgeyi temizle", act: "clear" });
  btns.push({ text: "Tamam", act: "ok" });
  const c = await menu(player, "§lBölge Seçici", body, btns);
  if (!c) return;
  if (c.act === "show") return showZone(player, z);
  if (c.act === "guard") return applyMode(player, myKilicli(player), "guard");
  if (c.act === "clear") {
    const pr = Prefs.get(player.id);
    delete pr.zone;
    Prefs.set(player.id, pr);
    player.sendMessage("§7Bölge temizlendi.");
  }
}
