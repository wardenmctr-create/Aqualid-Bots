// Aqualit Robotları — Keşif yapay zekâsı (v0.3.1)
// Yapı bulur (köy, tapınaklar, deneme odası, maden ocağı, ...), biyom bulur, çevreyi keşfedip DEVASA haritayı doldurur,
// bulduklarını "Bilinen yerler"e yazar ve sahibine konum gönderir. Sahibini ya da robotları araçla götürür.
// Aracı kendi seçer: uzun yol uçak, su üstü gemi, su altı denizaltı, yer altı matkap.
// Yalnız yüklü yığınlara bakar; uzaktayken çevresini işletir (tick_world) ve küçük bir işleme alanı açar.
import { world, system, BlockVolume, ItemStack } from "@minecraft/server";
import { V, safe, fire, yawOf, clamp, wait } from "./util.js";
import { Robots, getJSON, setJSON, getProp, setProp } from "./store.js";
import { sendMessage } from "./messages.js";
import { menu, modal, confirm } from "./ui/forms.js";
import { Harita, Yerler } from "./harita.js";
import { KESIF_ID, KAD, formOf, transform, ridersOf, aracMenu, collect, depoOku, depoYaz, depoSay, kaziTopla } from "./kesif.js";
import { sendLocation } from "./konum.js";
import { bots } from "./brain.js";
import { TYPE_NAME, robotIcon } from "./constants.js";
import { ICONS } from "./ikon_data.js";
import { YAPI } from "./yapi_bilgi.js";
import { seferMenu } from "./sefer.js";
import { KOLTUK, YALNIZ_OYUNCU } from "./kesif_koltuk.js";
import { hizCarpani } from "./kesif_radar.js";

const CRUISE = 14;            // yüzeyin kaç blok üstünden uçar
const FLY = 0.9;              // tek başına uçuş hızı (blok/tik)
const CARRY = 0.8;            // yolcu taşırken hız
const ICON = (id) => ICONS[`minecraft:${id}`] ?? "textures/items/compass_item";

// ======================================================================= yapılar ve biyomlar
// yapılar: yapi_bilgi.js (bütün robotlar ortak kullanır)
export { YAPI };
export const ikon = (tur) => ICON(YAPI[tur]?.icon ?? "compass");

export const BIYOM = {
  plains: "Ova", sunflower_plains: "Ayçiçekli ova", forest: "Orman", flower_forest: "Çiçek ormanı", birch_forest: "Huş ormanı",
  roofed_forest: "Kara orman", taiga: "Tayga", mega_taiga: "Dev tayga", jungle: "Cengel", bamboo_jungle: "Bambu cengeli",
  desert: "Çöl", savanna: "Savan", mesa: "Kanyon (badlands)", swampland: "Bataklık", mangrove_swamp: "Mangrov bataklığı",
  meadow: "Çayır", cherry_grove: "Kiraz bahçesi", pale_garden: "Solgun bahçe", ice_plains: "Karlı ova",
  ice_plains_spikes: "Buz dikenleri", cold_taiga: "Karlı tayga", grove: "Koru", snowy_slopes: "Karlı yamaç",
  jagged_peaks: "Sivri zirveler", frozen_peaks: "Donmuş zirveler", stony_peaks: "Taşlı zirveler",
  mushroom_island: "Mantar adası", beach: "Kumsal", ocean: "Okyanus", warm_ocean: "Ilık okyanus (mercan)",
  deep_ocean: "Derin okyanus", frozen_ocean: "Donmuş okyanus", river: "Nehir", lush_caves: "Yemyeşil mağara",
  dripstone_caves: "Sarkıt mağarası", deep_dark: "Derin karanlık",
  hell: "Nether çorak toprakları", crimson_forest: "Kızıl orman", warped_forest: "Çarpık orman",
  soulsand_valley: "Ruh kumu vadisi", basalt_deltas: "Bazalt deltası",
};
const NETHER_B = new Set(["hell", "crimson_forest", "warped_forest", "soulsand_valley", "basalt_deltas"]);
const ALTI_B = new Set(["lush_caves", "dripstone_caves", "deep_dark"]);
const SCAN_ALL = [...new Set(Object.values(YAPI).flatMap((s) => [...s.blocks, ...(s.all ?? [])]))];

// ======================================================================= Keşif kaydı
export const kesifler = new Map();            // varlık kimliği -> K

