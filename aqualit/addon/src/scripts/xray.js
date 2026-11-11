// Aqualit Robotları — Matkap X-ray (v0.4.1)
// Yalnız matkaba binince gelen X-ray eşyası: basılı tut → Kapalı / Yarı saydam / Tam saydam. Seçince matkabın
// çevresindeki yüklü yığınlarda taş türleri (taş, derin kayrak, granit, diyorit, andezit, tüf, kalsit, toprak, Nether
// taşı, kara taş, bazalt, End taşı) aynı eşyayı düşüren "hayalet" kopyalarıyla değiştirilir (gen/xray.py). Cevherler
// olduğu gibi kalır, tam görünür. Matkaptan inince ya da "Kapalı" seçince hepsi asıllarına döner. Oyun kapanırsa
// dönüştürülen yığınlar kaydedilir; açılışta yüklenince geri çevrilir.
import { world, system, BlockVolume } from "@minecraft/server";
import { safe } from "./util.js";
import { menu, modal } from "./ui/forms.js";

export const XRAY_ID = "aqualit:kesif_xray";
const TURLER = {
  "minecraft:overworld": ["stone", "deepslate", "granite", "diorite", "andesite", "tuff", "calcite", "dirt"],
  "minecraft:nether": ["netherrack", "blackstone", "basalt"],
  "minecraft:the_end": ["end_stone"],
};
const KIPLER = { y: "Yarı saydam", t: "Tam saydam" };
export const ADLAR = { stone: "Taş", deepslate: "Derin kayrak", granite: "Granit", diorite: "Diyorit", andesite: "Andezit",
  tuff: "Tüf", calcite: "Kalsit", dirt: "Toprak", netherrack: "Nether taşı", blackstone: "Kara taş", basalt: "Bazalt",
  end_stone: "End taşı" };
const AYAR = "aq:xray_ayar";     // oyuncuda: x-ray'e dahil OLMAYAN türler (virgülle)
/** Oyuncunun x-ray'e dahil ettiği türler. */
export function dahil(pl) {
  const dis = String(safe(() => pl.getDynamicProperty(AYAR), "") ?? "").split(",").filter(Boolean);
  return new Set(Object.keys(ADLAR).filter((k) => !dis.includes(k)));
}
export const XR_AYAR = { R: 4 };  // matkabın çevresinde 9x9 yığın
const BUTCE = 6;                 // tik başına en çok blok doldurma çağrısı (telefon yorulmasın)
const KAYIT = "aq:xray_kalan";   // geri çevrilmemiş yığınlar (oyun kapanırsa)
const durum = new Map();         // oyuncu kimliği -> { kip, dim, islenen: Set, kuyruk: [] }
let geriKuyruk = [];             // { dim, cx, cz }

const hid = (k, kip) => `aqualit:xr_${k}_${kip}`;
const mid = (k) => `minecraft:${k}`;

function kayitOku() { return safe(() => JSON.parse(world.getDynamicProperty(KAYIT) ?? "[]"), []) ?? []; }
function kayitYaz() {
  const l = [];
  for (const st of durum.values()) for (const k of st.islenen) l.push(`${st.dim}|${k}`);
  for (const g of geriKuyruk) l.push(`${g.dim}|${g.cx},${g.cz}`);
  safe(() => world.setDynamicProperty(KAYIT, JSON.stringify([...new Set(l)].slice(0, 2000))));
}

