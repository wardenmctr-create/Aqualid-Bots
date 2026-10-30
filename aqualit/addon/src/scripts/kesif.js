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
import { anaMenu, kesifKuruldu, kesifToplandi, koltuksuzIceri } from "./kesif_ai.js";
import { hizCarpani } from "./kesif_radar.js";

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
  const e = safe(() => dim.spawnEntity(KESIF_ID, p, { initialRotation: yaw }));
  if (!e) return safe(() => player.sendMessage("§cKeşif buraya konamadı."));
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
  safe(() => player.sendMessage("§s§lKeşif hazır!§r §7Ona dokun: menü (yapı/biyom bul, keşfet, beni götür, araç ol). " +
    "Araçken dokun: bin; eğilip dokun ya da binerken telsizi kullan: menü."));
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
  safe(() => e.setProperty("aqualit:gecis", true));
  snd(dim, "aqualit.kesif.goggles", p);
  snd(dim, to === "robot" ? "aqualit.kesif.untransform" : "aqualit.kesif.transform", p);
  system.runTimeout(() => {
    if (!safe(() => e.isValid, false)) return busy.delete(e.id);
    safe(() => e.triggerEvent(`aqualit:form_${to}`));
    safe(() => e.setProperty("aqualit:form", to));
    safe(() => e.setProperty("aqualit:gecis", false));
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

function drive(v, pl, t) {
  const form = formOf(v);
  if (form === "robot" || busy.has(v.id)) return;
  const dim = v.dimension;
  const mv = safe(() => pl.inputInfo.getMovementVector(), { x: 0, y: 0 }) ?? { x: 0, y: 0 };
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
    if (f > 0.1 && t % 6 === 0 && safe(() => v.isOnGround, false)) {
      const p = v.location;
      const ax = Math.floor(p.x + fwd.x * 1.5), az = Math.floor(p.z + fwd.z * 1.5), y = Math.floor(p.y + 0.1);
      const b1 = safe(() => dim.getBlock({ x: ax, y, z: az }));
      const b2 = safe(() => dim.getBlock({ x: ax, y: y + 1, z: az }));
      const b3 = safe(() => dim.getBlock({ x: ax, y: y + 2, z: az }));
      if (blocked(dim, b1) && !blocked(dim, b2) && !blocked(dim, b3)) safe(() => v.applyImpulse({ x: 0, y: 0.45, z: 0 }));
    }
  } else if (form === "matkap") {
    const mode = safe(() => v.getDynamicProperty("aq:kaz"), "yatay") ?? "yatay";
    if (f > 0.1 && t % 4 === 0) {
      const n = dig(v, fwd, mode);
      if (n) kaziTopla(v);
      if (n && t % 20 === 0) snd(dim, "aqualit.kesif.drill_loop", v.location, { volume: 0.8 });
    }
    if (mode === "dikey") tgt = { x: 0, y: 0, z: 0 };
  }
  const imp = { x: tgt.x - vel.x, y: fly ? tgt.y - vel.y : 0, z: tgt.z - vel.z };
  safe(() => v.applyImpulse(imp));
  safe(() => v.setRotation({ x: 0, y: rot.y }));
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
        if (was.form === "ucak" && !safe(() => pl.isOnGround, true)) safe(() => pl.addEffect("slow_falling", 200, { showParticles: false }));
      }
      continue;
    }
    const form = formOf(v);
    last.set(pl.id, { form, tick: t });
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
  if (form === "robot" || pl.isSneaking) {
    ev.cancel = true;
    system.run(() => fire(anaMenu(pl, e), "keşif menüsü"));
  }
});

world.beforeEvents.itemUse.subscribe((ev) => {
  const id = safe(() => ev.itemStack?.typeId);
  if (id !== "aqualit:robot_radio" && id !== "aqualit:task_remote") return;
  const v = ridingKesif(ev.source);
  if (!v) return;
  ev.cancel = true;
  system.run(() => fire(anaMenu(ev.source, v), "keşif menüsü"));
});