class K {
  constructor(e) {
    this.e = e;
    this.id = e.id;
    this.type = "kesif";
    this.model = 1;
    this.owner = safe(() => e.getDynamicProperty("aq:sahip"), "") ?? "";
    this.ownerName = safe(() => e.getDynamicProperty("aq:sahip_ad"), "") ?? "";
    this.rid = getProp(e, "aq:rid", "");
    if (!this.rid) {
      this.rid = `K${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
      setProp(e, "aq:rid", this.rid);
    }
    this.name = getProp(e, "aq:name", "");
    if (!this.name && this.owner) {
      this.name = `Keşif-${Robots.nextNumber(this.owner, "kesif")}`;
      setProp(e, "aq:name", this.name);
    }
    this.home = getProp(e, "aq:home", undefined);
    this.homeDim = getProp(e, "aq:homeDim", safe(() => e.dimension.id, "minecraft:overworld"));
    this.task = getJSON(e, "aq:gorev", null);
    this.status = "Bekliyor";
    this.job = null;
    this.lastIndex = 0;
  }
  get valid() { return safe(() => this.e.isValid, false); }
  get dim() { return this.e.dimension; }
  get loc() { return this.e.location; }
  get entry() { return { rid: this.rid, name: this.name, type: "kesif", model: 1 }; }
  say(text, opts) {
    if (!this.owner) return null;
    safe(() => this.dim.playSound("aqualit.robot.beep", this.loc, { volume: 0.7, pitch: 1.1 }));
    return sendMessage(this.owner, this.entry, text, opts);
  }
  setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.updateIndex(true);
  }
  updateIndex(force = false) {
    const now = system.currentTick;
    if (!force && now - this.lastIndex < 100) return;
    this.lastIndex = now;
    if (!this.owner) return;
    const l = this.loc;
    Robots.upsert(this.owner, { rid: this.rid, eid: this.id, name: this.name, type: "kesif", model: 1, dim: this.dim.id,
      pos: { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }, home: this.home, homeDim: this.homeDim,
      status: this.status, job: this.task && !this.task.done ? "gorev" : "bekleme", upd: Date.now() });
  }
  saveTask() { setJSON(this.e, "aq:gorev", this.task); }
  tick(on) { safe(() => this.e.triggerEvent(on ? "aqualit:tick_on" : "aqualit:tick_off")); }
}

export function kesifOf(e) {
  if (!e || safe(() => e.typeId) !== KESIF_ID) return undefined;
  let k = kesifler.get(e.id);
  if (!k) {
    k = new K(e);
    kesifler.set(e.id, k);
    if (k.task && !k.task.done) k.job = gorevIsi(k);      // yarım kalan görevi sürdür
    k.updateIndex(true);
  } else if (k.e !== e) k.e = e;
  return k;
}
export function kesifByRid(rid) {
  for (const k of kesifler.values()) if (k.rid === rid && k.valid) return k;
  return undefined;
}

/** Yeni konan Keşif'i kaydeder (evi konduğu yer). */
export function kesifKuruldu(e) {
  const k = kesifOf(e);
  if (!k) return;
  const l = e.location;
  k.home = { x: l.x, y: l.y, z: l.z };
  k.homeDim = e.dimension.id;
  setProp(e, "aq:home", k.home);
  setProp(e, "aq:homeDim", k.homeDim);
  k.updateIndex(true);
}
/** Keşif toplanınca listeden düşer. */
export function kesifToplandi(e) {
  const k = kesifler.get(e.id);
  if (k?.owner) Robots.remove(k.owner, k.rid);
  kesifler.delete(e.id);
  safe(() => world.tickingAreaManager?.removeTickingArea(`aqk_${k?.rid}`));
}

// ======================================================================= hareket
const isAir = (t) => !t || t === "minecraft:air" || t === "minecraft:cave_air" || t === "minecraft:void_air";

function yuzey(dim, x, z) {
  const b = safe(() => dim.getTopmostBlock({ x: Math.floor(x), z: Math.floor(z) }));
  return b ? { y: b.y, water: /water/.test(safe(() => b.typeId, "")) } : undefined;
}
function yuklu(dim, p) {
  return !!safe(() => dim.isChunkLoaded({ x: Math.floor(p.x), y: 64, z: Math.floor(p.z) }), true);
}

/** Uzaktaki yığınlar için küçük işleme alanı (3×3 yığın) — yalnız gerektiğinde, en çok 1 tane. */
function alanAc(k) {
  const tam = safe(() => world.tickingAreaManager);
  if (!tam) return;
  const l = k.loc;
  const c = { x: Math.floor(l.x / 16), z: Math.floor(l.z / 16) };
  if (k.alan && k.alan.x === c.x && k.alan.z === c.z) return;
  const id = `aqk_${k.rid}`;
  safe(() => tam.removeTickingArea(id));
  const opts = { dimension: k.dim, from: { x: (c.x - 1) * 16, y: 0, z: (c.z - 1) * 16 }, to: { x: (c.x + 1) * 16 + 15, y: 0, z: (c.z + 1) * 16 + 15 } };
  if (safe(() => tam.hasCapacity(opts), true)) fire(() => tam.createTickingArea(id, opts), "işleme alanı");
  k.alan = c;
}
function alanKapat(k) {
  safe(() => world.tickingAreaManager?.removeTickingArea(`aqk_${k.rid}`));
  k.alan = undefined;
}

function* araca(k, form) {
  if (formOf(k.e) === form) return true;
  if (!transform(k.e, form)) return formOf(k.e) === form;
  yield* wait(30);
  return formOf(k.e) === form;
}

/** Tek başına uçar (küçük ışınlanma adımları, yüzeyin üstünde sabit yükseklik). */
export function* uc(k, target, opts = {}) {
  k.tick(true);
  yield* araca(k, "ucak");
  safe(() => k.e.clearVelocity());
  let n = 0;
  let stuck = 0;
  for (;;) {
    const l = k.loc;
    const dx = target.x - l.x, dz = target.z - l.z;
    const hd = Math.hypot(dx, dz);
    if (hd < (opts.near ?? 2)) return true;
    const step = Math.min(opts.speed ?? FLY, hd);
    const nx = l.x + (dx / hd) * step, nz = l.z + (dz / hd) * step;
    const ahead = { x: l.x + (dx / hd) * Math.min(12, hd), z: l.z + (dz / hd) * Math.min(12, hd) };
    if (!yuklu(k.dim, ahead)) {
      alanAc(k);
      if (++stuck > 200) {
        k.say("İleride dünya yüklenmiyor, burada bekliyorum. Yakınıma gelirsen devam ederim.");
        stuck = -400;
      }
      yield;
      continue;
    }
    stuck = 0;
    const s1 = yuzey(k.dim, ahead.x, ahead.z);
    const s0 = yuzey(k.dim, nx, nz);
    const ground = Math.max(s1?.y ?? l.y - CRUISE, s0?.y ?? l.y - CRUISE);
    const want = Math.max(ground + (opts.cruise ?? CRUISE), opts.minY ?? -999);
    const dy = clamp(want - l.y, -0.5, 0.6);
    safe(() => k.e.teleport({ x: nx, y: l.y + dy, z: nz }, { rotation: { x: 0, y: yawOf(dx, dz) } }));
    const egim = clamp(Math.round(-dy * 60), -45, 45);
    if (Math.abs((safe(() => k.e.getProperty("aqualit:egim"), 0) ?? 0) - egim) > 5) safe(() => k.e.setProperty("aqualit:egim", egim));
    if (opts.her) opts.her();                   // her tik küçük bir iş (ör. tek yığın tarama)
    if (++n % 16 === 0) {
      haritaya(k);
      if (n % 64 === 0) alanAc(k);
      k.updateIndex();
      if (opts.tara) opts.tara();
    }
    if (n % 20 === 0) safe(() => k.dim.playSound("aqualit.kesif.plane_loop", l, { volume: 0.5 }));
    yield;
  }
}

/** Yere iner ve robota döner. */
export function* in_(k) {
  const l = k.loc;
  const s = yuzey(k.dim, l.x, l.z);
  const y = (s?.y ?? l.y - 1) + 1;
  for (let i = 0; i < 400 && k.loc.y > y + 0.2; i++) {
    const c = k.loc;
    safe(() => k.e.teleport({ x: c.x, y: Math.max(y, c.y - 0.4), z: c.z }));
    yield;
  }
  safe(() => k.e.setProperty("aqualit:egim", 0));
  yield* araca(k, "robot");
}

/** Eve uç ve in. */
export function* eveDon(k) {
  if (!k.home) return;
  if (k.dim.id !== k.homeDim) {
    k.say("Evim başka bir boyutta; beni oraya götürmen lazım.");
    return;
  }
  k.setStatus("Eve uçuyor");
  yield* uc(k, k.home, { near: 1.5 });
  safe(() => k.e.teleport({ x: k.home.x, y: k.loc.y, z: k.home.z }));
  yield* in_(k);
  k.tick(false);
  alanKapat(k);
}

// ======================================================================= tarama
function haritaya(k) {
  if (!k.owner) return;
  const l = k.loc;
  const b = safe(() => k.dim.getBiome(l)?.id);
  const s = yuzey(k.dim, l.x, l.z);
  if (b) Harita.kaydet(k.owner, k.dim.id, l, b, s?.y);
}

/** Bir yığında yapı imzası arar. Bulursa {tur, pos}. */
export function yiginTara(dim, cx, cz, turler) {
  const ys = turler.map((t) => YAPI[t].y);
  const y0 = Math.max(dim.heightRange?.min ?? -64, Math.min(...ys.map((y) => y[0])));
  const y1 = Math.min((dim.heightRange?.max ?? 320) - 1, Math.max(...ys.map((y) => y[1])));
  const types = [...new Set(turler.flatMap((t) => [...YAPI[t].blocks, ...(YAPI[t].all ?? [])]))];
  const vol = new BlockVolume({ x: cx * 16, y: y0, z: cz * 16 }, { x: cx * 16 + 15, y: y1, z: cz * 16 + 15 });
  const res = safe(() => dim.getBlocks(vol, { includeTypes: types }, true));
  if (!res) return null;
  const found = new Map();
  for (const p of safe(() => [...res.getBlockLocationIterator()], []) ?? []) {
    const t = safe(() => dim.getBlock(p)?.typeId);
    if (t && !found.has(t)) found.set(t, p);
    if (found.size >= types.length) break;
  }
  if (!found.size) return null;
  for (const tur of turler) {
    const S = YAPI[tur];
    const any = S.blocks.find((b) => found.has(b) && found.get(b).y >= S.y[0] && found.get(b).y <= S.y[1]);
    if (!any) continue;
    if (S.all && !S.all.every((b) => found.has(b))) continue;
    return { tur, pos: found.get(any) };
  }
  return null;
}

/** Bir noktanın çevresinde, yığın yığın, içten dışa arar (yalnız yüklü yığınlar). */
function* cevredeAra(k, turler, merkez, yaricap, opts = {}) {
  const c0 = { x: Math.floor(merkez.x / 16), z: Math.floor(merkez.z / 16) };
  const R = Math.ceil(yaricap / 16);
  for (let r = 0; r <= R; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = c0.x + dx, cz = c0.z + dz;
        const mid = { x: cx * 16 + 8, y: k.loc.y, z: cz * 16 + 8 };
        if (!yuklu(k.dim, mid)) {
          // yığına yaklaş: üstünden geç
          yield* uc(k, mid, { near: 24, cruise: opts.cruise });
          for (let w = 0; w < 60 && !yuklu(k.dim, mid); w++) yield;
          if (!yuklu(k.dim, mid)) continue;
        }
        const f = yiginTara(k.dim, cx, cz, turler);
        if (f) return f;
        yield;
      }
    }
    k.setStatus(`Arıyor (${r * 16}/${R * 16} blok)`);
  }
  return null;
}

// ======================================================================= görevler
function bildir(k, yer, why) {
  const proxy = { owner: k.owner, rid: k.rid, name: k.name, type: "kesif", model: 1, dim: k.dim, loc: yer.pos,
    say: (t, o) => k.say(t, o) };
  if (!sendLocation(proxy, why)) k.say(`${why} (${Math.floor(yer.pos.x)}, ${Math.floor(yer.pos.y)}, ${Math.floor(yer.pos.z)})`, { force: true });
}

export function* yapiBul(k, T) {
  const S = YAPI[T.tur];
  const origin = { ...k.loc };
  const max = T.max ?? 2000;
  if (!S.dims.includes(k.dim.id)) {
    k.say(`${S.ad} bu boyutta yok.`);
    return null;
  }
  // 1) bilinen yerler
  const bilinen = Yerler.enYakin(k.owner, T.tur, k.dim.id, origin, max);
  if (bilinen && !T.yeni) {
    bildir(k, bilinen, `${S.ad} zaten biliyorum: ${Math.round(V.hdist(bilinen.pos, origin))} blok ötede.`);
    return bilinen;
  }
  k.say(`${S.ad} arıyorum (en çok ${max} blok).`);
  // 2) önce buraya yakın çevre
  k.setStatus(`${S.ad} arıyor`);
  let f = yield* cevredeAra(k, [T.tur], origin, 96);
  // 3) uygun biyomlara git, orada ara
  const ziyaret = [];
  let from = origin;
  for (let deneme = 0; !f && deneme < 8; deneme++) {
    let hedef;
    if (S.biomes) {
      let bd = Infinity;
      for (const b of S.biomes) {
        const id = `minecraft:${b}`;
        const p = safe(() => k.dim.calculateClosestBiomeFromSeed(from, id, { boundingSize: { x: max * 2, y: 64, z: max * 2 } }))
          ?? Harita.enYakinBiyom(k.owner, k.dim.id, from, [id], max);
        if (!p || V.hdist(p, origin) > max) continue;
        if (ziyaret.some((z) => V.hdist(z, p) < 160)) continue;
        const d = V.hdist(p, k.loc);
        if (d < bd) { bd = d; hedef = p; }
      }
    } else {
      // biyomdan bağımsız: içten dışa halkalar (8 yön)
      const ring = 160 * (1 + Math.floor(deneme / 8));
      const a = (deneme % 8) * Math.PI / 4;
      hedef = { x: origin.x + Math.cos(a) * ring, y: origin.y, z: origin.z + Math.sin(a) * ring };
      if (V.hdist(hedef, origin) > max) hedef = undefined;
    }
    if (!hedef) break;
    ziyaret.push(hedef);
    k.setStatus(`${S.ad} için ${Math.round(V.hdist(hedef, k.loc))} blok uçuyor`);
    yield* uc(k, hedef, { near: 8 });
    f = yield* cevredeAra(k, [T.tur], k.loc, S.alti ? 64 : 128);
    // bir sonraki aday daha uzaktan aransın
    const d = V.sub(hedef, origin);
    const n = Math.hypot(d.x, d.z) || 1;
    from = { x: hedef.x + (d.x / n) * 200, y: hedef.y, z: hedef.z + (d.z / n) * 200 };
  }
  if (!f) {
    k.say(`${max} blok içinde ${S.ad.toLowerCase()} bulamadım. Daha uzağa bakmamı istersen uzaklığı artır.`, { force: true });
    return null;
  }
  const yer = Yerler.ekle(k.owner, { tur: f.tur, ad: YAPI[f.tur].ad, pos: f.pos, dim: k.dim.id, kim: k.name });
  bildir(k, yer, `${YAPI[f.tur].ad} buldum! ${Math.round(V.hdist(f.pos, origin))} blok ötede.`);
  return yer;
}

function* biyomBul(k, T) {
  const id = `minecraft:${T.biyom}`;
  const ad = BIYOM[T.biyom] ?? T.biyom;
  const origin = { ...k.loc };
  const max = T.max ?? 3000;
  k.setStatus(`${ad} arıyor`);
  let p = safe(() => k.dim.calculateClosestBiomeFromSeed(origin, id, { boundingSize: { x: max * 2, y: 64, z: max * 2 } }))
    ?? Harita.enYakinBiyom(k.owner, k.dim.id, origin, [id], max);
  if (!p || V.hdist(p, origin) > max) {
    k.say(`${max} blok içinde ${ad.toLowerCase()} yok.`, { force: true });
    return null;
  }
  yield* uc(k, p, { near: 4 });
  // biyomun içinde olduğunu doğrula (biraz çevresine bak)
  let ok = safe(() => k.dim.getBiome(k.loc)?.id) === id;
  for (let i = 0; !ok && i < 8; i++) {
    const a = i * Math.PI / 4;
    const q = { x: p.x + Math.cos(a) * 24, y: p.y, z: p.z + Math.sin(a) * 24 };
    yield* uc(k, q, { near: 4 });
    ok = safe(() => k.dim.getBiome(k.loc)?.id) === id;
  }
  const s = yuzey(k.dim, k.loc.x, k.loc.z);
  const pos = { x: Math.floor(k.loc.x), y: (s?.y ?? Math.floor(k.loc.y)) + 1, z: Math.floor(k.loc.z) };
  const yer = Yerler.ekle(k.owner, { tur: `biyom:${T.biyom}`, ad, pos, dim: k.dim.id, kim: k.name });
  bildir(k, yer, `${ad} buldum! ${Math.round(V.hdist(pos, origin))} blok ötede.`);
  return yer;
}

/** Çevreyi keşfet: kare sarmal uçuş, her yığını haritaya yazar, yolda gördüğü yapıları kaydeder. */
function* kesfet(k, T) {
  const origin = { ...k.loc };
  const R = T.yaricap ?? 256;
  const turler = Object.keys(YAPI).filter((t) => YAPI[t].dims.includes(k.dim.id));
  const bulunan = [];
  const bakildi = new Set();
  const kuyruk = [];
  // her 16 blokta çevredeki yığınları sıraya koyar, her tik yalnız birini tarar (tik kısa kalsın)
  const tara = () => {
    const c = { x: Math.floor(k.loc.x / 16), z: Math.floor(k.loc.z / 16) };
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${c.x + dx},${c.z + dz}`;
      if (bakildi.has(key)) continue;
      bakildi.add(key);
      kuyruk.push([c.x + dx, c.z + dz]);
    }
  };
  const her = () => {
    const q = kuyruk.shift();
    if (!q) return;
    const f = yiginTara(k.dim, q[0], q[1], turler);
    if (f && !bulunan.some((b) => b.tur === f.tur && V.hdist(b.pos, f.pos) < 48)) {
      bulunan.push(f);
      const yer = Yerler.ekle(k.owner, { tur: f.tur, ad: YAPI[f.tur].ad, pos: f.pos, dim: k.dim.id, kim: k.name });
      k.say(`Yolda ${YAPI[f.tur].ad.toLowerCase()} gördüm (${yer.pos.x}, ${yer.pos.y}, ${yer.pos.z}).`);
    }
  };
  const step = 64;
  let x = 0, z = 0, dx = step, dz = 0, leg = 1, done = 0;
  k.say(`${R} blok çevreyi keşfe çıkıyorum.`);
  while (Math.max(Math.abs(x), Math.abs(z)) <= R) {
    for (let i = 0; i < leg; i++) {
      x += dx; z += dz;
      if (Math.max(Math.abs(x), Math.abs(z)) > R) break;
      yield* uc(k, { x: origin.x + x, y: origin.y, z: origin.z + z }, { near: 3, tara, her });
      done++;
      k.setStatus(`Keşfediyor %${Math.min(99, Math.round((done * step * step * 100) / (4 * R * R)))}`);
    }
    [dx, dz] = [-dz, dx];
    if (dz === 0) leg++;
  }
  k.say(`Keşif bitti: ${Harita.boyut(k.owner)} yığınlık harita, ${bulunan.length} yeni yapı.`, { force: true });
  return bulunan;
}

