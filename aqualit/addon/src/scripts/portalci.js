// Aqualit Robotları — Portalcı robot (v0.4.0)
// Robot kafası boyunda dron. Kendi portalını açar (Minecraft portalı değil): Üst Dünya <-> Nether, Nether'de güvenli yere.
// Oyuncuyu ya da robotu omuzlarından tutup uçurur. Boşken küçülüp sahibinin omzunda süzülür.
// "Çırağı yap": bir robota yardımcı olur, onun omzunda durur; robot gerekince onunla Nether'e geçip malzeme toplar,
// portalla döner ve topladığını robotun sandığına koyar.
import { world, system, ItemStack } from "@minecraft/server";
import { safe, V, wait, log } from "./util.js";
import { menu } from "./ui/forms.js";
import { consumeHand } from "./place.js";
import { bots, botByRid, startJob } from "./brain.js";

export const PORTALCI = "aqualit:portalci";
export const PORTAL = "aqualit:portal";
const MODLAR = { omuz: "Omzunda süzülüyor", serbest: "Yanında uçuyor", bekle: "Burada bekliyor", cirak: "Çıraklık yapıyor",
  tasi: "Taşıyor", sefer: "Nether seferinde" };
const pcs = new Map();             // varlık kimliği -> { e, owner, mod, cirak }
const portallar = new Map();       // portal kimliği -> { e, hedef: {dim, loc, yaw}, bitis }
const gecti = new Map();           // varlık kimliği -> tik (portaldan yeni geçti, geri sekmesin)
const seferde = new Set();         // Nether seferindeki robotlar: yalnız kendi portallarından geçer

export const MALZEME = {
  kuvars: { ad: "Nether kuvarsı", bloklar: ["minecraft:quartz_ore"], esya: "minecraft:quartz" },
  altin: { ad: "Altın (Nether altın cevheri)", bloklar: ["minecraft:nether_gold_ore"], esya: "minecraft:gold_nugget" },
  isiltas: { ad: "Işıltaş", bloklar: ["minecraft:glowstone"], esya: "minecraft:glowstone_dust" },
  netherrack: { ad: "Netherrack", bloklar: ["minecraft:netherrack"], esya: "minecraft:netherrack" },
  karatas: { ad: "Kara taş", bloklar: ["minecraft:blackstone"], esya: "minecraft:blackstone" },
  kutuk: { ad: "Kızıl / çarpık kütük", bloklar: ["minecraft:crimson_stem", "minecraft:warped_stem"], esya: null },
  ruhkumu: { ad: "Ruh kumu", bloklar: ["minecraft:soul_sand", "minecraft:soul_soil"], esya: null },
  magma: { ad: "Magma bloğu", bloklar: ["minecraft:magma"], esya: "minecraft:magma" },
  enkaz: { ad: "Antik enkaz (çok nadir)", bloklar: ["minecraft:ancient_debris"], esya: "minecraft:ancient_debris" },
};

const kayit = (e) => {
  let p = pcs.get(e.id);
  if (!p) {
    p = { e, owner: safe(() => e.getDynamicProperty("aq:owner"), ""), mod: safe(() => e.getDynamicProperty("aq:pc_mod"), "serbest") ?? "serbest",
      cirak: safe(() => e.getDynamicProperty("aq:pc_cirak"), "") ?? "" };
    pcs.set(e.id, p);
  }
  p.e = e;
  return p;
};
function modAyarla(p, mod, cirak, elle = false) {
  p.mod = mod;
  p.elle = elle && mod === "serbest";
  p.modBas = system.currentTick;
  safe(() => p.e.setDynamicProperty("aq:pc_mod", mod));
  if (cirak !== undefined) {
    p.cirak = cirak;
    safe(() => p.e.setDynamicProperty("aq:pc_cirak", cirak));
  }
}
const sahip = (p) => world.getAllPlayers().find((pl) => pl.id === p.owner);
export function portalcilar(owner) { return [...pcs.values()].filter((p) => p.owner === owner && safe(() => p.e.isValid, false)); }
export function portalciOf(e) { return pcs.get(safe(() => e.id)); }

