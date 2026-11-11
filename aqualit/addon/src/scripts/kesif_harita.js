// Aqualit Robotları — Keşif Haritası (v0.4.0)
// Minecraft haritası gibi: dünyayı tam tepeden görürsün (kuzey yukarıda), sen ortadasın ve yürüdükçe harita seninle
// kayar. Gerçek araziyi oyunun kendisi çizer; üstüne Minecraft haritası işaretleri gibi küçük piksel simgeler konur:
// beyaz ok = sen, yapılar kendi simgesi ve altında adıyla. Ekrana sığmayan yapılar kenarda, yönünü gösteren okla durur;
// adresleri (koordinat, uzaklık) ekranın altında yazar ve pusula çubuğunda kendi simgeleriyle görünür.
// Oyuncu haritası: yalnız yapılar. Keşif'in haritası: + robotlar, sandıklar, Keşif, canavarlar, hayvanlar, köylüler.
// Haritayı kullan: aç → yakın / orta / uzak → kapat. Eğil: kapat. Eğilip kullan: bildiğin bütün yapıların listesi.
import { world, system, MolangVariableMap, LocationWaypoint } from "@minecraft/server";
import { safe, V } from "./util.js";
import { menu } from "./ui/forms.js";
import { Harita, Yerler } from "./harita.js";
import { HUCRE, AD } from "./harita_isaret.js";
import { ISARET } from "./harita_glif.js";
import { YAPI } from "./yapi_bilgi.js";
import { dronTara } from "./kesif_dron.js";
import { bots } from "./brain.js";
import { getJSON } from "./store.js";

const YUKSEK = [40, 85, 150];          // kamera yüksekliği: yakın, orta, uzak
const ADLAR = ["yakın", "orta", "uzak"];
const D = 8;                           // işaretler kameranın 8 blok önüne (küçültülmüş) çizilir: arazi örtmez
const BOY = 1.6;                       // işaret hücresinin yarı genişliği (D uzaklıkta; ekran yüksekliğinin ~%27si)
const GORUS = 0.55;                    // ekranda güvenle görünen yarıçap (yükseklik katı)
const YON8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const PUSULA = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"];
const SIS = "aq_harita";
const acik = new Map();                // oyuncu kimliği -> durum

function aci(dx, dz) {                 // kuzey 0, saat yönünde derece
  return ((((Math.atan2(dx, -dz) * 180) / Math.PI) % 360) + 360) % 360;
}
function yon8(a) { return Math.round(a / 45) % 8; }
function pusula(dx, dz) { return PUSULA[yon8(aci(dx, dz))]; }
function ad(y) { return y.ad ?? YAPI[y.tur]?.ad ?? y.tur; }

/** Haritadaki bir işaretin ekrandaki yeri (kameranın D blok önünde, küçültülmüş) ve hücresi. Test için dışarı açık. */
export function isaretler(st, pl) {
  const p = pl.location;
  const H = YUKSEK[st.olcek];
  const R = H * GORUS;
  const dim = pl.dimension;
  const liste = [];
  const ekle = (hucre, dx, dz, alfa = 1, boy = BOY) => liste.push({ hucre, dx, dz, alfa, boy });
  // yapılar: görünüyorsa yerinde, görünmüyorsa kenarda (yarı soluk) + dışa bakan ok
  const yapilar = [];
  for (const y of Yerler.list(st.owner)) {
    if (y.dim !== dim.id || !HUCRE[y.tur]) continue;
    const dx = y.pos.x - p.x, dz = y.pos.z - p.z;
    yapilar.push({ y, dx, dz, d: Math.hypot(dx, dz) });
  }
  yapilar.sort((a, b) => a.d - b.d);
  let kenar = 0;
  for (const { y, dx, dz, d } of yapilar) {
    if (d <= R) ekle(y.tur, dx, dz);
    else if (kenar++ < 10) {
      const k = (R * 0.88) / d;
      ekle(y.tur, dx * k, dz * k, 0.75, BOY * 0.8);
      const k2 = (R * 0.97) / d;
      ekle("ok_" + YON8[yon8(aci(dx, dz))], dx * k2, dz * k2, 1, BOY * 0.7);
    }
  }
  // Keşif katmanı
  if (st.kesif) {
    for (const b of bots.values()) {
      if (b.owner !== st.owner || safe(() => b.dim.id) !== dim.id) continue;
      const l = b.loc;
      if (Math.hypot(l.x - p.x, l.z - p.z) <= R) ekle("robot", l.x - p.x, l.z - p.z, 1, BOY * 0.6);
    }
    for (const k of safe(() => world.getDynamicPropertyIds(), []) ?? []) {
      if (!k.startsWith("aq:su:")) continue;
      const u = safe(() => getJSON(world, k, null));
      const q = u?.blocks?.[0];
      if (!q || u.owner !== st.owner || u.dim !== dim.id || Math.hypot(q.x - p.x, q.z - p.z) > R) continue;
      ekle("sandik", q.x - p.x, q.z - p.z, 1, BOY * 0.6);
    }
    let n = 0;
    for (const e of safe(() => dim.getEntities({ location: p, maxDistance: R }), []) ?? []) {
      if (n > 60) break;
      const t = safe(() => e.typeId, "");
      const fam = safe(() => e.getComponent("minecraft:type_family"));
      let h = null;
      if (t === "aqualit:kesif") h = "kesif";
      else if (t === "minecraft:villager_v2" || t === "minecraft:villager" || t === "minecraft:wandering_trader") h = "koylu";
      else if (safe(() => fam?.hasTypeFamily("monster"), false)) h = "canavar";
      else if (safe(() => fam?.hasTypeFamily("animal"), false)) h = "hayvan";
      if (!h) continue;
      const l = e.location;
      ekle(h, l.x - p.x, l.z - p.z, 1, BOY * 0.5);
      n++;
    }
  }
  // sen: ortada, baktığın yöne beyaz ok (oyun yaw 180 = kuzey)
  const yaw = safe(() => pl.getRotation().y, 0);
  ekle("sen_" + YON8[yon8((((yaw - 180) % 360) + 360) % 360)], 0, 0, 1, BOY * 0.9);
  return { liste, yapilar, R, H };
}

