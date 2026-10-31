// Aqualit Robotları — Mini Keşif (yapay zekâsız): robot <-> binilebilir araçlar
//
// Robotken dokun: araç menüsü. Araçken dokun: bin. Eğilip dokun ya da binerken telsizi/kumandayı kullan: menü.
// Sürüş: ileri/geri tuşu; yön bakılan yöne göre. Uçak ve denizaltı bakış yönünde tırmanır/dalar.
// Matkap ilerlerken seçilen yönde (düz, aşağı, çapraz) 3x3 kazar. Keşif ve araçları yalnız sahibine aittir.
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { safe, fire } from "./util.js";
import * as B from "./blocks.js";
import * as FX from "./fx.js";
import { ICONS } from "./ikon_data.js";
import { anaMenu, kesifKuruldu, kesifToplandi, koltuksuzIceri, aiMesgul, aiBirak } from "./kesif_ai.js";
import { hizCarpani, tutucuAcik, tutucuAyarla } from "./kesif_radar.js";

export const KESIF_ID = "aqualit:kesif";
export const KFORMS = ["robot", "ucak", "gemi", "denizalti", "arazi", "matkap"];
export const KAD = { robot: "Robot", ucak: "Uçak", gemi: "Gemi", denizalti: "Denizaltı", arazi: "Arazi aracı", matkap: "Matkap" };
const KAZ = ["yatay", "dikey", "capraz"];
const KAZ_AD = { yatay: "düz ileri", dikey: "aşağı", capraz: "çapraz aşağı" };
const SPEED = { ucak: 1.1, gemi: 0.6, denizalti: 0.38, arazi: 0.55, matkap: 0.14 }; // blok/tik
const LOOP = { ucak: "aqualit.kesif.plane_loop", gemi: "aqualit.kesif.boat_loop", denizalti: "aqualit.kesif.sub_loop",
  arazi: "aqualit.kesif.rover_loop", matkap: "aqualit.kesif.drill_loop" };
const START = { ucak: "aqualit.kesif.plane", gemi: "aqualit.kesif.boat", denizalti: "aqualit.kesif.sonar",
  arazi: "aqualit.kesif.rover", matkap: "aqualit.kesif.drill" };
const ICON = { robot: "textures/items/robot_kesif", ucak: ICONS["minecraft:elytra"], gemi: ICONS["minecraft:oak_boat"],
  denizalti: ICONS["minecraft:nautilus_shell"], arazi: ICONS["minecraft:minecart"], matkap: ICONS["minecraft:diamond_pickaxe"] };
const UNBREAK = new Set(["minecraft:bedrock", "minecraft:barrier", "minecraft:end_portal_frame", "minecraft:end_portal",
  "minecraft:portal", "minecraft:end_gateway", "minecraft:command_block", "minecraft:chain_command_block",
  "minecraft:repeating_command_block", "minecraft:structure_block", "minecraft:jigsaw", "minecraft:reinforced_deepslate",
  "minecraft:light_block", "minecraft:allow", "minecraft:deny", "minecraft:border_block", "minecraft:structure_void"]);
const KEEP = /chest|barrel|shulker|furnace|smoker|hopper|dispenser|dropper|^aqualit:|_bed$|_sign|spawner|vault|beacon|anvil|enchanting/;

const busy = new Set();      // dönüşmekte olan Keşifler
const last = new Map();      // oyuncu -> { form, tick } (indiğinde yavaş düşüş için)
const snd = (dim, id, p, o) => safe(() => dim.playSound(id, p, o));

export const formOf = (e) => safe(() => e.getProperty("aqualit:form"), "robot");
const ownerOf = (e) => safe(() => e.getDynamicProperty("aq:sahip"));
export const ridersOf = (e) => safe(() => e.getComponent("minecraft:rideable")?.getRiders() ?? [], []);

export function ridingKesif(pl) {
  const r = safe(() => pl.getComponent("minecraft:riding")?.entityRidingOn);
  return r && safe(() => r.typeId) === KESIF_ID ? r : null;
}

// ------------------------------------------------------------------ yerleştirme ve toplama
const FACE = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] };

