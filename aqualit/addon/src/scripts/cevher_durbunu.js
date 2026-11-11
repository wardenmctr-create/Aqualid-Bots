// Aqualit Robotları — Cevher dürbünü (v0.3.8)
// v0.4.5: panel kaldırıldı, cevherler ekranın kendisinde görünür (aşağıda "cevher görüşü"). durbun() eski kare
// haritayı hâlâ hesaplar (testlerde). Eski not: matkaba binince ekranın altında canlı mini harita: matkabın önü (yukarı) ve yanları, 4 blok altından 4 blok üstüne
// kadar taranır; her sütundaki en değerli cevher kendi renkli karesiyle görünür, taş koyu kalır. Gerçek x-ray (taşı
// saydam yapmak) oyunda mümkün değil; dürbün duvarın ardındaki cevherin yerini gösterir.
import { world, system, BlockVolume, MolangVariableMap } from "@minecraft/server";
import { CEVHER_U } from "./cevher_atlas.js";
import { gorusAcik } from "./xray.js";
import { safe } from "./util.js";
import { CEVHER } from "./harita_glif.js";
import { formOf } from "./kesif.js";

const KESIF_ID = "aqualit:kesif";
const GEN = 5;          // sağa-sola 5 sütun (11 genişlik)
const ON = 8;           // önde 8 sıra
const DY = 4;           // aşağı-yukarı 4 blok
// cevher kimliği -> [kare anahtarı, değer, Türkçe ad]
const CEV = {};
const ekle = (ids, k, deger, ad) => { for (const id of ids) CEV[`minecraft:${id}`] = [k, deger, ad]; };
ekle(["ancient_debris"], "enkaz", 10, "antik enkaz");
ekle(["diamond_ore", "deepslate_diamond_ore"], "elmas", 9, "elmas");
ekle(["emerald_ore", "deepslate_emerald_ore"], "zumrut", 8, "zümrüt");
ekle(["gold_ore", "deepslate_gold_ore", "nether_gold_ore"], "altin", 7, "altın");
ekle(["lapis_ore", "deepslate_lapis_ore"], "lapis", 6, "lapis");
ekle(["redstone_ore", "deepslate_redstone_ore", "lit_redstone_ore", "lit_deepslate_redstone_ore"], "kizil", 5, "kızıltaş");
ekle(["iron_ore", "deepslate_iron_ore"], "demir", 4, "demir");
ekle(["copper_ore", "deepslate_copper_ore"], "bakir", 3, "bakır");
ekle(["quartz_ore"], "kuvars", 2, "kuvars");
ekle(["coal_ore", "deepslate_coal_ore"], "komur", 1, "kömür");
const TURLER = Object.keys(CEV);

function ridingKesif(pl) {
  const r = safe(() => pl.getComponent("minecraft:riding")?.entityRidingOn);
  return r && safe(() => r.typeId) === KESIF_ID ? r : null;
}

/** Matkabın önündeki cevher haritası: { satirlar, en } (en: en değerli cevher ve uzaklığı). */
export function durbun(v) {
  const dim = v.dimension, p = v.location;
  const yaw = (safe(() => v.getRotation().y, 0) * Math.PI) / 180;
  const ileri = { x: -Math.sin(yaw), z: Math.cos(yaw) }, sag = { x: -Math.cos(yaw), z: -Math.sin(yaw) };
  const R = ON + 1;
  const vol = new BlockVolume({ x: Math.floor(p.x) - R, y: Math.floor(p.y) - DY, z: Math.floor(p.z) - R },
    { x: Math.floor(p.x) + R, y: Math.floor(p.y) + DY + 1, z: Math.floor(p.z) + R });
  const res = safe(() => dim.getBlocks(vol, { includeTypes: TURLER }, true));
  const kare = Array.from({ length: ON }, () => Array(GEN * 2 + 1).fill(null));
  let en = null;
  for (const q of safe(() => [...(res?.getBlockLocationIterator() ?? [])], []) ?? []) {
    const dx = q.x + 0.5 - p.x, dz = q.z + 0.5 - p.z;
    const f = Math.round(dx * ileri.x + dz * ileri.z), r = Math.round(dx * sag.x + dz * sag.z);
    if (f < 1 || f > ON || Math.abs(r) > GEN) continue;
    const c = CEV[safe(() => dim.getBlock(q)?.typeId, "")];
    if (!c) continue;
    const sat = ON - f, sut = r + GEN;
    if (!kare[sat][sut] || kare[sat][sut][1] < c[1]) kare[sat][sut] = c;
    const uz = Math.round(Math.hypot(dx, q.y - p.y, dz));
    if (!en || c[1] > en.c[1] || (c[1] === en.c[1] && uz < en.uz)) en = { c, uz, dy: Math.round(q.y - p.y) };
  }
  const satirlar = kare.map((s) => "§f" + s.map((c) => (c ? CEVHER[c[0]] : CEVHER.tas)).join(""));
  const alt = Array(GEN * 2 + 1).fill(CEVHER.bos);
  alt[GEN] = CEVHER.matkap;
  satirlar.push("§f" + alt.join(""));
  return { satirlar, en };
}

// ======================================================================= v0.4.5 cevher görüşü (panelsiz)
// Matkaptayken X-ray açıksa (X-ray eşyasına basılı tut) cevherler ekranın kendisinde, gerçek yerlerinde görünür: her cevherin resmi gözden cevhere giden
// çizginin üstüne, önündeki ilk duvarın hemen önüne konur ve uzaklıkla orantılı küçültülür (gerçek blok ne kadar
// görünecekse o kadar). Böylece duvarın ardındaki elmas, duvarda tam kazman gereken yerde ve uzaklığına uygun boyda
// görünür. Gözden çizgi dönmeye bağlı değil: kafanı çevirince işaretler kaymaz. Oyunda denenmedi.

