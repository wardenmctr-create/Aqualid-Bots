// v0.4.4: Kılıçlı Robot Kostümü. Oyuncu Kılıçlı robotunu giyer: görünmez olur, yerinde robotun modeli (aqualit:kostum)
// durur ve onunla birlikte yürür; robotun canı, gücü, hızı ve kılıcı oyuncuya geçer. Eline gelen "Kostüm Güçleri"
// eşyasıyla robotun açık güçlerini kullanır, "Kostümden Çık" ile eski haline döner. Robot bu sürede görünmez bekler.
// Oyunda denenmedi.
import { world, system, ItemStack } from "@minecraft/server";
import { safe, clamp, V } from "./util.js";
import { bots } from "./brain.js";
import { ACT2 } from "./bot.js";
import { getStats, setMode } from "./kilicli.js";
import { POWERS, POWER_LIST, usePower, powersTick } from "./powers.js";
import { menu } from "./ui/forms.js";
import { POWER_ICON } from "./ui/kilicli_ui.js";
import { KILICLI_MODELS } from "./constants.js";

const KOSTUM_ID = "aqualit:kostum";
const ESYALAR = ["aqualit:kostum_guc", "aqualit:kostum_cik", "aqualit:aqualit_sword"];
const PROP = "aq:kostum";
const ETKILER = ["invisibility", "health_boost", "strength", "speed", "resistance"];
/** oyuncu kimliği -> { pl, kid, botId, kb } */
export const kostumlar = new Map();

const oku = (pl) => safe(() => JSON.parse(pl.getDynamicProperty(PROP) ?? "null"), null);
const yaz = (pl, v) => safe(() => pl.setDynamicProperty(PROP, v ? JSON.stringify(v) : undefined));

export function kostumda(pl) {
  return kostumlar.has(pl.id);
}

function envanterBos(pl) {
  const c = safe(() => pl.getComponent("minecraft:inventory")?.container);
  if (!c) return false;
  for (let i = 0; i < c.size; i++) if (safe(() => c.getItem(i))) return false;
  const eq = safe(() => pl.getComponent("minecraft:equippable"));
  for (const s of ["Head", "Chest", "Legs", "Feet", "Offhand"]) if (safe(() => eq?.getEquipment(s))) return false;
  return true;
}

function kilitli(id, ad) {
  const it = new ItemStack(id, 1);
  safe(() => { it.lockMode = "inventory"; });
  safe(() => { it.keepOnDeath = true; });
  if (ad) safe(() => { it.nameTag = ad; });
  return it;
}

/** Güç kodunun robot gibi kullandığı sahte robot: gövde oyuncu, animasyon kostüm varlığında. */
function sahteRobot(pl, bot, st) {
  const kb = {
    get e() { return pl; },
    get loc() { return pl.location; },
    get dim() { return pl.dimension; },
    get valid() { return safe(() => pl.isValid, false); },
    get id() { return pl.id; },
    type: "kilicli", model: bot.model, name: `${pl.name} (${bot.name})`, owner: pl.id,
    stats: { ...st, guc: false },     // kendi başına güç seçmesin: oyuncu seçer
    job: null, pw: null, _act: "", _move: "",
    kostum: null,
    setAct(a) {
      if (this._act === a) return;
      this._act = a;
      const k = this.kostum;
      const two = ACT2.has(a);
      safe(() => k.setProperty("aqualit:act", two ? "none" : a));
      safe(() => k.setProperty("aqualit:act2", two ? a : "none"));
    },
    setMove(m) {
      if (this._move === m) return;
      this._move = m;
      safe(() => this.kostum.setProperty("aqualit:move", m));
    },
    setStatus() {}, say(t) { safe(() => pl.sendMessage(`§7${t}`)); },
    tp(pos, yaw) { safe(() => pl.teleport(pos, { rotation: { x: 0, y: yaw ?? pl.getRotation().y } })); },
  };
  return kb;
}

function etkileriVer(pl, st) {
  const s = (ad, amp) => safe(() => pl.addEffect(ad, 20000000, { amplifier: amp, showParticles: false }));
  s("invisibility", 0);
  const ek = Math.max(0, (st.can ?? 30) - 20);
  if (ek > 0) s("health_boost", clamp(Math.ceil(ek / 4) - 1, 0, 255));
  s("strength", clamp(Math.round(((st.hasar ?? 7) - 1) / 3) - 1, 0, 30));
  s("speed", clamp(Math.round(((st.hiz ?? 3) - 1) / 2) - 1, 0, 4));
  s("resistance", clamp((st.model ?? 1) - 2, 0, 3));
}