export function spawnKesif(player, block, face) {
  const o = FACE[face] ?? FACE.Up;
  const p = { x: block.x + o[0] + 0.5, y: block.y + o[1], z: block.z + o[2] + 0.5 };
  const dim = player.dimension;
  const yaw = safe(() => player.getRotation().y, 0) + 180;
  let e, hata;
  try {
    e = dim.spawnEntity(KESIF_ID, p, { initialRotation: yaw });
  } catch (err) {
    hata = String(err?.message ?? err).slice(0, 160);
  }
  if (!e) {
    // v0.3.7: sebebi de yaz (v0.3.6'da varlık oyunda yüklenmediği için hiçbir yere konamıyordu)
    return safe(() => player.sendMessage(`§cKeşif buraya konamadı.${hata ? ` §7(${hata})` : ""}`));
  }
  safe(() => e.setDynamicProperty("aq:sahip", player.id));
  safe(() => e.setDynamicProperty("aq:sahip_ad", player.name));
  if (safe(() => player.getGameMode(), "Survival") !== "Creative") {
    const inv = safe(() => player.getComponent("minecraft:inventory").container);
    const slot = player.selectedSlotIndex;
    const it = safe(() => inv.getItem(slot));
    if (it?.typeId === "aqualit:robot_kesif") safe(() => inv.setItem(slot, it.amount > 1 ? Object.assign(it, { amount: it.amount - 1 }) : undefined));
  }
  snd(dim, "aqualit.robot.boot", p, { volume: 0.8 });
  system.run(() => kesifKuruldu(e));
  system.run(() => kitVer(player));
  safe(() => player.sendMessage("§s§lKeşif hazır!§r §7Ona dokun: menü (yapı/biyom bul, keşfet, beni götür). " +
    "Dönüşüm Kiti'yle basılı tut: araç seç. Araçken dokun: bin; eğilip dokun: menü."));
}

/** Dönüşüm Kiti: envanterde yoksa verir; envanter doluysa oyuncunun önüne bırakır. */
export const KIT = "aqualit:kesif_kiti";
export function kitVer(pl) {
  const inv = safe(() => pl.getComponent("minecraft:inventory").container);
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) if (safe(() => inv.getItem(i)?.typeId) === KIT) return;
  const rest = safe(() => inv.addItem(new ItemStack(KIT, 1)));
  if (rest) {
    const d = safe(() => pl.getViewDirection(), { x: 0, y: 0, z: 1 });
    const l = pl.location;
    safe(() => pl.dimension.spawnItem(rest, { x: l.x + d.x * 1.2, y: l.y + 0.5, z: l.z + d.z * 1.2 }));
    safe(() => pl.sendMessage("§eEnvanterin dolu; Dönüşüm Kiti'ni önüne bıraktım."));
  } else safe(() => pl.sendMessage("§s§lDönüşüm Kiti§r §7envanterinde: Keşif'e basılı tutunca araç listesi açılır."));
}

/** Kitle açılan dönüşüm listesi. */
export async function donusumMenu(pl, e) {
  if (!safe(() => e.isValid, false)) return;
  const form = formOf(e);
  const f = new ActionFormData().title("§lDönüşüm Kiti").body(`Şu an: §l${KAD[form]}§r\n§7Ne olsun?`);
  const opts = [];
  for (const k of KFORMS) {
    if (k === form) continue;
    f.button(k === "robot" ? "§lRobot§r\n§7Yürür, menü açar" : `§l${KAD[k]}§r`, ICON[k]);
    opts.push(k);
  }
  const r = await f.show(pl);
  if (r.canceled || r.selection === undefined || !safe(() => e.isValid, false)) return;
  transform(e, opts[r.selection], pl);
}

export function collect(e, pl) {
  const dim = e.dimension, p = { ...e.location };
  kesifToplandi(e);
  for (const r of ridersOf(e)) safe(() => e.getComponent("minecraft:rideable").ejectRider(r));
  safe(() => e.remove());
  safe(() => {
    const inv = pl.getComponent("minecraft:inventory").container;
    const left = inv.addItem(new ItemStack("aqualit:robot_kesif", 1));
    if (left) dim.spawnItem(left, p);
  });
  snd(dim, "aqualit.robot.servo", p, { volume: 0.8 });
}

// ------------------------------------------------------------------ dönüşüm
function waterAt(dim, p, dy = 0) {
  const b = safe(() => dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y + dy), z: Math.floor(p.z) }));
  return !!b && /water/.test(safe(() => b.typeId, ""));
}

