// Aqualit Robotları — Aqualit Telefon ve Organizatör menüsü (v0.4.0)
// Yazıyla görev: telefon (ya da Organizatör'e dokununca) → yaz → dil.js anlar → yazım hatası varsa "Şunu mu demek
// istedin?" → plan gösterilir (gerekirse onay) → organizator.js robotlara dağıtır, zincirleri ve koşulları izler.
import { world, system } from "@minecraft/server";
import { safe, V } from "./util.js";
import { menu, modal, confirm } from "./ui/forms.js";
import { anla, adimYazi, YARDIM, turAdi, sade } from "./dil.js";
import * as ORG from "./organizator.js";
import { bots, startTask } from "./brain.js";
import { kesifListesi, gorevVer as kesifGorev, basla, eveDon, takipEt } from "./kesif_ai.js";
import { seferBaslat, bosKesif } from "./sefer.js";
import { yapiAra, chooseSite } from "./mimar.js";
import { YAPI } from "./yapi_bilgi.js";
import { robotIcon } from "./constants.js";

const ICON = {
  yaz: "textures/items/writable_book", tekrar: "textures/items/clock_item", zincir: "textures/items/paper",
  ara: "textures/items/compass_item", duzen: "textures/blocks/barrel_side", durum: "textures/items/map_filled",
  ozet: "textures/items/book_normal", yardim: "textures/items/book_written", gecmis: "textures/items/book_portfolio",
};

// ======================================================================= Organizatör'ün dış işleri (Keşif, Mimar, sefer)
ORG.bagla({
  kesifListesi,
  kesifEveDon: (k) => basla(k, eveDon(k), "Eve dönüyorum."),
  kesifTakip: (k, pl) => basla(k, takipEt(k, () => pl, pl.name), `${pl.name} adlı oyuncuyu takip ediyorum.`),
  sefer(pl, a, robotlar) {
    const ekip = robotlar.filter((b) => !b.e || b.e.typeId === "aqualit:robot").filter((b) => b.type);
    const k = robotlar.find((b) => b.e?.typeId === "aqualit:kesif") ?? bosKesif(pl.id, pl.location);
    if (!k) return ORG.konus(pl.id, "Sefer için boşta bir Keşif yok.");
    const err = seferBaslat({ k, ekip, tur: a.yapi });
    if (err) return ORG.konus(pl.id, `Sefer başlamadı: ${err}`);
    ORG.konus(pl.id, `${k.name} ile sefer başladı: ${ekip.map((b) => b.name).join(", ")} → ${YAPI[a.yapi]?.ad ?? a.yapi}.`);
    return ekip.map((b) => b.id);
  },
  kesif(pl, a, robotlar) {
    const k = robotlar.find((b) => b.e?.typeId === "aqualit:kesif") ?? bosKesif(pl.id, pl.location);
    if (!k) return ORG.konus(pl.id, "Boşta bir Keşif yok.");
    if (a.eylem === "kesfet" || !a.yapi) {
      kesifGorev(k, { is: "kesfet", yaricap: 256 }, "Çevreyi keşfe çıkıyorum.");
      return [];
    }
    kesifGorev(k, { is: "yapi", tur: a.yapi, max: 3000 }, `${YAPI[a.yapi]?.ad ?? a.yapi} arıyorum.`);
    return [];
  },
  async insa(pl, a, robotlar) {
    const mimar = robotlar.find((b) => b.type === "insaatci")
      ?? [...bots.values()].find((b) => b.valid && b.owner === pl.id && b.type === "insaatci" && ORG.bosta(b));
    if (!mimar) return ORG.konus(pl.id, "Boşta bir Mimar yok.");
    const ad = (a.yapiAdi || "").trim();
    const aday = yapiAra(ad);
    if (!aday.length) return ORG.konus(pl.id, `"${ad}" adında bir yapı bulamadım. Mimar'a dokunup kütüphaneden seçebilirsin.`);
    let y = aday[0];
    if (aday.length > 1 && aday[0].ad !== aday[1].ad) {
      const r = await menu(pl, "§lHangi yapı?", `"${ad}" için en uygunlar:`, aday.slice(0, 8).map((x) => ({ text: `§l${x.ad}§r\n§7${x.boyut.join("x")} · ${x.blok} blok`, y: x })));
      if (!r) return;
      y = r.y;
    }
    ORG.konus(pl.id, `${mimar.name}, ${y.ad} kuracak. Yerini göster.`);
    const plan = await chooseSite(pl, y, false);
    if (!plan || !mimar.valid) return;
    mimar.task = plan;
    mimar.saveTask();
    startTask(mimar);
    return [mimar.id];
  },
});