/** Robot eşyasıyla yere koyunca. */
export function spawnPortalci(pl, block, face) {
  const p = V.add({ x: block.x + 0.5, y: block.y, z: block.z + 0.5 }, { x: 0, y: 1.6, z: 0 });
  const e = safe(() => pl.dimension.spawnEntity(PORTALCI, p));
  if (!e) return safe(() => pl.sendMessage("§cPortalcı buraya konamadı."));
  safe(() => e.setDynamicProperty("aq:owner", pl.id));
  safe(() => (e.nameTag = "Portalcı"));
  consumeHand(pl);
  const r = kayit(e);
  r.owner = pl.id;
  modAyarla(r, "serbest");
  safe(() => pl.sendMessage("§dPortalcı§r hazır! Ona dokun: portal aç, seni taşısın, bir robota çırak olsun."));
}

// ======================================================================= güvenli yer ve portal
function katiMi(t) {
  return t && !/air|lava|water|fire|portal|vine|leaves|bedrock|magma/.test(t) && !t.includes("slab") ? true : false;
}
function bosMu(t) { return t === "minecraft:air" || t === "minecraft:cave_air" || t === "minecraft:void_air"; }
function guvenliMi(dim, x, y, z) {
  const t = (dy) => safe(() => dim.getBlock({ x, y: y + dy, z })?.typeId, null);
  return katiMi(t(-1)) && bosMu(t(0)) && bosMu(t(1)) && bosMu(t(2));
}
/** Hedef boyutta güvenli yer arar (yüklenmesini bekler); bulamazsa obsidyen bir platform kurar. */
export function* guvenliYer(dim, x, z, yTahmin = 64) {
  x = Math.floor(x); z = Math.floor(z);
  const ad = `aqp${Math.abs(x) % 997}${Math.abs(z) % 997}`;
  safe(() => dim.runCommand(`tickingarea add circle ${x} ${yTahmin} ${z} 1 ${ad} true`));
  for (let i = 0; i < 200 && !safe(() => dim.isChunkLoaded({ x, y: yTahmin, z }), false); i++) yield;
  const nether = dim.id === "minecraft:nether";
  let bulunan = null;
  for (let r = 0; r <= 12 && !bulunan; r += 2) {
    for (let dx = -r; dx <= r && !bulunan; dx += 2) {
      for (const dz of r ? [-r, r] : [0]) {
        const xx = x + dx, zz = z + dz;
        if (nether) {
          for (let y = 32; y <= 110; y++) if (guvenliMi(dim, xx, y, zz)) { bulunan = { x: xx + 0.5, y, z: zz + 0.5 }; break; }
        } else {
          const top = safe(() => dim.getTopmostBlock({ x: xx, z: zz }));
          if (top && guvenliMi(dim, xx, top.y + 1, zz)) bulunan = { x: xx + 0.5, y: top.y + 1, z: zz + 0.5 };
        }
        if (bulunan) break;
      }
      yield;
    }
  }
  if (!bulunan) {
    const y = nether ? 70 : Math.max(64, (safe(() => dim.getTopmostBlock({ x, z })?.y, 63) ?? 63) + 1);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      safe(() => dim.setBlockType({ x: x + dx, y: y - 1, z: z + dz }, "minecraft:obsidian"));
      for (let dy = 0; dy < 3; dy++) safe(() => dim.setBlockType({ x: x + dx, y: y + dy, z: z + dz }, "minecraft:air"));
    }
    bulunan = { x: x + 0.5, y, z: z + 0.5 };
  }
  system.runTimeout(() => safe(() => dim.runCommand(`tickingarea remove ${ad}`)), 600);
  return bulunan;
}

