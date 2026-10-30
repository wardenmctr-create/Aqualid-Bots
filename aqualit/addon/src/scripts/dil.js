// Aqualit Robotları — Organizatör'ün Türkçe dil motoru (v0.4.0)
// Oyuncunun yazdığı serbest cümleyi anlar ve robotlara verilecek adımlara çevirir. Oyun API'si kullanmaz (testte de çalışır).
//
//   anla("Madenci 3 ve madenci 4 yirmi demir getirsin, bitince oduncular 2 deste meşe kessin", baglam)
//     -> { adimlar: [{ eylem: "topla", robotlar, esya, miktar, sira }, ...], sorular, duzeltmeler, sohbet, guven }
//
// Yöntem: yazı sadeleştirilir (Türkçe küçük harf, ç/ğ/ı/ö/ş/ü olmadan da anlaşılır), cümle bağlaçlardan ("sonra",
// "bitince", "ve", virgül, "aynı anda", "eğer ... ise") yan cümlelere bölünür. Her yan cümlede sözlükteki kelimeler ek
// kökünden tanınır (madencilere -> madenci, elmasları -> elmas), sayılar yazıyla da okunur ("yirmi beş", "bir deste"),
// robot adları ("kılıçlı 4", "4. kılıçlı", "Madenci-3"), eşyalar, yerler, koşullar ve eylemler bulunur.
// Bilinmeyen kelimeye en yakın sözlük kelimesi aranır ("elmaz" -> "elmas") ve "Şunu mu demek istedin?" diye sorulur.

