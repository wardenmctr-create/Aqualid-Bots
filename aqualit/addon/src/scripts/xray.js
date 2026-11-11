// Aqualit Robotları — Matkap X-ray (v0.4.1, v0.4.6'da yenilendi: aşağıda)
import { world, system, BlockVolume } from "@minecraft/server";
import { safe } from "./util.js";

export const XRAY_ID = "aqualit:kesif_xray";
const TURLER = {
  "minecraft:overworld": ["stone", "deepslate", "granite", "diorite", "andesite", "tuff", "calcite", "dirt"],
  "minecraft:nether": ["netherrack", "blackstone", "basalt"],
  "minecraft:the_end": ["end_stone"],
};
export const ADLAR = { stone: "Taş", deepslate: "Derin kayrak", granite: "Granit", diorite: "Diyorit", andesite: "Andezit",
  tuff: "Tüf", calcite: "Kalsit", dirt: "Toprak", netherrack: "Nether taşı", blackstone: "Kara taş", basalt: "Bazalt",
  end_stone: "End taşı" };
const BUTCE = 6;                 // tik başına en çok blok doldurma çağrısı (telefon yorulmasın)
const KAYIT = "aq:xray_kalan";   // geri çevrilmemiş yığınlar (oyun kapanırsa)
let geriKuyruk = [];             // { dim, cx, cz }

const hid = (k, kip) => `aqualit:xr_${k}_${kip}`;
const mid = (k) => `minecraft:${k}`;

function kayitOku() { return safe(() => JSON.parse(world.getDynamicProperty(KAYIT) ?? "[]"), []) ?? []; }
function kayitYaz() {
  const l = [];
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

// ======================================================================= v0.4.6: yeni X-ray = cevher görüşü
// Eski saydam taş sistemi kaldırıldı (herkese görünüyordu, oyunda düzgün çalışmadı). X-ray eşyasına basılı tutunca
// matkaptaki oyuncunun ekranında cevherler görünür (cevher_durbunu.js); tekrar basınca kapanır. Kişisel: işaretler
// yalnız o oyuncunun ekranına çizilir. Hayalet blok tanımları eski dünyalar bozulmasın diye pakette duruyor; önceki
// oturumdan kalan hayalet taşlar açılışta asıllarına döndürülür.
export const gorusAcik = new Set();          // cevher görüşü açık oyuncular
export function xrayKullan(pl) {
  const ac = !gorusAcik.has(pl.id);
  if (ac) gorusAcik.add(pl.id); else gorusAcik.delete(pl.id);
  safe(() => pl.onScreenDisplay.setActionBar(ac ? "§bX-ray açık §7· cevherler ekranda" : "§7X-ray kapalı"));
  safe(() => pl.playSound(ac ? "beacon.activate" : "beacon.deactivate", { pitch: 1.8, volume: 0.5 }));
  return ac;
}
export function xrayKapat(pl) { gorusAcik.delete(pl.id); }
export function xrayKipi(pl) { return gorusAcik.has(pl.id) ? "acik" : null; }

// her tik: önceki sürümden kalan hayalet taşları (kayıtlı yığınlar) asıllarına döndür
function* isleyici() {
  for (;;) {
    let calisti = false;
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
world.afterEvents.playerLeave?.subscribe((ev) => gorusAcik.delete(ev.playerId));
export const _test = { geriKuyruk: () => geriKuyruk, dilimIsle };