/** Portal açar. hedef: { dim, loc, yaw }. buyuk: 2x1 (oyuncu, robot), değilse 1x1. */
export function portalAc(dim, loc, yaw, hedef, buyuk = true, sure = 20 * 60) {
  const e = safe(() => dim.spawnEntity(PORTAL, loc));
  if (!e) return null;
  safe(() => e.setRotation({ x: 0, y: yaw }));
  safe(() => e.setProperty("aqualit:buyuk", buyuk));
  safe(() => dim.playSound("block.end_portal.spawn", loc, { volume: 0.6, pitch: 1.6 }));
  portallar.set(e.id, { e, dim, loc, yaw, hedef, bitis: system.currentTick + sure, buyuk });
  return e;
}
export function portalKapat(e) {
  const p = portallar.get(safe(() => e.id));
  portallar.delete(safe(() => e.id));
  safe(() => p?.dim.playSound("block.end_portal_frame.fill", p.loc, { volume: 0.6, pitch: 0.7 }));
  safe(() => e.remove());
}
/** Portalın önüne düşen nokta (yaw yönünde d blok). */
function onunde(loc, yaw, d) {
  const r = (yaw * Math.PI) / 180;
  return { x: loc.x - Math.sin(r) * d, y: loc.y, z: loc.z + Math.cos(r) * d };
}
function gecir(ent, hedef) {
  gecti.set(ent.id, system.currentTick);
  const dim = world.getDimension(hedef.dim);
  const p = onunde(hedef.loc, hedef.yaw, 1.4);
  safe(() => ent.teleport(p, { dimension: dim, rotation: { x: 0, y: hedef.yaw } }));
  safe(() => dim.playSound("mob.endermen.portal", p, { volume: 0.7, pitch: 1.3 }));
  if (safe(() => ent.typeId) === "minecraft:player") {
    safe(() => ent.camera.fade({ fadeTime: { fadeInTime: 0.1, holdTime: 0.2, fadeOutTime: 0.4 }, fadeColor: { red: 0.45, green: 0.15, blue: 0.75 } }));
    safe(() => ent.addEffect("fire_resistance", 200, { showParticles: false }));
  }
  // sahibin portalcısı ve evcil dronu da gelsin
  for (const p2 of pcs.values()) {
    if (p2.owner === ent.id && (p2.mod === "omuz" || p2.mod === "serbest")) safe(() => p2.e.teleport(p, { dimension: dim }));
  }
}

// ======================================================================= hareket (her tik)
const OMUZ_SOL = 0.5;
function omuzSol(e, yukseklik = 1.62) {
  const l = e.location;
  const yaw = (safe(() => e.getRotation().y, 0) * Math.PI) / 180;
  return { x: l.x + Math.cos(yaw) * OMUZ_SOL, y: l.y + yukseklik, z: l.z + Math.sin(yaw) * OMUZ_SOL };
}
function yaklas(e, hedef, dim, hiz = 0.7) {
  if (safe(() => e.dimension.id) !== dim.id) return safe(() => e.teleport(hedef, { dimension: dim }));
  const l = e.location;
  const d = V.dist(l, hedef);
  if (d < 0.04) return;
  const k = d > 24 ? 1 : Math.min(1, hiz / d);
  safe(() => e.teleport({ x: l.x + (hedef.x - l.x) * k, y: l.y + (hedef.y - l.y) * k, z: l.z + (hedef.z - l.z) * k },
    { dimension: dim, facingLocation: d > 0.5 ? hedef : undefined }));
}
function binici(e) {
  return safe(() => e.getComponent("minecraft:rideable")?.getRiders()?.[0]);
}

system.runInterval(() => {
  for (const [id, p] of pcs) {
    const e = p.e;
    if (!safe(() => e.isValid, false)) { pcs.delete(id); continue; }
    const r = binici(e);
    if (r && safe(() => r.typeId) === "minecraft:player") {          // uçarak taşıma: baktığın yöne
      safe(() => e.setProperty("aqualit:kucuk", false));
      const mv = safe(() => r.inputInfo.getMovementVector(), { x: 0, y: 0 }) ?? { x: 0, y: 0 };
      const rot = safe(() => r.getRotation(), { x: 0, y: 0 });
      const yaw = (rot.y * Math.PI) / 180, pit = (rot.x * Math.PI) / 180;
      const ileri = { x: -Math.sin(yaw) * Math.cos(pit), y: -Math.sin(pit), z: Math.cos(yaw) * Math.cos(pit) };
      const sag = { x: -Math.cos(yaw), z: -Math.sin(yaw) };
      const H = 0.55;
      const l = e.location;
      const n = { x: l.x + (ileri.x * mv.y + sag.x * -mv.x) * H, y: l.y + ileri.y * mv.y * H, z: l.z + (ileri.z * mv.y + sag.z * -mv.x) * H };
      const blok = safe(() => e.dimension.getBlock({ x: Math.floor(n.x), y: Math.floor(n.y), z: Math.floor(n.z) })?.typeId, "minecraft:air");
      const alt = safe(() => e.dimension.getBlock({ x: Math.floor(n.x), y: Math.floor(n.y - 2.2), z: Math.floor(n.z) })?.typeId, "minecraft:air");
      if (bosMu(blok) && (bosMu(alt) || mv.y === 0 || ileri.y >= 0)) safe(() => e.teleport(n, { rotation: { x: 0, y: rot.y } }));
      else safe(() => e.setRotation({ x: 0, y: rot.y }));
      continue;
    }
    if (p.mod === "sefer" || p.mod === "bekle") continue;
    const pl = sahip(p);
    if (p.mod === "cirak") {
      const b = botByRid(p.cirak);
      if (!b || !b.valid) { safe(() => e.setProperty("aqualit:kucuk", false)); continue; }
      safe(() => e.setProperty("aqualit:kucuk", true));
      yaklas(e, omuzSol(b.e, 1.75), b.dim, 0.9);
      continue;
    }
    if (!pl) continue;
    if (p.mod === "omuz") {
      safe(() => e.setProperty("aqualit:kucuk", true));
      const h = omuzSol(pl);
      if (safe(() => e.dimension.id) !== pl.dimension.id || V.dist(e.location, h) > 0.05)
        safe(() => e.teleport(h, { dimension: pl.dimension, rotation: { x: 0, y: safe(() => pl.getRotation().y, 0) } }));
    } else {
      // boşken (15 sn işi yoksa) küçülüp omzuna gelir; "Yanımda uç" seçildiyse gelmez
      if (p.mod === "serbest" && !p.elle && system.currentTick - (p.modBas ?? 0) > 20 * 15) { modAyarla(p, "omuz"); continue; }
      safe(() => e.setProperty("aqualit:kucuk", false));
      const yaw = (safe(() => pl.getRotation().y, 0) * Math.PI) / 180;
      const h = { x: pl.location.x + Math.sin(yaw) * 1.6 + Math.cos(yaw) * 1.2, y: pl.location.y + 2.3, z: pl.location.z - Math.cos(yaw) * 1.6 + Math.sin(yaw) * 1.2 };
      if (V.dist(e.location, pl.location) > 2.2 || safe(() => e.dimension.id) !== pl.dimension.id) yaklas(e, h, pl.dimension, 0.6);
    }
  }
}, 1);

