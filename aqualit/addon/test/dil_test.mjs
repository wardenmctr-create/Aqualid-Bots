// Organizatör dil motoru birim testi: node test/dil_test.mjs
import { anla, adimYazi, sade, sayiOku } from "../src/scripts/dil.js";

const robotlar = [
  { id: "m3", ad: "Madenci-3", tur: "madenci", no: 3 }, { id: "m4", ad: "Madenci-4", tur: "madenci", no: 4 },
  { id: "m5", ad: "Madenci-5", tur: "madenci", no: 5 }, { id: "k2", ad: "Kılıçlı-2", tur: "kilicli", no: 2 },
  { id: "k4", ad: "Kılıçlı-4", tur: "kilicli", no: 4 }, { id: "k7", ad: "Kılıçlı-7", tur: "kilicli", no: 7 },
  { id: "o1", ad: "Oduncu-1", tur: "oduncu", no: 1 }, { id: "s1", ad: "Şimşek", tur: "kilicli", no: 9 },
];
let fail = 0, n = 0;
function t(metin, fn, ad) {
  n++;
  const r = anla(metin, { robotlar });
  let ok = false;
  try { ok = fn(r); } catch (e) { ok = false; }
  if (!ok) {
    fail++;
    console.log(`✘ ${ad ?? metin}\n   ${JSON.stringify(r.adimlar.map((a) => ({ e: a.eylem, r: a.robotlar, es: a.esyalar?.map((x) => x.anahtar), m: a.miktar, ms: a.miktarlar, y: a.yapi, yer: a.yer, s: a.sira, k: a.kosul })))} sohbet=${r.sohbet} düz=${JSON.stringify(r.duzeltmeler)}`);
  } else console.log(`✔ ${ad ?? metin}  →  ${r.sohbet ? "(sohbet)" : r.adimlar.map((a) => adimYazi(a)).join(" | ")}`);
}
const A = (r, i = 0) => r.adimlar[i];
const R = (a) => a.robotlar;

// sayılar
const S = (s) => sayiOku(sade(s).split(" "), 0)?.n;
t("sayı", () => S("yirmi beş") === 25 && S("yüz elli") === 150 && S("2 deste") === 128 && S("yarım deste") === 32 && S("bin") === 1000 && S("on iki") === 12, "sayılar yazıyla");
// toplama
t("madenci 20 demir getir", (r) => A(r).eylem === "topla" && R(A(r)).turler[0] === "madenci" && A(r).esya.anahtar === "demir" && A(r).miktarlar[0] === 20);
t("Madenciler yirmi beş elmas getirsin", (r) => A(r).eylem === "topla" && A(r).esya.anahtar === "elmas" && A(r).miktarlar[0] === 25);
t("madenci 3 otuz kömür kazsın", (r) => R(A(r)).numaralar.madenci?.[0] === 3 && A(r).esya.anahtar === "komur" && A(r).miktarlar[0] === 30);
t("oduncular 2 deste meşe kessin", (r) => A(r).eylem === "topla" && R(A(r)).turler[0] === "oduncu" && A(r).miktarlar[0] === 128);
t("çiftçi buğday eksin", (r) => A(r).eylem === "topla" && R(A(r)).turler[0] === "ciftci" && A(r).esya.anahtar === "bugday");
t("20 demir lazım", (r) => (A(r).eylem === "topla" || A(r).eylem === "ver") && A(r).esya.anahtar === "demir");
t("bana 64 kum getir", (r) => A(r).esya.anahtar === "kum" && A(r).miktarlar[0] === 64);
t("kürekçi bir deste kum toplasın", (r) => R(A(r)).turler[0] === "kurekci" && A(r).miktarlar[0] === 64);
t("madenci 20 demir ve 10 elmas getirsin", (r) => r.adimlar.length === 1 && A(r).esyalar.length === 2 && A(r).miktarlar[1] === 10);
t("madenciye 15 altın kazdır", (r) => A(r).esya.anahtar === "altin" && R(A(r)).turler[0] === "madenci");
t("birkaç kömür getirin", (r) => A(r).esya.anahtar === "komur" && A(r).miktarlar[0] === 8);
t("odun lazım", (r) => A(r).esya?.anahtar === "odun");
// yazım hatası
t("madenci 10 elmaz getr", (r) => A(r).esya.anahtar === "elmas" && r.duzeltmeler.length >= 1, "yazım hatası: elmaz -> elmas");
t("kasif köy bulsun", (r) => A(r).eylem === "bul" && R(A(r)).turler[0] === "kesif" && A(r).yapi === "koy", "kaşif = keşif");
t("madnci 5 demir getirsin", (r) => R(A(r)).turler[0] === "madenci" && r.duzeltmeler.length === 1, "madnci -> madenci");
// robotlar ve numaralar
t("kılıçlı 4 ve kılıçlı 7 peşimden gelsin", (r) => A(r).eylem === "takip" && R(A(r)).numaralar.kilicli?.join() === "4,7");
t("Kılıçlı-2 burada beklesin", (r) => A(r).eylem === "bekle" && R(A(r)).numaralar.kilicli?.[0] === 2);
t("4. kılıçlı eve dönsün", (r) => A(r).eylem === "don" && R(A(r)).numaralar.kilicli?.[0] === 4);
t("madenci 3, 4 ve 5 eve dönsün", (r) => R(A(r)).numaralar.madenci?.join() === "3,4,5" && A(r).eylem === "don");
t("şimşek bizi korusun", (r) => A(r).eylem === "koru" && R(A(r)).idler.includes("s1"), "özel ad");
t("herkes eve dönsün", (r) => A(r).eylem === "don" && R(A(r)).hepsi);
t("bütün robotlar dursun", (r) => A(r).eylem === "dur" && R(A(r)).hepsi);
t("kılıçlılar evi korusun", (r) => A(r).eylem === "koru" && R(A(r)).turler[0] === "kilicli" && A(r).yer === "ev");
t("kılıçlılar yanıma gelsin", (r) => A(r).eylem === "gel" && A(r).yer === "ben");
t("kılıçlı 7 mobları öldürsün", (r) => A(r).eylem === "saldir");
// zincirler
t("önce madenci 30 kömür getirsin, sonra çiftçi buğday eksin", (r) => r.adimlar.length === 2 && A(r, 1).sira === "sonra" && R(A(r, 1)).turler[0] === "ciftci");
t("madenciler demir kazsın ardından eve dönsünler", (r) => r.adimlar.length === 2 && A(r, 1).eylem === "don" && R(A(r, 1)).turler[0] === "madenci", "robot devralma");
t("oduncu 64 meşe kessin aynı anda madenci 20 taş getirsin", (r) => r.adimlar.length === 2 && A(r, 1).sira === "ayni");
t("madenci kömür getirsin bitince oduncu meşe kessin bitince çiftçi havuç eksin", (r) => r.adimlar.length === 3 && A(r, 2).sira === "sonra");
// koşullar
t("eğer demir 10'dan azsa madenci 32 demir getirsin", (r) => A(r).kosul?.tur === "esya_az" && A(r).kosul.n === 10 && A(r).miktarlar[0] === 32);
t("kömür biterse madenci 64 kömür kazsın", (r) => A(r).kosul?.tur === "esya_az" && A(r).esya.anahtar === "komur");
t("gece olunca kılıçlılar evi korusun", (r) => A(r).kosul?.tur === "gece" && A(r).eylem === "koru");
// sorular ve eşyalar
t("elmas nerede?", (r) => A(r).eylem === "sor" && A(r).esya.anahtar === "elmas");
t("kaç tane demir var", (r) => A(r).eylem === "sor" && A(r).esya.anahtar === "demir");
t("sandıklarda yemek var mı", (r) => A(r).eylem === "sor" && A(r).esya.anahtar === "yemek");
t("bana 10 ekmek ver", (r) => A(r).eylem === "ver" && A(r).esya.anahtar === "ekmek" && A(r).miktarlar[0] === 10);
t("bana bir kazma lazım", (r) => A(r).eylem === "ver" && A(r).esya.anahtar === "kazma");
t("sandıkları düzenle", (r) => A(r).eylem === "duzenle");
t("sandıkları sırala", (r) => A(r).eylem === "duzenle");
t("durum", (r) => A(r).eylem === "durum");
t("ne yapıyorsunuz", (r) => A(r).eylem === "durum");
// keşif, sefer, yağma, inşa
t("Kılıçlı 4, kılıçlı 7, kılıçlı 2, madenci 3, madenci 4 ve madenci 5. Kaşife binin, en yakın trial chambers'a gidip sandıkları yağmalayın, mobları öldürün, anahtarları alın, anahtarlar ile eşyaları toplayıp kaşifle birlikte tekrar geri dönün",
  (r) => r.adimlar.some((a) => a.eylem === "sefer" && a.yapi === "deneme_odasi" && a.robotlar.numaralar.kilicli?.length === 3 && a.robotlar.numaralar.madenci?.length === 3),
  "kullanıcının örnek sefer cümlesi");
