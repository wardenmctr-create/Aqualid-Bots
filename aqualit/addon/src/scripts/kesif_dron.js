// Aqualit Robotları — mini Keşif dronları (v0.3.5)
// Keşif yerinde durur; dronlar Keşif'ten çıkıp dört yöne açılır, geniş alanı yığın yığın tarar (yapı imzası, biyom
// haritası), buldukları yeri Keşif'e bildirir ve geri dönüp içine girer. Telefonda uzak yığınlar yüklü olmadığı için her
// dron yanında küçük bir işleme alanı (tickingarea) taşır; alan yüklenince altındaki yığınları tarar.
import { world, system } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import { Harita } from "./harita.js";

export const DRON = "aqualit:kesif_dron";
const HIZ = 1.6;               // dron hızı (blok/tik)
const ARALIK = 48;             // halkalar arası (3 yığın: işleme alanı 3x3 yığın tarar)
const TIK_TARAMA = 1;          // tik başına en çok taranan yığın (bütün dronlar toplam; telefonda tik kısa kalsın)
const EN_COK = 100;            // dron sınırı yok gibi: alan büyüdükçe Keşif daha çok dron gönderir
const canli = new Set();       // çalışan dron varlık kimlikleri (yeniden yüklemede sahipsizler silinir)

/** Bir dronun izleyeceği yol: kendi diliminde halka halka, yılan gibi (bir gidiş bir dönüş). */
function yolYap(merkez, yaricap, i, n) {
  const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
  const out = [];
  let yon = 1;
  for (let r = ARALIK; r <= yaricap; r += ARALIK) {
    const adim = Math.max(1, Math.ceil(((a1 - a0) * r) / ARALIK));
    const noktalar = [];
    for (let j = 0; j <= adim; j++) {
      const a = a0 + ((a1 - a0) * j) / adim;
      noktalar.push({ x: merkez.x + Math.cos(a) * r, z: merkez.z + Math.sin(a) * r });
    }
    if (yon < 0) noktalar.reverse();
    out.push(...noktalar);
    yon = -yon;
  }
  return out;
}

function alanKur(d, dim, id) {
  const tam = safe(() => world.tickingAreaManager);
  if (!tam) return false;
  const c = { x: Math.floor(d.e.location.x / 16), z: Math.floor(d.e.location.z / 16) };
  if (d.alan && d.alan.x === c.x && d.alan.z === c.z) return true;
  safe(() => tam.removeTickingArea(id));
  const o = { dimension: dim, from: { x: (c.x - 1) * 16, y: 0, z: (c.z - 1) * 16 }, to: { x: (c.x + 1) * 16 + 15, y: 0, z: (c.z + 1) * 16 + 15 } };
  if (!safe(() => tam.hasCapacity(o), true)) return false;
  safe(() => tam.createTickingArea(id, o));
  d.alan = c;
  return true;
}
function alanSil(id) {
  safe(() => world.tickingAreaManager?.removeTickingArea(id));
}
function parla(dim, p) {
  safe(() => dim.spawnParticle("minecraft:basic_crit_particle", p));
  safe(() => dim.spawnParticle("minecraft:villager_happy", p));
}

/**
 * Dronları çıkarıp tarar. o: { merkez, yaricap, turler: [yapı türü], tara(dim,cx,cz,turler) -> {tur,pos}|null,
 *   hepsi: true ise bulduğunda durmaz (keşif), bulunca(f), n: dron sayısı (en çok 4), durum(yuzde, n) }
 * Dönen: bulunanlar dizisi.
 */