/** Görev dağıtıcı. task: {tur:'yapi'|'biyom'|'kesfet'|'eve', ...} */
function* gorevIsi(k) {
  const T = k.task;
  try {
    let sonuc = null;
    if (T.is === "yapi") sonuc = yield* yapiBul(k, T);
    else if (T.is === "biyom") sonuc = yield* biyomBul(k, T);
    else if (T.is === "kesfet") yield* kesfet(k, T);
    if (sonuc && T.bekle) {
      // bulunan yerde bekle (sahibi gelsin)
      yield* uc(k, sonuc.pos, { near: 3 });
      yield* in_(k);
      k.setStatus("Bulduğu yerde bekliyor");
    } else yield* eveDon(k);
  } finally {
    T.done = true;
    k.saveTask();
    k.setStatus("Bekliyor");
    k.tick(false);
    alanKapat(k);
  }
}

// ======================================================================= götürme (otopilot)
/** Sahibini (ve binen robotları) araçla götürür. Araç: yolun çoğu su ise gemi, değilse uçak. */
export function* gotur(k, hedef, ad, opts = {}) {
  const dim = k.dim;
  const l = k.loc;
  const su = yuzey(dim, l.x, l.z)?.water && yuzey(dim, hedef.x, hedef.z)?.water;
  const form = su ? "gemi" : "ucak";
  yield* araca(k, form);
  k.setStatus(`${ad} yerine götürüyor`);
  k.tick(true);
  let bos = 0;
  for (let t = 0; t < 20 * 60 * 20; t++) {
    if (!yolcuSayisi(k)) {
      if (++bos > 100) {
        k.say("Herkes indi, yolculuğu bıraktım.");
        break;
      }
      yield;
      continue;
    }
    bos = 0;
    const p = k.loc;
    const dx = hedef.x - p.x, dz = hedef.z - p.z;
    const hd = Math.hypot(dx, dz);
    if (hd < 3) break;
    const sur = ridersOf(k.e).find((r) => r.typeId === "minecraft:player");
    const sp = Math.min((form === "gemi" ? 0.6 : CARRY) * hizCarpani(k.e, sur), hd / 10 + 0.1);
    let vy = 0;
    if (form === "ucak") {
      const ahead = { x: p.x + (dx / hd) * 12, z: p.z + (dz / hd) * 12 };
      const g = Math.max(yuzey(dim, ahead.x, ahead.z)?.y ?? p.y - CRUISE, yuzey(dim, p.x, p.z)?.y ?? p.y - CRUISE);
      const want = hd < 24 ? (yuzey(dim, hedef.x, hedef.z)?.y ?? hedef.y) + 3 : g + CRUISE;
      vy = clamp((want - p.y) * 0.1, -0.4, 0.5);
      if (!yuklu(dim, ahead)) alanAc(k);
    }
    const vel = safe(() => k.e.getVelocity(), { x: 0, y: 0, z: 0 });
    const tgt = { x: (dx / hd) * sp, y: vy, z: (dz / hd) * sp };
    safe(() => k.e.applyImpulse({ x: tgt.x - vel.x, y: form === "ucak" ? tgt.y - vel.y : 0, z: tgt.z - vel.z }));
    safe(() => k.e.setRotation({ x: 0, y: yawOf(dx, dz) }));
    if (t % 20 === 0) {
      safe(() => dim.playSound(form === "gemi" ? "aqualit.kesif.boat_loop" : "aqualit.kesif.plane_loop", p, { volume: 0.6 }));
      haritaya(k);
      k.updateIndex();
    }
    yield;
  }
  safe(() => k.e.clearVelocity());           // varınca dur (kaymasın)
  if (opts.kal) {
    // otopilot: araç olarak kalır, sürücü devralır
    k.say(`${ad}: vardık! Otopilot kapandı, artık sen sürüyorsun.`, { force: true });
    k.setStatus("Bekliyor");
    k.tick(false);
    alanKapat(k);
    return;
  }
  // yer altındaysa (deneme odası, antik şehir) matkapla iner
  const s = yuzey(dim, k.loc.x, k.loc.z);
  if (s && hedef.y < s.y - 6 && yolcuSayisi(k)) {
    k.say("Hedef yerin altında, matkapla iniyorum. İnince eğilip in.");
    yield* araca(k, "matkap");
    safe(() => k.e.setDynamicProperty("aq:kaz", "dikey"));
    for (let t = 0; t < 20 * 90 && k.loc.y > hedef.y + 1; t++) {
      if (t % 4 === 0) kazAsagi(k);
      const v = safe(() => k.e.getVelocity(), { x: 0, y: 0, z: 0 });
      safe(() => k.e.applyImpulse({ x: -v.x, y: -0.15 - v.y, z: -v.z }));     // sabit hızla iner
      yield;
    }
    safe(() => k.e.clearVelocity());
  } else {
    // in ve robota dön (yolcular iner)
    safe(() => k.e.clearVelocity());
    yield* in_(k);
  }
  k.say(`${ad}: vardık!`, { force: true });
  k.setStatus("Bekliyor");
  k.tick(false);
  alanKapat(k);
}