// portallar: içine giren oyuncu ve robotlar geçer; süresi dolan kapanır
system.runInterval(() => {
  const t = system.currentTick;
  for (const [id, p] of portallar) {
    if (!safe(() => p.e.isValid, false)) { portallar.delete(id); continue; }
    if (t > p.bitis) { portalKapat(p.e); continue; }
    if (!p.hedef) continue;
    const yaw = (p.yaw * Math.PI) / 180;
    const n = { x: -Math.sin(yaw), z: Math.cos(yaw) };       // portalın baktığı yön
    for (const ent of safe(() => p.dim.getEntities({ location: p.loc, maxDistance: 2.5 }), []) ?? []) {
      const tip = safe(() => ent.typeId, "");
      if (tip !== "minecraft:player" && tip !== "aqualit:robot" && tip !== "aqualit:kesif") continue;
      if (t - (gecti.get(ent.id) ?? -999) < 60) continue;
      if (seferde.has(ent.id) && p.sahip !== ent.id) continue;
      const l = ent.location;
      const dx = l.x - p.loc.x, dz = l.z - p.loc.z;
      const derin = Math.abs(dx * n.x + dz * n.z), yan = Math.abs(dx * n.z - dz * n.x);
      if (derin < 0.6 && yan < (p.buyuk ? 0.8 : 0.6) && l.y >= p.loc.y - 0.5 && l.y < p.loc.y + (p.buyuk ? 2 : 1)) gecir(ent, p.hedef);
    }
  }
}, 2);