export function* dronTara(k, o) {
  const dim = k.dim;
  const merkez = { x: o.merkez?.x ?? k.loc.x, y: o.merkez?.y ?? k.loc.y, z: o.merkez?.z ?? k.loc.z };
  const R = o.yaricap ?? 256;
  // dron sayısı alanla büyür (her dron ~64 blokluk dilim); uzak yığın yükletme izni (en çok 10) sırayla kullanılır
  let n = Math.max(1, Math.min(EN_COK, o.n ?? Math.max(4, Math.round(R / 48))));
  const bulunan = [];
  const dronlar = [];
  const yukseklik = Math.max(merkez.y, k.loc.y) + 24;
  for (let i = 0; i < n; i++) {
    const e = safe(() => dim.spawnEntity(DRON, { x: k.loc.x, y: k.loc.y + 1.5, z: k.loc.z }));
    if (!e) continue;
    canli.add(e.id);
    safe(() => e.setDynamicProperty("aq:kesif", k.e.id));
    dronlar.push({ e, i, yol: yolYap(merkez, R, i, n), j: 0, alanId: `aqd_${k.rid}_${i}`, kuyruk: [], bakildi: new Set(), bitti: false, alan: null });
    if (i % 4 === 0) parla(dim, k.loc);
    yield* wait(i < 8 ? 3 : 1);
  }
  n = dronlar.length;
  if (!n) return bulunan;
  safe(() => dim.playSound("aqualit.kesif.sonar", k.loc, { volume: 0.8 }));
  k.say(`${n} mini dron çıkardım; ${R} blok çevreyi tarıyorlar.`, { force: true });
  const toplam = dronlar.reduce((a, d) => a + d.yol.length, 0);
  let dur = false;
  for (let t = 0; !dur && dronlar.some((d) => !d.bitti); t++) {
    let tarandi = 0;
    for (const d of dronlar) {
      if (d.bitti || !safe(() => d.e.isValid, false)) { d.bitti = true; continue; }
      // 1) yol üzerinde ilerle (yüksekten)
      const hedef = d.yol[d.j];
      if (!hedef) {
        d.bitti = true;
        alanSil(d.alanId);
        d.alan = null;
        continue;
      }
      const l = d.e.location;
      const dx = hedef.x - l.x, dz = hedef.z - l.z;
      const hd = Math.hypot(dx, dz);
      // bulunduğu yer yüklenmeden ilerlemez (tarama atlanmasın)
      // senin çevrendeki yüklü yerlerde izin gerekmez; uzakta yükletme izni alır (yoksa sırasını bekler)
      const yukluMu = () => safe(() => dim.isChunkLoaded({ x: l.x, y: 64, z: l.z }), true);
      let yuklu = !d.alan && yukluMu();
      if (!yuklu) yuklu = alanKur(d, dim, d.alanId) && yukluMu();
      if (yuklu) {
        // altındaki 3x3 yığını sıraya koy
        const c = { x: Math.floor(l.x / 16), z: Math.floor(l.z / 16) };
        for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
          const key = `${c.x + ax},${c.z + az}`;
          if (d.bakildi.has(key)) continue;
          d.bakildi.add(key);
          d.kuyruk.push([c.x + ax, c.z + az]);
        }
      }
      if (hd < HIZ + 0.1) d.j++;
      else if (yuklu) {
        const step = Math.min(HIZ, hd);
        const ny = l.y + Math.max(-0.5, Math.min(0.5, yukseklik - l.y));
        safe(() => d.e.teleport({ x: l.x + (dx / hd) * step, y: ny, z: l.z + (dz / hd) * step }, { rotation: { x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI } }));
      }
      // 2) sıradaki yığını tara (tik başına sınırlı)
      if (tarandi < TIK_TARAMA && d.kuyruk.length) {
        const [cx, cz] = d.kuyruk.shift();
        tarandi++;
        const f = o.tara(dim, cx, cz, o.turler);
        const bp = { x: cx * 16 + 8, y: 64, z: cz * 16 + 8 };
        const b = safe(() => dim.getBiome(bp));
        if (b && k.owner) safe(() => Harita.kaydet(k.owner, dim.id, bp, b.id ?? b, null));
        if (f && !bulunan.some((x) => x.tur === f.tur && V.hdist(x.pos, f.pos) < 48)) {
          bulunan.push(f);
          parla(dim, d.e.location);
          safe(() => dim.playSound("random.orb", d.e.location, { volume: 1, pitch: 1.5 }));
          o.bulunca?.(f, d);
          if (!o.hepsi) dur = true;
        }
      }
    }
    if (t % 40 === 0) {
      const yapilan = dronlar.reduce((a, d) => a + Math.min(d.j, d.yol.length), 0);
      o.durum?.(Math.round((100 * yapilan) / Math.max(1, toplam)), n);
    }
    yield;
  }
  // geri dön ve Keşif'e gir
  k.setStatus("Dronlar dönüyor");
  for (let t = 0; t < 20 * 60 && dronlar.some((d) => !d.dondu); t++) {
    for (const d of dronlar) {
      if (d.dondu || !safe(() => d.e.isValid, false)) { d.dondu = true; continue; }
      const l = d.e.location;
      const kl = k.loc;
      const dx = kl.x - l.x, dy = kl.y + 1 - l.y, dz = kl.z - l.z;
      const dd = Math.hypot(dx, dy, dz);
      if (dd < 2.5) {
        parla(dim, l);
        safe(() => d.e.remove());
        canli.delete(d.e.id);
        alanSil(d.alanId);
        d.dondu = true;
        continue;
      }
      const step = Math.min(dd > 64 ? 6 : 2, dd);
      safe(() => d.e.teleport({ x: l.x + (dx / dd) * step, y: l.y + (dy / dd) * step, z: l.z + (dz / dd) * step }));
    }
    yield;
  }
  for (const d of dronlar) {
    safe(() => d.e.isValid && d.e.remove());
    canli.delete(d.e.id);
    alanSil(d.alanId);
  }
  return bulunan;
}

// dünya yeniden yüklenince yarıda kalan dronlar silinir
world.afterEvents.entityLoad?.subscribe((ev) => {
  const e = ev.entity;
  if (safe(() => e.typeId) !== DRON) return;
  if (!canli.has(e.id)) system.run(() => safe(() => e.remove()));
});