function kazAsagi(k) {
  kaziTopla(k.e);
  const p = k.loc;
  const cx = Math.floor(p.x), cy = Math.floor(p.y + 0.05) - 1, cz = Math.floor(p.z);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const bl = safe(() => k.dim.getBlock({ x: cx + a, y: cy, z: cz + b }));
    const t = safe(() => bl?.typeId, "minecraft:air");
    if (!bl || isAir(t) || /bedrock|chest|spawner|vault|barrel|reinforced|portal/.test(t)) continue;
    safe(() => k.dim.runCommand(`setblock ${cx + a} ${cy} ${cz + b} air destroy`));
  }
}

// ======================================================================= robot taşıma
const yolcu = new Set();       // binmiş robotların kimlikleri (brain onları yürütmesin)
export function robotYolcuMu(id) {
  return yolcu.has(id);
}
export const KAPASITE = 10;    // koltuklar, kanatlar, tavan, platform (kesif_koltuk.js); yetmezse içeri
const gizlenen = new Map();     // Keşif kimliği -> içeri giren robotlar (görünmez, araçla taşınır)

function iceriAl(k, b) {
  let set = gizlenen.get(k.id);
  if (!set) gizlenen.set(k.id, (set = new Set()));
  set.add(b);
  safe(() => b.e.addEffect("invisibility", 20 * 60 * 60, { showParticles: false }));
  safe(() => b.e.teleport({ ...k.loc }));
  safe(() => k.dim.playSound("aqualit.kesif.lock", k.loc, { volume: 0.5, pitch: 1.4 }));
}
/** İçerideki robotlar araçla birlikte taşınır (her tik). */
function icerdekileriTasi() {
  for (const [id, set] of gizlenen) {
    const k = kesifler.get(id);
    if (!k?.valid) {
      for (const b of set) disari(null, b, 0);
      gizlenen.delete(id);
      continue;
    }
    const l = k.loc;
    for (const b of set) safe(() => b.e.teleport({ x: l.x, y: l.y + 0.3, z: l.z }));
  }
}
function disari(k, b, i) {
  safe(() => b.e.removeEffect("invisibility"));
  if (k) {
    const a = (i / 6) * Math.PI * 2;
    const l = k.loc;
    safe(() => b.e.teleport({ x: l.x + Math.cos(a) * 1.8, y: l.y + 0.1, z: l.z + Math.sin(a) * 1.8 }));
  }
}