function kostumVarligi(pl, model, eski) {
  let k = eski ? safe(() => world.getEntity(eski)) : null;
  if (k && safe(() => k.isValid, false)) return k;
  k = safe(() => pl.dimension.spawnEntity(KOSTUM_ID, pl.location));
  if (!k) return null;
  safe(() => k.setProperty("aqualit:type", "kilicli"));
  safe(() => k.setProperty("aqualit:model", clamp(model, 1, 5)));
  safe(() => k.setDynamicProperty("aq:kostum_sahip", pl.id));
  return k;
}

/** Kılıçlı robotu giy. Envanter boş olmalı. */
export function kostumGiy(pl, bot) {
  if (kostumda(pl)) return pl.sendMessage("§7Zaten bir kostüm giyiyorsun.");
  if (!envanterBos(pl)) return pl.sendMessage("§eKostümü giymek için envanterin ve zırh yuvaların boş olmalı.");
  const st = getStats(bot);
  const k = kostumVarligi(pl, bot.model);
  if (!k) return pl.sendMessage("§cKostüm oluşturulamadı.");
  // robot görünmez bekler; kendi başına güç kullanmaz
  setMode(bot, "stay", true);
  safe(() => bot.e.addEffect("invisibility", 20000000, { amplifier: 0, showParticles: false }));
  bot._kostumGuc = bot.stats?.guc;
  if (bot.stats) bot.stats = { ...bot.stats, guc: false };
  const kb = sahteRobot(pl, bot, st);
  kb.kostum = k;
  kostumlar.set(pl.id, { pl, kid: k.id, botId: bot.id, kb });
  yaz(pl, { kid: k.id, botId: bot.id, model: bot.model });
  etkileriVer(pl, st);
  system.runTimeout(() => safe(() => pl.getComponent("minecraft:health")?.resetToMaxValue()), 2);
  const c = safe(() => pl.getComponent("minecraft:inventory")?.container);
  safe(() => c.setItem(0, kilitli("aqualit:aqualit_sword", `§b${bot.name} kılıcı`)));
  safe(() => c.setItem(7, kilitli("aqualit:kostum_guc")));
  safe(() => c.setItem(8, kilitli("aqualit:kostum_cik")));
  safe(() => pl.camera.setCamera("minecraft:third_person"));
  safe(() => pl.playSound("aqualit.power.zap", { pitch: 1.3 }));
  safe(() => pl.dimension.spawnParticle("minecraft:totem_particle", V.add(pl.location, { x: 0, y: 1, z: 0 })));
  pl.sendMessage(`§sArtık ${bot.name} sensin!§r Canın ${st.can}, hasarın ${st.hasar}. Güçler için §lKostüm Güçleri§r eşyasını, çıkmak için §lKostümden Çık§r eşyasını kullan.`);
  return true;
}

function esyalariAl(pl) {
  const c = safe(() => pl.getComponent("minecraft:inventory")?.container);
  if (!c) return;
  for (let i = 0; i < c.size; i++) {
    const it = safe(() => c.getItem(i));
    if (!it) continue;
    const bizim = it.typeId !== "aqualit:aqualit_sword" || safe(() => it.keepOnDeath) === true || safe(() => it.lockMode) === "inventory";
    if (ESYALAR.includes(it.typeId) && bizim) safe(() => c.setItem(i, undefined));
  }
}

/** Kostümden çık: oyuncu eski haline döner, robot yanında belirir ve seni takip eder. */
export function kostumCik(pl, sessiz = false) {
  const k = kostumlar.get(pl.id);
  const kayit = oku(pl);
  const kid = k?.kid ?? kayit?.kid;
  const botId = k?.botId ?? kayit?.botId;
  kostumlar.delete(pl.id);
  yaz(pl, null);
  const ent = kid ? safe(() => world.getEntity(kid)) : null;
  safe(() => ent?.remove());
  for (const e of ETKILER) safe(() => pl.removeEffect(e));
  esyalariAl(pl);
  safe(() => pl.camera.clear());
  const bot = [...bots.values()].find((b) => b.id === botId);
  if (bot) {
    safe(() => bot.e.removeEffect("invisibility"));
    if (bot.stats) bot.stats = { ...bot.stats, guc: bot._kostumGuc ?? true };
    if (bot.dim?.id === pl.dimension.id) safe(() => bot.e.teleport(V.add(pl.location, { x: 1, y: 0, z: 0 })));
    setMode(bot, "follow", true);
  }
  if (!sessiz) pl.sendMessage("§7Kostümden çıktın. Robotun yanında.");
  return true;
}