function cizim(pl, st) {
  const p = pl.location;
  const { liste, yapilar, H } = isaretler(st, pl);
  const cam = { x: p.x, y: p.y + H, z: p.z };
  safe(() => pl.camera.setCamera("minecraft:free", {
    location: cam, rotation: { x: 90, y: 180 }, easeOptions: { easeTime: 0.12, easeType: "Linear" },
  }));
  const k = D / H;
  for (const m of liste) {
    const h = HUCRE[m.hucre];
    if (!h) continue;
    const mv = new MolangVariableMap();
    mv.setFloat("variable.u", h[0]);
    mv.setFloat("variable.v", h[1]);
    mv.setFloat("variable.boy", m.boy);
    mv.setFloat("variable.alfa", m.alfa);
    safe(() => pl.spawnParticle("aqualit:harita_isaret", { x: cam.x + m.dx * k, y: cam.y - D, z: cam.z + m.dz * k }, mv));
  }
  // altta: en yakın 3 yapının adresi
  const yazi = yapilar.slice(0, 3).map(({ y, dx, dz, d }) =>
    `§f${ad(y)} §7${y.pos.x}, ${y.pos.z} · §e${Math.round(d)}m ${pusula(dx, dz)}`);
  const ust = `§lHarita§r §7(${ADLAR[st.olcek]}) · ${Math.round(p.x)}, ${Math.round(p.z)} · haritaya bas: ${st.olcek < YUKSEK.length - 1 ? "uzaklaştır" : "kapat"} · eğil: kapat`;
  safe(() => pl.onScreenDisplay.setActionBar([ust, ...(yazi.length ? yazi : ["§7Bu boyutta bildiğin yapı yok: gez, ya da Keşif'in dronlarını gönder."])].join("\n")));
}

function igneler(pl, st) {
  const lb = safe(() => pl.locatorBar);
  if (!lb) return;
  const max = Math.max(0, (safe(() => lb.maxCount, 16) ?? 16) - safe(() => lb.count, 0) - 2);
  const dim = pl.dimension, p = pl.location;
  const yak = Yerler.list(st.owner).filter((y) => y.dim === dim.id)
    .sort((a, b) => V.hdist(a.pos, p) - V.hdist(b.pos, p)).slice(0, Math.min(12, max));
  for (const y of yak) {
    const wp = safe(() => new LocationWaypoint({ dimension: dim, x: y.pos.x + 0.5, y: y.pos.y + 1, z: y.pos.z + 0.5 },
      { textureBoundsList: [{ lowerBound: 0, texture: { path: `textures/ui/aqualit_harita/${y.tur}`, iconWidth: 12, iconHeight: 12 } }] }));
    if (wp && safe(() => (lb.addWaypoint(wp), true), false)) st.igne.push(wp);
  }
}

/** Harita açık mı? */
export function haritaAcikMi(pl) { return acik.has(pl.id); }

/** Haritayı kapatır, kamerayı ve sisi geri verir. */
export function haritaKapat(pl, sessiz = false) {
  const st = acik.get(pl.id);
  if (!st) return;
  acik.delete(pl.id);
  system.clearRun(st.run);
  safe(() => pl.camera.clear());
  safe(() => pl.runCommand(`fog @s remove ${SIS}`));
  for (const wp of st.igne) { safe(() => pl.locatorBar.removeWaypoint(wp)); safe(() => wp.remove()); }
  if (!sessiz) safe(() => pl.onScreenDisplay.setActionBar("§7Harita kapandı."));
}