/** Robotları bindirir: önce koltuklar (kanatlar, üstü dahil), kalanlar içeri girer. En çok 10. Binen sayısı. */
export function* robotlariBindir(k, list) {
  yield* araca(k, "ucak");
  const rc = safe(() => k.e.getComponent("minecraft:rideable"));
  let n = 0;
  const yalniz = YALNIZ_OYUNCU.includes(formOf(k.e));
  for (const b of list) {
    if (!b.valid || n >= KAPASITE) continue;
    b.setMove?.("none");
    b.setAct?.("none");            // binen robot kendiliğinden oturur (istemci: q.is_riding), tutunanlar act2
    if (!yalniz && safe(() => rc.addRider(b.e), false)) {
      yolcu.add(b.id);
      n++;
    } else {
      iceriAl(k, b);              // koltuk kalmadı: aracın içine
      yolcu.add(b.id);
      n++;
    }
    yield* wait(2);
  }
  const ic = gizlenen.get(k.id)?.size ?? 0;
  if (ic) k.say(`${n - ic} robot koltuklarda ve kanatlarda, ${ic} robot içeride.`);
  return n;
}
export function robotlariIndir(k, list, yeniEv) {
  const rc = safe(() => k.e.getComponent("minecraft:rideable"));
  const ic = gizlenen.get(k.id);
  let i = 0;
  for (const b of list) {
    if (ic?.has(b)) {
      ic.delete(b);
      disari(k, b, i++);
    } else safe(() => rc?.ejectRider(b.e));
    yolcu.delete(b.id);
    b.setAct?.("none");
    safe(() => b.e.setProperty("aqualit:act2", "none"));
    if (yeniEv) {
      const l = b.loc;
      b.home = { x: Math.floor(l.x) + 0.5, y: Math.floor(l.y), z: Math.floor(l.z) + 0.5 };
      setProp(b.e, "aq:home", b.home);
      b.resetTrail?.();
      b.updateIndex?.(true);
    }
  }
  if (ic && !ic.size) gizlenen.delete(k.id);
}
/** Yolcu sayısı: koltukta ya da içeride. */
export function yolcuSayisi(k) {
  return ridersOf(k.e).length + (gizlenen.get(k.id)?.size ?? 0);
}
function* robotTasi(k, list, hedef, ad, yeniEv) {
  const n = yield* robotlariBindir(k, list);
  if (!n) {
    k.say("Hiçbir robot binemedi.");
    return;
  }
  k.say(`${n} robotu ${ad} yerine götürüyorum.`);
  k.setStatus(`${n} robot taşıyor`);
  k.tick(true);
  // robotlar binmişken ışınlanmayla uçulmaz: götürme ile aynı itme sürüşü (yolcu sayılırlar)
  yield* gotur(k, hedef, ad);
  robotlariIndir(k, list, yeniEv);
  k.say(yeniEv ? `Robotlar indi; yeni evleri burası. Görev verirsen buradan çalışırlar.` : "Robotlar indi.", { force: true });
}

/** Araç değişince koltuğu kalmayan robot (ör. denizaltı: robotlar dışarıda boğulur) aracın içine girer. */
export function koltuksuzIceri(e, r) {
  const k = kesifler.get(e.id);
  const b = bots.get(r.id);
  if (!k || !b) return false;
  iceriAl(k, b);
  yolcu.add(b.id);
  return true;
}

/** Matkap deposundakileri madenciye verir: önce binen/içerideki madenciler, yoksa yakındaki (8 blok) madenciler. */
function depoyuDagit(k) {
  const d = depoOku(k.e);
  const ids = Object.keys(d);
  if (!ids.length) return;
  const ic = gizlenen.get(k.id) ?? new Set();
  const adaylar = [...ridersOf(k.e).map((r) => bots.get(r.id)), ...ic,
    ...[...bots.values()].filter((b) => b.valid && b.owner === k.owner && V.dist(b.loc, k.loc) < 8)];
  const madenci = adaylar.filter((b, i) => b?.valid && b.type === "madenci" && adaylar.indexOf(b) === i);
  if (!madenci.length) return;
  let verilen = 0;
  for (const b of madenci) {
    for (const id of Object.keys(d)) {
      const left = b.addItem(id, d[id]);
      verilen += d[id] - left;
      if (left > 0) d[id] = left;
      else delete d[id];
    }
    if (!Object.keys(d).length) break;
  }
  depoYaz(k.e, d);
  if (verilen) k.say(`Matkapla kazdıklarımı madenciye verdim (${verilen} eşya).`);
}