export function transform(e, to, pl) {
  if (!safe(() => e.isValid, false) || busy.has(e.id)) return false;
  const from = formOf(e);
  if (from === to || !KFORMS.includes(to)) return false;
  const dim = e.dimension, p = e.location;
  if (to === "denizalti" && !(waterAt(dim, p, 0.2) || waterAt(dim, p, 1))) {
    safe(() => pl?.sendMessage("§eDenizaltı olmak için Keşif suyun içinde olmalı."));
    return false;
  }
  if (to === "gemi" && !(waterAt(dim, p, 0) || waterAt(dim, p, -0.5) || waterAt(dim, p, 0.5))) {
    safe(() => pl?.sendMessage("§eGemi olmak için Keşif suyun üstünde olmalı."));
    return false;
  }
  const riders = ridersOf(e);
  busy.add(e.id);
  kesifDurumSil(e);
  if (from === "arazi") tutucuAyarla(e, false);
  safe(() => e.setProperty("aqualit:gecis", true));
  safe(() => e.triggerEvent("aqualit:gecis_on"));
  snd(dim, "aqualit.kesif.goggles", p);
  snd(dim, to === "robot" ? "aqualit.kesif.untransform" : "aqualit.kesif.transform", p);
  system.runTimeout(() => {
    if (!safe(() => e.isValid, false)) return busy.delete(e.id);
    safe(() => e.triggerEvent(`aqualit:form_${to}`));
    safe(() => e.setProperty("aqualit:form", to));
    safe(() => e.setProperty("aqualit:gecis", false));
    safe(() => e.triggerEvent("aqualit:gecis_off"));
    safe(() => e.setProperty("aqualit:egim", 0));
    const c = { x: e.location.x, y: e.location.y + 0.8, z: e.location.z };
    FX.parlama(dim, c, 1.6);
    for (let i = 0; i < 8; i++) FX.parilti(dim, { x: c.x + FX.rnd() * 1.5, y: c.y + FX.rnd() * 0.8, z: c.z + FX.rnd() * 1.5 });
    snd(dim, "aqualit.kesif.sparkle", c, { volume: 0.7 });
    if (to !== "robot") {
      system.runTimeout(() => {
        const rc = safe(() => e.getComponent("minecraft:rideable"));
        for (const r of riders) {
          if (!safe(() => r.isValid, false)) continue;
          // koltuk kalmadıysa (denizaltıya robot binmez) robot aracın içine girer
          if (!safe(() => rc.addRider(r), false) && r.typeId === "aqualit:robot") koltuksuzIceri(e, r);
        }
      }, 2);
    }
    system.runTimeout(() => {
      snd(dim, "aqualit.kesif.lock", e.location);
      if (to !== "robot") snd(dim, START[to], e.location, { volume: 0.9 });
      busy.delete(e.id); // açılma bitti: sürülebilir
    }, 17);
  }, 11);
  return true;
}

// ------------------------------------------------------------------ araç menüsü (kendin sür)
export async function aracMenu(pl, e) {
  if (!safe(() => e.isValid, false)) return;
  const form = formOf(e);
  const kaz = safe(() => e.getDynamicProperty("aq:kaz"), "yatay") ?? "yatay";
  const f = new ActionFormData().title("Keşif Robotu")
    .body(`Şu an: §l${KAD[form]}§r\n§7Araçken dokunarak binersin, eğilince inersin. İleri tuşu: baktığın yöne git.` +
      (form === "matkap" ? `\nKazma yönü: §l${KAZ_AD[kaz]}` : ""));
  const opts = [];
  for (const k of KFORMS) {
    if (k === form) continue;
    f.button(k === "robot" ? "Robota dön" : `${KAD[k]} ol`, ICON[k]);
    opts.push(["form", k]);
  }
  if (form === "matkap") {
    f.button(`Kazma yönü: ${KAZ_AD[kaz]} (değiştir)`, ICONS["minecraft:compass"]);
    opts.push(["kaz"]);
  }
  f.button("Topla (eşyaya çevir)", ICONS["minecraft:chest"]);
  opts.push(["topla"]);
  const r = await f.show(pl);
  if (r.canceled || r.selection === undefined || !safe(() => e.isValid, false)) return;
  const [act, arg] = opts[r.selection];
  if (act === "form") transform(e, arg, pl);
  else if (act === "kaz") {
    const n = KAZ[(KAZ.indexOf(kaz) + 1) % KAZ.length];
    safe(() => e.setDynamicProperty("aq:kaz", n));
    safe(() => pl.sendMessage(`§sMatkap artık §l${KAZ_AD[n]}§r§s kazıyor.`));
  } else if (act === "topla") collect(e, pl);
}