// ======================================================================= telefon
function baglam(pl) {
  const robotlar = [...bots.values()].filter((b) => b.valid && b.owner === pl.id)
    .map((b) => ({ id: b.id, ad: b.name, tur: b.type, no: Number(/-(\d+)$/.exec(b.name ?? "")?.[1] ?? NaN) }));
  for (const k of kesifListesi()) if (k.owner === pl.id) robotlar.push({ id: k.e.id, ad: k.name, tur: "kesif", no: Number(/-(\d+)$/.exec(k.name ?? "")?.[1] ?? NaN) });
  return { robotlar, son: ORG.sonKomut(pl.id) };
}

export async function telefonAc(pl, org) {
  const z = ORG.zincirler(pl.id);
  const son = ORG.sonKomut(pl.id);
  const orglar = ORG.orgListesi(pl.id);
  const body = [
    orglar.length ? `§7Organizatör: §f${orglar.map((o) => o.name).join(", ")}` : "§eHenüz Organizatör robotun yok; yine de görev verebilirim (eşya getirme ve düzenleme için Organizatör gerekir).",
    z.length ? `§7Bekleyen görev zinciri: §f${z.length}` : "",
  ].filter(Boolean).join("\n");
  const btns = [{ text: "§l§bYaz: görev ver ya da sor§r\n§7\"madenci 20 demir getirsin\", \"elmas nerede?\"", icon: ICON.yaz, v: "yaz" }];
  if (son) btns.push({ text: `Son komutu tekrarla\n§7${son.metin.slice(0, 40)}`, icon: ICON.tekrar, v: "tekrar" });
  if (z.length) btns.push({ text: `Görev zinciri (${z.length})\n§7Bekleyenler, iptal`, icon: ICON.zincir, v: "zincir" });
  btns.push({ text: "Nerede?\n§7Sandıklarda eşya ara", icon: ICON.ara, v: "ara" });
  btns.push({ text: "Sandıkları düzenle\n§7Türe göre yerleştir, yığınları birleştir", icon: ICON.duzen, v: "duzen" });
  btns.push({ text: "Durum\n§7Robotlar ve sandıklar", icon: ICON.durum, v: "durum" });
  btns.push({ text: "Gün özeti", icon: ICON.ozet, v: "ozet" });
  for (const x of ORG.ekler().telefonDugmeleri?.(pl) ?? []) btns.push(x);
  btns.push({ text: "Geçmiş komutlar", icon: ICON.gecmis, v: "gecmis" });
  btns.push({ text: "Yardım: neler yazabilirim?", icon: ICON.yardim, v: "yardim" });
  const r = await menu(pl, "§lAqualit Telefon", body, btns);
  if (!r) return;
  switch (r.v) {
    case "yaz": return yaz(pl);
    case "tekrar": return calistir(pl, { metin: son.metin, adimlar: son.adimlar, sorular: [], duzeltmeler: [], guven: 1 }, true);
    case "zincir": return zincirMenu(pl);
    case "ara": return araMenu(pl);
    case "duzen": return ORG.adimCalistir(pl, { eylem: "duzenle", robotlar: { bos: true } }, ORG.ekler());
    case "durum": return pl.sendMessage(ORG.durumYazi(pl.id, kesifListesi));
    case "ozet": return ORG.gunOzeti(pl);
    case "gecmis": return gecmisMenu(pl);
    case "yardim":
      await menu(pl, "§lYardım", YARDIM, [{ text: "Tamam", v: 1 }]);
      return telefonAc(pl, org);
    default:
      if (typeof r.calis === "function") { const f = r.calis; return f(); }
  }
}

export async function yaz(pl, onceki = "") {
  const v = await modal(pl, "§lOrganizatör'e yaz", [{ type: "text", label: "Ne yapalım? (görev, soru, zincir: \"önce ..., sonra ...\")", value: onceki, placeholder: "madenci 3 ve 4 yirmi demir getirsin" }], "Gönder");
  const metin = String(v?.[0] ?? "").trim();
  if (!metin) return;
  return isle(pl, metin);
}

