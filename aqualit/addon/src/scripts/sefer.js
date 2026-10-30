// Aqualit Robotları — Sefer: Keşif bir robot ekibini bir yapıya götürür, ekip iş görür, birlikte döner.
// Örnek: "Kılıçlı-4, Kılıçlı-2, Madenci-3: Keşif'e binin, en yakın deneme odasına gidin, sandıkları yağmalayın,
// mobları öldürün, anahtarlarla kasaları açın, Keşif'le geri dönün." (Organizatör yazılı komutu bunu kurar.)
//
// Aşamalar: hedefi bul (bilinen yer ya da Keşif arar) → toplan → bin (5 koltuk; fazlası için birkaç sefer)
// → git → in → Kılıçlılar bölgeyi korur, iş robotları yağmalar → bin → eve dön → sandığa koy.
// Not: Deneme odası çıkarıcıları (trial spawner) yalnız oyuncu yakındayken mob çıkarır ve anahtar düşürür.
import { V, wait } from "./util.js";
import { bots } from "./brain.js";
import { YAPI } from "./yapi_bilgi.js";
import { kesifler, ikon, yapiBul, gotur, uc, in_, robotlariBindir, robotlariIndir, basla } from "./kesif_ai.js";
import { Yerler } from "./harita.js";
import { yapiIsleri, yagmaOzet } from "./yagma.js";
import { guardZone, setMode } from "./kilicli.js";
import { keepFor } from "./jobs.js";
import { menu, confirm } from "./ui/forms.js";
import { TYPE_NAME, robotIcon } from "./constants.js";

const KOLTUK = 10;                    // Keşif en çok 10 robot alır (koltuk + kanat + üstü + içi)
const IS_AD = { yagma: "yağmalıyor", tuzak_tnt: "TNT tuzağını söküyor", tuzak_ip: "tel tuzaklarını kesiyor",
  arkeoloji: "arkeoloji yapıyor", altin: "altın blokları söküyor", sunger: "sünger topluyor", sigil: "Nether siğili topluyor",
  kemik: "kemik söküyor", ametist: "ametist topluyor", vagon: "vagonları boşaltıyor" };
const IS_SURESI = 20 * 60 * 12;       // yapıda en çok 12 dakika
export const seferler = new Map();     // Keşif rid -> sefer

