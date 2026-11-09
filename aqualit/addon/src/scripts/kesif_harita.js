// Aqualit Robotları — Keşif Haritası (v0.3.8)
// Devasa harita (en uzakta 1600x1600 blok, normal haritanın 100 katından fazla). Menü gövdesinde özel glif kareleriyle
// (kaynak paketi font/glyph_E1/E2.png, gen/harita_glif.py) kare kare çizilir; oyuncu hep ortadadır.
// Oyuncu haritası: yalnız biyomlar ve yapılar (kalabalık olmasın). Keşif'in haritası: + sandıklar, moblar, robotlar.
// Oyuncu yürüdükçe oyunun yüklediği bütün alan bir seferde haritaya işlenir; uzağı dron ordusu doldurur.
import { world, system } from "@minecraft/server";
import { safe, V } from "./util.js";
import { menu } from "./ui/forms.js";
import { Harita, Yerler } from "./harita.js";
import { BIYOM, YAPI as YG, ISARET, ETIKET, BIYOM_ESLESME } from "./harita_glif.js";
import { YAPI } from "./yapi_bilgi.js";
import { dronTara } from "./kesif_dron.js";
import { bots } from "./brain.js";
import { getJSON } from "./store.js";

const N = 25;                    // harita N x N kare
const YARI = (N - 1) / 2;
const OLCEK = [16, 32, 64];      // blok/kare: 400, 800, 1600 blok
const YON8 = ["ok_s", "ok_sw", "ok_w", "ok_nw", "ok_n", "ok_ne", "ok_e", "ok_se"];   // oyun yaw 0 = güney
const PUSULA = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"];

// biyom kimliği -> karakter (en uzun eşleşen parça kazanır: "deep_frozen_ocean" donuk okyanus olur)
const BK = new Map();
function biyomKar(id) {
  if (!id) return BIYOM.bilinmiyor;
  let c = BK.get(id);
  if (c) return c;
  const s = String(id).replace("minecraft:", "");
  let best = "ova", bl = 0;
  for (const [ad, parcalar] of BIYOM_ESLESME) {
    for (const p of parcalar) if (s.includes(p) && p.length > bl) { best = ad; bl = p.length; }
  }
  c = BIYOM[best] ?? BIYOM.ova;
  BK.set(id, c);
  return c;
}

function pusula(dx, dz) {
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;      // kuzey 0, saat yönü
  return PUSULA[Math.round(((a % 360) + 360) % 360 / 45) % 8];
}

/** Harita ızgarası (satırlar) ve görünen yapılar. kesif: Keşif katmanı (sandık, mob, robot). */
export function haritaCiz(owner, dim, merkez, olcek, oyuncuYaw, kesif) {
  const s = olcek;
  const g = [];
  for (let r = 0; r < N; r++) {
    const satir = [];
    for (let c = 0; c < N; c++) {
      const x = merkez.x + (c - YARI) * s, z = merkez.z + (r - YARI) * s;
      // kare birkaç yığın kaplıyorsa bilinen ilk yığının biyomu
      let b;
      const adim = Math.max(1, s / 16);
      for (let i = 0; i < Math.min(adim, 2) && !b; i++) {
        for (let j = 0; j < Math.min(adim, 2) && !b; j++) b = Harita.bak(owner, dim.id, { x: x + i * 16 * (adim / 2), z: z + j * 16 * (adim / 2) });
      }
      satir.push(biyomKar(b?.biome));
    }
    g.push(satir);
  }
  const kare = (p) => ({ c: Math.round((p.x - merkez.x) / s + YARI), r: Math.round((p.z - merkez.z) / s + YARI) });
  const icinde = (q) => q.c >= 0 && q.c < N && q.r >= 0 && q.r < N;
  // Keşif katmanı: robotlar, sandıklar, moblar (önce, yapılar üstüne yazılır)
  if (kesif) {
    for (const b of bots.values()) {
      if (b.owner !== owner || safe(() => b.dim.id) !== dim.id) continue;
      const q = kare(b.loc);
      if (icinde(q)) g[q.r][q.c] = ISARET.robot;
    }
    for (const k of safe(() => world.getDynamicPropertyIds(), []) ?? []) {
      if (!k.startsWith("aq:su:")) continue;
      const u = safe(() => getJSON(world, k, null));
      if (!u || u.owner !== owner || u.dim !== dim.id || !u.blocks?.[0]) continue;
      const q = kare(u.blocks[0]);
      if (icinde(q)) g[q.r][q.c] = ISARET.sandik;
    }
    const yaricap = (s * N) / 2;
    const ents = safe(() => dim.getEntities({ location: { x: merkez.x, y: merkez.y ?? 64, z: merkez.z }, maxDistance: yaricap }), []) ?? [];
    let n = 0;
    for (const e of ents) {
      if (n > 150) break;
      const fam = safe(() => e.getComponent("minecraft:type_family"));
      const t = safe(() => e.typeId, "");
      let isaret = null;
      if (t === "aqualit:kesif") isaret = ISARET.kesif;
      else if (t === "minecraft:villager_v2" || t === "minecraft:villager" || t === "minecraft:wandering_trader") isaret = ISARET.koylu;
      else if (safe(() => fam?.hasTypeFamily("monster"), false)) isaret = ISARET.canavar;
      else if (safe(() => fam?.hasTypeFamily("animal"), false) || safe(() => fam?.hasTypeFamily("mob"), false)) isaret = ISARET.hayvan;
      if (!isaret) continue;
      const q = kare(e.location);
      if (icinde(q)) { g[q.r][q.c] = isaret; n++; }
    }
  }
  // yapılar: kendi rozeti + altında kısa adı (3 kare)
  const gorunen = [];
  for (const y of Yerler.list(owner)) {
    if (y.dim !== dim.id || !YG[y.tur]) continue;
    const q = kare(y.pos);
    if (!icinde(q)) continue;
    g[q.r][q.c] = YG[y.tur];
    const et = ETIKET[y.tur];
    if (et && q.r + 1 < N) for (let k = 0; k < 3; k++) if (q.c - 1 + k >= 0 && q.c - 1 + k < N) g[q.r + 1][q.c - 1 + k] = et[k];
    gorunen.push(y);
  }
  // sen: ortada, baktığın yöne ok
  const yi = Math.round((((oyuncuYaw ?? 0) % 360) + 360) % 360 / 45) % 8;
  if (kesif?.oyuncu !== false) g[YARI][YARI] = ISARET[YON8[yi]];
  return { satirlar: g.map((r) => "§f" + r.join("")), gorunen };
}