/** Her yarım saniye: binen robotların pozu (koltuk sırasına göre: tutun ya da otur) ve matkabın arka kapısı. */
function koltukPozlari() {
  for (const k of kesifler.values()) {
    if (!k.valid) continue;
    const form = formOf(k.e);
    const plan = KOLTUK[form] ?? [];
    let robot = 0;
    ridersOf(k.e).forEach((r, i) => {
      if (r.typeId !== "aqualit:robot") return;
      robot++;
      const want = plan[i]?.tur === "tutun" ? "tutun" : "none";
      if (safe(() => r.getProperty("aqualit:act2")) !== want) safe(() => r.setProperty("aqualit:act2", want));
      if (safe(() => r.getProperty("aqualit:act")) === "sit") safe(() => r.setProperty("aqualit:act", "none"));
    });
    // kapı robot binmişken açık; yalnız oyuncu binince ya da Keşif tek başına giderken kapanır
    const ac = form === "matkap" && robot > 0;
    if (safe(() => k.e.getProperty("aqualit:kapi")) !== ac) safe(() => k.e.setProperty("aqualit:kapi", ac));
  }
}

// ======================================================================= iş döngüsü
system.runInterval(() => {
  icerdekileriTasi();
  if (system.currentTick % 10 === 0) koltukPozlari();
  if (system.currentTick % 40 === 20) for (const k of kesifler.values()) if (k.valid) safe(() => depoyuDagit(k));
  for (const [id, k] of kesifler) {
    if (!k.valid) {
      kesifler.delete(id);
      continue;
    }
    if (!k.job) continue;
    try {
      const r = k.job.next();
      if (r.done) k.job = null;
    } catch (e) {
      k.job = null;
      k.say("Bir şeyler ters gitti, görevi bıraktım.");
    }
  }
}, 1);

world.afterEvents.entityLoad.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) === KESIF_ID) system.run(() => kesifOf(ev.entity));
});
world.afterEvents.worldLoad?.subscribe(() => system.runTimeout(() => {
  for (const id of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    for (const e of safe(() => world.getDimension(id).getEntities({ type: KESIF_ID }), []) ?? []) kesifOf(e);
  }
}, 30));

/** Keşif'in yapay zekâsı bir iş yapıyor mu (o sırada oyuncunun sürüşü devre dışı). */
export function aiMesgul(e) {
  return !!kesifler.get(e.id)?.job;
}
export function kesifListesi() {
  return [...kesifler.values()].filter((k) => k.valid);
}

// ======================================================================= otopilot ve takip (v0.3.2)
/** Otopilot: sürücüyü hedefe kendisi götürür, varınca araç olarak kalır. */
export function otopilotBaslat(k, hedef, ad) {
  safe(() => k.e.setDynamicProperty("aq:otopilot", true));
  k.job = (function* () {
    try {
      yield* gotur(k, hedef, ad, { kal: true });
    } finally {
      safe(() => k.e.setDynamicProperty("aq:otopilot", false));
    }
  })();
  k.say(`Otopilot açık: ${ad} yerine gidiyorum (${Math.round(V.hdist(hedef, k.loc))} blok).`, { force: true });
}
export function otopilotDur(k) {
  k.job = null;
  safe(() => k.e.setDynamicProperty("aq:otopilot", false));
  safe(() => k.e.clearVelocity());
  k.setStatus("Bekliyor");
}

/** Birini takip et: hedefin hemen arkasından gelir (hedef Keşif ise onun aracına dönüşür). */
export function* takipEt(k, bul, ad) {
  k.tick(true);
  k.setStatus(`${ad} takip ediliyor`);
  let son = 0;
  for (;;) {
    const h = bul();
    if (!h || !safe(() => h.isValid, false)) {
      k.say(`${ad} kayboldu, takibi bıraktım.`, { force: true });
      break;
    }
    if (h.dimension.id !== k.dim.id) {
      yield* wait(20);
      continue;
    }
    // araç seçimi: hedef Keşif aracıysa aynısı, değilse uçak
    let hf = h.typeId === KESIF_ID ? formOf(h) : "ucak";
    if (hf === "robot") hf = "ucak";
    if (formOf(k.e) !== hf && system.currentTick - son > 60) {
      son = system.currentTick;
      if (!(yield* araca(k, hf)) && formOf(k.e) === "robot") yield* araca(k, "ucak");
      continue;
    }
    const hl = h.location;
    const yaw = (safe(() => h.getRotation().y, 0) * Math.PI) / 180;
    const ileri = { x: -Math.sin(yaw), z: Math.cos(yaw) };
    const uc = formOf(k.e) === "ucak";
    const zemin = uc ? (yuzey(k.dim, hl.x, hl.z)?.y ?? hl.y) : hl.y;
    const nokta = { x: hl.x - ileri.x * 7, y: uc ? Math.max(hl.y + 1, zemin + 2) : hl.y, z: hl.z - ileri.z * 7 };
    const l = k.loc;
    const d = V.dist(l, nokta);
    if (d > 80) {
      safe(() => k.e.teleport(nokta));                // çok geride kaldı: arkasına ışınlanır
      yield;
      continue;
    }
    const sp = Math.min(1.8, d * 0.2);
    const n = Math.max(0.001, d);
    const vel = safe(() => k.e.getVelocity(), { x: 0, y: 0, z: 0 });
    const tgt = { x: ((nokta.x - l.x) / n) * sp, y: ((nokta.y - l.y) / n) * sp, z: ((nokta.z - l.z) / n) * sp };
    safe(() => k.e.applyImpulse({ x: tgt.x - vel.x, y: uc || formOf(k.e) === "denizalti" ? tgt.y - vel.y : 0, z: tgt.z - vel.z }));
    safe(() => k.e.setRotation({ x: 0, y: yawOf(hl.x - l.x, hl.z - l.z) }));
    if (system.currentTick % 40 === 0) k.updateIndex();
    yield;
  }
  k.setStatus("Bekliyor");
  k.tick(false);
}

/** Takip edilecekleri listeler: oyuncular, öteki Keşif'ler, robotlar. Seçilenin {bul, ad}. */
export async function takipHedefiSec(pl, haric, baslik) {
  const btns = [];
  for (const p of world.getAllPlayers()) {
    if (p.id === haric) continue;
    btns.push({ text: `§l${p.name}§r\n§7Oyuncu · ${Math.round(V.dist(p.location, pl.location))} blok`, icon: ICON("player_head"), id: p.id, ad: p.name });
  }
  for (const k of kesifListesi()) {
    if (k.e.id === haric || k.owner !== pl.id) continue;
    btns.push({ text: `§l${k.name}§r\n§7Keşif · ${KAD[formOf(k.e)]} · ${Math.round(V.dist(k.loc, pl.location))} blok`, icon: "textures/items/robot_kesif", id: k.e.id, ad: k.name });
  }
  for (const b of bots.values()) {
    if (b.id === haric || b.owner !== pl.id || !b.valid) continue;
    btns.push({ text: `§l${b.name}§r\n§7${TYPE_NAME[b.type] ?? "Robot"} · ${Math.round(V.dist(b.loc, pl.location))} blok`, icon: robotIcon(b.type, b.model), id: b.id, ad: b.name });
  }
  if (!btns.length) {
    pl.sendMessage("§eTakip edilecek kimse yok.");
    return undefined;
  }
  const r = await menu(pl, baslik, "Kimi takip etsin?", btns);
  if (!r) return undefined;
  return { id: r.id, ad: r.ad, bul: () => varlikBul(r.id) };
}
export function varlikBul(id) {
  return world.getAllPlayers().find((p) => p.id === id) ?? safe(() => world.getEntity(id));
}

export function basla(k, gen, msg) {
  k.job = gen;
  if (msg) k.say(msg);
}