/** Yazılanı anlar ve çalıştırır (telefon, Organizatör menüsü, testler). */
export async function isle(pl, metin, otomatik = false) {
  let r = anla(metin, baglam(pl));
  pl.sendMessage(`§7> ${metin}`);
  if (r.sohbet) return ORG.konus(pl.id, r.sohbet);
  // yazım hatası: "Şunu mu demek istedin?"
  if (r.duzeltmeler.length && !otomatik) {
    let duz = sade(metin);
    for (const d of r.duzeltmeler) duz = duz.replace(d.yazilan, d.onerilen);
    const ok = await confirm(pl, "§lŞunu mu demek istedin?", `§f"${duz}"\n\n§7${r.duzeltmeler.map((d) => `${d.yazilan} → ${d.onerilen}`).join(", ")}`, "Evet", "Hayır, yeniden yaz");
    if (!ok) return yaz(pl, metin);
  }
  if (!r.adimlar.length) {
    const anlasilmayan = r.anlasilmayan.slice(0, 4).join(", ");
    ORG.konus(pl.id, `Anlayamadım${anlasilmayan ? ` (${anlasilmayan})` : ""}. Örnek: "madenci 20 demir getirsin", "kılıçlılar evi korusun", "elmas nerede?". Telefonda Yardım'a bakabilirsin.`);
    return;
  }
  // sorular (eksik bilgi)
  for (const a of r.adimlar) {
    if (a.eylem === "topla" && !a.esyalar?.length && !otomatik) {
      const v = await modal(pl, "§lBir şey soracağım", [{ type: "text", label: a.soru ?? "Ne toplansın?", value: "" }], "Tamam");
      const ek = anla(String(v?.[0] ?? ""), baglam(pl)).adimlar[0];
      if (!ek?.esyalar) return ORG.konus(pl.id, "Tamam, bu adımı atlıyorum.");
      a.esyalar = ek.esyalar;
      a.miktarlar = ek.miktarlar;
      a.miktar = ek.miktar;
    }
  }
  return calistir(pl, r, otomatik);
}

async function calistir(pl, r, otomatik) {
  const yapiAd = (t) => YAPI[t]?.ad ?? t;
  const satir = r.adimlar.map((a, i) => `§b${i + 1}.§r ${i && a.sira === "ayni" ? "§7(aynı anda)§r " : i ? "§7(sonra)§r " : ""}${adimYazi(a, yapiAd)}`);
  const buyuk = r.adimlar.length > 1 || r.guven < 0.75 || r.adimlar.some((a) => ["sefer", "yagma", "insa", "git"].includes(a.eylem) || a.robotlar?.hepsi);
  if (buyuk && !otomatik) {
    const ok = await confirm(pl, "§lŞöyle anladım", `${satir.join("\n")}\n\n§7Onaylarsan robotlara dağıtırım.`, "Onayla", "İptal");
    if (!ok) return ORG.konus(pl.id, "Tamam, iptal ettim.");
  } else pl.sendMessage(satir.join("\n"));
  return ORG.zincirKur(pl, r, ORG.ekler());
}

async function zincirMenu(pl) {
  const z = ORG.zincirler(pl.id);
  const yapiAd = (t) => YAPI[t]?.ad ?? t;
  const satir = z.flatMap((x) => x.adimlar.map((s) => `${s.durum === "bitti" ? "§a✔" : s.durum === "calisiyor" ? "§e▶" : "§7…"}§r ${adimYazi(s.a, yapiAd)}`));
  const ok = await confirm(pl, "§lGörev zinciri", satir.join("\n") || "Bekleyen yok.", "Tamam", "Hepsini iptal et");
  if (!ok && z.length) {
    ORG.zincirIptal(pl.id);
    ORG.konus(pl.id, "Bekleyen görev zincirlerini iptal ettim.");
  }
}

async function araMenu(pl) {
  const v = await modal(pl, "§lNerede?", [{ type: "text", label: "Hangi eşya? (ör. elmas, demir, yemek, kazma)", value: "" }], "Ara");
  const t = String(v?.[0] ?? "").trim();
  if (!t) return;
  return isle(pl, `${t} nerede`, true);
}

async function gecmisMenu(pl) {
  const g = ORG.gecmis(pl.id).slice(-10).reverse();
  if (!g.length) return pl.sendMessage("§7Henüz komut yok.");
  const r = await menu(pl, "§lGeçmiş komutlar", "Birine dokunursan yeniden çalıştırırım.", g.map((m) => ({ text: m.slice(0, 60), m })));
  if (r) return isle(pl, r.m);
}

// ======================================================================= Organizatör robotuna dokununca
export async function orgMenu(pl, bot, digerleri) {
  const q = ORG.dizin(pl.id);
  const body = [`§7Durum: §f${bot.status}`, `§7Sandıklar: §f${q.sandiklar.length}`, `§7Konum: §f${Math.floor(bot.loc.x)}, ${Math.floor(bot.loc.y)}, ${Math.floor(bot.loc.z)}`].join("\n");
  const btns = [
    { text: "§l§bKonuş / görev ver§r\n§7Yazıyla", icon: ICON.yaz, v: "yaz" },
    { text: "Telefon menüsü\n§7Ara, düzenle, durum, zincir", icon: "textures/items/aqualit_telefon", v: "tel" },
    ...(ORG.ekler().orgDugmeleri?.(pl, bot) ?? []),
    ...(digerleri ?? []),
  ];
  const r = await menu(pl, `§l${bot.name}`, body, btns);
  if (!r) return;
  if (r.v === "yaz") return yaz(pl);
  if (r.v === "tel") return telefonAc(pl, bot);
  if (typeof r.calis === "function") { const f = r.calis; return f(); }
  return r;
}