/** Bir yığının bir dilimini hedef kipe çevirir (kip null: asıllarına döndür). Yapılan çağrı sayısı. */
function dilimIsle(dim, cx, cz, y0, y1, kip, secili) {
  let n = 0;
  for (const k of TURLER[dim.id] ?? []) {
    const kk = secili && !secili.has(k) ? null : kip;       // ayarlarda kapalı tür normal kalır
    const hedef = kk ? hid(k, kk) : mid(k);
    const kaynak = kk ? [mid(k), hid(k, kk === "y" ? "t" : "y")] : [hid(k, "y"), hid(k, "t")];
    const vol = new BlockVolume({ x: cx * 16, y: y0, z: cz * 16 }, { x: cx * 16 + 15, y: y1, z: cz * 16 + 15 });
    safe(() => dim.fillBlocks(vol, hedef, { blockFilter: { includeTypes: kaynak }, ignoreChunkBoundErrors: true }));
    n++;
  }
  return n;
}
function dilimler(dim) {
  const h = safe(() => dim.heightRange, { min: -64, max: 320 }) ?? { min: -64, max: 320 };
  const out = [];
  for (let y = h.min; y < h.max; y += 128) out.push([y, Math.min(h.max - 1, y + 127)]);
  return out;
}

function* yiginIs(dim, cx, cz, kip, secili) {
  let n = 0;
  for (const [y0, y1] of dilimler(dim)) {
    n += dilimIsle(dim, cx, cz, y0, y1, kip, secili);
    if (n >= BUTCE) { n = 0; yield; }
  }
}

/** Matkabın çevresindeki yüklü yığınları en yakından başlayarak sıraya koyar. */
function kuyrukKur(st, v) {
  const p = v.location;
  const ccx = Math.floor(p.x / 16), ccz = Math.floor(p.z / 16);
  const l = [];
  const R = XR_AYAR.R;
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const k = `${ccx + dx},${ccz + dz}`;
    if (st.islenen.has(k)) continue;
    if (!safe(() => v.dimension.isChunkLoaded({ x: (ccx + dx) * 16 + 8, y: 64, z: (ccz + dz) * 16 + 8 }), false)) continue;
    l.push([dx * dx + dz * dz, ccx + dx, ccz + dz]);
  }
  l.sort((a, b) => a[0] - b[0]);
  st.kuyruk = l.map(([, cx, cz]) => ({ cx, cz }));
  st.merkez = `${ccx},${ccz}`;
}

/** X-ray kipini ayarlar (kip: "y" | "t" | null). */
export function xrayAyarla(pl, v, kip) {
  let st = durum.get(pl.id);
  if (!kip) return xrayKapat(pl);
  if (!st) durum.set(pl.id, (st = { kip, dim: v.dimension.id, islenen: new Set(), kuyruk: [], merkez: "" }));
  st.secili = dahil(pl);
  if (st.kip !== kip) {                 // kip değişti: işlenenler yeni kipe yeniden çevrilir
    st.kip = kip;
    st.islenen.clear();
  }
  st.dim = v.dimension.id;
  kuyrukKur(st, v);
  safe(() => pl.onScreenDisplay.setActionBar(`§bX-ray: ${KIPLER[kip]} §7· matkabın çevresi hazırlanıyor`));
}

/** X-ray kapanır: dönüştürülen bütün yığınlar asıllarına döner. */
export function xrayKapat(pl, sessiz = false) {
  const st = durum.get(pl.id);
  if (!st) return;
  durum.delete(pl.id);
  for (const k of st.islenen) {
    const [cx, cz] = k.split(",").map(Number);
    geriKuyruk.push({ dim: st.dim, cx, cz });
  }
  kayitYaz();
  if (!sessiz) safe(() => pl.onScreenDisplay.setActionBar("§7X-ray kapandı · taşlar eski hâline dönüyor"));
}

export function xrayKipi(pl) { return durum.get(pl.id)?.kip ?? null; }

export async function xrayMenu(pl, v) {
  const simdi = xrayKipi(pl);
  const sec = (k, ad) => ({ text: `${simdi === k ? "§a● " : ""}§l${ad}`, k });
  const r = await menu(pl, "§lMatkap X-ray", "§7Taşlar saydamlaşır, cevherler tam görünür. Matkaptan inince kapanır.",
    [sec(null, "Kapalı"), sec("y", "Yarı saydam"), sec("t", "Tam saydam"), { text: "§lAyarlar§r\n§7Hangi bloklar saydamlaşsın", ayar: true }]);
  if (!r) return;
  if (r.ayar) return xrayAyarMenu(pl, v);
  if (!v || !safe(() => v.isValid, false)) return safe(() => pl.sendMessage("§eX-ray yalnız matkaptayken çalışır."));
  xrayAyarla(pl, v, r.k);
}