t("madenciler keşife binip deneme odasına gitsin", (r) => r.adimlar.some((a) => a.eylem === "sefer" && a.yapi === "deneme_odasi"));
t("keşif en yakın nether kalesini bulsun", (r) => A(r).eylem === "bul" && A(r).yapi === "nether_kalesi");
t("madenciler çöl tapınağını yağmalasın", (r) => A(r).eylem === "yagma" && A(r).yapi === "col_tapinagi");
t("oduncu buradaki sandıkları yağmalasın", (r) => A(r).eylem === "yagma" && A(r).yer === "ben");
t("mimar buraya kule kursun", (r) => A(r).eylem === "insa" && A(r).yer === "ben" && /kule/.test(A(r).yapiAdi));
t("keşif çevreyi keşfetsin", (r) => A(r).eylem === "kesfet" || A(r).eylem === "bul");
t("madenciler 100 200 noktasına gitsin", (r) => A(r).eylem === "git" && A(r).koordinat?.x === 100);
// sohbet
t("merhaba", (r) => !!r.sohbet);
t("teşekkürler organizatör", (r) => !!r.sohbet);
t("ne yapabilirsin", (r) => /Örnek/.test(r.sohbet ?? ""));
t("sen kimsin", (r) => /Organizatör/.test(r.sohbet ?? ""));
// tekrar
{
  const ilk = anla("madenci 20 demir getirsin", { robotlar });
  n++;
  const r = anla("tekrar", { robotlar, son: ilk });
  if (r.tekrar && r.adimlar[0]?.esya?.anahtar === "demir") console.log("✔ tekrar: son komutu yineler");
  else { fail++; console.log("✘ tekrar"); }
}
// devam / dur
t("madenci 3 dursun", (r) => A(r).eylem === "dur" && R(A(r)).numaralar.madenci?.[0] === 3);
t("madenciler işe devam etsin", (r) => A(r).eylem === "devam");
t("oduncu 1 beni takip etsin", (r) => A(r).eylem === "takip" && R(A(r)).numaralar.oduncu?.[0] === 1);

console.log(fail ? `\nBAŞARISIZ: ${fail}/${n}` : `\nTÜM DİL DENEMELERİ GEÇTİ (${n})`);
process.exit(fail ? 1 : 0);
