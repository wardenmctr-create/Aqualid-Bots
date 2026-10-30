// Aqualit Robotları — Keşif'e binince oyuncuya gelen iki eşya (v0.3.1):
// - Yer Bulucu Radar: basılı tutunca yapı listesi; seçince Keşif'ten radar sesleri gelir ve en yakın yapıya konum
//   çubuğunda simge çıkar. Radar açıkken basınca listede yalnız "İptal et" olur.
// - Hız Sayacı: Keşif'in hızını seçer. Yaratıcı modda "Ekstra hızlı" ve "Max hız" da var (yalnız uçakta tavsiye edilir).
// İkisi de yalnız binerken envanterdedir; inince geri alınır.
import { world, system, ItemStack, LocationWaypoint } from "@minecraft/server";
import { V, safe, clamp } from "./util.js";
import { menu } from "./ui/forms.js";
import { Yerler, Harita } from "./harita.js";
import { KESIF_ID, formOf } from "./kesif.js";
import { YAPI, ikon, yiginTara } from "./kesif_ai.js";
import { selector } from "./konum.js";

export const RADAR = "aqualit:kesif_radar";
export const HIZ = "aqualit:kesif_hiz";
const PIN = "textures/ui/aqualit_bas/pin_kesif";
const TARAMA = 8;                 // oyuncunun çevresinde taranan yığın yarıçapı (yüklü olanlar)

// ======================================================================= hız
export const HIZLAR = [
  { k: 0.5, ad: "Yavaş", not: "Dar yerler, mağaralar" },
  { k: 1, ad: "Normal", not: "" },
  { k: 1.5, ad: "Hızlı", not: "" },
  { k: 2.5, ad: "Ekstra hızlı", not: "§eYalnız uçakta tavsiye edilir", yaratici: true },
  { k: 4, ad: "Max hız", not: "§cYalnız uçakta tavsiye edilir", yaratici: true },
];
const yaratici = (pl) => safe(() => pl.getGameMode(), "Survival") === "Creative";

/** Keşif'in seçili hız çarpanı. Yaratıcı olmayan sürücüde en çok "Hızlı". */
export function hizCarpani(v, pl) {
  const k = safe(() => v.getDynamicProperty("aq:hiz"), 1) ?? 1;
  return pl && !yaratici(pl) ? Math.min(k, 1.5) : k;
}

function bindigi(pl) {
  const v = safe(() => pl.getComponent("minecraft:riding")?.entityRidingOn);
  return v && safe(() => v.typeId, "") === KESIF_ID ? v : null;
}

export async function hizMenu(pl) {
  const v = bindigi(pl);
  if (!v) return safe(() => pl.sendMessage("§eHız sayacı yalnız Keşif'e binince çalışır."));
  const cur = hizCarpani(v, pl);
  const list = HIZLAR.filter((h) => !h.yaratici || yaratici(pl));
  const r = await menu(pl, "§lHız Sayacı", `§7Şu an: §f${list.find((h) => h.k === cur)?.ad ?? "Normal"}`,
    list.map((h) => ({ text: `${h.k === cur ? "§l§b» " : ""}${h.ad} §7(×${h.k})${h.not ? `\n${h.not}` : ""}`, v: h.k,
      icon: `textures/items/kesif_hiz` })));
  if (!r || !safe(() => v.isValid, false)) return;
  safe(() => v.setDynamicProperty("aq:hiz", r.v));
  const h = HIZLAR.find((x) => x.k === r.v);
  const uyari = r.v > 1.5 && formOf(v) !== "ucak" ? " §e(Yalnız uçakta tavsiye edilir.)" : "";
  safe(() => pl.onScreenDisplay.setActionBar(`§bHız: §f${h.ad} §7(×${h.k})${uyari}`));
  safe(() => v.dimension.playSound("random.click", v.location, { pitch: 0.8 + r.v * 0.15 }));
}

// ======================================================================= radar
const radarlar = new Map();       // oyuncu kimliği -> { tur, hedef, dim, tahmini, wp, sira, bip, kuyruk }

function yon(from, to) {
  const a = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI;   // 0 = kuzey (-z), saat yönü
  const adlar = ["kuzey", "kuzeydoğu", "doğu", "güneydoğu", "güney", "güneybatı", "batı", "kuzeybatı"];
  return adlar[Math.round(((a + 360) % 360) / 45) % 8];
}

function igneKoy(pl, R) {
  igneKaldir(pl, R);
  const lb = safe(() => pl.locatorBar);
  const dim = safe(() => world.getDimension(R.dim));
  if (!lb || !dim) return;
  const wp = safe(() => new LocationWaypoint({ dimension: dim, x: R.hedef.x + 0.5, y: R.hedef.y + 1, z: R.hedef.z + 0.5 },
    selector(PIN)));
  if (wp && safe(() => (lb.addWaypoint(wp), true), false)) R.wp = wp;
}
function igneKaldir(pl, R) {
  if (!R?.wp) return;
  safe(() => pl.locatorBar.removeWaypoint(R.wp));
  safe(() => R.wp.remove());
  R.wp = null;
}