/** Oyuncunun (ya da robotun) önüne iki yönlü portal açar: Üst Dünya <-> Nether (End'den Üst Dünya'ya). */
export function* portalSeferi(kaynak, dimHedefId, sure = 20 * 60, hedefLoc = null, sahip = null) {
  const dim = kaynak.dimension;
  const l = kaynak.location;
  const yaw = safe(() => kaynak.getRotation().y, 0);
  const on = onunde({ x: Math.floor(l.x) + 0.5, y: Math.floor(l.y), z: Math.floor(l.z) + 0.5 }, yaw, 2.5);
  const hedefDim = world.getDimension(dimHedefId);
  const k = dim.id === "minecraft:nether" && dimHedefId !== "minecraft:nether" ? 8 : dimHedefId === "minecraft:nether" && dim.id !== "minecraft:nether" ? 1 / 8 : 1;
  let hx = on.x * k, hz = on.z * k;
  if (dimHedefId === "minecraft:overworld" && dim.id === "minecraft:the_end") {
    const sp = safe(() => world.getDefaultSpawnLocation(), { x: 0, z: 0 });
    hx = sp.x; hz = sp.z;
  }
  // dönüşte çıkılan yere geri açılır; yoksa ölçekli yerde güvenli bir nokta aranır
  const varis = hedefLoc ? { ...hedefLoc } : yield* guvenliYer(hedefDim, hx, hz, dimHedefId === "minecraft:nether" ? 64 : 80);
  // portal bize baksın (yaw + 180): içine yürüyünce geçilir
  const p1 = portalAc(dim, on, (yaw + 180) % 360, null, true, sure);
  const p2 = portalAc(hedefDim, varis, yaw, null, true, sure);
  if (!p1 || !p2) return null;
  portallar.get(p1.id).hedef = { dim: hedefDim.id, loc: varis, yaw };
  portallar.get(p2.id).hedef = { dim: dim.id, loc: on, yaw: (yaw + 180) % 360 };
  if (sahip) { portallar.get(p1.id).sahip = sahip; portallar.get(p2.id).sahip = sahip; }
  return { p1, p2, on, varis };
}

// ======================================================================= çırak: robotla Nether'den malzeme getir
function* tasiyarak(b, p, hedef) {
  // Portalcı robotu omuzlarından tutup uçurur
  const dim = b.dim;
  for (let i = 0; i < 400; i++) {
    if (safe(() => b.dim.id) !== dim.id) break;        // portaldan geçti: başka boyuta taşıma
    const l = b.loc;
    const d = V.dist(l, hedef);
    if (d < 0.6) break;
    const k = Math.min(1, 0.45 / d);
    const n = { x: l.x + (hedef.x - l.x) * k, y: l.y + (hedef.y - l.y) * k, z: l.z + (hedef.z - l.z) * k };
    safe(() => b.e.teleport(n, { dimension: dim, facingLocation: hedef }));
    if (p) safe(() => p.e.teleport({ x: n.x, y: n.y + 2.1, z: n.z }, { dimension: dim }));
    yield;
  }
}

export function* netherIsi(b, p, tur, adet) {
  const m = MALZEME[tur];
  const geri = { dim: b.dim.id, loc: { ...b.loc } };
  modAyarla(p, "sefer");
  safe(() => p.e.setProperty("aqualit:kucuk", false));
  b.setStatus(`Portalcıyla Nether'e gidiyor (${m.ad})`);
  b.say(`Portalcım ile Nether'e geçiyorum: ${adet} ${m.ad} getireceğim.`);
  seferde.add(b.e.id);
  const s = yield* portalSeferi(b.e, b.dim.id === "minecraft:nether" ? "minecraft:overworld" : "minecraft:nether", 20 * 60 * 6, null, b.e.id);
  if (!s) { seferde.delete(b.e.id); b.say("Portal açılamadı."); modAyarla(p, "cirak"); return; }
  yield* tasiyarak(b, p, s.on);
  for (let i = 0; i < 40 && b.dim.id === geri.dim; i++) yield;
  if (b.dim.id === geri.dim) {           // geçemediyse doğrudan ışınla
    safe(() => b.e.teleport(s.varis, { dimension: world.getDimension("minecraft:nether") }));
    yield;
  }
  safe(() => p.e.teleport({ x: b.loc.x, y: b.loc.y + 2.1, z: b.loc.z }, { dimension: b.dim }));
  // topla
  const bas = system.currentTick;
  const sayi = () => (m.esya ? b.count(m.esya) : m.bloklar.reduce((a, t) => a + b.count(t), 0));
  const once = sayi();
  b.setStatus(`Nether'de ${m.ad} topluyor`);
  while (sayi() - once < adet && system.currentTick - bas < 20 * 180) {
    const bulunan = yield* b.scanFar(m.bloklar, b.loc, 28, 20, 16);
    if (!bulunan.length) { b.say(`Buralarda ${m.ad} kalmadı.`); break; }
    bulunan.sort((a, c) => V.dist(a, b.loc) - V.dist(c, b.loc));
    const q = bulunan[0];
    // yanına uçarak git (Portalcı taşır), sonra kaz
    const yan = [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }]
      .map((d) => V.add(q, d)).find((c) => bosMu(safe(() => b.dim.getBlock(c)?.typeId, "")) && bosMu(safe(() => b.dim.getBlock(V.add(c, { x: 0, y: 1, z: 0 }))?.typeId, "")));
    if (yan) yield* tasiyarak(b, p, { x: yan.x + 0.5, y: yan.y, z: yan.z + 0.5 });
    yield* b.mine(q, { force: true });
    yield* wait(2);
  }
  const toplanan = sayi() - once;
  // dön
  b.setStatus("Portalla dönüyor");
  const s2 = yield* portalSeferi(b.e, geri.dim, 20 * 30, geri.loc, b.e.id);
  if (s2) yield* tasiyarak(b, p, s2.on);
  for (let i = 0; i < 40 && b.dim.id !== geri.dim; i++) yield;
  if (b.dim.id !== geri.dim) safe(() => b.e.teleport(geri.loc, { dimension: world.getDimension(geri.dim) }));
  yield;
  seferde.delete(b.e.id);
  modAyarla(p, "cirak");
  b.say(`Döndüm! ${toplanan} ${m.ad} getirdim, sandığıma koyuyorum.`);
  yield* b.deposit();
  b.setStatus("Hazır");
}