/** Haritayı açar; açıksa bir kademe uzaklaştırır, en uzaktaysa kapatır. o: { kesif } (Keşif'in haritası) */
export async function haritaAc(pl, o = {}) {
  const st = acik.get(pl.id);
  if (st) {
    if (st.olcek < YUKSEK.length - 1) { st.olcek++; return; }
    return haritaKapat(pl);
  }
  if (pl.isSneaking && !o.kesif) return yapiListesi(pl, pl.id);
  const k = o.kesif;
  const yeni = { owner: k?.owner ?? pl.id, kesif: !!k, olcek: 0, igne: [], run: 0 };
  yeni.run = system.runInterval(() => {
    if (!safe(() => pl.isValid, false)) { system.clearRun(yeni.run); acik.delete(pl.id); return; }
    cizim(pl, yeni);
  }, 4);
  acik.set(pl.id, yeni);
  safe(() => pl.runCommand(`fog @s push aqualit:harita_sis ${SIS}`));
  safe(() => pl.camera.fade({ fadeTime: { fadeInTime: 0.15, holdTime: 0.05, fadeOutTime: 0.3 }, fadeColor: { red: 0.85, green: 0.78, blue: 0.6 } }));
  igneler(pl, yeni);
  yakinlariIsle(pl, 10);
  cizim(pl, yeni);
}

/** Bildiğin bütün yapılar: ad, koordinat, uzaklık, yön. */
export async function yapiListesi(pl, owner) {
  const p = pl.location, dim = pl.dimension;
  const l = Yerler.list(owner).filter((y) => y.dim === dim.id).map((y) => ({ y, d: V.hdist(y.pos, p) })).sort((a, b) => a.d - b.d);
  if (!l.length) return safe(() => pl.sendMessage("§7Bu boyutta bildiğin yapı yok. Gezdikçe ya da Keşif'in dronlarıyla bulunur."));
  const btns = l.slice(0, 40).map(({ y, d }) => ({ text: `§l${ad(y)}§r\n§7${y.pos.x}, ${y.pos.y}, ${y.pos.z} · ${Math.round(d)} blok ${pusula(y.pos.x - p.x, y.pos.z - p.z)}`,
    icon: `textures/ui/aqualit_harita/${y.tur}` }));
  await menu(pl, "§lBildiğin yapılar", `§7${l.length} yapı. Haritayı aç: hepsi kendi simgesiyle görünür.`, btns);
}

// eğil: harita kapanır
world.afterEvents.entityStartSneaking?.subscribe((ev) => {
  if (acik.has(safe(() => ev.entity.id))) haritaKapat(ev.entity);
});
world.afterEvents.playerLeave?.subscribe((ev) => {
  const st = acik.get(ev.playerId);
  if (st) system.clearRun(st.run);
  acik.delete(ev.playerId);
});
world.afterEvents.playerDimensionChange?.subscribe((ev) => {
  const st = acik.get(ev.player.id);
  if (!st) return;
  for (const wp of st.igne) { safe(() => ev.player.locatorBar.removeWaypoint(wp)); safe(() => wp.remove()); }
  st.igne = [];
  igneler(ev.player, st);
});

// ======================================================================= yürürken haritayı doldur
const SPIRAL = [];
{
  const R = 12;                  // yığın (192 blok); yalnız oyunun yüklediği yığınlar işlenir
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= R * R) SPIRAL.push([dx, dz]);
  SPIRAL.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
}
const durum = new Map();         // oyuncu -> { anahtar, i }

/** Oyuncunun çevresindeki yüklü yığınlardan en çok n tanesini haritaya işler. */
function yakinlariIsle(pl, n) {
  const dim = pl.dimension;
  const l = pl.location;
  const ccx = Math.floor(l.x / 16), ccz = Math.floor(l.z / 16);
  const key = `${dim.id}:${ccx}:${ccz}`;
  let d = durum.get(pl.id);
  if (!d || d.anahtar !== key) durum.set(pl.id, (d = { anahtar: key, i: 0 }));
  let yapilan = 0, bakilan = 0;
  while (d.i < SPIRAL.length && yapilan < n && bakilan < 60) {
    const [dx, dz] = SPIRAL[d.i++];
    bakilan++;
    const cx = ccx + dx, cz = ccz + dz;
    if (Harita.bilinir(pl.id, dim.id, cx, cz)) continue;
    const p = { x: cx * 16 + 8, y: 64, z: cz * 16 + 8 };
    if (!safe(() => dim.isChunkLoaded(p), false)) continue;
    const top = safe(() => dim.getTopmostBlock({ x: p.x, z: p.z }));
    const y = top ? top.y + 1 : 64;
    const b = safe(() => dim.getBiome({ x: p.x, y, z: p.z }));
    if (!b) continue;
    Harita.kaydet(pl.id, dim.id, p, b.id ?? b, y);
    yapilan++;
  }
}