function grup(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Robotun seferdeki işi: aşamaya göre bekler, yürür, yağmalar. */
function* uyeIsi(S, b) {
  b.setMove("none");
  for (;;) {
    if (S.bitti) return;
    const a = S.asama;
    if (a === "toplan" && !b._binmis && S.toplanma && V.hdist(b.loc, S.toplanma) > 4) {
      b.setStatus("Keşif'e yürüyor");
      yield* b.travelTo(S.toplanma, { near: 3 });
      b.setAct("wave");
      yield* wait(20);
      b.setAct("none");
    }
    if (a === "calis" && !b._isBitti && b.type !== "kilicli") {
      b.setStatus("Seferde: çalışıyor");
      const say = yield* yapiIsleri(b, S.yer, S.r, { sefer: true, sessiz: b !== S.ekip.find((x) => x.type !== "kilicli") });
      b._ozet = say;
      b._isBitti = true;
      b.setStatus("Seferde: Keşif'i bekliyor");
      // Keşif'in yanına dön
      yield* b.travelTo(S.inis ?? S.yer.pos, { near: 3 });
    }
    yield* wait(10);
  }
}

/** Sefer yöneticisi (Keşif'in işi). */
function* seferIsi(S) {
  const k = S.k;
  const say = (t, o) => k.say(t, o);
  try {
    // 1) hedef
    if (!S.yer) {
      if (S.tur) {
        k.setStatus(`Sefer: ${YAPI[S.tur].ad} arıyor`);
        const yer = yield* yapiBul(k, { tur: S.tur, max: S.max ?? 2000 });
        if (!yer) {
          say(`Sefer iptal: ${YAPI[S.tur].ad.toLowerCase()} bulamadım.`, { force: true });
          return;
        }
        S.yer = yer;
      }
    }
    // 2) toplanma: Keşif evine (ya da ilk robota) döner, ekip yanına gelir
    S.toplanma = k.home ?? { ...S.ekip[0].loc };
    if (V.hdist(k.loc, S.toplanma) > 6) {
      k.setStatus("Sefer: ekibin yanına dönüyor");
      yield* uc(k, S.toplanma, { near: 2 });
      yield* in_(k);
    }
    S.asama = "toplan";
    for (const b of S.ekip) {
      b._binmis = false;
      b._isBitti = false;
      b._oncekiMod = b.type === "kilicli" ? b.mode : undefined;
      b._oncekiZon = b.type === "kilicli" ? b.zone : undefined;
      if (b.type === "kilicli") setMode(b, "stay", true);
      b.job = uyeIsi(S, b);
      b.jobName = "sefer";
    }
    say(`Sefer başlıyor: ${S.ekip.map((b) => b.name).join(", ")} → ${S.yer.ad}. Herkes yanıma gelsin!`, { force: true });
    k.setStatus("Sefer: ekibi bekliyor");
    for (let t = 0; t < 20 * 90; t++) {
      if (S.ekip.every((b) => !b.valid || V.hdist(b.loc, k.loc) < 7)) break;
      yield;
    }
    // 3) gidiş (gerekirse birkaç sefer)
    S.asama = "git";
    S.inis = undefined;
    const gruplar = grup(S.ekip.filter((b) => b.valid), KOLTUK);
    for (let gi = 0; gi < gruplar.length; gi++) {
      const g = gruplar[gi];
      if (gi > 0) {
        k.setStatus("Sefer: kalanları almaya dönüyor");
        yield* uc(k, S.toplanma, { near: 2 });
        yield* in_(k);
        for (let t = 0; t < 20 * 30 && !g.every((b) => V.hdist(b.loc, k.loc) < 7); t++) yield;
      }
      const n = yield* robotlariBindir(k, g);
      for (const b of g) {
        b._binmis = true;
        b.job = uyeIsi(S, b);            // yarım kalan yürüyüş inince sürmesin
      }
      k.setStatus(`Sefer: ${n} robotla ${S.yer.ad} yerine uçuyor`);
      yield* gotur(k, S.yer.pos, S.yer.ad);
      robotlariIndir(k, g, false);
      S.inis ??= { ...k.loc };
    }
    // 4) iş: Kılıçlılar bölgeyi korur, diğerleri yağmalar
    S.asama = "calis";
    for (const b of S.ekip) {
      if (!b.valid) continue;
      if (b.type === "kilicli") {
        guardZone(b, S.yer.pos, Math.max(12, S.r));
        b.say("Bölgeyi koruyorum, mobları temizliyorum.");
      }
    }
    const bilgi = YAPI[S.yer.tur];
    say(`${S.yer.ad} yerindeyiz! Kılıçlılar koruyor${bilgi?.kilicli?.length ? ` (${bilgi.kilicli.slice(0, 3).join(", ")})` : ""}, diğerleri `
      + `${(bilgi?.isler ?? ["yagma"]).map((i) => IS_AD[i] ?? i).join(", ")}.${bilgi?.not ? ` ${bilgi.not}` : ""}`, { force: true });
    k.setStatus("Sefer: ekip çalışıyor");
    const isciler = S.ekip.filter((b) => b.type !== "kilicli");
    for (let t = 0; t < IS_SURESI; t++) {
      if (isciler.every((b) => !b.valid || b._isBitti)) break;
      if (t % 200 === 0) k.updateIndex();
      yield;
    }
    // 5) dönüş
    S.asama = "don";
    for (const b of S.ekip) {
      if (b.type === "kilicli" && b.valid) setMode(b, "stay", true);
    }
    // ekip Keşif'in yanına gelsin
    for (const b of S.ekip) if (b.valid && b.type === "kilicli") b.job = (function* () { yield* b.travelTo(k.loc, { near: 3 }); })();
    for (let t = 0; t < 20 * 60 && !S.ekip.every((b) => !b.valid || V.hdist(b.loc, k.loc) < 7); t++) yield;
    const evGrup = grup(S.ekip.filter((b) => b.valid), KOLTUK);
    for (let gi = 0; gi < evGrup.length; gi++) {
      const g = evGrup[gi];
      if (gi > 0) {
        yield* uc(k, S.inis ?? S.yer.pos, { near: 2 });
        yield* in_(k);
        for (let t = 0; t < 20 * 30 && !g.every((b) => V.hdist(b.loc, k.loc) < 7); t++) yield;
      }
      yield* robotlariBindir(k, g);
      for (const b of g) if (b.type !== "kilicli") b.job = uyeIsi(S, b);
      k.setStatus("Sefer: eve dönüyor");
      yield* gotur(k, S.toplanma, "Ev");
      robotlariIndir(k, g, false);
    }
    // özet
    const top = { kap: 0, comlek: 0, kasa: 0, esya: 0 };
    for (const b of S.ekip) for (const key of Object.keys(top)) top[key] += b._ozet?.[key] ?? 0;
    say(`Sefer bitti, hepimiz döndük. Ekip ${yagmaOzet(top)}`, { force: true });
  } finally {
    S.bitti = true;
    seferler.delete(k.rid);
    // robotlar normal hayatlarına: iş robotları eve gidip ganimeti sandığa koyar, Kılıçlılar eski moduna
    for (const b of S.ekip) {
      if (!b.valid) continue;
      b._binmis = false;
      if (b.type === "kilicli") {
        if (b._oncekiMod === "guard" && b._oncekiZon) guardZone(b, b._oncekiZon, b._oncekiZon.r);
        else setMode(b, b._oncekiMod ?? "follow", true);
      } else {
        b.job = (function* () {
          yield* b.goHome();
          yield* b.deposit(keepFor(b));
          b.setStatus("Bekliyor");
        })();
        b.jobName = "donus";
      }
    }
    k.setStatus("Bekliyor");
  }
}

/**
 * Seferi başlatır.
 * o: {k: Keşif, ekip: [Bot], tur?: yapı türü, yer?: {pos, ad, tur}, r?: çalışma yarıçapı, max?: arama uzaklığı}
 */
export function seferBaslat(o) {
  const k = o.k;
  if (!k?.valid) return "Keşif bulunamadı.";
  if (seferler.has(k.rid)) return `${k.name} zaten seferde.`;
  const ekip = (o.ekip ?? []).filter((b) => b?.valid && b.owner === k.owner && b.dim.id === k.dim.id);
  if (!ekip.length) return "Sefere katılacak robot yok (aynı boyutta ve yüklü olmalı).";
  const S = { k, ekip, tur: o.tur, yer: o.yer, r: o.r ?? (o.tur === "deneme_odasi" || o.yer?.tur === "deneme_odasi" ? 40 : 28),
    max: o.max, asama: "hazir", bitti: false };
  seferler.set(k.rid, S);
  k.job = null;
  basla(k, seferIsi(S));
  return null;
}

/** Sahibin seferde olmayan, yüklü bir Keşif'i (en yakın). */
export function bosKesif(owner, pos) {
  let best, bd = Infinity;
  for (const k of kesifler.values()) {
    if (!k.valid || k.owner !== owner || seferler.has(k.rid) || k.job) continue;
    const d = pos ? V.dist(k.loc, pos) : 0;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// ======================================================================= menü (Keşif → Sefer düzenle)

export async function seferMenu(pl, k) {
  const aday = [...bots.values()].filter((b) => b.owner === pl.id && b.valid && b.dim.id === k.dim.id && b.type !== "insaatci")
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!aday.length) return pl.sendMessage("§7Bu boyutta yüklü robotun yok.");
  const sec = new Set();
  for (;;) {
    const btns = [{ text: sec.size ? `§l§2Devam ▶§r §8(${sec.size} robot)` : "§8Devam ▶ (önce ekibi seç)", v: "ok" }];
    for (const b of aday) {
      btns.push({ text: `${sec.has(b.id) ? "§2✔ §l" : "§8"}${b.name}§r\n§7${TYPE_NAME[b.type]} · ${Math.round(V.dist(b.loc, k.loc))} blok`,
        icon: robotIcon(b.type, b.model), b });
    }
    const r = await menu(pl, "Sefer · ekip", "Kılıçlılar bölgeyi korur, diğerleri yağmalar. 5'ten fazlası için Keşif birkaç kez gidip gelir.", btns);
    if (!r) return;
    if (r.v === "ok") {
      if (sec.size) break;
      continue;
    }
    if (sec.has(r.b.id)) sec.delete(r.b.id);
    else sec.add(r.b.id);
  }
  const ekip = aday.filter((b) => sec.has(b.id));
  const hedefBtn = [];
  for (const y of Yerler.list(k.owner).filter((y) => y.dim === k.dim.id && YAPI[y.tur])) {
    hedefBtn.push({ text: `§l${y.ad}§r\n§7bilinen yer · ${Math.round(V.hdist(y.pos, k.loc))} blok`, icon: ikon(y.tur), yer: y });
  }
  for (const [tur, s] of Object.entries(YAPI)) {
    if (!s.dims.includes(k.dim.id)) continue;
    hedefBtn.push({ text: `En yakın ${s.ad.toLowerCase()}\n§7Keşif önce bulur`, icon: ikon(tur), tur });
  }
  const h = await menu(pl, "Sefer · hedef", "Nereye gidelim?", hedefBtn);
  if (!h) return;
  const ad = h.yer ? h.yer.ad : `en yakın ${YAPI[h.tur].ad.toLowerCase()}`;
  const plan = [
    h.yer ? `1. ${ad} yerine gideceğiz.` : `1. ${k.name} ${ad} yerini bulacak.`,
    `2. ${ekip.map((b) => b.name).join(", ")} ${k.name}'e binecek${ekip.length > KOLTUK ? ` (${Math.ceil(ekip.length / KOLTUK)} seferde)` : ""}.`,
    `3. Kılıçlılar bölgeyi koruyacak, diğerleri sandık/fıçı/çömlek/kasa yağmalayacak, anahtar toplayacak.`,
    `4. Hep birlikte dönüp ganimeti sandıklara koyacağız.`,
  ].join("\n");
  if (!(await confirm(pl, "Sefer planı", `Şunları sırayla yapacağız:\n\n${plan}`, "Başla", "Vazgeç"))) return;
  const err = seferBaslat({ k, ekip, yer: h.yer, tur: h.tur });
  if (err) pl.sendMessage(`§c${err}`);
}