// ======================================================================= menü
async function pcMenu(pl, p) {
  const nether = pl.dimension.id === "minecraft:nether";
  const btns = [
    { text: nether ? "§lPortal aç: Üst Dünya§r\n§7Önüne iki yönlü portal" : "§lPortal aç: Nether§r\n§7Önüne iki yönlü portal, güvenli yere", v: "portal" },
    { text: "§lBeni taşı (uç)§r\n§7Baktığın yöne uçar · inmek için eğil", v: "tasi" },
    { text: p.mod === "omuz" ? "Yanımda uç" : "Omzuma gel (küçülür)", v: p.mod === "omuz" ? "serbest" : "omuz" },
    { text: "Burada bekle", v: "bekle" },
    { text: "§lÇırağı yap§r\n§7Bir robota yardım etsin (Nether seferleri)", v: "cirak" },
  ];
  const b = p.mod === "cirak" ? botByRid(p.cirak) : null;
  if (b) btns.push({ text: `§l${b.name} ile Nether'den malzeme getir`, v: "malzeme" });
  btns.push({ text: "§7Eşyaya dönüştür (envantere al)", v: "al" });
  const r = await menu(pl, "§lPortalcı", `§7Şu an: §f${MODLAR[p.mod] ?? p.mod}${b ? ` §7(${b.name})` : ""}`, btns);
  if (!r) return;
  if (r.v === "portal") {
    pl.sendMessage("§dPortal açılıyor...");
    system.runJob((function* () {
      const s = yield* portalSeferi(pl, nether ? "minecraft:overworld" : "minecraft:nether");
      if (s) safe(() => pl.sendMessage("§dPortal açık§r (1 dakika). İçine yürü; robotların da geçebilir."));
      else safe(() => pl.sendMessage("§cPortal açılamadı."));
    })());
  } else if (r.v === "tasi") {
    modAyarla(p, "serbest");
    safe(() => p.e.teleport({ x: pl.location.x, y: pl.location.y + 1.6, z: pl.location.z }, { dimension: pl.dimension }));
    system.runTimeout(() => {
      const ok = safe(() => p.e.getComponent("minecraft:rideable").addRider(pl), false);
      safe(() => pl.onScreenDisplay.setActionBar(ok ? "§dPortalcı seni taşıyor §7· baktığın yöne yürü: uçar · eğil: in" : "§cTaşıyamadı"));
    }, 2);
  } else if (r.v === "cirak") {
    const list = [...bots.values()].filter((x) => x.owner === pl.id && x.valid);
    if (!list.length) return pl.sendMessage("§7Yüklü robotun yok.");
    const c = await menu(pl, "§lÇırağı yap", "§7Portalcı hangi robota yardım etsin?", list.map((x) => ({ text: `${x.name}\n§7${x.status}`, x })));
    if (!c) return;
    modAyarla(p, "cirak", c.x.rid);
    c.x.say("Bir Portalcı çırağım oldu! Nether'den malzeme gerekirse onunla giderim.");
  } else if (r.v === "malzeme" && b) {
    const c = await menu(pl, `§l${b.name} · Nether malzemesi`, "§7Ne getirsin?", Object.entries(MALZEME).map(([k, m]) => ({ text: m.ad, k })));
    if (!c) return;
    const a = await menu(pl, "§lKaç tane?", "", [16, 32, 64].map((n) => ({ text: `${n}`, n })));
    if (!a) return;
    startJob(b, netherIsi(b, p, c.k, a.n), "gorev");
  } else if (r.v === "al") {
    safe(() => p.e.remove());
    pcs.delete(p.e.id);
    const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
    const it = new ItemStack("aqualit:robot_portalci", 1);
    if (safe(() => inv.addItem(it), it)) safe(() => pl.dimension.spawnItem(it, pl.location));
  } else modAyarla(p, r.v, undefined, true);
}

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const e = ev.target;
  if (safe(() => e.typeId) !== PORTALCI) return;
  ev.cancel = true;
  const pl = ev.player;
  system.run(() => {
    const p = kayit(e);
    if (p.owner && p.owner !== pl.id) return safe(() => pl.sendMessage("§cBu Portalcı başka bir oyuncunun."));
    if (!p.owner) { p.owner = pl.id; safe(() => e.setDynamicProperty("aq:owner", pl.id)); }
    pcMenu(pl, p).catch((x) => log("portalcı menü", x));
  });
});
// taşınırken eğil: in
world.afterEvents.entityStartSneaking?.subscribe((ev) => {
  for (const p of pcs.values()) {
    if (binici(p.e) === ev.entity) {
      safe(() => p.e.getComponent("minecraft:rideable").ejectRider(ev.entity));
      safe(() => ev.entity.addEffect("slow_falling", 100, { showParticles: false }));
    }
  }
});