export const GORUS = { R: 14, DY: 8, EN_COK: 40 };
const gorus = new Map();
export const _gorus = gorus;      // oyuncu kimliği -> { liste: [{x,y,z,id,deger}], ray: Map, sira }

function tara(pl) {
  const dim = pl.dimension, h = pl.getHeadLocation();
  const R = GORUS.R;
  const vol = new BlockVolume({ x: Math.floor(h.x) - R, y: Math.floor(h.y) - GORUS.DY, z: Math.floor(h.z) - R },
    { x: Math.floor(h.x) + R, y: Math.floor(h.y) + GORUS.DY, z: Math.floor(h.z) + R });
  const res = safe(() => dim.getBlocks(vol, { includeTypes: TURLER }, true));
  const liste = [];
  for (const q of safe(() => [...(res?.getBlockLocationIterator() ?? [])], []) ?? []) {
    const id = safe(() => dim.getBlock(q)?.typeId, "");
    const c = CEV[id];
    if (!c || CEVHER_U[id] === undefined) continue;
    const uz = Math.hypot(q.x + 0.5 - h.x, q.y + 0.5 - h.y, q.z + 0.5 - h.z);
    if (uz > R + 0.5) continue;
    liste.push({ x: q.x, y: q.y, z: q.z, id, deger: c[1], ad: c[2], uz });
  }
  // önce değerli, sonra yakın olanlar
  liste.sort((a, b) => b.deger - a.deger || a.uz - b.uz);
  return liste.slice(0, GORUS.EN_COK);
}

/** Gözden cevhere giden çizgide ilk katı bloğa uzaklık (yoksa cevherin kendisi). */
function engel(pl, h, c, uz) {
  const yon = { x: (c.x + 0.5 - h.x) / uz, y: (c.y + 0.5 - h.y) / uz, z: (c.z + 0.5 - h.z) / uz };
  const hit = safe(() => pl.dimension.getBlockFromRay(h, yon, { maxDistance: uz, includeLiquidBlocks: false, includePassableBlocks: false }));
  if (!hit?.block) return uz;
  const f = hit.faceLocation ?? { x: 0.5, y: 0.5, z: 0.5 };
  const p = { x: hit.block.x + f.x, y: hit.block.y + f.y, z: hit.block.z + f.z };
  return Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z);
}

/** Çizilecek işaretler: [{ p, boy, u, c }]. ray: önceki engel uzaklıkları (cevher anahtarı -> uzaklık). */
export function cevherIsaretleri(pl, liste, ray = new Map()) {
  const h = pl.getHeadLocation();
  const bak = safe(() => pl.getViewDirection(), { x: 0, y: 0, z: 1 });
  const out = [];
  for (const c of liste) {
    const cx = c.x + 0.5, cy = c.y + 0.5, cz = c.z + 0.5;
    const uz = Math.hypot(cx - h.x, cy - h.y, cz - h.z);
    if (uz < 0.9) continue;
    const yon = { x: (cx - h.x) / uz, y: (cy - h.y) / uz, z: (cz - h.z) / uz };
    if (yon.x * bak.x + yon.y * bak.y + yon.z * bak.z < 0.25) continue;      // arkada / çok yanda
    const k = `${c.x},${c.y},${c.z}`;
    const e = ray.get(k) ?? uz;
    // duvarın hemen önü; çok yakın duvarda bile kameranın önünde kalsın
    const D = Math.max(0.32, Math.min(uz - 0.55, e * 0.92 - 0.12));
    out.push({ p: { x: h.x + yon.x * D, y: h.y + yon.y * D, z: h.z + yon.z * D }, boy: (0.5 * D) / uz, u: CEVHER_U[c.id], c });
  }
  return out;
}

system.runInterval(() => {
  const t = system.currentTick;
  for (const pl of world.getAllPlayers()) {
    const v = ridingKesif(pl);
    // v0.4.6: yalnız X-ray eşyasıyla açılınca (kişisel)
    if (!v || formOf(v) !== "matkap" || !gorusAcik.has(pl.id)) { gorus.delete(pl.id); continue; }
    let g = gorus.get(pl.id);
    if (!g) gorus.set(pl.id, (g = { liste: [], ray: new Map(), sira: 0, son: -99 }));
    if (t - g.son >= 10) { g.liste = tara(pl); g.son = t; }
    // her seferinde birkaç cevherin engel uzaklığını yenile (telefon yorulmasın)
    const h = pl.getHeadLocation();
    for (let i = 0; i < 8 && g.liste.length; i++) {
      const c = g.liste[g.sira++ % g.liste.length];
      const uz = Math.hypot(c.x + 0.5 - h.x, c.y + 0.5 - h.y, c.z + 0.5 - h.z);
      g.ray.set(`${c.x},${c.y},${c.z}`, engel(pl, h, c, uz));
    }
    for (const m of cevherIsaretleri(pl, g.liste, g.ray)) {
      const mv = new MolangVariableMap();
      mv.setFloat("variable.u", m.u);
      mv.setFloat("variable.boy", m.boy);
      safe(() => pl.spawnParticle("aqualit:cevher", m.p, mv));
    }
    if (t % 10 === 0) {
      const en = g.liste[0];
      safe(() => pl.onScreenDisplay.setActionBar(en ? `§e⛏ §l${en.ad}§r§e ${Math.round(en.uz)} blok · ekranda ${g.liste.length} cevher` : "§7Yakında cevher yok"));
    }
  }
}, 2);