/** Haritayı açar. o: { kesif: Keşif (katmanlı harita), olcek, merkez } */
export async function haritaAc(pl, o = {}) {
  let olcekNo = o.olcekNo ?? 1;
  let merkez = null;
  const k = o.kesif;
  for (;;) {
    const dim = pl.dimension;
    const sen = pl.location;
    const m = { ...(merkez ?? { x: Math.floor(sen.x), z: Math.floor(sen.z) }), y: Math.floor(sen.y) };
    const s = OLCEK[olcekNo];
    const owner = k?.owner ?? pl.id;
    // haritaya bakılan yerin biyomlarını hemen işle (yüklü olanlar)
    yakinlariIsle(pl, 6);
    const { satirlar, gorunen } = haritaCiz(owner, dim, m, s, safe(() => pl.getRotation().y, 0), k ? { oyuncu: true } : null);
    const genislik = s * N;
    const liste = gorunen
      .map((y) => ({ y, d: V.hdist(y.pos, sen) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 10)
      .map(({ y, d }) => `${YG[y.tur]} §l${y.ad ?? YAPI[y.tur]?.ad ?? y.tur}§r §7${y.pos.x}, ${y.pos.y}, ${y.pos.z} · ${Math.round(d)} blok ${pusula(y.pos.x - sen.x, y.pos.z - sen.z)}`);
    const baslik = `§71 kare = ${s} blok · ${genislik}x${genislik} blok · merkez ${m.x}, ${m.z}`;
    const aciklama = k ? `§7${ISARET.robot} robot  ${ISARET.sandik} sandık  ${ISARET.kesif} Keşif  ${ISARET.canavar} canavar  ${ISARET.hayvan} hayvan  ${ISARET.koylu} köylü`
      : "§7Karanlık yerler henüz keşfedilmedi. Keşif'in dronları ya da sen gezdikçe dolar.";
    const govde = [baslik, ...satirlar, aciklama, "", gorunen.length ? "§lBu haritadaki yapılar:" : "§7Bu alanda bilinen yapı yok.", ...liste].join("\n");
    const btns = [
      { text: "▲ Kuzey", v: "n" }, { text: "▼ Güney", v: "s" }, { text: "◀ Batı", v: "w" }, { text: "▶ Doğu", v: "e" },
      { text: olcekNo > 0 ? "+ Yakınlaştır" : "§8+ Yakınlaştır", v: "in" }, { text: olcekNo < OLCEK.length - 1 ? "- Uzaklaştır" : "§8- Uzaklaştır", v: "out" },
      { text: "◎ Beni ortala", v: "c" },
    ];
    if (k) btns.push({ text: "§lDron ordusu gönder§r\n§725 dron keşfedilmemiş yerlere", icon: "textures/items/dron_ordusu", v: "ordu" });
    btns.push({ text: "§cKapat", v: "x" });
    const r = await menu(pl, k ? `§l${k.name} · Haritam` : "§lKeşif Haritası", govde, btns);
    if (!r || r.v === "x") return;
    const kay = s * 8;
    if (r.v === "n") merkez = { x: m.x, z: m.z - kay };
    else if (r.v === "s") merkez = { x: m.x, z: m.z + kay };
    else if (r.v === "w") merkez = { x: m.x - kay, z: m.z };
    else if (r.v === "e") merkez = { x: m.x + kay, z: m.z };
    else if (r.v === "in") olcekNo = Math.max(0, olcekNo - 1);
    else if (r.v === "out") olcekNo = Math.min(OLCEK.length - 1, olcekNo + 1);
    else if (r.v === "c") merkez = null;
    else if (r.v === "ordu") {
      const ai = await import("./kesif_ai.js");
      ai.basla(k, ai.orduIsi(k), "25 dronluk ordumu haritanın keşfedilmemiş yerlerine gönderiyorum!");
      return;
    }
  }
}

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
  for (const pl of world.getAllPlayers()) safe(() => yakinlariIsle(pl, 3));
}, 2);

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