// yüklü Portalcıları ve portalları tanı (dünya açılınca)
system.runInterval(() => {
  for (const d of ["overworld", "nether", "the_end"]) {
    for (const e of safe(() => world.getDimension(d).getEntities({ type: PORTALCI }), []) ?? []) kayit(e);
    for (const e of safe(() => world.getDimension(d).getEntities({ type: PORTAL }), []) ?? []) if (!portallar.has(e.id)) safe(() => e.remove());
  }
}, 100);

// ======================================================================= kendiliğinden Nether seferi
const MALZEME_OF = new Map();
for (const [k, m] of Object.entries(MALZEME)) {
  if (m.esya) MALZEME_OF.set(m.esya, k);
  for (const b of m.bloklar) MALZEME_OF.set(b, k);
}
MALZEME_OF.set("minecraft:glowstone", "isiltas");
MALZEME_OF.set("minecraft:gold_ingot", "altin");
/** v0.4.6: robotun Portalcı çırağı (yoksa undefined). Çırağı olan Madenci'ye Nether madenleri de açılır. */
export function cirakPortalcisi(b) {
  return [...pcs.values()].find((x) => x.mod === "cirak" && x.cirak === b.rid && safe(() => x.e.isValid, false));
}
/** Madenci maden anahtarı -> Nether malzeme anahtarı */
export const MADEN_MALZEME = { kuvars: "kuvars", nether_altin: "altin", antik: "enkaz" };
/** Seçilen Nether madenlerini sırayla Portalcıyla toplar; bitince (varsa) dünyadaki görevi başlatır. */
export function* netherMadenleri(b, p, liste, sonra) {
  for (const n of liste) {
    const k = MADEN_MALZEME[n.key];
    if (k) yield* netherIsi(b, p, k, n.amount);
  }
  if (sonra) system.run(sonra);
}

/** Bir robotun (ya da sahibin) eksiği Nether malzemesiyse, çırağı olan boştaki robot Portalcısıyla sefere çıkar.
 *  need: { eşyaKimliği: adet }. Üstlenilen eşya kimlikleri döner. */
export function netherIhtiyaci(owner, need) {
  const alinan = [];
  for (const [id0, n] of Object.entries(need ?? {})) {
    const id = id0.includes(":") ? id0 : `minecraft:${id0}`;
    const k = MALZEME_OF.get(id);
    if (!k) continue;
    const p = [...pcs.values()].find((x) => x.owner === owner && x.mod === "cirak" && safe(() => x.e.isValid, false));
    const b = p && botByRid(p.cirak);
    if (!b || !b.valid || (b.jobName && b.jobName !== "bekleme")) continue;
    const adet = Math.min(64, Math.max(16, id === "minecraft:gold_ingot" ? n * 9 : n));
    startJob(b, netherIsi(b, p, k, adet), "gorev");
    b.say(`${MALZEME[k].ad} lazımmış; Portalcım ile Nether'den ${adet} tane getiriyorum.`);
    alinan.push(id0);
    break;                                   // bir seferde bir sefer
  }
  return alinan;
}