// ======================================================================= yazı sadeleştirme
const TR = { "I": "ı", "İ": "i" };
export function kucuk(s) {
  return String(s ?? "").replace(/[Iİ]/g, (c) => TR[c]).toLowerCase();
}
const SADE = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
/** Türkçe harfleri sadeleştirir: karşılaştırma hep bu biçimde yapılır (kaşif = kasif). */
export function sade(s) {
  return kucuk(s).replace(/[çğıöşüâîû]/g, (c) => SADE[c]);
}
function kelimeler(s) {
  return sade(s)
    .replace(/(\d)\s*\.(?=\s|$)/g, "$1. ")                 // "4." sıra sayısı
    .replace(/['’`´]/g, "")                                // kesme işareti: "keşif'e" -> "keşife"
    .replace(/([a-z])-(\d)/g, "$1 $2")                   // Madenci-3 -> madenci 3
    .replace(/[^a-z0-9.\-:\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// ======================================================================= ekler
// Kelimenin sonundaki ekler (çoğul, hâl, iyelik, fiil). Sözlük kelimesi kökün başında bulunur, kalan kısım bu eklerden
// oluşuyorsa kelime tanınır. Liste uzun: Türkçede ekler üst üste gelir (madencilerimize, getirebilirler mi).
const EKLER = [
  "lerinizden", "larinizdan", "lerimizden", "larimizdan", "lerinden", "larindan", "lerine", "larina", "lerini", "larini",
  "lerinin", "larinin", "lerimiz", "larimiz", "leriniz", "lariniz", "lerim", "larim", "lerin", "larin", "leri", "lari",
  "lerde", "larda", "lerden", "lardan", "lere", "lara", "leri", "ler", "lar",
  "imizden", "imize", "imizi", "imiz", "iniz", "inizi", "inize", "ini", "ine", "inin", "inde", "inden",
  "nin", "nun", "nın", "nun", "in", "un", "yi", "yu", "ye", "ya", "yla", "yle", "la", "le", "ile",
  "si", "su", "sini", "sunu", "sine", "suna", "sinde", "sunda", "sinden", "sundan",
  "de", "da", "te", "ta", "den", "dan", "ten", "tan", "e", "a", "i", "u", "y",
  "deki", "daki", "teki", "taki", "ki", "lik", "lik", "luk", "cik", "cuk", "ci", "cu", "ca", "ce",
  "sin", "sun", "sinler", "sunlar", "in", "un", "iniz", "unuz", "yin", "yun", "yiniz", "yunuz",
  "mak", "mek", "may", "mey", "meni", "mani", "mesini", "masini", "mesi", "masi",
  "ebilir", "abilir", "yebilir", "yabilir", "ebilirmisin", "abilirmisin", "irmisin", "urmusun", "irmi", "urmu",
  "mi", "mu", "misin", "musun", "miyiz", "muyuz",
  "di", "du", "ti", "tu", "dik", "duk", "tik", "tuk", "dikten", "duktan", "tikten", "tuktan", "ince", "unca", "yince", "yunca",
  "erek", "arak", "yerek", "yarak", "ip", "up", "yip", "yup", "ken", "yken",
  "sa", "se", "sak", "sek", "ysa", "yse", "irse", "ursa", "arsa", "erse",
  "acak", "ecek", "yacak", "yecek", "iyor", "uyor", "ar", "er", "ir", "ur", "r",
  "ni", "nu", "na", "ne", "nde", "nda", "nden", "ndan", "iz", "uz", "sunuz", "siniz", "yiz", "yuz", "dir", "dur", "tir", "tur",
];
// 2 harfli kökler (ev, ok, et...) yalnız bu eklerle tanınır
const KISA_EK = new Set(["", "i", "e", "de", "den", "imiz", "imize", "imizi", "imizde", "ime", "imi", "imde", "in", "ine", "ini",
  "inde", "deki", "ler", "lere", "leri", "ye", "yi"]);
const EK_SET = new Set(EKLER);
/** kalan kısım eklerden oluşuyor mu (en çok 4 ek). */
function ekMi(kalan, derin = 0) {
  if (!kalan) return true;
  if (derin > 4) return false;
  for (let n = Math.min(12, kalan.length); n >= 1; n--) {
    if (EK_SET.has(kalan.slice(0, n)) && ekMi(kalan.slice(n), derin + 1)) return true;
  }
  return false;
}

// ======================================================================= sayılar
const BIRLER = { sifir: 0, bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9 };
const ONLAR = { on: 10, yirmi: 20, otuz: 30, kirk: 40, elli: 50, altmis: 60, yetmis: 70, seksen: 80, doksan: 90 };
const OZEL_SAYI = {
  deste: 64, yigin: 64, stack: 64, stak: 64, istif: 64, sandikdolusu: 1728, "yarim": 0.5, "ceyrek": 0.25,
  birkac: 8, biraz: 16, cok: 64, bolca: 64, epey: 32, duzine: 12,
};
/** Kelimeler içinde sayı: rakam, yazı ("yirmi beş", "yüz elli"), "2 deste", "yarım deste", "bir sürü". */
export function sayiOku(ks, i) {
  let t = ks[i];
  if (t === undefined) return null;
  const sayiEki = (s) => s.match(/^(\d+)\.?(?:[a-z]*)$/);
  let m = sayiEki(t);
  let n = null, j = i;
  if (m) {
    n = Number(m[1]);
    j = i + 1;
  } else {
    let toplam = 0, buldu = false;
    for (; j < ks.length; j++) {
      const k = ks[j].replace(/(tane|adet|er|ar|ser|sar)$/, "");
      if (BIRLER[k] !== undefined && !(k === "bir" && buldu && toplam % 10)) { toplam += BIRLER[k]; buldu = true; continue; }
      if (ONLAR[k] !== undefined) { toplam += ONLAR[k]; buldu = true; continue; }
      if (k === "yuz") { toplam = (toplam || 1) * 100; buldu = true; continue; }
      if (k === "bin") { toplam = (toplam || 1) * 1000; buldu = true; continue; }
      break;
    }
    if (buldu) n = toplam;
  }
  // çarpan: "2 deste", "bir yığın", "yarım deste"
  const sonra = ks[j];
  if (sonra) {
    const kok = Object.keys(OZEL_SAYI).find((o) => OZEL_SAYI[o] >= 2 && sonra.startsWith(o) && ekMi(sonra.slice(o.length)));
    if (kok && (n !== null || ks[i] === "yarim")) {
      return { n: Math.round((n ?? 1) * OZEL_SAYI[kok]), son: j + 1 };
    }
  }
  if (n === null) {
    if (t === "yarim" && ks[i + 1]?.startsWith("deste")) return { n: 32, son: i + 2 };
    if (t === "bir" && (ks[i + 1] === "suru" || ks[i + 1] === "suruu")) return { n: 64, son: i + 2 };
    const o = Object.keys(OZEL_SAYI).find((k) => t === k || (k.length >= 4 && t.startsWith(k) && ["", "ca", "ce", "lar", "ler"].includes(t.slice(k.length))));
    if (o && OZEL_SAYI[o] >= 2) return { n: OZEL_SAYI[o], son: i + 1, yaklasik: true };
    return null;
  }
  return { n, son: j };
}

// ======================================================================= sözlük: robot türleri
export const ROBOT_TUR = {
  madenci: ["madenci", "maden robotu", "madenciler", "kazici", "maden"],
  kurekci: ["kurekci", "kazmaci", "toprakci", "kumcu"],
  ciftci: ["ciftci", "tarimci", "bahcivan", "hasatci"],
  oduncu: ["oduncu", "agacci", "keresteci", "baltaci"],
  kilicli: ["kilicli", "savasci", "asker", "koruma", "muhafiz", "kilic robotu", "dovuscu", "bekci", "nobetci"],
  insaatci: ["mimar", "insaatci", "usta", "yapici", "inşaatci"],
  kesif: ["kesif", "kasif", "kesifci", "kesif robotu", "ucak", "arac"],
  toplayici: ["organizator", "toplayici", "organizer", "duzenleyici", "sen", "kendin"],
};
const TUR_ADI = { madenci: "Madenci", kurekci: "Kürekçi", ciftci: "Çiftçi", oduncu: "Oduncu", kilicli: "Kılıçlı",
  insaatci: "Mimar", kesif: "Keşif", toplayici: "Organizatör" };
export const turAdi = (t) => TUR_ADI[t] ?? t;
const HEPSI = ["herkes", "hepsi", "hepiniz", "butun", "tum", "tumu", "hepsini", "herbiri", "her"];
const ROBOT_KELIME = ["robot", "robotlar", "bot", "botlar", "ekip", "takim", "grup", "elemanlar", "adamlar", "cocuklar"];

// ======================================================================= sözlük: eşyalar
// ad -> { id, ad, kaynak: [robot türü, katalog anahtarı] } ; ids: aynı adı taşıyan eşya kalıbı (yemek, kazma...)
const E = (ad, id, kaynak, ek = {}) => ({ ad, id, kaynak, ...ek });
export const ESYA = {
  // madenler (Madenci)
  komur: E("Kömür", "minecraft:coal", ["madenci", "komur"]),
  demir: E("Demir", "minecraft:iron_ingot", ["madenci", "demir"], { ham: "minecraft:raw_iron" }),
  "ham demir": E("Ham demir", "minecraft:raw_iron", ["madenci", "demir"]),
  "demir kulcesi": E("Demir külçesi", "minecraft:iron_ingot", ["madenci", "demir"]),
  bakir: E("Bakır", "minecraft:copper_ingot", ["madenci", "bakir"], { ham: "minecraft:raw_copper" }),
  altin: E("Altın", "minecraft:gold_ingot", ["madenci", "altin"], { ham: "minecraft:raw_gold" }),
  "altin kulcesi": E("Altın külçesi", "minecraft:gold_ingot", ["madenci", "altin"]),
  kiziltas: E("Kızıltaş", "minecraft:redstone", ["madenci", "kiziltas"]),
  redstone: E("Kızıltaş", "minecraft:redstone", ["madenci", "kiziltas"]),
  lapis: E("Lapis Lazuli", "minecraft:lapis_lazuli", ["madenci", "lapis"]),
  elmas: E("Elmas", "minecraft:diamond", ["madenci", "elmas"]),
  zumrut: E("Zümrüt", "minecraft:emerald", ["madenci", "zumrut"]),
  aqualit: E("Aqualit", "aqualit:aqualit_ingot", ["madenci", "aqualit"], { ham: "aqualit:raw_aqualit" }),
  akualit: E("Aqualit", "aqualit:aqualit_ingot", ["madenci", "aqualit"], { ham: "aqualit:raw_aqualit" }),
  kuvars: E("Nether kuvarsı", "minecraft:quartz", ["madenci", "kuvars"]),
  "nether altini": E("Nether altını", "minecraft:gold_nugget", ["madenci", "nether_altin"]),
  "antik kalinti": E("Antik kalıntı", "minecraft:ancient_debris", ["madenci", "antik"]),
  netherit: E("Antik kalıntı", "minecraft:ancient_debris", ["madenci", "antik"]),
  ametist: E("Ametist", "minecraft:amethyst_shard", ["madenci", "ametist"]),
  tas: E("Taş", "minecraft:cobblestone", ["madenci", "tas"], { ids: ["minecraft:cobblestone", "minecraft:stone"] }),
  kiriktas: E("Kırıktaş", "minecraft:cobblestone", ["madenci", "tas"]),
  maden: E("Maden", null, ["madenci", "*"]),
  cevher: E("Maden", null, ["madenci", "*"]),
  // kürekçi
  kum: E("Kum", "minecraft:sand", ["kurekci", "kum"]),
  "kirmizi kum": E("Kırmızı kum", "minecraft:red_sand", ["kurekci", "kirmizi_kum"]),
  cakil: E("Çakıl", "minecraft:gravel", ["kurekci", "cakil"]),
  toprak: E("Toprak", "minecraft:dirt", ["kurekci", "toprak"]),
  kil: E("Kil", "minecraft:clay_ball", ["kurekci", "kil"]),
  camur: E("Çamur", "minecraft:mud", ["kurekci", "camur"]),
  "ruh kumu": E("Ruh kumu", "minecraft:soul_sand", ["kurekci", "ruh_kumu"]),
  kar: E("Kar", "minecraft:snowball", ["kurekci", "kar"]),
  cam: E("Cam", "minecraft:glass", ["kurekci", "kum"], { eritme: true }),
  tugla: E("Tuğla", "minecraft:brick", ["kurekci", "kil"], { eritme: true }),
  // oduncu
  odun: E("Odun", null, ["oduncu", "mese"], { ids: [/_log$/, /_stem$/] }),
  kutuk: E("Kütük", null, ["oduncu", "mese"], { ids: [/_log$/] }),
  agac: E("Odun", null, ["oduncu", "mese"], { ids: [/_log$/] }),
  kereste: E("Odun", null, ["oduncu", "mese"], { ids: [/_log$/] }),
  tahta: E("Tahta", null, ["oduncu", "mese"], { ids: [/_planks$/] }),
  mese: E("Meşe kütüğü", "minecraft:oak_log", ["oduncu", "mese"]),
  ladin: E("Ladin kütüğü", "minecraft:spruce_log", ["oduncu", "ladin"]),
  cam_agaci: E("Ladin kütüğü", "minecraft:spruce_log", ["oduncu", "ladin"]),
  hus: E("Huş kütüğü", "minecraft:birch_log", ["oduncu", "hus"]),
  orman: E("Orman kütüğü", "minecraft:jungle_log", ["oduncu", "orman"]),
  akasya: E("Akasya kütüğü", "minecraft:acacia_log", ["oduncu", "akasya"]),
  "koyu mese": E("Koyu meşe kütüğü", "minecraft:dark_oak_log", ["oduncu", "koyu_mese"]),
  mangrov: E("Mangrov kütüğü", "minecraft:mangrove_log", ["oduncu", "mangrov"]),
  kiraz: E("Kiraz kütüğü", "minecraft:cherry_log", ["oduncu", "kiraz"]),
  "solgun mese": E("Solgun meşe kütüğü", "minecraft:pale_oak_log", ["oduncu", "solgun_mese"]),
  kavak: E("Kavak kütüğü", "minecraft:poplar_log", ["oduncu", "kavak"]),
  "kizil govde": E("Kızıl gövde", "minecraft:crimson_stem", ["oduncu", "kizil"]),
  "carpik govde": E("Çarpık gövde", "minecraft:warped_stem", ["oduncu", "carpik"]),
  fidan: E("Fidan", null, ["oduncu", "mese"], { ids: [/_sapling$/] }),
  yaprak: E("Yaprak", null, ["oduncu", "mese"], { ids: [/_leaves$/] }),
  cubuk: E("Çubuk", "minecraft:stick", null),
  merdiven: E("Merdiven", "minecraft:ladder", null),
  fici: E("Fıçı", "minecraft:barrel", null),
  kitaplik: E("Kitaplık", "minecraft:bookshelf", null),
  "cam panel": E("Cam panel", "minecraft:glass_pane", null),
  "demir kazma": E("Demir kazma", "minecraft:iron_pickaxe", null),
  "elmas kazma": E("Elmas kazma", "minecraft:diamond_pickaxe", null),
  "demir kilic": E("Demir kılıç", "minecraft:iron_sword", null),
  "elmas kilic": E("Elmas kılıç", "minecraft:diamond_sword", null),
  "aqualit kablo": E("Aqualit Kablo", "aqualit:aqualit_kablo", null),
  kablo: E("Aqualit Kablo", "aqualit:aqualit_kablo", null),
  elma: E("Elma", "minecraft:apple", ["oduncu", "mese"]),
  // çiftçi
  bugday: E("Buğday", "minecraft:wheat", ["ciftci", "bugday"]),
  havuc: E("Havuç", "minecraft:carrot", ["ciftci", "havuc"]),
  patates: E("Patates", "minecraft:potato", ["ciftci", "patates"]),
  pancar: E("Pancar", "minecraft:beetroot", ["ciftci", "pancar"]),
  "nether sigili": E("Nether siğili", "minecraft:nether_wart", ["ciftci", "nether_sigili"]),
  "seker kamisi": E("Şeker kamışı", "minecraft:sugar_cane", ["ciftci", "seker_kamisi"]),
  kamis: E("Şeker kamışı", "minecraft:sugar_cane", ["ciftci", "seker_kamisi"]),
  bambu: E("Bambu", "minecraft:bamboo", ["ciftci", "bambu"]),
  karpuz: E("Karpuz", "minecraft:melon_slice", ["ciftci", "karpuz"]),
  "bal kabagi": E("Bal kabağı", "minecraft:pumpkin", ["ciftci", "balkabagi"]),
  balkabagi: E("Bal kabağı", "minecraft:pumpkin", ["ciftci", "balkabagi"]),
  "tatli meyve": E("Tatlı meyve", "minecraft:sweet_berries", ["ciftci", "tatli_meyve"]),
  kakao: E("Kakao", "minecraft:cocoa_beans", ["ciftci", "kakao"]),
  tohum: E("Tohum", "minecraft:wheat_seeds", ["ciftci", "bugday"]),
  sebze: E("Sebze", null, ["ciftci", "havuc"], { ids: ["minecraft:carrot", "minecraft:potato", "minecraft:beetroot"] }),
  urun: E("Ürün", null, ["ciftci", "bugday"]),
  // Organizatör'ün sandıklarda arayabileceği / dağıtabileceği her şey (kaynağı olmayanlar)
  yemek: E("Yemek", null, null, { ids: ["minecraft:bread", "minecraft:cooked_beef", "minecraft:cooked_porkchop", "minecraft:cooked_chicken",
    "minecraft:cooked_mutton", "minecraft:cooked_salmon", "minecraft:cooked_cod", "minecraft:baked_potato", "minecraft:apple",
    "minecraft:carrot", "minecraft:golden_carrot", "minecraft:pumpkin_pie", "minecraft:cookie", "minecraft:melon_slice"] }),
  ekmek: E("Ekmek", "minecraft:bread", ["ciftci", "bugday"]),
  et: E("Et", null, null, { ids: [/beef$/, /porkchop$/, /chicken$/, /mutton$/, /rabbit$/] }),
  biftek: E("Biftek", "minecraft:cooked_beef", null),
  tavuk: E("Tavuk", "minecraft:cooked_chicken", null),
  balik: E("Balık", null, null, { ids: [/cod$/, /salmon$/] }),
  yumurta: E("Yumurta", "minecraft:egg", null),
  sut: E("Süt kovası", "minecraft:milk_bucket", null),
  seker: E("Şeker", "minecraft:sugar", null),
  bal: E("Bal şişesi", "minecraft:honey_bottle", null),
  kurabiye: E("Kurabiye", "minecraft:cookie", null),
  pasta: E("Pasta", "minecraft:cake", null),
  kazma: E("Kazma", null, null, { ids: [/_pickaxe$/], alet: "pickaxe" }),
  kurek: E("Kürek", null, null, { ids: [/_shovel$/], alet: "shovel" }),
  balta: E("Balta", null, null, { ids: [/_axe$/], alet: "axe" }),
  capa: E("Çapa", null, null, { ids: [/_hoe$/], alet: "hoe" }),
  kilic: E("Kılıç", null, null, { ids: [/_sword$/], alet: "sword" }),
  alet: E("Alet", null, null, { ids: [/_pickaxe$/, /_shovel$/, /_axe$/, /_hoe$/, /_sword$/] }),
  yay: E("Yay", "minecraft:bow", null),
  ok: E("Ok", "minecraft:arrow", null),
  kalkan: E("Kalkan", "minecraft:shield", null),
  zirh: E("Zırh", null, null, { ids: [/_helmet$/, /_chestplate$/, /_leggings$/, /_boots$/] }),
  kask: E("Kask", null, null, { ids: [/_helmet$/] }),
  mesale: E("Meşale", "minecraft:torch", null),
  fener: E("Fener", "minecraft:lantern", null),
  sandik: E("Sandık", "minecraft:chest", null),
  firin: E("Fırın", "minecraft:furnace", null),
  "calisma masasi": E("Çalışma masası", "minecraft:crafting_table", null),
  kitap: E("Kitap", "minecraft:book", null),
  kagit: E("Kağıt", "minecraft:paper", null),
  deri: E("Deri", "minecraft:leather", null),
  yun: E("Yün", null, null, { ids: [/_wool$/] }),
  ip: E("İp", "minecraft:string", null),
  kemik: E("Kemik", "minecraft:bone", null),
  "kemik tozu": E("Kemik tozu", "minecraft:bone_meal", null),
  barut: E("Barut", "minecraft:gunpowder", null),
  "ender incisi": E("Ender incisi", "minecraft:ender_pearl", null),
  inci: E("Ender incisi", "minecraft:ender_pearl", null),
  "blaze cubugu": E("Blaze çubuğu", "minecraft:blaze_rod", null),
  obsidyen: E("Obsidyen", "minecraft:obsidian", null),
  saman: E("Saman balyası", "minecraft:hay_block", null),
  kova: E("Kova", "minecraft:bucket", null),
  "su kovasi": E("Su kovası", "minecraft:water_bucket", null),
  "lav kovasi": E("Lav kovası", "minecraft:lava_bucket", null),
  tnt: E("TNT", "minecraft:tnt", null),
  "kum tasi": E("Kum taşı", "minecraft:sandstone", ["kurekci", "kum"]),
  kumtasi: E("Kum taşı", "minecraft:sandstone", ["kurekci", "kum"]),
  beton: E("Beton", null, null, { ids: [/_concrete$/] }),
  "pismis kil": E("Pişmiş kil", null, null, { ids: [/terracotta$/] }),
  "tas tugla": E("Taş tuğla", "minecraft:stone_bricks", null),
  bayrak: E("Bayrak", null, null, { ids: [/_banner$/] }),
  yatak: E("Yatak", null, null, { ids: [/_bed$/] }),
  kapi: E("Kapı", null, null, { ids: [/_door$/] }),
  ray: E("Ray", "minecraft:rail", null),
  vagon: E("Vagon", "minecraft:minecart", null),
  tekne: E("Tekne", null, null, { ids: [/_boat$/] }),
  pusula: E("Pusula", "minecraft:compass", null),
  harita: E("Harita", null, null, { ids: [/map$/] }),
  saat: E("Saat", "minecraft:clock", null),
  "deneme anahtari": E("Deneme anahtarı", "minecraft:trial_key", null),
  anahtar: E("Anahtar", null, null, { ids: ["minecraft:trial_key", "minecraft:ominous_trial_key"] }),
  "buyu kitabi": E("Büyü kitabı", "minecraft:enchanted_book", null),
  iksir: E("İksir", null, null, { ids: [/potion$/] }),
  "tamir kiti": E("Tamir kiti", "aqualit:tamir_kiti", null),
  kabuk: E("Kabuk", null, null, { ids: [/^aqualit:kabuk_/] }),
  totem: E("Ölümsüzlük totemi", "minecraft:totem_of_undying", null),
  "altin elma": E("Altın elma", "minecraft:golden_apple", null),
  "demir blok": E("Demir bloğu", "minecraft:iron_block", null),
  "elmas blok": E("Elmas bloğu", "minecraft:diamond_block", null),
  "altin blok": E("Altın bloğu", "minecraft:gold_block", null),
  "komur blok": E("Kömür bloğu", "minecraft:coal_block", null),
  esya: E("Eşya", null, null, { ids: [/./] }),
  malzeme: E("Malzeme", null, null, { ids: [/./] }),
  ganimet: E("Ganimet", null, null, { ids: [/./] }),
};
// eşya adının çoklu yazılışları (kelime -> sözlük anahtarı)
const ESYA_EK = {
  "iron": "demir", "diamond": "elmas", "gold": "altin", "coal": "komur", "emerald": "zumrut", "copper": "bakir",
  "kulce": "demir kulcesi", "kirik tas": "kiriktas", "cobble": "kiriktas", "kirmizitas": "kiziltas", "kizil tas": "kiziltas",
  "agac kutugu": "kutuk", "tahtalar": "tahta", "kalas": "tahta", "ekin": "bugday", "bugdai": "bugday", "patetes": "patates",
  "havuc": "havuc", "seker kamis": "seker kamisi", "et yemegi": "et", "pirzola": "et", "domuz": "et", "koyun eti": "et",
  "dana": "biftek", "ciger": "et", "ender": "ender incisi", "pearl": "ender incisi", "blaze": "blaze cubugu",
  "obsidiyen": "obsidyen", "obsidian": "obsidyen", "trial key": "deneme anahtari", "buyu": "buyu kitabi",
  "kazmalar": "kazma", "kilicim": "kilic", "zirhlar": "zirh", "yiyecek": "yemek", "erzak": "yemek", "azik": "yemek",
};

// ======================================================================= sözlük: yerler (yapılar yapi_bilgi.js'ten gelir)
export const YER = {
  ev: ["ev", "us", "evimiz", "yuva", "baz", "merkez", "kamp"],
  ben: ["bura", "burasi", "buraya", "burada", "yanim", "yanima", "yanimda", "bana", "bulundugum", "oldugum", "benim yanim", "konumum"],
  sandik: ["sandik", "sandiklar", "depo", "ambar"],
};
// yapı adları (yapi_bilgi YAPI anahtarları) için ek takma adlar
export const YAPI_TAKMA = {
  koy: ["koy", "kasaba", "koyluler", "koylu", "village"],
  col_tapinagi: ["col tapinagi", "piramit", "col piramidi", "tapinak", "desert temple"],
  orman_tapinagi: ["orman tapinagi", "cengel tapinagi", "jungle temple"],
  cadi_kulubesi: ["cadi kulubesi", "cadi evi", "witch hut"],
  iglo: ["iglo", "igloo", "buz evi"],
  karakol: ["karakol", "yagmaci kulesi", "outpost", "pillager"],
  orman_kosku: ["orman kosku", "malikane", "kosk", "mansion"],
  okyanus_aniti: ["okyanus aniti", "su tapinagi", "anit", "monument"],
  deneme_odasi: ["deneme odasi", "deneme odalari", "trial chamber", "trial chambers", "trial", "deneme"],
  maden_ocagi: ["maden ocagi", "terk edilmis maden", "mineshaft", "ocak"],
  zindan: ["zindan", "dungeon", "canavar odasi"],
  kale_yeralti: ["kale", "stronghold", "end portali", "yeralti kalesi"],
  antik_sehir: ["antik sehir", "ancient city", "warden sehri", "derin karanlik"],
  yikik_portal: ["yikik portal", "ruined portal", "portal"],
  gemi_enkazi: ["gemi enkazi", "batik gemi", "shipwreck", "enkaz"],
  okyanus_harabesi: ["okyanus harabesi", "su alti harabesi", "ocean ruin"],
  iz_harabesi: ["iz harabesi", "trail ruins", "harabe"],
  col_kuyusu: ["col kuyusu", "kuyu"],
  fosil: ["fosil", "dinozor"],
  geod: ["geod", "ametist geodu", "ametist magarasi"],
  nether_kalesi: ["nether kalesi", "fortress", "nether fortress", "blaze kalesi"],
  burc_kalintisi: ["burc kalintisi", "bastion", "piglin kalesi", "burc"],
  end_sehri: ["end sehri", "end city", "shulker"],
};

// ======================================================================= sözlük: eylemler
// eylem -> kök kelimeler (sade). Sıra önemli: önce özel olanlar.
export const EYLEM = {
  sefer: ["sefer", "akin", "baskin", "macera", "ekspedisyon", "operasyon"],
  bin: ["bin", "binin", "binsin", "binsinler", "atla", "atlayin", "yerles"],
  yagma: ["yagma", "yagmala", "soy", "talan", "bosalt", "dagit", "sandiklari bosalt", "lootla", "loot", "tala"],
  saldir: ["saldir", "oldur", "kes bicer", "temizle", "yok et", "savas", "vur", "dovus", "avla", "kir gecir"],
  koru: ["koru", "nobet", "bekci", "muhafaza", "kolla", "gozet", "devriye"],
  takip: ["takip", "pesimden", "pesimi", "arkamdan", "arkami", "yanimdan ayrilma", "pesinden", "izle", "eslik"],
  gel: ["gel", "gelin", "gelsin", "toplan", "toplanin"],
  don: ["don", "donun", "donsun", "geri gel", "geri don", "eve git", "eve don", "geri cekil", "cekil", "geri gelin"],
  dur: ["dur", "durun", "dursun", "birak", "iptal", "vazgec", "kes artik", "yeter", "beklet", "durdur", "sakin"],
  devam: ["devam", "surdur", "kaldigin yerden", "yeniden basla", "tekrar basla"],
  bekle: ["bekle", "bekleyin", "beklesin", "kipirdama", "kal", "sabit", "yerinde kal"],
  git: ["git", "gidin", "gitsin", "gidip", "gidin", "uc", "ucun", "yola cik", "yolculuk", "seyahat", "yonel", "ulas"],
  bul: ["bul", "bulun", "bulsun", "ara", "arayin", "arasin", "kesfet", "kesfedin", "yerini bul", "nerede oldugunu bul", "konumunu bul"],
  kesfet: ["harita", "haritala", "cevreyi kesfet", "etrafi kesfet", "gez", "dolas", "tara"],
  craft: ["uret", "uretin", "uretsin", "imal", "craft", "hazirla", "hazirlayin", "hazirlasin"],
  firin: ["aqualit firin", "firin kur", "firin koy"],
  insa: ["insa", "kur", "kurun", "kursun", "yap", "yapin", "yapsin", "dik", "olustur", "in sa"],
  duzenle: ["duzenle", "sirala", "tasnif", "ayikla", "topla sandik", "derle", "temizle sandik", "duzen", "organize"],
  sor: ["nerede", "nerde", "var mi", "kac tane", "kac", "ne kadar", "bende ne var", "neler var", "envanter", "sayim", "say"],
  ver: ["ver", "verin", "versin", "getir bana", "bana getir", "uzat", "yolla", "gonder", "teslim et", "lazim", "ihtiyacim var",
    "istiyorum", "gerek", "gerekiyor", "ihtiyac"],
  koy: ["koy", "koyun", "koysun", "birak sandiga", "depola", "sakla", "yerlestir", "kaldir"],
  eritme: ["erit", "eritin", "eritsin", "pisir", "pisirin", "firinla", "firina at", "kizart"],
  ek: ["ek", "ekin", "eksin", "dik fidan", "tarla", "ekin ek", "hasat", "hasat et", "biç", "bic", "topla urun"],
  kes: ["kes", "kesin", "kessin", "biç", "agac kes", "devir", "kir"],
  kaz: ["kaz", "kazin", "kazsin", "kazi", "delik", "tunel", "madene in", "maden kaz"],
  topla: ["topla", "toplayin", "toplasin", "getir", "getirin", "getirsin", "getirsinler", "getirebilir", "getirir",
    "cikar", "cikarin", "cikarsin", "edin", "bul getir", "biriktir", "stokla", "temin et", "sagla", "al", "alin", "alsin"],
  durum: ["durum", "ne yapiyor", "ne yapiyorsun", "ne yapiyorlar", "rapor", "ozet", "nasil gidiyor", "neredeler", "kim nerede", "liste", "listele"],
  isim: ["adini", "ismini", "adin", "ismin"],
  tekrar: ["tekrar", "bir daha", "aynisini", "aynisi", "yine", "yeniden"],
  hatirla: ["hatirla", "kaydet", "not al", "unutma"],
};

// koşul ve sıra kelimeleri
const SIRA = {
  sonra: ["sonra", "ardindan", "akabinde", "daha sonra", "bitince", "bittikten sonra", "bitirince", "tamamlayinca",
    "isi bitince", "sonrasinda", "ondan sonra", "bunun ardindan", "en son", "sonunda", "ve sonra", "ardından"],
  ayni: ["ayni anda", "bu arada", "o sirada", "birlikte", "es zamanli", "paralel", "beraber", "ayrica", "bir de", "hem de"],
  once: ["once", "ilk olarak", "ilk once", "evvela", "basta"],
};
const KOSUL = {
  eger: ["eger", "sayet", "ola ki", "durumunda", "takdirde", "halinde"],
  gece: ["gece olunca", "gece olursa", "karanlik olunca", "aksam olunca", "gece"],
  gunduz: ["sabah olunca", "gunduz olunca", "gun dogunca", "sabah", "gunduz"],
  az: ["az", "azsa", "azalirsa", "azalinca", "kalmazsa", "biterse", "bitince stok", "tukenirse", "yoksa", "dusukse", "altina duserse"],
  cok: ["fazla", "fazlaysa", "coksa", "gecerse", "dolunca", "dolarsa", "dolu"],
  can: ["canim", "canim azalinca", "yaralaninca", "olurken", "tehlike", "saldiri olursa", "saldiriya ugrarsam", "biri saldirirsa"],
};

// sohbet (Organizatör'ün kişiliği)
export const SOHBET = [
  { k: ["merhaba", "selam", "slm", "mrb", "hey", "hi", "naber", "nbr"], c: ["Selam patron! Sandıklar düzenli, robotlar hazır. Ne yapalım?", "Merhaba! Bir görev mi var, yoksa bir şey mi arıyorsun?"] },
  { k: ["nasilsin", "iyi misin", "keyfin"], c: ["Harikayım! Sandıkları saymak benim için meditasyon gibi.", "İyiyim, robot ekibi de iyi. Sen nasılsın?"] },
  { k: ["tesekkur", "sagol", "sag ol", "eyvallah", "mersi", "tsk", "tskler", "eline saglik"], c: ["Rica ederim, her zaman!", "Ne demek, işim bu.", "Ne zaman istersen."] },
  { k: ["kimsin", "sen kimsin", "nesin", "adin ne"], c: ["Ben Organizatör: sandıkların, robotların ve görevlerin düzenleyicisiyim. Bana yazıyla görev verebilirsin."] },
  { k: ["yardim", "ne yapabilirsin", "neler yapabilirsin", "komutlar", "nasil kullan", "help", "kullanim"], c: ["YARDIM"] },
  { k: ["aferin", "harika", "super", "muhtesem", "bravo", "iyi is"], c: ["Teşekkürler! Ekibe de iletirim.", "Biz bir takımız!"] },
  { k: ["sus", "kapa ceneni", "sessiz"], c: ["Tamam, daha az konuşurum."] },
  { k: ["saka", "fikra", "espri"], c: ["Bir madenci sandığa ne demiş? 'Seni dolduracağım!'", "Kılıçlı neden sandığa girmez? Çünkü kılıfı yok!"] },
  { k: ["gunaydin"], c: ["Günaydın! Gece robotlar çalıştı, sandıklara bir bak istersen."] },
  { k: ["iyi geceler"], c: ["İyi geceler! Ben nöbetteyim, sandıklara göz kulak olurum."] },
];

// ======================================================================= yardımcılar
/** Levenshtein uzaklığı (yazım hatası düzeltme). */
export function uzaklik(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Sözlük dizini: çok kelimeli ifadeler dahil, uzun olan önce. */
function dizinYap() {
  const girdi = [];
  const ekle = (ifade, tip, deger) => {
    const ks = sade(ifade).split(" ");
    girdi.push({ ks, tip, deger, ifade: sade(ifade) });
  };
  for (const [tur, ls] of Object.entries(ROBOT_TUR)) for (const s of ls) ekle(s, "robot", tur);
  for (const s of HEPSI) ekle(s, "hepsi", true);
  for (const s of ROBOT_KELIME) ekle(s, "robotkelime", true);
  for (const k of Object.keys(ESYA)) ekle(k, "esya", k);
  for (const [k, v] of Object.entries(ESYA_EK)) ekle(k, "esya", v);
  for (const [k, ls] of Object.entries(YER)) for (const s of ls) ekle(s, "yer", k);
  for (const [k, ls] of Object.entries(YAPI_TAKMA)) for (const s of ls) ekle(s, "yapi", k);
  for (const [k, ls] of Object.entries(EYLEM)) for (const s of ls) ekle(s, "eylem", k);
  for (const [k, ls] of Object.entries(SIRA)) for (const s of ls) ekle(s, "sira", k);
  for (const [k, ls] of Object.entries(KOSUL)) for (const s of ls) ekle(s, "kosul", k);
  girdi.sort((a, b) => b.ks.length - a.ks.length || b.ifade.length - a.ifade.length);
  return girdi;
}
let DIZIN = null;
let SOZCUKLER = null;
function dizin() {
  if (!DIZIN) {
    DIZIN = dizinYap();
    SOZCUKLER = new Set(DIZIN.flatMap((g) => g.ks));
  }
  return DIZIN;
}

/** Bir kelime sözlük kökünü (ekleriyle) karşılıyor mu. Kısa kökler (<=2) tam eşleşmeli. */
function karsilar(kelime, kok) {
  if (kelime === kok) return true;
  if (kok.length <= 2) return kelime.startsWith(kok) && KISA_EK.has(kelime.slice(kok.length));
  if (!kelime.startsWith(kok)) {
    // ünsüz yumuşaması: kitap -> kitabı, sandık -> sandığa, ağaç -> ağacı, kanat -> kanadı
    const son = kok[kok.length - 1];
    const yum = { p: "b", c: "c", t: "d", k: "g" }[son];
    if (!yum || !kelime.startsWith(kok.slice(0, -1) + yum)) return false;
    return ekMi(kelime.slice(kok.length));
  }
  return ekMi(kelime.slice(kok.length));
}

/** Kelime dizisini sözlüğe göre işaretler: [{tip, deger, bas, son, yazilan}] */
function isaretle(ks, duzeltmeler) {
  const D = dizin();
  const out = [];
  for (let i = 0; i < ks.length; ) {
    // sayı
    const s = sayiOku(ks, i);
    if (s) {
      out.push({ tip: "sayi", deger: s.n, bas: i, son: s.son, yaklasik: s.yaklasik });
      i = s.son;
      continue;
    }
    // koordinat "x:100" ya da "-200"
    let bul = null;
    for (const g of D) {
      const n = g.ks.length;
      if (i + n > ks.length) continue;
      let ok = true;
      for (let j = 0; j < n; j++) {
        const kel = ks[i + j];
        const kok = g.ks[j];
        if (!(j === n - 1 ? karsilar(kel, kok) : kel === kok || karsilar(kel, kok))) { ok = false; break; }
      }
      if (ok) { bul = { g, n }; break; }
    }
    if (bul) {
      out.push({ tip: bul.g.tip, deger: bul.g.deger, bas: i, son: i + bul.n, yazilan: ks.slice(i, i + bul.n).join(" ") });
      i += bul.n;
      continue;
    }
    // yazım hatası: en yakın sözlük kelimesi (en az 4 harf, uzaklık <= 1; 7+ harf için 2)
    const kel = ks[i];
    if (kel.length >= 5 && !/^\d/.test(kel) && !DOLGU.has(kel) && ![...DOLGU].some((d) => d.length >= 3 && karsilar(kel, d))) {
      let iyi = null, iu = 99, iboy = 99;
      for (const sz of SOZCUKLER) {
        if (sz.length < 5 || Math.abs(sz.length - kel.length) > 3) continue;
        const u = uzaklik(kel, sz);
        const kokU = kel.length > sz.length && ekMi(kel.slice(sz.length)) ? uzaklik(kel.slice(0, sz.length), sz) : 9;
        const best = Math.min(u, kokU);
        const boy = Math.abs(sz.length - kel.length);
        if (best < iu || (best === iu && boy < iboy)) { iu = best; iyi = sz; iboy = boy; }
      }
      const sinir = kel.length >= 8 ? 2 : 1;
      if (iyi && iu <= sinir && iu > 0) {
        const tek = D.find((g) => g.ks.length === 1 && g.ks[0] === iyi);
        if (tek) {
          duzeltmeler.push({ yazilan: kel, onerilen: iyi });
          out.push({ tip: tek.tip, deger: tek.deger, bas: i, son: i + 1, yazilan: kel, duzeltme: iyi });
          i += 1;
          continue;
        }
      }
    }
    out.push({ tip: "bilinmeyen", deger: kel, bas: i, son: i + 1, yazilan: kel });
    i += 1;
  }
  return out;
}

// ======================================================================= cümle -> adımlar
/**
 * baglam: { robotlar: [{id, ad, tur, no}], yapilar: {tur: ad} (yapi_bilgi), yerler: [{ad, tur}], son: önceki sonuç }
 * Dönen: { adimlar, sohbet, sorular, duzeltmeler, anlasilmayan, guven, ozet }
 */
export function anla(metin, baglam = {}) {
  const ham = String(metin ?? "").trim();
  const sonuc = { metin: ham, adimlar: [], sohbet: null, sorular: [], duzeltmeler: [], anlasilmayan: [], guven: 0 };
  if (!ham) return sonuc;
  const ks = kelimeler(ham);
  // robot adlarını (Madenci-3, Kılıçlı-4, özel adlar) önce yakala
  const robotlar = baglam.robotlar ?? [];
  const isaret = isaretle(ks, sonuc.duzeltmeler);
  ozelAdlar(ks, isaret, robotlar);
  // sohbet mi?
  const sadeMetin = ks.join(" ");
  const eylemVar = isaret.some((t) => t.tip === "eylem");
  for (const s of SOHBET) {
    if (s.k.some((k) => (k.includes(" ") ? (" " + sadeMetin + " ").includes(" " + k) : ks.some((w) => w === k || (k.length >= 4 && karsilar(w, k)))))) {
      if (!eylemVar || s.c[0] === "YARDIM") {
        sonuc.sohbet = s.c[0] === "YARDIM" ? YARDIM : s.c[Math.floor(Math.random() * s.c.length)];
        sonuc.guven = 1;
        return sonuc;
      }
    }
  }
  // "tekrar": önceki komut
  if (isaret.some((t) => t.tip === "eylem" && t.deger === "tekrar") && baglam.son?.adimlar?.length && isaret.filter((t) => t.tip === "eylem").length === 1) {
    sonuc.adimlar = baglam.son.adimlar.map((a) => ({ ...a }));
    sonuc.guven = 0.9;
    sonuc.tekrar = true;
    return sonuc;
  }
  // yan cümlelere böl
  const parcalar = bol(isaret);
  let oncekiRobotlar = null;
  let oncekiSira = "sonra";
  for (const p of parcalar) {
    const adim = parcaCoz(p.ogeler, baglam, oncekiRobotlar);
    if (!adim) continue;
    adim.sira = sonuc.adimlar.length ? (p.sira ?? oncekiSira) : "simdi";
    if (adim.robotlar && !adim.robotlar.bos) oncekiRobotlar = adim.robotlar;
    if (p.kosul) adim.kosul = p.kosul;
    sonuc.adimlar.push(adim);
  }
  sonuc.adimlar = seferBirlestir(birlestir(sonuc.adimlar));
  sonuc.anlasilmayan = isaret.filter((t) => t.tip === "bilinmeyen" && !DOLGU.has(t.deger)).map((t) => t.yazilan);
  // güven: anlaşılan kelime oranı + eylem bulundu mu
  const bilinen = isaret.filter((t) => t.tip !== "bilinmeyen" || DOLGU.has(t.deger)).length;
  sonuc.guven = sonuc.adimlar.length ? Math.min(1, 0.4 + 0.6 * (bilinen / Math.max(1, isaret.length))) - 0.15 * sonuc.duzeltmeler.length : 0;
  for (const a of sonuc.adimlar) if (a.soru) sonuc.sorular.push(a.soru);
  return sonuc;
}

// cümlede anlamı olmayan dolgu kelimeleri
const DOLGU = new Set(["ve", "ile", "de", "da", "ki", "bir", "su", "bu", "o", "lutfen", "lutfen", "hadi", "haydi", "acil", "hemen",
  "simdi", "biraz", "cabuk", "yavas", "tane", "adet", "olarak", "icin", "gibi", "kadar", "en", "yakin", "yakindaki", "uzak",
  "gidip", "giderek", "ama", "fakat", "yalniz", "sadece", "tamam", "evet", "hayir", "ok", "okey", "aga", "abi", "kanka",
  "kardesim", "dostum", "patron", "organizator", "ya", "yada", "veya", "mi", "mu", "misin", "musun", "bak", "bakalim", "sey",
  "seyler", "olan", "olani", "tum", "her", "sey", "seyi", "ne", "neyi", "kim", "kimi", "dan", "den", "tan", "ten", "e", "a",
  "mobs", "moblari", "mob", "moblar", "moblara", "canavar", "canavarlari", "dusman", "dusmanlari", "anahtarlar", "anahtarlari", "esyalari",
  "et", "etsin", "etsinler", "edin", "etmek", "etmesi", "et", "olsun", "olsunlar",   "kendi", "kendini", "senin", "benim", "onlarin", "onlar", "onlari", "onu", "ona", "geri", "birlikte", "toplu", "tek", "tekrar"]);

/** Bağlaçlardan yan cümlelere böler; her parçanın sırası (sonra/aynı) ve koşulu. */
function bol(isaret) {
  const out = [];
  let cur = { ogeler: [], sira: null, kosul: null };
  const kapat = () => {
    if (cur.ogeler.length) out.push(cur);
    cur = { ogeler: [], sira: null, kosul: null };
  };
  for (let i = 0; i < isaret.length; i++) {
    const t = isaret[i];
    if (t.tip === "sira") {
      if (t.deger === "once") continue;
      // "sonra" önceki parçayı kapatır; bu parça önceki bitince başlar
      if (cur.ogeler.some((o) => o.tip === "eylem")) kapat();
      cur.sira = t.deger === "ayni" ? "ayni" : "sonra";
      continue;
    }
    if (t.tip === "kosul" && (t.deger === "eger")) {
      if (cur.ogeler.some((o) => o.tip === "eylem")) kapat();
      cur.kosulBekle = true;
      continue;
    }
    // virgül ve "ve": eylem içeren parçadan sonra yeni bir eylem gelirse ayır
    if (t.tip === "eylem" && t.deger === "tekrar" && isaret.some((o) => o.tip === "eylem" && o.deger !== "tekrar")) continue;
    if (t.tip === "eylem" && cur.ogeler.some((o) => o.tip === "eylem") && !ayniEylemGrubu(cur, t)) {
      // "bin ve git" gibi: aynı parçanın devamı sayılmaz, sırayla yapılır
      const yeni = { ogeler: [], sira: cur.sira === "ayni" ? "sonra" : "sonra", kosul: null };
      // önceki eylemden sonra gelen robot/eşya yoksa bunlar yeni parçaya
      out.push(cur);
      cur = yeni;
    }
    if (t.tip === "kosul" && cur.kosulBekle) {
      cur.kosul = kosulCoz(cur.ogeler, t);
      cur.ogeler = [];
      cur.kosulBekle = false;
      continue;
    }
    if (t.tip === "kosul" && (t.deger === "gece" || t.deger === "gunduz")) {
      cur.kosul = { tur: t.deger };
      continue;
    }
    if (t.tip === "kosul" && (t.deger === "az" || t.deger === "cok") && cur.ogeler.some((o) => o.tip === "esya")) {
      cur.kosul = kosulCoz(cur.ogeler, t);
      cur.ogeler = cur.ogeler.filter((o) => o.tip === "robot" || o.tip === "hepsi");
      continue;
    }
    if (t.tip === "kosul" && t.deger === "can") {
      cur.kosul = { tur: "can" };
      continue;
    }
    cur.ogeler.push(t);
  }
  kapat();
  return out;
}
function ayniEylemGrubu(cur, t) {
  const son = [...cur.ogeler].reverse().find((o) => o.tip === "eylem");
  // "gidip yağmalayın" -> ayrı adımlar; "getir topla" -> aynı
  const AYNI = [["topla", "kaz", "kes"], ["dur", "bekle"], ["don", "gel"], ["takip", "gel"], ["takip", "koru"]];
  return son && (son.deger === t.deger || AYNI.some((g) => g.includes(son.deger) && g.includes(t.deger)));
}
function kosulCoz(ogeler, t) {
  const esya = ogeler.find((o) => o.tip === "esya");
  const sayi = ogeler.find((o) => o.tip === "sayi");
  if (esya) return { tur: t.deger === "cok" ? "esya_cok" : "esya_az", esya: esya.deger, n: sayi?.deger ?? (t.deger === "cok" ? 64 : 1) };
  if (t.deger === "gece" || t.deger === "gunduz") return { tur: t.deger };
  if (t.deger === "can") return { tur: "can" };
  return { tur: t.deger };
}

/** Bir yan cümleden tek adım. */
function parcaCoz(ogeler, baglam, oncekiRobotlar) {
  let eylemler = ogeler.filter((o) => o.tip === "eylem").map((o) => o.deger);
  if (eylemler.length > 1) eylemler = eylemler.filter((e) => e !== "tekrar");
  const esyalar = ogeler.filter((o) => o.tip === "esya");
  const sayilar = ogeler.filter((o) => o.tip === "sayi");
  const yerler = ogeler.filter((o) => o.tip === "yer");
  const yapilar = ogeler.filter((o) => o.tip === "yapi");
  let robotlar = robotSec(ogeler, baglam);
  if (robotlar.bos && oncekiRobotlar && !ogeler.some((o) => o.tip === "robot")) robotlar = { ...oncekiRobotlar, devral: true };
  let eylem = eylemler[0];
  // eylemsiz: "20 demir" -> topla; "elmas?" -> sor
  if (!eylem) {
    if (esyalar.length && sayilar.length) eylem = "topla";
    else if (esyalar.length) eylem = "sor";
    else if (yapilar.length && robotlar.turler?.includes("kesif")) eylem = "bul";
    else return null;
  }
  // eylem öncelikleri
  if (eylemler.includes("sor") && !eylemler.includes("topla")) eylem = "sor";
  if (eylemler.includes("insa")) eylem = "insa";
  // "10 meşale yap": eşya varsa ve yapı adı yoksa üretim
  if ((eylem === "insa" || eylem === "craft") && esyalar.length && !ogeler.some((o) => o.tip === "bilinmeyen" && !DOLGU.has(o.deger))) eylem = "craft";
  if (eylemler.includes("yagma")) eylem = "yagma";
  if (eylemler.includes("ver") && (yerler.some((y) => y.deger === "ben") || ogeler.some((o) => o.yazilan === "bana"))) eylem = "ver";
  if (eylem === "ek" || eylem === "kes" || eylem === "kaz") eylem = "topla";
  if (eylem === "topla" && robotlar.bos && ogeler.some((o) => o.yazilan === "bana")) eylem = "ver";
  // "X'i bul" + eşya -> topla
  if (eylem === "bul" && esyalar.length && !yapilar.length) eylem = "topla";
  const adim = { eylem, robotlar };
  const esya = esyalar[0];
  if (esya) {
    adim.esya = { anahtar: esya.deger, ...ESYA[esya.deger] };
    adim.esyalar = esyalar.map((e) => ({ anahtar: e.deger, ...ESYA[e.deger] }));
    // eşya başına miktar: "20 demir ve 5 elmas"
    adim.miktarlar = esyalar.map((e) => {
      const s = [...ogeler].filter((o) => o.tip === "sayi" && o.son <= e.bas).pop();
      const yakin = s && e.bas - s.son <= 1 ? s.deger : null;
      return yakin;
    });
  }
  // miktar: eşyanın önündeki sayı; robot numarası olarak kullanılmış sayılar hariç
  const kullanilan = new Set(robotlar.sayilar ?? []);
  const miktar = sayilar.filter((s) => !kullanilan.has(s)).find((s) => !esya || s.son <= esya.bas) ?? sayilar.filter((s) => !kullanilan.has(s))[0];
  if (miktar) adim.miktar = miktar.deger;
  if (yapilar.length) adim.yapi = yapilar[0].deger;
  if (yerler.length) adim.yer = yerler[0].deger;
  if (ogeler.some((o) => o.tip === "kosul" && o.deger === "can")) adim.kosul = { tur: "can" };
  // ham yazıdan yapı adı (Mimar kütüphanesi): "kule kur", "çiftlik yap"
  if (eylem === "insa") adim.yapiAdi = ogeler.filter((o) => o.tip === "bilinmeyen" && !DOLGU.has(o.deger)).map((o) => o.deger).join(" ");
  // koordinat: üç sayı arka arkaya
  const ss = sayilar.map((s) => s.deger);
  if ((eylem === "git" || eylem === "gel") && ss.length >= 2 && !esya) {
    const negatif = ogeler.filter((o) => o.tip === "bilinmeyen" && /^-\d+$/.test(o.deger)).map((o) => Number(o.deger));
    adim.koordinat = ss.length >= 3 ? { x: ss[0], y: ss[1], z: ss[2] } : { x: ss[0], z: ss[1] };
    if (negatif.length) adim.koordinat = null;
  }
  // varsayılanlar ve sorular
  if (eylem === "topla" && !esya) adim.soru = "Ne toplansın? (ör. \"20 demir\")";
  if (eylem === "topla" && esya && robotlar.bos) {
    const kay = ESYA[esya.deger]?.kaynak;
    if (kay) adim.robotlar = { turler: [kay[0]], bos: false, otomatik: true };
    else if (!eylemler.includes("ver")) { adim.eylem = "ver"; }
  }
  if (adim.eylem === "yagma" && !yapilar.length && !yerler.length) adim.yer = adim.yer ?? "ben";
  if (["sefer", "bin"].includes(eylem) || (eylemler.includes("bin") && (yapilar.length || eylemler.includes("git")))) {
    if (eylemler.includes("bin") || robotlar.turler?.includes("kesif") || eylem === "sefer") adim.eylem = yapilar.length ? "sefer" : eylem;
  }
  return adim;
}

/** Robot seçimi: türler, numaralar ("madenci 3, 4 ve 5"), adlar, "hepsi". */
function robotSec(ogeler, baglam) {
  const sec = { turler: [], numaralar: {}, idler: [], hepsi: false, bos: true, sayilar: [] };
  let sonTur = null;
  for (let i = 0; i < ogeler.length; i++) {
    const o = ogeler[i];
    if (o.tip === "robotad") {
      sec.idler.push(o.deger);
      (sec.adlar ??= []).push(o.ad);
      sec.bos = false;
      sonTur = o.tur;
      continue;
    }
    if (o.tip === "robot") {
      sonTur = o.deger;
      sec.bos = false;
      if (/(ler|lar)/.test(String(o.yazilan ?? "").split(" ").pop().slice(3))) sec.cogul = true;   // madenciler, kılıçlılara
      if (!sec.turler.includes(o.deger)) sec.turler.push(o.deger);
      // "4. kılıçlı" : önceki sayı
      const once = ogeler[i - 1];
      if (once?.tip === "sayi" && /\.$/.test(String(o.yazilanOnce ?? "")) === false && once.siraSayisi) {
        (sec.numaralar[o.deger] ??= []).push(once.deger);
        sec.sayilar.push(once);
      }
      continue;
    }
    if (o.tip === "sayi" && sonTur && sonTur !== "kesif") {
      // tür adından hemen sonra gelen küçük sayılar numaradır ("kılıçlı 4", "madenci 3, 4 ve 5"); sonrasında eşya varsa miktar
      const sonraki = ogeler[i + 1];
      if (sonraki?.tip === "esya") continue;
      if (o.deger >= 1 && o.deger <= 99 && Number.isInteger(o.deger)) {
        (sec.numaralar[sonTur] ??= []).push(o.deger);
        sec.sayilar.push(o);
        continue;
      }
    }
    if (o.tip === "hepsi") {
      sec.hepsi = true;
      sec.bos = false;
    }
    if (o.tip === "eylem" || o.tip === "esya" || o.tip === "yapi") sonTur = sonTur && o.tip === "eylem" ? null : sonTur;
  }
  // numaralı türün kendisi "bütün türü" değil
  if (Object.keys(sec.numaralar).length) sec.numarali = true;
  return sec;
}

/** "Madenci-3", "kılıçlı 4", özel adlar ("Şimşek") gibi robot adlarını işaretler. */
function ozelAdlar(ks, isaret, robotlar) {
  for (const r of robotlar) {
    const ad = sade(r.ad).replace(/[-_]/g, " ").split(" ").filter(Boolean);
    if (!ad.length) continue;
    if (ad.length === 2 && /^\d+$/.test(ad[1]) && Object.values(ROBOT_TUR).some((ls) => ls.some((x) => sade(x) === ad[0]))) continue;
    for (let i = 0; i < isaret.length; i++) {
      const t = isaret[i];
      const kel = ks.slice(t.bas, t.bas + ad.length);
      if (kel.length === ad.length && kel.every((k, j) => k === ad[j] || karsilar(k.replace(/-/g, " "), ad[j]))) {
        // tür adı + numara olarak zaten okunacaksa dokunma (madenci 3); yalnız özel adlar
        if (ad.length === 1 && ROBOT_TUR[r.tur]?.some((x) => sade(x) === ad[0])) continue;
        isaret.splice(i, 1, { tip: "robotad", deger: r.id, ad: r.ad, tur: r.tur, bas: t.bas, son: t.bas + ad.length, yazilan: kel.join(" ") });
      }
    }
    // "madenci-3" tek kelime
    const tek = sade(r.ad).replace(/\s+/g, "");
    for (let i = 0; i < isaret.length; i++) {
      if (isaret[i].tip === "bilinmeyen" && isaret[i].deger === tek) isaret.splice(i, 1, { ...isaret[i], tip: "robotad", deger: r.id, tur: r.tur });
    }
  }
  // "madenci-3" biçimini tür + sayı yap
  for (let i = 0; i < isaret.length; i++) {
    const t = isaret[i];
    if (t.tip !== "bilinmeyen") continue;
    const m = /^([a-z]+)-(\d+)$/.exec(t.deger);
    if (!m) continue;
    const tur = Object.keys(ROBOT_TUR).find((k) => ROBOT_TUR[k].some((x) => karsilar(m[1], sade(x))));
    if (tur) isaret.splice(i, 1, { tip: "robot", deger: tur, bas: t.bas, son: t.son }, { tip: "sayi", deger: Number(m[2]), bas: t.bas, son: t.son });
  }
  // "4." sıra sayısı + tür
  for (let i = 0; i < isaret.length - 1; i++) {
    const t = isaret[i];
    if (t.tip === "sayi" && /\.$/.test(ks[t.bas] ?? "") && isaret[i + 1].tip === "robot" && isaret[i - 1]?.tip !== "robot"
      && isaret[i - 1]?.tip !== "sayi") t.siraSayisi = true;
  }
}

/** "Keşif'e binin, deneme odasına gidip yağmalayın, mobları öldürün, geri dönün" -> tek sefer adımı. */
function seferBirlestir(adimlar) {
  const binVar = adimlar.some((a) => a.eylem === "bin" || a.eylem === "sefer")
    || adimlar.some((a) => a.robotlar?.turler?.includes("kesif") && ["git", "bin", "yagma"].includes(a.eylem));
  const yapiAdim = adimlar.find((a) => a.yapi);
  if (!binVar || !yapiAdim) return adimlar;
  const r = { turler: [], numaralar: {}, idler: [], hepsi: false, bos: true, sayilar: [] };
  for (const a of adimlar) {
    const x = a.robotlar;
    if (!x || x.bos) continue;
    r.bos = false;
    r.hepsi ||= x.hepsi;
    for (const t of x.turler ?? []) if (t !== "kesif" && !r.turler.includes(t)) r.turler.push(t);
    for (const [t, ns] of Object.entries(x.numaralar ?? {})) {
      r.numaralar[t] ??= [];
      for (const n of ns) if (!r.numaralar[t].includes(n)) r.numaralar[t].push(n);
      if (!r.turler.includes(t)) r.turler.push(t);
    }
    for (const id of x.idler ?? []) if (!r.idler.includes(id)) r.idler.push(id);
  }
  if (Object.keys(r.numaralar).length) r.numarali = true;
  const gorevler = [...new Set(adimlar.map((a) => a.eylem).filter((e) => ["yagma", "saldir", "topla", "don"].includes(e)))];
  const sefer = { eylem: "sefer", robotlar: r, yapi: yapiAdim.yapi, gorevler, sira: "simdi" };
  const kalan = adimlar.filter((a) => !["bin", "sefer", "git", "yagma", "saldir", "topla", "don", "tekrar", "dur"].includes(a.eylem) || a.kosul);
  return [sefer, ...kalan];
}

/** Aynı eylem ve robotlu art arda adımları birleştirir ("20 demir ve 10 elmas getirsin" tek görev). */
function birlestir(adimlar) {
  const out = [];
  for (const a of adimlar) {
    const p = out[out.length - 1];
    if (p && a.eylem === "topla" && p.eylem === "topla" && a.robotlar?.devral && !a.kosul && a.sira !== "sonra" && p.esya && a.esya) {
      p.esyalar.push(...a.esyalar);
      p.miktarlar.push(...a.miktarlar);
      continue;
    }
    out.push(a);
  }
  return out;
}

// ======================================================================= açıklama (onay ekranı için)
const EYLEM_AD = {
  topla: "toplasın", ver: "sana getireyim", sor: "sandıklarda arayayım", yagma: "yağmalasın", sefer: "sefere çıksın",
  bin: "Keşif'e binsin", git: "gitsin", gel: "yanına gelsin", don: "eve dönsün", dur: "dursun", devam: "devam etsin",
  bekle: "beklesin", takip: "seni takip etsin", koru: "korusun", saldir: "saldırsın", bul: "bulsun", kesfet: "keşfetsin",
  insa: "inşa etsin", duzenle: "sandıkları düzenleyeyim", koy: "sandığa koysun", eritme: "eritsin", durum: "durumu söyleyeyim",
  isim: "adını değiştirsin", hatirla: "hatırlayayım",
};
export function cogul(s) {
  const unlu = [...s.toLowerCase()].reverse().find((c) => "aeıioöuü".includes(c));
  return s + ("aıou".includes(unlu) ? "lar" : "ler");
}
export function robotlarYazi(r) {
  if (!r || r.bos) return "uygun robot";
  if (r.hepsi && !r.turler.length) return "bütün robotlar";
  const p = [];
  for (const t of r.turler) {
    const no = r.numaralar?.[t];
    p.push(no?.length ? no.map((n) => `${turAdi(t)}-${n}`).join(", ") : `${r.hepsi ? "bütün " : ""}${cogul(turAdi(t))}`);
  }
  if (r.adlar?.length) p.push(...r.adlar);
  else if (r.idler?.length) p.push(`${r.idler.length} robot`);
  return p.join(", ");
}
export function adimYazi(a, yapiAdi = (t) => t) {
  const kim = ["ver", "sor", "duzenle", "durum", "hatirla"].includes(a.eylem) ? "Ben" : robotlarYazi(a.robotlar);
  const parcalar = [];
  if (a.esyalar?.length) {
    parcalar.push(a.esyalar.map((e, i) => `${a.miktarlar?.[i] ?? (i === 0 ? a.miktar ?? "" : "")} ${e.ad}`.trim()).join(", "));
  }
  if (a.yapi) parcalar.push(`(${yapiAdi(a.yapi)})`);
  if (a.yer && a.yer !== "sandik") parcalar.push(a.yer === "ben" ? "(senin yanın)" : a.yer === "ev" ? "(ev)" : `(${a.yer})`);
  if (a.koordinat) parcalar.push(`(${a.koordinat.x}, ${a.koordinat.z})`);
  if (a.yapiAdi) parcalar.push(`"${a.yapiAdi}"`);
  const kos = a.kosul ? ` §7[${kosulYazi(a.kosul)}]§r` : "";
  return `${kim}: ${parcalar.join(" ")} ${EYLEM_AD[a.eylem] ?? a.eylem}${kos}`.replace(/\s+/g, " ").trim();
}
export function kosulYazi(k) {
  if (!k) return "";
  if (k.tur === "esya_az") return `sandıklarda ${k.n}'den az ${ESYA[k.esya]?.ad ?? k.esya} kalınca`;
  if (k.tur === "esya_cok") return `sandıklarda ${k.n}'den çok ${ESYA[k.esya]?.ad ?? k.esya} olunca`;
  if (k.tur === "gece") return "gece olunca";
  if (k.tur === "gunduz") return "sabah olunca";
  if (k.tur === "can") return "canın azalınca";
  return k.tur;
}

export const YARDIM = [
  "§lBana yazıyla görev verebilirsin. Örnekler:§r",
  "• §bmadenci 20 demir getirsin§r  • §boduncular 2 deste meşe kessin§r",
  "• §bkılıçlı 4 ve kılıçlı 7 peşimden gelsin§r  • §bherkes eve dönsün§r",
  "• §belmas nerede?§r  • §bbana 10 ekmek ver§r  • §bsandıkları düzenle§r",
  "• §bmadenci 3, 4 ve 5 keşife binin, en yakın deneme odasına gidip yağmalayın§r",
  "• §bönce madenci 30 kömür getirsin, sonra çiftçi buğday eksin§r",
  "• §beğer demir 10'dan azsa madenci 32 demir getirsin§r  • §bgece olunca kılıçlılar evi korusun§r",
  "• §bkeşif köy bulsun§r  • §bmimar buraya kule kursun§r  • §bdurum§r",
  "Yazım hatası olursa düzeltip sorarım. \"tekrar\" yazarsan son komutu yinelerim.",
].join("\n");
