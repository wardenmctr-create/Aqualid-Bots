// Aqualit Robotları — DEVASA harita ve bilinen yerler (sahip başına, dünya kaydında)
// Harita: 512×512 blokluk bölge başına bir kayıt; her 16×16 yığın için biyom ve yüzey yüksekliği.
// Robotlar gezdikçe dolar (şimdilik Keşif); "en yakın köy / orman" soruları önce buraya bakar.
import { safe, V } from "./util.js";
import { getJSON, setJSON } from "./store.js";
import { world } from "@minecraft/server";

const REG = 512;
const MAX_YER = 200;
const dimKey = (d) => (d.includes("nether") ? "n" : d.includes("end") ? "e" : "o");

// biyom kimliklerini kısa sayıya çevir (kayıt küçük kalsın); liste sabit, yalnız sona eklenir
const BIYOM = [];
const BIX = new Map();
function biyomNo(id) {
  if (!BIX.has(id)) {
    BIX.set(id, BIYOM.length);
    BIYOM.push(id);
  }
  return BIX.get(id);
}
function loadBiyom() {
  if (BIYOM.length) return;
  const list = getJSON(world, "aq:hrt_biyom", []);
  for (const id of list) biyomNo(id);
}
function saveBiyom() {
  setJSON(world, "aq:hrt_biyom", BIYOM);
}

export const Harita = {
  /** Bir yığını kaydet. */
  kaydet(owner, dimId, pos, biome, h) {
    loadBiyom();
    const n = BIX.size;
    const b = biyomNo(biome);
    if (BIX.size !== n) saveBiyom();
    const rx = Math.floor(pos.x / REG), rz = Math.floor(pos.z / REG);
    const k = `aq:hrt:${owner}:${dimKey(dimId)}:${rx}:${rz}`;
    const reg = getJSON(world, k, {});
    const ck = `${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`;
    const v = `${b.toString(36)}.${Math.round(h ?? 64)}`;
    if (reg[ck] === v) return false;
    reg[ck] = v;
    setJSON(world, k, reg);
    return true;
  },
  /** Bir yığının bilgisi: {biome, h} ya da undefined. */
  bak(owner, dimId, pos) {
    loadBiyom();
    const rx = Math.floor(pos.x / REG), rz = Math.floor(pos.z / REG);
    const reg = getJSON(world, `aq:hrt:${owner}:${dimKey(dimId)}:${rx}:${rz}`, {});
    const v = reg[`${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`];
    if (!v) return undefined;
    const [b, h] = v.split(".");
    return { biome: BIYOM[parseInt(b, 36)], h: Number(h) };
  },
  /** Haritada en yakın verilen biyom (yığın merkezi). */
  enYakinBiyom(owner, dimId, pos, biomes, maxDist = 4096) {
    loadBiyom();
    const want = new Set(biomes.map((b) => BIX.get(b)).filter((x) => x !== undefined).map((x) => x.toString(36)));
    if (!want.size) return undefined;
    let best, bd = maxDist * maxDist;
    const pre = `aq:hrt:${owner}:${dimKey(dimId)}:`;
    for (const k of safe(() => world.getDynamicPropertyIds(), []) ?? []) {
      if (!k.startsWith(pre)) continue;
      const reg = getJSON(world, k, {});
      for (const [ck, v] of Object.entries(reg)) {
        if (!want.has(v.split(".")[0])) continue;
        const [cx, cz] = ck.split(",").map(Number);
        const p = { x: cx * 16 + 8, y: Number(v.split(".")[1]), z: cz * 16 + 8 };
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  },
  /** Kaç yığın keşfedildi. */
  boyut(owner) {
    let n = 0;
    for (const k of safe(() => world.getDynamicPropertyIds(), []) ?? []) {
      if (k.startsWith(`aq:hrt:${owner}:`)) n += Object.keys(getJSON(world, k, {})).length;
    }
    return n;
  },
};

/** Bulunan yapılar ve yerler: {id, tur, ad, pos, dim, t, kim} */
export const Yerler = {
  list(owner) {
    return getJSON(world, `aq:yer:${owner}`, []);
  },
  save(owner, list) {
    setJSON(world, `aq:yer:${owner}`, list.slice(-MAX_YER));
  },
  /** Ekler; aynı türden 48 blok içinde kayıt varsa yenisini eklemez. */
  ekle(owner, yer) {
    const list = this.list(owner);
    const old = list.find((y) => y.tur === yer.tur && y.dim === yer.dim && V.hdist(y.pos, yer.pos) < 48);
    if (old) return old;
    const y = { id: Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36), t: Date.now(), ...yer };
    list.push(y);
    this.save(owner, list);
    return y;
  },
  sil(owner, id) {
    this.save(owner, this.list(owner).filter((y) => y.id !== id));
  },
  enYakin(owner, tur, dimId, pos, maxDist = 1e9) {
    let best, bd = maxDist;
    for (const y of this.list(owner)) {
      if (y.tur !== tur || y.dim !== dimId) continue;
      const d = V.hdist(y.pos, pos);
      if (d < bd) { bd = d; best = y; }
    }
    return best;
  },
};