// ------------------------------------------------------------------ sürüş
function blocked(dim, b) {
  const t = safe(() => b?.typeId, "minecraft:air");
  return !B.isPassableType(t);
}

function dig(v, fwd, mode) {
  const dim = v.dimension, p = v.location;
  const ax = Math.abs(fwd.x) >= Math.abs(fwd.z);
  const dx = ax ? Math.sign(fwd.x) : 0, dz = ax ? 0 : Math.sign(fwd.z);
  const lx = dz, lz = dx; // yana dik
  const cx = Math.floor(p.x), cy = Math.floor(p.y + 0.05), cz = Math.floor(p.z);
  const cells = [];
  if (mode === "dikey") {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) cells.push([cx + a, cy - 1, cz + b]);
  } else {
    const hs = mode === "capraz" ? [-1, 0, 1] : [0, 1, 2];
    for (let d = 1; d <= 2; d++) for (let l = -1; l <= 1; l++) for (const h of hs) {
      cells.push([cx + dx * d + lx * l, cy + h, cz + dz * d + lz * l]);
    }
  }
  let n = 0;
  for (const [x, y, z] of cells) {
    const b = safe(() => dim.getBlock({ x, y, z }));
    if (!b) continue;
    const id = safe(() => b.typeId, "minecraft:air");
    if (id === "minecraft:air" || /water|lava/.test(id) || UNBREAK.has(id) || KEEP.test(id)) continue;
    safe(() => dim.runCommand(`setblock ${x} ${y} ${z} air destroy`));
    n++;
  }
  return n;
}

// matkabın kazdıkları: düşen eşyalar Keşif deposuna (aq:kdepo); madenci varsa ona verilir (kesif_ai.js depoyuDagit)
export function depoOku(e) {
  return safe(() => JSON.parse(e.getDynamicProperty("aq:kdepo") ?? "{}"), {}) ?? {};
}
export function depoYaz(e, d) {
  safe(() => e.setDynamicProperty("aq:kdepo", JSON.stringify(d)));
}
export function depoSay(e) {
  return Object.values(depoOku(e)).reduce((a, n) => a + n, 0);
}
/** Kazıdan birkaç tik sonra çevredeki düşen eşyaları depoya alır. */
export function kaziTopla(v) {
  system.runTimeout(() => {
    if (!safe(() => v.isValid, false)) return;
    const items = safe(() => v.dimension.getEntities({ type: "minecraft:item", location: v.location, maxDistance: 5 }), []) ?? [];
    if (!items.length) return;
    const d = depoOku(v);
    for (const it of items) {
      const st = safe(() => it.getComponent("minecraft:item")?.itemStack);
      if (!st) continue;
      d[st.typeId] = (d[st.typeId] ?? 0) + st.amount;
      safe(() => it.remove());
    }
    depoYaz(v, d);
  }, 4);
}

// ------------------------------------------------------------------ v0.3.6: eğim, tırmanma, denizaltı modu
const DURUM = new Map();     // Keşif kimliği -> { y, s, h, tir, hedefY, sure, bos, dz }
function durum(v) {
  let d = DURUM.get(v.id);
  if (!d) DURUM.set(v.id, (d = { y: v.location.y, x: v.location.x, z: v.location.z, s: 0, h: 0, tir: false, sure: 0, bos: 0, dz: null }));
  return d;
}
export function kesifDurumSil(v) {
  const d = DURUM.get(v.id);
  if (d?.tir) safe(() => v.triggerEvent("aqualit:tirman_off"));
  DURUM.delete(v.id);
}

/** İnip çıkarken burun açısı (derece; eksi = burun yukarı). Yükseklik değişimi / yatay yol, yumuşatılmış. */
export function egimHesap(v) {
  const d = durum(v), p = v.location;
  const dy = p.y - d.y, dh = Math.hypot(p.x - d.x, p.z - d.z);
  d.x = p.x; d.y = p.y; d.z = p.z;
  if (Math.abs(dy) > 3 || dh > 3) { d.s = 0; d.h = 0; return 0; }   // ışınlandı
  d.s = d.s * 0.75 + dy * 0.25;
  d.h = d.h * 0.75 + dh * 0.25;
  if (d.h < 0.02 && Math.abs(d.s) < 0.02) return 0;
  const a = (-Math.atan2(d.s, Math.max(d.h, 0.08)) * 180) / Math.PI;
  return Math.max(-35, Math.min(35, a));
}