// ======================================================================= menüler
/** Keşif'e dokununca (robotken) ya da binerken telsizle açılan ana menü. */
export async function anaMenu(pl, e) {
  const k = kesifOf(e);
  if (!k) return;
  if (!k.owner) {
    safe(() => e.setDynamicProperty("aq:sahip", pl.id));
    safe(() => e.setDynamicProperty("aq:sahip_ad", pl.name));
    k.owner = pl.id;
    k.ownerName = pl.name;
  }
  const form = formOf(e);
  const mesgul = !!k.job;
  const body = [
    `§7Durum: §f${k.status}`,
    `§7Şu an: §f${KAD[form]}`,
    `§7Bilinen yer: §f${Yerler.list(k.owner).length} · Harita: §f${Harita.boyut(k.owner)} yığın`,
  ].join("\n");
  const btns = [];
  if (mesgul) btns.push({ text: "§l§cGörevi bırak§r\n§7Eve döner", icon: ICON("barrier"), v: "dur" });
  btns.push({ text: "§lYapı bul§r\n§7Köy, tapınak, deneme odası...", icon: ICON("filled_map"), v: "yapi" });
  btns.push({ text: "§lBiyom bul§r\n§7Çöl, kiraz bahçesi, mantar adası...", icon: ICON("compass"), v: "biyom" });
  btns.push({ text: "§lÇevreyi keşfet§r\n§7Harita çıkarır, yoldaki yapıları kaydeder", icon: ICON("filled_map"), v: "kesfet" });
  btns.push({ text: "§lBilinen yerler§r\n§7Bulduklarım: konum, götür, sil", icon: ICON("writable_book"), v: "yerler" });
  btns.push({ text: "§lBeni götür§r\n§7Araç olur, bindirir, kendisi sürer", icon: ICON("elytra"), v: "gotur" });
  btns.push({ text: "§lSefer düzenle§r\n§7Robot ekibini bir yapıya götürür: korur, yağmalar, döner", icon: ICON("trial_key"), v: "sefer" });
  btns.push({ text: "§lRobotları taşı§r\n§7Yakındaki robotları başka yere götürür", icon: robotIcon("madenci", 1), v: "tasi" });
  btns.push({ text: "§lBirini takip et§r\n§7Başka bir Keşif'in, robotun ya da oyuncunun hemen arkasından gelir", icon: ICON("lead"), v: "takip" });
  const depo = depoSay(e);
  if (depo) btns.push({ text: `§lMatkap deposu§r\n§7${depo} eşya: bana ver`, icon: ICON("chest"), v: "depo" });
  btns.push({ text: "Araç ol (kendin sür)", icon: ICON("rail"), v: "arac" });
  btns.push({ text: "Eve dön", icon: ICON("bed"), v: "eve" });
  btns.push({ text: "İsim ver", icon: ICON("name_tag"), v: "isim" });
  btns.push({ text: "Topla (eşyaya çevir)", icon: "textures/items/robot_kesif", v: "topla" });
  const r = await menu(pl, `§l${k.name}`, body, btns);
  if (!r || !k.valid) return;
  switch (r.v) {
    case "dur":
      k.task && (k.task.done = true);
      k.saveTask();
      return basla(k, eveDon(k), "Tamam, görevi bırakıp eve dönüyorum.");
    case "yapi": return yapiMenu(pl, k);
    case "biyom": return biyomMenu(pl, k);
    case "kesfet": return kesfetMenu(pl, k);
    case "yerler": return yerlerMenu(pl, k);
    case "gotur": return goturMenu(pl, k);
    case "tasi": return tasiMenu(pl, k);
    case "takip": {
      const h = await takipHedefiSec(pl, k.e.id, `${k.name} · birini takip et`);
      if (!h || !k.valid) return;
      return basla(k, takipEt(k, h.bul, h.ad), `${h.ad} adlı hedefi takip ediyorum; hemen arkasından geleceğim.`);
    }
    case "sefer": return seferMenu(pl, k);
    case "arac": return aracMenu(pl, e);
    case "depo": {
      const d = depoOku(e);
      const inv = safe(() => pl.getComponent("minecraft:inventory")?.container);
      let n = 0;
      for (const [id, say] of Object.entries(d)) {
        let left = say;
        while (left > 0) {
          const max = safe(() => new ItemStack(id, 1).maxAmount, 0);
          const st = max ? safe(() => new ItemStack(id, Math.min(left, max))) : null;
          if (!st) break;
          const amt = st.amount;
          const rest = inv ? safe(() => inv.addItem(st)) : st;
          if (rest) safe(() => pl.dimension.spawnItem(rest, pl.location));
          left -= amt;
          n += amt;
        }
      }
      depoYaz(e, {});
      return k.say(`Matkap deposunu sana verdim (${n} eşya).`, { force: true });
    }
    case "eve": return basla(k, eveDon(k), "Eve dönüyorum.");
    case "isim": {
      const v = await modal(pl, "İsim ver", [{ type: "text", label: "Keşif'in yeni adı", value: k.name }], "Kaydet");
      const ad = String(v?.[0] ?? "").trim().slice(0, 24);
      if (!ad) return;
      k.name = ad;
      setProp(e, "aq:name", ad);
      e.nameTag = ad;
      k.updateIndex(true);
      return;
    }
    case "topla":
      if (await confirm(pl, "Keşif'i topla", `§f${k.name}§r eşyaya dönüşsün mü?`, "Topla")) collect(e, pl);
      return;
  }
}

export function gorevVer(k, task, msg) {
  if (k.job) {
    k.say("Önceki görevi bıraktım.");
  }
  k.task = { ...task, done: false, t: Date.now() };
  k.saveTask();
  basla(k, gorevIsi(k), msg);
}

const UZAK = [500, 1000, 2000, 4000];
async function uzaklik(pl, title, def = 1) {
  const v = await modal(pl, title, [
    { type: "dropdown", label: "En çok ne kadar uzağa baksın?", items: UZAK.map((u) => `${u} blok`), value: def },
    { type: "dropdown", label: "Bulunca", items: ["Konumu gönder, eve dön", "Konumu gönder, orada beklesin"], value: 0 },
  ], "Başla");
  if (!v) return undefined;
  return { max: UZAK[v[0]] ?? 1000, bekle: v[1] === 1 };
}

async function yapiMenu(pl, k) {
  const list = Object.entries(YAPI).filter(([, s]) => s.dims.includes(k.dim.id));
  if (!list.length) return pl.sendMessage("§7Bu boyutta aranacak yapı yok.");
  const r = await menu(pl, "Keşif · yapı bul", "Hangi yapıyı arayayım? Önce bildiklerime bakarım.",
    list.map(([key, s]) => {
      const y = Yerler.enYakin(k.owner, key, k.dim.id, k.loc);
      return { text: `§l${s.ad}§r${y ? `\n§a✔ biliniyor · ${Math.round(V.hdist(y.pos, k.loc))} blok` : s.alti ? "\n§7yer altında" : ""}`,
        icon: ikon(key), key };
    }));
  if (!r) return;
  const o = await uzaklik(pl, `Keşif · ${YAPI[r.key].ad}`, 1);
  if (!o) return;
  gorevVer(k, { is: "yapi", tur: r.key, ...o }, `${YAPI[r.key].ad} aramaya çıkıyorum!`);
}