/** Ayarlar: her blok türü için aç/kapa (kapalı olan normal görünür). */
export async function xrayAyarMenu(pl, v) {
  const d = dahil(pl);
  const keys = Object.keys(ADLAR);
  const r = await modal(pl, "§lX-ray · Ayarlar", keys.map((k) => ({ type: "toggle", label: `${ADLAR[k]}`, value: d.has(k) })), "Kaydet");
  if (!r) return;
  const dis = keys.filter((k, i) => !r[i]);
  safe(() => pl.setDynamicProperty(AYAR, dis.join(",")));
  safe(() => pl.sendMessage(`§bX-ray ayarları kaydedildi§7 · saydamlaşanlar: ${keys.filter((k, i) => r[i]).map((k) => ADLAR[k]).join(", ") || "hiçbiri"}`));
  const kip = xrayKipi(pl);
  if (kip && v && safe(() => v.isValid, false)) {     // açıksa yeni ayarla yeniden uygula
    const st = durum.get(pl.id);
    st.islenen.clear();
    xrayAyarla(pl, v, kip);
  }
}

// her tik: sıradaki yığınları bütçe içinde işle; matkap başka yığına geçince yenilerini sıraya koy
function* isleyici() {
  for (;;) {
    let calisti = false;
    for (const [pid, st] of durum) {
      const pl = world.getAllPlayers().find((p) => p.id === pid);
      const v = pl && safe(() => pl.getComponent("minecraft:riding")?.entityRidingOn);
      if (!v) continue;
      const p = v.location;
      if (`${Math.floor(p.x / 16)},${Math.floor(p.z / 16)}` !== st.merkez || v.dimension.id !== st.dim) {
        if (v.dimension.id !== st.dim) { xrayKapat(pl, true); continue; }
        kuyrukKur(st, v);
      }
      const c = st.kuyruk.shift();
      if (!c) continue;
      calisti = true;
      yield* yiginIs(v.dimension, c.cx, c.cz, st.kip, st.secili);
      st.islenen.add(`${c.cx},${c.cz}`);
      if (st.islenen.size % 8 === 0) kayitYaz();
      if (!st.kuyruk.length) safe(() => pl.onScreenDisplay.setActionBar(`§bX-ray: ${KIPLER[st.kip]} §7· hazır`));
    }
    const g = geriKuyruk[0];
    if (g) {
      const dim = safe(() => world.getDimension(g.dim));
      if (dim && safe(() => dim.isChunkLoaded({ x: g.cx * 16 + 8, y: 64, z: g.cz * 16 + 8 }), false)) {
        yield* yiginIs(dim, g.cx, g.cz, null);
        geriKuyruk.shift();
        if (!geriKuyruk.length) kayitYaz();
        calisti = true;
      } else geriKuyruk.push(geriKuyruk.shift());   // yüklü değil: sonra
    }
    yield;
    if (!calisti) for (let i = 0; i < 10; i++) yield;
  }
}
system.runTimeout(() => system.runJob(isleyici()), 20);

// açılış: önceki oturumdan kalan hayalet taşlar geri çevrilir
system.runTimeout(() => {
  for (const s of kayitOku()) {
    const [dim, k] = s.split("|");
    const [cx, cz] = (k ?? "").split(",").map(Number);
    if (dim && Number.isFinite(cx) && Number.isFinite(cz)) geriKuyruk.push({ dim, cx, cz });
  }
}, 40);
world.afterEvents.playerLeave?.subscribe((ev) => {
  const st = durum.get(ev.playerId);
  if (!st) return;
  durum.delete(ev.playerId);
  for (const k of st.islenen) { const [cx, cz] = k.split(",").map(Number); geriKuyruk.push({ dim: st.dim, cx, cz }); }
  kayitYaz();
});
export const _test = { durum, geriKuyruk: () => geriKuyruk };