function katiMi(dim, x, y, z) {
  return blocked(dim, safe(() => dim.getBlock({ x, y, z })));
}

/**
 * Arazi aracı tırmanma modu (v0.3.6): Tırmanma Modu eşyasıyla tekerleklere mavi tutucular çıkınca, düz duvara doğru
 * sürülürse araç yerçekimsiz olur, burnu dikilir ve duvara yapışıp yukarı tırmanır; üste varınca yere döner.
 * Tutucular kapalıyken yalnız 1 bloğu oyunun otomatik basamak çıkması aşar.
 */
const TIRMAN_ACI = -80;
export function tirman(v, pl, mv, t) {
  const d = durum(v), dim = v.dimension, p = v.location;
  const ileri = (mv?.y ?? 0) > 0.3;
  if (!tutucuAcik(v)) {
    if (d.tir) { d.tir = false; safe(() => v.triggerEvent("aqualit:tirman_off")); }
    return 0;
  }
  const yaw = safe(() => v.getRotation().y, 0);
  const yr = (yaw * Math.PI) / 180;
  const h = { x: -Math.sin(yr), z: Math.cos(yr) };
  const ax = Math.floor(p.x + h.x * 1.8), az = Math.floor(p.z + h.z * 1.8);
  const y0 = Math.floor(p.y + 0.1);
  if (!d.tir) {
    if (!ileri || t % 2) return 0;
    // 1 bloğu oyun kendisi çıkar; 2+ blok duvara dayanınca tırman
    if (!(katiMi(dim, ax, y0, az) && katiMi(dim, ax, y0 + 1, az))) return 0;
    // duvarın üstü: 64 bloğa kadar ara (bulunamazsa tavana kadar tırmanır)
    let ust = 64;
    for (let k = 2; k <= 64; k++) {
      if (!katiMi(dim, ax, y0 + k, az) && !katiMi(dim, ax, y0 + k + 1, az)) { ust = k; break; }
    }
    d.tir = true; d.hedefY = y0 + ust; d.basY = p.y; d.sure = 0; d.bos = 0;
    safe(() => v.triggerEvent("aqualit:tirman_on"));
    snd(dim, "aqualit.kesif.rover", p, { volume: 0.8 });
    if (!d.ipucu) {
      d.ipucu = true;
      safe(() => pl.onScreenDisplay.setActionBar("§bTutucular duvara yapıştı · ileri bas (yukarı bakarsan daha hızlı)"));
    }
    return TIRMAN_ACI;
  }
  d.sure++;
  d.bos = ileri ? 0 : d.bos + 1;
  // ileri basılıyken yukarı it (oyun binilen araçta itkiyi almazsa yukarı bakarak sürülür)
  const geri = (mv?.y ?? 0) < -0.3;
  if (geri) {
    // geri: duvardan yavaşça aşağı iner
    const vel = safe(() => v.getVelocity(), { x: 0, y: 0, z: 0 });
    safe(() => v.applyImpulse({ x: 0, y: -0.15 - vel.y, z: 0 }));
  } else if (ileri) {
    const vel = safe(() => v.getVelocity(), { x: 0, y: 0, z: 0 });
    const yukari = p.y < d.hedefY + 0.2;
    safe(() => v.applyImpulse({ x: h.x * (yukari ? 0.02 : 0.12), y: (yukari ? 0.2 : 0.02) - vel.y, z: h.z * (yukari ? 0.02 : 0.12) }));
  }
  if (t % 10 === 0) safe(() => dim.spawnParticle("minecraft:basic_crit_particle", { x: p.x + h.x * 1.4, y: p.y + 0.3, z: p.z + h.z * 1.4 }));
  // üste çıktı (altı dolu, önü açık), duvar bitti ya da geri basıp yere indi: yerçekimi geri gelir
  const altDolu = katiMi(dim, Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
  const ustte = p.y >= d.hedefY - 0.1 && altDolu;
  const duvarYok = !katiMi(dim, ax, y0, az) && !katiMi(dim, ax, y0 - 1, az);
  // (basmayı bırakınca tutucular duvarda tutar, düşmez)
  const indi = altDolu && geri && p.y <= (d.basY ?? p.y) + 0.3;
  if (ustte || indi || p.y > d.hedefY + 3 || d.sure > 6000 || (duvarYok && altDolu && d.sure > 10)) {
    d.tir = false;
    safe(() => v.triggerEvent("aqualit:tirman_off"));
    return 0;
  }
  // tavana dayandı: tırmanamaz, bekler (geri basınca iner)
  return TIRMAN_ACI;
}

/** Denizaltı suyun içindeyse uçan binek gibi (dalar, çıkar), dışındaysa düşer ve yavaş sürünür. */
function dzMod(v) {
  const d = durum(v);
  const su = safe(() => v.isInWater, false) || waterAt(v.dimension, v.location, 0.5);
  const m = su ? "su" : "kara";
  if (d.dz === m) return;
  d.dz = m;
  safe(() => v.triggerEvent(su ? "aqualit:dz_su" : "aqualit:dz_kara"));
}

function drive(v, pl, t) {
  const form = formOf(v);
  if (form === "robot" || busy.has(v.id)) return;
  const dim = v.dimension;
  const mv = safe(() => pl.inputInfo.getMovementVector(), { x: 0, y: 0 }) ?? { x: 0, y: 0 };
  if (aiMesgul(v)) {
    // otopilot / takip / götürme: Keşif kendisi sürüyor; oyuncu yön tuşuna basarsa kontrol oyuncuya geçer
    if (Math.abs(mv.x) + Math.abs(mv.y) < 0.2) return;
    aiBirak(v, pl);
  }
  const rot = safe(() => pl.getRotation(), { x: 0, y: 0 });
  const yr = (rot.y * Math.PI) / 180;
  const fwd = { x: -Math.sin(yr), y: 0, z: Math.cos(yr) };
  const vel = safe(() => v.getVelocity(), { x: 0, y: 0, z: 0 });
  const sp = SPEED[form] * hizCarpani(v, pl);       // hız sayacı (kesif_radar.js)
  const f = Math.max(-0.4, Math.min(1, mv.y));
  let tgt = { x: fwd.x * sp * f, y: 0, z: fwd.z * sp * f };
  let fly = false;
  let tilt = 0;
  if (form === "ucak") {
    const look = safe(() => pl.getViewDirection(), fwd);
    const thr = Math.max(0, mv.y);
    fly = true;
    tgt = { x: look.x * sp * thr, y: look.y * sp * thr, z: look.z * sp * thr };
    if (thr < 0.05) tgt.y = safe(() => v.isOnGround, false) ? 0 : -0.08; // gaz yoksa süzülerek alçalır
    tilt = Math.max(-45, Math.min(45, rot.x)) * thr;
  } else if (form === "denizalti") {
    fly = true;
    dzMod(v);
    if (safe(() => v.isInWater, false)) {
      const look = safe(() => pl.getViewDirection(), fwd);
      tgt = { x: look.x * sp * f, y: look.y * sp * f, z: look.z * sp * f };
      tilt = Math.max(-45, Math.min(45, rot.x)) * Math.abs(f);
    } else tgt = { x: 0, y: -0.35, z: 0 }; // suyun dışında düşer
    if (t % 100 === 0) {
      for (const r of ridersOf(v)) {
        safe(() => r.addEffect("water_breathing", 240, { showParticles: false }));
        safe(() => r.addEffect("night_vision", 320, { showParticles: false }));
      }
    }
  } else if (form === "gemi") {
    const water = safe(() => v.isInWater, false) || waterAt(dim, v.location, -0.3);
    if (!water) tgt = { x: tgt.x * 0.08, y: 0, z: tgt.z * 0.08 };
  } else if (form === "arazi") {
    // bir blok: oyunun otomatik basamak çıkması (variable_max_auto_step); 2-6 blok dik duvar: tırmanma modu
    tilt = tirman(v, pl, mv, t);
  } else if (form === "matkap") {
    const mode = safe(() => v.getDynamicProperty("aq:kaz"), "yatay") ?? "yatay";
    if (f > 0.1 && t % 4 === 0) {
      const n = dig(v, fwd, mode);
      if (n) kaziTopla(v);
      if (n && t % 20 === 0) snd(dim, "aqualit.kesif.drill_loop", v.location, { volume: 0.8 });
    }
    if (mode === "dikey") tgt = { x: 0, y: 0, z: 0 };
  }
  // ileri-geri ve dönüşü oyunun sürüş sistemi yapar (input_ground_controlled); betik yalnız uçak ve denizaltının
  // yukarı-aşağısını verir, matkap kazar. (v0.3.4'e kadar yatay itki veriliyordu; oyuncu binince oyunda işlemiyordu.)
  // v0.3.6: uçak ve denizaltının yukarı-aşağısını da oyunun uçan binek sistemi yapar (input_air_controlled; Mutlu Ghast
  // gibi baktığın yöne). Betikle dikey itki oyuncu binince oyunda işlemiyordu (uçak birkaç blokta kalıyordu).
  // yedek: uçan binek sistemi bu biçimde çalışmazsa betik bakış yönüne göre dikey hız verir (v0.3.5 gibi)
  if (fly && (form === "ucak" || safe(() => v.isInWater, false))) safe(() => v.applyImpulse({ x: 0, y: tgt.y - vel.y, z: 0 }));
  if (form === "arazi" || form === "matkap") {
    const e2 = egimHesap(v);
    if (form === "matkap" || !durum(v).tir) tilt = e2;
  }
  const cur = safe(() => v.getProperty("aqualit:egim"), 0) ?? 0;
  if (Math.abs(cur - tilt) > 3) safe(() => v.setProperty("aqualit:egim", Math.round(tilt)));
  const moving = Math.hypot(tgt.x, tgt.y, tgt.z) > 0.03;
  if (moving && t % 20 === 0 && form !== "matkap") snd(dim, LOOP[form], v.location, { volume: 0.6 });
}

system.runInterval(() => {
  const t = system.currentTick;
  for (const pl of world.getAllPlayers()) {
    const v = ridingKesif(pl);
    const was = last.get(pl.id);
    if (!v) {
      if (was) {
        last.delete(pl.id);
        // indi: tırmanırken bırakılan araç yerçekimine döner
        if (was.v && safe(() => was.v.isValid, false) && DURUM.get(was.v.id)?.tir) {
          DURUM.get(was.v.id).tir = false;
          safe(() => was.v.triggerEvent("aqualit:tirman_off"));
        }
        if (was.form === "ucak" && !safe(() => pl.isOnGround, true)) safe(() => pl.addEffect("slow_falling", 200, { showParticles: false }));
      }
      continue;
    }
    const form = formOf(v);
    last.set(pl.id, { form, tick: t, v });
    const owner = ownerOf(v);
    const riders = ridersOf(v);
    if (owner && owner !== pl.id) {
      // başkası: yalnızca sahibi de bindiyse yolcu olabilir
      if (!riders.some((r) => r.id === owner)) safe(() => v.getComponent("minecraft:rideable").ejectRider(pl));
      continue;
    }
    if (!owner && riders[0]?.id !== pl.id) continue;
    drive(v, pl, t);
  }
}, 1);

// ------------------------------------------------------------------ etkileşim
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const e = ev.target;
  if (safe(() => e.typeId) !== KESIF_ID) return;
  const pl = ev.player;
  const owner = ownerOf(e);
  const form = formOf(e);
  if (owner && owner !== pl.id) {
    if (form === "robot" || !ridersOf(e).some((r) => r.id === owner)) {
      ev.cancel = true;
      const ad = safe(() => e.getDynamicProperty("aq:sahip_ad"), "başka bir oyuncu") ?? "başka bir oyuncu";
      system.run(() => safe(() => pl.sendMessage(`§cBu Keşif ${ad} oyuncusuna ait.`)));
    }
    return;
  }
  if (ev.itemStack?.typeId === KIT) {
    ev.cancel = true;
    system.run(() => fire(donusumMenu(pl, e), "dönüşüm kiti"));
    return;
  }
  if (form === "robot" || pl.isSneaking) {
    ev.cancel = true;
    system.run(() => fire(anaMenu(pl, e), "keşif menüsü"));
  }
});

world.beforeEvents.itemUse.subscribe((ev) => {
  const id = safe(() => ev.itemStack?.typeId);
  if (id !== "aqualit:robot_radio" && id !== "aqualit:task_remote" && id !== KIT) return;
  const v = ridingKesif(ev.source);
  if (!v) return;
  ev.cancel = true;
  if (id === KIT) return system.run(() => fire(donusumMenu(ev.source, v), "dönüşüm kiti"));
  system.run(() => fire(anaMenu(ev.source, v), "keşif menüsü"));
});
