// Aqualit Robotları — Cevher dürbünü (v0.3.8)
// Matkaba binince ekranın altında canlı mini harita: matkabın önü (yukarı) ve yanları, 4 blok altından 4 blok üstüne
// kadar taranır; her sütundaki en değerli cevher kendi renkli karesiyle görünür, taş koyu kalır. Gerçek x-ray (taşı
// saydam yapmak) oyunda mümkün değil; dürbün duvarın ardındaki cevherin yerini gösterir.
import { world, system, BlockVolume } from "@minecraft/server";
import { safe } from "./util.js";
import { CEVHER } from "./harita_glif.js";

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

system.runInterval(() => {
  for (const pl of world.getAllPlayers()) {
    const v = ridingKesif(pl);
    if (!v || safe(() => v.getProperty("aqualit:form")) !== "matkap") continue;
    const { satirlar, en } = durbun(v);
    const not = en ? `§e${CEVHER[en.c[0]]} §l${en.c[2]}§r§e ${en.uz} blok ${en.dy > 0 ? `(${en.dy} yukarıda)` : en.dy < 0 ? `(${-en.dy} aşağıda)` : "(aynı hizada)"}`
      : "§7Yakında cevher yok";
    safe(() => pl.onScreenDisplay.setActionBar([...satirlar, not].join("\n")));
  }
}, 10);