export function radarBitir(pl, msg) {
  const R = radarlar.get(pl.id);
  if (!R) return;
  igneKaldir(pl, R);
  radarlar.delete(pl.id);
  if (msg) safe(() => pl.sendMessage(msg));
}

/** Oyuncunun çevresindeki yüklü yığınlar (içten dışa). */
function kuyrukYap(pos) {
  const c0 = { x: Math.floor(pos.x / 16), z: Math.floor(pos.z / 16) };
  const out = [];
  for (let r = 0; r <= TARAMA; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r) out.push([c0.x + dx, c0.z + dz]);
  return out;
}

function hedefKoy(pl, R, pos, tahmini) {
  R.hedef = { x: Math.floor(pos.x), y: Math.floor(pos.y ?? pl.location.y), z: Math.floor(pos.z) };
  R.tahmini = tahmini;
  R.kuyruk = null;
  igneKoy(pl, R);
  const d = Math.round(V.hdist(pl.location, R.hedef));
  const S = YAPI[R.tur];
  safe(() => pl.sendMessage(tahmini
    ? `§bRadar§r: Yakında ${S.ad} görünmüyor; en yakın uygun biyom ${d} blok ${yon(pl.location, R.hedef)}. Simgeyi takip et, yaklaşınca radar yapının tam yerini arar.`
    : `§bRadar§r: En yakın ${S.ad} ${d} blok ${yon(pl.location, R.hedef)}. Konum çubuğundaki simgeyi takip et.`));
}

/** Yapı seçilince: önce bilinen yerler, sonra çevredeki yüklü yığınlar (radar taraması), yoksa biyom tahmini. */
function radarBaslat(pl, tur) {
  const S = YAPI[tur];
  const R = { tur, dim: pl.dimension.id, hedef: null, tahmini: false, wp: null, bip: 0, kuyruk: null };
  radarlar.set(pl.id, R);
  if (!S.dims.includes(pl.dimension.id)) {
    radarBitir(pl, `§eRadar: ${S.ad} bu boyutta olmaz.`);
    return;
  }
  const bilinen = Yerler.enYakin(pl.id, tur, pl.dimension.id, pl.location, 20000);
  if (bilinen) return hedefKoy(pl, R, bilinen.pos, false);
  R.kuyruk = kuyrukYap(pl.location);
  R.toplam = R.kuyruk.length;
  safe(() => pl.sendMessage(`§bRadar§r: ${S.ad} aranıyor...`));
}

/** Tarama bitti, yakında yok: biyomdan tahmin. */
function biyomTahmini(pl, R) {
  const S = YAPI[R.tur];
  const dim = pl.dimension;
  let best, bd = Infinity;
  for (const b of S.biomes ?? []) {
    const id = `minecraft:${b}`;
    const p = safe(() => dim.calculateClosestBiomeFromSeed(pl.location, id, { boundingSize: { x: 6000, y: 64, z: 6000 } }))
      ?? Harita.enYakinBiyom(pl.id, dim.id, pl.location, [id], 3000);
    if (!p) continue;
    const d = V.hdist(p, pl.location);
    if (d < bd) { bd = d; best = p; }
  }
  if (best && bd > TARAMA * 16) return hedefKoy(pl, R, best, true);
  radarBitir(pl, `§eRadar: Yakında ${S.ad} bulamadım. Keşif'e "Yapı bul" görevi verirsen uzaklara uçup arar.`);
}

export async function radarMenu(pl) {
  const R = radarlar.get(pl.id);
  if (R) {
    const r = await menu(pl, "§lYer Bulucu Radar", `§7Aranan: §f${YAPI[R.tur].ad}`,
      [{ text: "§l§cİptal et", icon: "textures/ui/cancel", v: "iptal" }]);
    if (r?.v === "iptal") radarBitir(pl, "§bRadar§r: Konum görevi bitti.");
    return;
  }
  const turler = Object.keys(YAPI).filter((t) => YAPI[t].dims.includes(pl.dimension.id));
  const r = await menu(pl, "§lYer Bulucu Radar", "§7Hangi yapıyı arayalım? En yakınını gösteririm.",
    turler.map((t) => ({ text: `§l${YAPI[t].ad}§r\n§7${YAPI[t].deger.slice(0, 40)}`, icon: ikon(t), v: t })));
  if (!r) return;
  radarBaslat(pl, r.v);
}