async function biyomMenu(pl, k) {
  const nether = k.dim.id.includes("nether");
  const list = Object.entries(BIYOM).filter(([b]) => NETHER_B.has(b) === nether);
  const r = await menu(pl, "Keşif · biyom bul", "Hangi biyomu bulayım?",
    list.map(([b, ad]) => ({ text: `${ad}${ALTI_B.has(b) ? "\n§7yer altında" : ""}`, b })));
  if (!r) return;
  const o = await uzaklik(pl, `Keşif · ${BIYOM[r.b]}`, 2);
  if (!o) return;
  gorevVer(k, { is: "biyom", biyom: r.b, max: o.max, bekle: o.bekle }, `${BIYOM[r.b]} aramaya çıkıyorum!`);
}

async function kesfetMenu(pl, k) {
  const R = [128, 256, 512, 1024];
  const v = await modal(pl, "Keşif · çevreyi keşfet", [
    { type: "dropdown", label: "Ne kadar geniş bir alan?", items: R.map((x) => `${x} blok çevre`), value: 1 },
  ], "Başla");
  if (!v) return;
  gorevVer(k, { is: "kesfet", yaricap: R[v[0]] ?? 256 }, "Keşfe çıkıyorum!");
}

function yerAdi(y) {
  return `${y.ad} §7(${y.pos.x}, ${y.pos.y}, ${y.pos.z})`;
}

async function yerlerMenu(pl, k) {
  const list = Yerler.list(k.owner).filter((y) => y.dim === k.dim.id)
    .sort((a, b) => V.hdist(a.pos, pl.location) - V.hdist(b.pos, pl.location));
  if (!list.length) return pl.sendMessage("§7Henüz bilinen yer yok. Keşif'e yapı ya da biyom buldur.");
  const r = await menu(pl, "Bilinen yerler", "En yakından uzağa.", list.slice(0, 60).map((y) => ({
    text: `§l${y.ad}§r\n§7${Math.round(V.hdist(y.pos, pl.location))} blok · ${y.kim ?? ""}`,
    icon: YAPI[y.tur] ? ikon(y.tur) : ICON("compass"), y })));
  if (!r) return;
  const a = await menu(pl, r.y.ad, yerAdi(r.y), [
    { text: "Konumunu gönder", icon: ICON("compass"), v: "pin" },
    { text: "§lBeni oraya götür", icon: ICON("elytra"), v: "git" },
    { text: "§cListeden sil", v: "sil" },
  ]);
  if (!a) return;
  if (a.v === "pin") bildir(k, r.y, `${r.y.ad}:`);
  else if (a.v === "git") return bindirVeGotur(pl, k, r.y.pos, r.y.ad);
  else if (a.v === "sil") Yerler.sil(k.owner, r.y.id);
}

export async function hedefSec(pl, k, title) {
  const btns = [];
  for (const y of Yerler.list(k.owner).filter((y) => y.dim === k.dim.id).slice(-12).reverse()) {
    btns.push({ text: `${y.ad}\n§7${Math.round(V.hdist(y.pos, pl.location))} blok`, icon: YAPI[y.tur] ? ikon(y.tur) : ICON("compass"), p: y.pos, ad: y.ad });
  }
  if (k.home) btns.push({ text: "Keşif'in evi", icon: ICON("bed"), p: k.home, ad: "Ev" });
  for (const b of bots.values()) {
    if (b.owner !== pl.id || !b.valid || b.dim.id !== k.dim.id) continue;
    btns.push({ text: `${b.name}\n§7${TYPE_NAME[b.type] ?? ""} · ${Math.round(V.dist(b.loc, pl.location))} blok`,
      icon: robotIcon(b.type, b.model), p: { ...b.loc }, ad: b.name });
  }
  btns.push({ text: "Koordinat yaz", icon: ICON("writable_book"), v: "xyz" });
  const r = await menu(pl, title, "Nereye?", btns);
  if (!r) return undefined;
  if (r.v === "xyz") {
    const v = await modal(pl, "Koordinat", [
      { type: "text", label: "X", value: String(Math.floor(pl.location.x)) },
      { type: "text", label: "Y (bilmiyorsan boş bırak)", value: "" },
      { type: "text", label: "Z", value: String(Math.floor(pl.location.z)) },
    ], "Git");
    if (!v) return undefined;
    const x = Number(v[0]), z = Number(v[2]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
    const y = v[1] === "" || !Number.isFinite(Number(v[1])) ? 70 : Number(v[1]);
    return { p: { x, y, z }, ad: `${x}, ${z}` };
  }
  return r;
}

async function goturMenu(pl, k) {
  const h = await hedefSec(pl, k, "Keşif · beni götür");
  if (!h) return;
  return bindirVeGotur(pl, k, h.p, h.ad);
}

export async function bindirVeGotur(pl, k, hedef, ad) {
  if (V.dist(pl.location, k.loc) > 8) return pl.sendMessage("§cKeşif'in yanına gel (8 blok içinde), sonra seçince bineceksin.");
  k.job = null;
  const su = yuzey(k.dim, k.loc.x, k.loc.z)?.water && yuzey(k.dim, hedef.x, hedef.z)?.water;
  transform(k.e, su ? "gemi" : "ucak", pl);
  system.runTimeout(() => {
    safe(() => k.e.getComponent("minecraft:rideable")?.addRider(pl));
    basla(k, gotur(k, hedef, ad), `Bin bakalım! ${ad} yerine gidiyoruz (${Math.round(V.hdist(hedef, k.loc))} blok).`);
  }, 32);
}

async function tasiMenu(pl, k) {
  const yakin = [...bots.values()].filter((b) => b.owner === pl.id && b.valid && b.dim.id === k.dim.id
    && V.dist(b.loc, k.loc) < 24 && b.type !== "kilicli");
  if (!yakin.length) return pl.sendMessage("§7Keşif'in 24 blok yakınında taşınacak robot yok.");
  const sec = new Set();
  for (;;) {
    const btns = [{ text: sec.size ? `§l§2Devam ▶§r §8(${sec.size} robot)` : "§8Devam ▶ (önce robot seç)", v: "ok" }];
    for (const b of yakin) btns.push({ text: `${sec.has(b.id) ? "§2✔ §l" : "§8"}${b.name}§r\n§7${TYPE_NAME[b.type]}`, icon: robotIcon(b.type, b.model), b });
    const r = await menu(pl, "Keşif · robot taşı", "En çok 10 robot: koltuklara, kanatlara, üstüne oturur; kalanlar içeri girer.", btns);
    if (!r) return;
    if (r.v === "ok") {
      if (sec.size) break;
      continue;
    }
    if (sec.has(r.b.id)) sec.delete(r.b.id);
    else if (sec.size < KAPASITE) sec.add(r.b.id);
  }
  const h = await hedefSec(pl, k, "Keşif · robotlar nereye?");
  if (!h) return;
  const o = await menu(pl, "Vardıklarında", "Robotlar orada ne yapsın?", [
    { text: "§lOrada kalsınlar§r\n§7Yeni evleri orası olur", v: true },
    { text: "Bıraksın, eve yürüsünler", v: false },
  ]);
  if (!o) return;
  tasiBaslat(k, yakin.filter((b) => sec.has(b.id)), h.p, h.ad, o.v);
}

/** Robotları taşıma işini başlatır (Organizatör de kullanabilir). */
export function tasiBaslat(k, list, hedef, ad, yeniEv) {
  k.job = null;
  basla(k, robotTasi(k, list, hedef, ad, yeniEv));
}