/** Kostüm Güçleri eşyası: robotun açık güçlerinden birini hemen kullan. */
export async function kostumGucMenu(pl) {
  const k = kostumlar.get(pl.id);
  if (!k) return pl.sendMessage("§7Önce bir Kılıçlı'yı kostüm olarak giy (Komut Çubuğu → robot → Kostüm olarak giy).");
  const kb = k.kb;
  const now = system.currentTick;
  const keys = POWER_LIST.filter((key) => POWERS[key] && POWERS[key].model <= kb.model);
  const btns = keys.map((key) => {
    const p = POWERS[key];
    const cd = Math.max(0, Math.ceil(((kb.pw?.cd?.[key] ?? 0) - now) / 20));
    return { text: `§l${p.ad}§r\n${cd ? `§7Bekleme: ${cd} sn` : "§7dokun: kullan"}`, icon: POWER_ICON[key] ?? "textures/items/nether_star", key };
  });
  const c = await menu(pl, "§lKostüm Güçleri", `§7Seviye ${kb.model} (${KILICLI_MODELS[kb.model]?.renk}) · ${keys.length} güç açık.`, btns);
  if (!c || !kostumlar.has(pl.id)) return;
  const ok = usePower(kb, c.key);
  pl.sendMessage(ok ? `§s${POWERS[c.key].ad}!` : "§7Şu an kullanılamıyor (bekleme sürüyor ya da yakında düşman yok).");
}

// ---------------------------------------------------------------- her tik: kostüm oyuncuyla yürür
system.runInterval(() => {
  for (const [id, k] of kostumlar) {
    const pl = k.pl;
    if (!safe(() => pl.isValid, false)) { kostumlar.delete(id); continue; }
    let ent = safe(() => world.getEntity(k.kid));
    if (!ent || !safe(() => ent.isValid, false) || safe(() => ent.dimension.id) !== safe(() => pl.dimension.id)) {
      safe(() => ent?.remove());
      ent = kostumVarligi(pl, k.kb.model);
      if (!ent) continue;
      k.kid = ent.id;
      k.kb.kostum = ent;
      k.kb._act = k.kb._move = "";
      yaz(pl, { kid: ent.id, botId: k.botId, model: k.kb.model });
    }
    k.kb.kostum = ent;
    const r = safe(() => pl.getRotation(), { x: 0, y: 0 });
    safe(() => ent.teleport(pl.location, { rotation: { x: 0, y: r.y } }));
    const v = safe(() => pl.getVelocity(), { x: 0, y: 0, z: 0 });
    const hiz = Math.hypot(v.x, v.z);
    k.kb.setMove(hiz > 0.2 ? "run" : hiz > 0.03 ? "walk" : "none");
    safe(() => powersTick(k.kb));
    const now = system.currentTick;
    if (!k.kb.pw?.cast && k.kb._attackUntil && k.kb._attackUntil <= now) { k.kb._attackUntil = 0; k.kb.setAct("none"); }
  }
}, 1);

// vuruş animasyonu
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const k = kostumlar.get(safe(() => ev.damagingEntity.id));
  if (!k || k.kb.pw?.cast) return;
  k.kb.setAct("attack");
  k.kb._attackUntil = system.currentTick + 8;
});

// ölünce kostüm çıkar
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (safe(() => e.typeId) !== "minecraft:player") return;
  if (kostumlar.has(e.id) || oku(e)) kostumCik(e, true);
});

// oyuna dönünce (ya da yeniden doğunca) kayıt varsa kostümü sür; robot yoksa temizle
world.afterEvents.playerSpawn.subscribe((ev) => {
  const pl = ev.player;
  system.runTimeout(() => {
    const kayit = oku(pl);
    if (!kayit || kostumlar.has(pl.id)) return esyalariAlYoksa(pl, kayit);
    const bot = [...bots.values()].find((b) => b.id === kayit.botId);
    if (!bot) return kostumCik(pl, true);
    const st = getStats(bot);
    const kb = sahteRobot(pl, bot, st);
    kostumlar.set(pl.id, { pl, kid: kayit.kid, botId: bot.id, kb });
    etkileriVer(pl, st);
    safe(() => pl.camera.setCamera("minecraft:third_person"));
  }, 40);
});

function esyalariAlYoksa(pl, kayit) {
  if (!kayit && !kostumlar.has(pl.id)) esyalariAl(pl);
}

// sahipsiz kostüm varlıklarını temizle (dünya yeniden yüklenince)
system.runInterval(() => {
  for (const d of ["overworld", "nether", "the_end"]) {
    const list = safe(() => world.getDimension(d).getEntities({ type: KOSTUM_ID }), []);
    for (const e of list ?? []) {
      const sahip = safe(() => e.getDynamicProperty("aq:kostum_sahip"));
      const k = sahip && kostumlar.get(sahip);
      if (!k || k.kid !== e.id) safe(() => e.remove());
    }
  }
}, 200);