function radarTik(pl, R) {
  if (pl.dimension.id !== R.dim) return radarBitir(pl, "§bRadar§r: Boyut değişti, konum görevi bitti.");
  const dim = pl.dimension;
  // tarama: tik başına 2 yığın
  if (R.kuyruk) {
    for (let i = 0; i < 2 && R.kuyruk.length; i++) {
      const [cx, cz] = R.kuyruk.shift();
      if (!safe(() => dim.isChunkLoaded({ x: cx * 16 + 8, y: 64, z: cz * 16 + 8 }), true)) continue;
      const f = yiginTara(dim, cx, cz, [R.tur]);
      if (f) {
        Yerler.ekle(pl.id, { tur: R.tur, ad: YAPI[R.tur].ad, pos: f.pos, dim: dim.id });
        return hedefKoy(pl, R, f.pos, false);
      }
    }
    if (system.currentTick % 10 === 0) {
      const y = Math.round((100 * (R.toplam - R.kuyruk.length)) / R.toplam);
      safe(() => pl.onScreenDisplay.setActionBar(`§bRadar§r taranıyor... %${y}`));
    }
    if (!R.kuyruk.length) {
      R.kuyruk = null;
      biyomTahmini(pl, R);
    }
    return;
  }
  if (!R.hedef) return;
  const d = V.hdist(pl.location, R.hedef);
  // tahmini hedefe yaklaşınca çevreyi tara: yapının tam yeri
  if (R.tahmini && d < 64) {
    R.kuyruk = kuyrukYap(pl.location);
    R.toplam = R.kuyruk.length;
    R.tahmini = false;
    R.yeniden = true;
    return;
  }
  if (R.yeniden && !R.kuyruk && d < 64 && !R.bulundu) {
    // tahminin çevresinde de yoksa: biraz daha gez
    R.yeniden = false;
  }
  if (!R.tahmini && d < 10 && Math.abs(pl.location.y - R.hedef.y) < 30) {
    Yerler.ekle(pl.id, { tur: R.tur, ad: YAPI[R.tur].ad, pos: R.hedef, dim: dim.id });
    safe(() => dim.playSound("random.levelup", pl.location, { volume: 0.6, pitch: 1.4 }));
    return radarBitir(pl, `§bRadar§r: ${YAPI[R.tur].ad} burada! Bilinen yerlere kaydettim.`);
  }
  // radar sesi: yaklaştıkça sıklaşır ve incelir; binerken Keşif'ten gelir
  const aralik = clamp(Math.round(d / 12), 4, 40);
  if (system.currentTick - R.bip >= aralik) {
    R.bip = system.currentTick;
    const v = bindigi(pl);
    const kay = v ? v.location : pl.location;
    safe(() => dim.playSound("note.pling", kay, { volume: 0.7, pitch: clamp(2 - d / 400, 0.6, 2) }));
  }
  if (system.currentTick % 20 === 0) {
    safe(() => pl.onScreenDisplay.setActionBar(
      `§bRadar§r: ${YAPI[R.tur].ad}${R.tahmini ? " §7(tahmini)" : ""} §7· §f${Math.round(d)} blok §7· ${yon(pl.location, R.hedef)}`));
  }
}

// ======================================================================= eşyaları ver / al
const verildi = new Set();
function envanterde(inv, id) {
  for (let i = 0; i < inv.size; i++) if (safe(() => inv.getItem(i)?.typeId) === id) return i;
  return -1;
}
function esyalariVer(pl) {
  const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
  if (!inv) return;
  for (const id of [RADAR, HIZ]) {
    if (envanterde(inv, id) >= 0) continue;
    const st = new ItemStack(id, 1);
    safe(() => (st.keepOnDeath = false));
    safe(() => (st.lockMode = "inventory"));     // envanterden atılamaz (yere düşmesin)
    safe(() => inv.addItem(st));
  }
}
function esyalariAl(pl) {
  const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) {
    const t = safe(() => inv.getItem(i)?.typeId);
    if (t === RADAR || t === HIZ) safe(() => inv.setItem(i));
  }
}

system.runInterval(() => {
  const t = system.currentTick;
  for (const pl of world.getAllPlayers()) {
    if (t % 10 === 0) {
      const v = bindigi(pl);
      if (v && formOf(v) !== "robot") {
        esyalariVer(pl);
        verildi.add(pl.id);
      } else if (verildi.has(pl.id)) {
        esyalariAl(pl);
        verildi.delete(pl.id);
      }
    }
    const R = radarlar.get(pl.id);
    if (R) safe(() => radarTik(pl, R));
  }
}, 1);
world.afterEvents.playerLeave?.subscribe((ev) => {
  radarlar.delete(ev.playerId);
  verildi.delete(ev.playerId);
});