system.runInterval(() => {
  for (const pl of world.getAllPlayers()) safe(() => yakinlariIsle(pl, 4));
}, 10);

// ======================================================================= dron ordusu (oyuncu, yaratıcı eşyası)
const ordular = new Set();
export async function orduMenu(pl) {
  if (ordular.has(pl.id)) return safe(() => pl.sendMessage("§eDron ordun zaten keşifte; dönmelerini bekle."));
  const r = await menu(pl, "§lKeşif Dron Ordusu", "§725 dron çevrendeki haritanın keşfedilmemiş yerlerine uçar, yapıları bulur, biyomları işler.\n§7Bulunan yapılar Keşif Haritası'nda kendi simgesiyle görünür.",
    [{ text: "§l400 blok çevre", v: 400 }, { text: "§l800 blok çevre", v: 800 }, { text: "§l1600 blok çevre§r\n§7(uzun sürer)", v: 1600 }, { text: "§cİptal", v: 0 }]);
  if (!r?.v) return;
  const dim = pl.dimension;
  const k = {
    dim, e: pl, rid: "p" + pl.id.slice(-6), owner: pl.id, name: "Dron ordusu",
    get loc() { return safe(() => pl.location, { x: 0, y: 64, z: 0 }); },
    say: (m) => safe(() => pl.sendMessage(`§b[Dron Ordusu]§r ${m}`)),
    setStatus: () => {},
  };
  const { boyutYapilari } = await import("./kesif_ai.js");
  const { yiginTara } = await import("./kesif_ai.js");
  ordular.add(pl.id);
  const yaricap = r.v / 2;
  function* is() {
    try {
      const bulunan = yield* dronTara(k, {
        merkez: { ...pl.location }, yaricap, n: 25, hepsi: true, turler: boyutYapilari(dim.id), tara: yiginTara,
        atla: (cx, cz) => Harita.bilinir(pl.id, dim.id, cx, cz),
        durum: (oran, n) => safe(() => pl.onScreenDisplay.setActionBar(`§bDron ordusu§r: ${n} dron tarıyor §f%${oran}`)),
        bulunca: (f) => {
          const y = Yerler.ekle(pl.id, { tur: f.tur, ad: YAPI[f.tur].ad, pos: f.pos, dim: dim.id, kim: "Dron ordusu" });
          k.say(`${YAPI[f.tur].ad} buldum: ${y.pos.x}, ${y.pos.y}, ${y.pos.z}`);
        },
      });
      k.say(`Döndük: ${bulunan.length} yapı bulduk. Keşif Haritası'nda görünüyor.`);
    } finally {
      ordular.delete(pl.id);
    }
  }
  system.runJob(is());
}

// ======================================================================= sürerken mini harita (v0.4.2)
const OKLAR = ["ok_n", "ok_ne", "ok_e", "ok_se", "ok_s", "ok_sw", "ok_w", "ok_nw"];
/** En yakın 3 yapı: ok aracın gidişine göre (yukarı = önün), ad, uzaklık. */
export function miniHaritaYazi(pl, v) {
  const p = v.location, dim = v.dimension;
  const yaw = safe(() => v.getRotation().y, 0) ?? 0;
  const l = Yerler.list(pl.id).filter((y) => y.dim === dim.id).map((y) => ({ y, d: V.hdist(y.pos, p) }))
    .sort((a, b) => a.d - b.d).slice(0, 3);
  if (!l.length) return "§7Mini harita: yakında bilinen yapı yok";
  return l.map(({ y, d }) => {
    const mutlak = aci(y.pos.x - p.x, y.pos.z - p.z);            // kuzey 0
    const gidis = (((yaw - 180) % 360) + 360) % 360;            // aracın baktığı yön (kuzey 0)
    const goreli = (((mutlak - gidis) % 360) + 360) % 360;
    return `§f${ISARET[OKLAR[yon8(goreli)]] ?? ""} §b${ad(y)} §7${Math.round(d)}m`;
  }).join("  ");
}
system.runInterval(() => {
  for (const pl of world.getAllPlayers()) {
    if (safe(() => pl.getDynamicProperty("aq:mini_harita"), false) !== true || acik.has(pl.id)) continue;
    const v = safe(() => pl.getComponent("minecraft:riding")?.entityRidingOn);
    if (!v || safe(() => v.typeId) !== "aqualit:kesif") continue;
    const f = safe(() => v.getDynamicProperty("aq:form")) ?? safe(() => v.getProperty("aqualit:form"));
    if (f === "matkap" || f === "robot") continue;              // matkapta cevher dürbünü var
    safe(() => pl.onScreenDisplay.setActionBar(miniHaritaYazi(pl, v)));
  }
}, 20);
