# Aqualit Robotları — Ayrıntılı Mod Planı

29 Ekim 2026 · v0.2.9 · Kullanıcının belgesindeki planın aynısı (https://claude.ai/artifact/XxXBNAehQDjMnAKH8JbizQ).
İlk plan (V1, Kılıçlı'nın 50 gücü, kombolar, 33 animasyon, takım taktikleri): `docs/ilk_plan_v1.txt`.

## Özet

Aqualit Robotları, Minecraft Bedrock 26.50 (Android telefonda oynanıyor) için iş robotları, yeni bir maden (Aqualit),
kabuk ve taş zırhlar ve yeni bir Aqualit sandığı ekleyen bir eklenti. Şu anki sürüm **v0.2.9**: derleniyor, sahte test
dünyasındaki bütün denemeleri geçiyor (20 senaryo, 307 denetim), ama **oyunda henüz denenmedi**.

Öncelik sırası: oyunda v0.2.9 sandığını denemek → Mimar (İnşaatçı) → Organizatör ve Aqualit Telefon → tam Keşif →
Kılıçlı'nın büyük güncellemesi.

## Sürüm geçmişi

| Tarih | Sürüm | Ne geldi |
| --- | --- | --- |
| 29 Ekim | v0.2.9 | Yeni Aqualit sandığı: oyunun gerçek sandığı (dokun aç, basılı tut kır), çift sandık, ▶◀ sayfalar, kilitli yuvalar, eğil + basılı tut paneli, kapasite tek 200 / çift 500, sahibine özel, Kılıçlı/İnşaatçı/Toplayıcı sandıkları, eski sandıklar eşyalarıyla taşınır. Oyunda denenmedi. |
| 28 Ekim | v0.2.8 | Taş zırh sadeleşti: görünüş aynı, özel özellik ve 5 taş kitabı kalktı; deri zırh değerleri. Derin kayrak biraz güçlü, bakırın altında. |
| 28 Ekim | v0.2.7 | Kabuk Zırhları v1.2.1 birleştirildi: 12 ağaç (Kızıl ve Çarpık Nether dahil), gerçek dayanıklılık, ateş kuralları, Reçine Koruması I–III, 6 kitap yalnız doğal sandıklardan çıkar. |
| 25–28 Ekim | Kabuk Zırhları v1.0 | Ayrı paket: yalnız kabuk zırhları ve kabuk soyma (namespace `kabuk:`). Aqualit ile aynı dünyada açılınca uyarı verir. |
| 24 Ekim | v0.2.6 | Mini Keşif: 6 biçim, dönüşüm animasyonları ve sesleri, binme ve sürme, matkap düz/aşağı/çapraz 3x3. |
| 24 Ekim | v0.2.5 | Kılıçlı'nın 5 gücüne epik efektler, 6 güç sesi. |
| 24 Ekim | v0.2.4 | Robotların görünmemesi düzeltildi. |
| 24 Ekim | v0.2.3 | V3 ara sürüm: Kılıçlı'nın 5 gücü, takım davranışı ve tamir kiti, uzak görüş ve keşif, çanta ekranı, çiftçinin kova numarası, boş zaman işleri, konum çubuğu. |
| 24 Ekim | v0.2.2 | Sunucu çökmesi düzeltildi (sonsuz döngü, tik bütçesi), metalik robot sesleri. |
| 23 Ekim | v0.2.1 | V2 düzeltmeleri. |
| 22–23 Ekim | V1–V2 | Aqualit cevheri ve aletleri, 4 iş robotu, Kılıçlı (5 seviye), görev kumandası, telsiz, takip ekranı, varlık sandıkları, kapalı robot ve tamir kiti, kabuk/taş/Aqualit zırhları. |

## Oyunda şu an olanlar

### Robotlar

Tarif: üstte Aqualit Bloğu, ortada külçe + Aqualit Sandık + külçe, altta işini belirleyen alet. Yere konunca yanına kendi
türünde sandık kurulur ve Görev Kumandası verilir.

| Robot | Alet | Ne yapıyor |
| --- | --- | --- |
| Madenci | Aqualit Kazma | Seçilen madenleri kazar; Skyblock modunda taş makinesinden taş toplar; fırın varsa eritir |
| Kürekçi | Aqualit Kürek | Kum, toprak, çakıl toplar; kumu cama çevirebilir |
| Çiftçi | Aqualit Çapa | Tarla kurar, eker, hasat eder; su uzaksa suyu havaya atıp Aqualit kovayla yakalar |
| Oduncu | Aqualit Balta | Seçilen ağaçtan keser, fidan diker; yüzlerce blok ötedeki ağacı bulur |
| Kılıçlı (1–5) | Aqualit Kılıç | Toplama, takip-koruma, bölge koruma; 5 güç; takım; tamir kiti; geri çekilme. Can 30/60/100/160/300, hasar 7/8/10/12/15 |
| Mini Keşif | Pusula | Uçak, gemi, denizaltı, arazi aracı, matkap; 5 kişi biner (matkap 3) |

Ortak: sandığa / sahibine getirme ya da eritip koyma; uzaklık 32–512 blok ya da Sınırsız; uzak görüş ve keşif, kaynak
hafızası; boş zaman işleri (eritme, tamir kiti, hasat, eksik haberi); can bitince kapalı robot heykeli; 45 metalik ses.

### Cihazlar ve eşyalar

| Eşya | Ne yapıyor |
| --- | --- |
| Görev Kumandası | Ne toplanacak (resimli liste), ne kadar, değerli bulursa alsın mı, bitince ne yapsın, uzaklık, çantası |
| Robot Telsizi | Robot listesi, mesajlar, onay soruları, geri dön modları, konum isteme, konum çubuğu, sandık listesi |
| Takip Ekranı | Canlı dijital harita ve robotun gözünden canlı izleme |
| Komut Çubuğu | Kılıçlıları bağla; havaya: dur/devam; eğilip: yanına gel |
| Bölge Seçici | Kılıçlı'nın koruyacağı bölgenin iki köşesi |
| Kılıçlı Ayar Dişlisi (yaratıcı) | Can, hasar, hız, enerji, model, ciddiyet (1–100) |
| Aqualit Tamir Kiti | 5 kullanımlık; kapalı robotu uyandırır ve onarır |
| Konum çubuğu | Robotlar kafa resimleriyle; gönderilen konum iğnesi |
| Çanta ekranı | Türkçe adlar ve resimlerle; adet seçerek al/koy |

### Cevher, aletler, zırhlar

- Aqualit cevheri: taş ve derin kayrakta, y -48 ile 16, yığın başına 7 deneme, 5'lik damarlar.
- Aqualit aletleri: dayanıklılık 937, kazma hızı 10, hasar kazma 5 / kürek 4 / balta 6 / çapa 4 / kılıç 7.
- Aqualit zırh seti: koruma 3/8/6/3, dayanıklılık 330/480/450/390; tam sette Çabukluk I, suda nefes, suda %40 hız.
- Kabuk zırhları: 12 ağaç × 4 parça; tam set 5 koruma, %20 hız, %30 az düşüş hasarı; Nether kabuğu ateşe dayanıklı.
- Kabuk büyü kitapları (6): Esnek Lifler, Hafif Adımlar, Orman Gölgesi, Reçine Koruması, Son Kabuk, Düşüş Aşınması.
  Üretilemez; doğal sandıkların ilk açılışında %16; elde kullanılınca işlenir.
- Taş zırh deri değerlerinde (7 koruma); derin kayrak 8 koruma, bakırın altında.

## v0.2.9 Aqualit sandığı

Kod: `src/scripts/sandik.js`, panel `ui/chest.js`, dosyalar `gen/sandik_gen.py`, deneme `sim.mjs sandik` (91 denetim).

- Dokun: açılır. Basılı tut: kırılır (bütün sayfalar, eklenen sandıklar ve Aqualit sandığı düşer). Eğil + basılı tut: panel
  (İçindekiler, Kapasite, Açılış sayfası, Erişim, İsim ver, Sandığı kaldır).
- Sayfalar: sağ alt ▶, sol alt ◀; oka dokununca ya da imleçle tutunca sayfa çevrilir; oka bırakılan eşya boş yuvaya taşınır.
- Kapasite: tek 27, çift 54; her normal sandık +27; en çok tek 200, çift 500; fazlası son sayfada kilitli yuva.
- Sahiplik: başkası açamaz, kıramaz, panelini açamaz, yanına sandık koyamaz. Patlama kırmaz.
- Yan yana: farklı tür ve sıradan tuzaklı sandık Aqualit sandığının yanına konamaz; çiftin yanına başka tür konabilir.
- Türler (8): Aqualit, Madenci, Kürekçi, Çiftçi, Oduncu, Kılıçlı, İnşaatçı, Toplayıcı.
- Depo: plaka varlığı `aqualit:sandik_depo` (128 yuva) + gerekirse görünmez `aqualit:sandik_ek` (128 yuva).
- Eski varlık sandıkları yüklenince aynı yere gerçek sandık konur; eşyalar, ad, erişim, robot bağlantıları korunur.
- Yan etki: sıradan tuzaklı sandıklar da Aqualit görünümünde (plakasız); tuzaklı sandık açılınca kızıltaş sinyali verir.

Oyunda doğrulanacaklar:

- [ ] Aqualit sandık eşyası (`minecraft:block_placer`) tuzaklı sandığı koyuyor mu, oyuncuya dönük mü?
- [ ] Çift sandıkta kap 54 yuva görünüyor mu?
- [ ] Amblem plakası ön yüzde mi (yön ilk koyuşta ölçülüyor)?
- [ ] Plakaya dokunmak sandığı açıyor mu?
- [ ] Telefon arayüzünde ▶◀ oklarına dokununca sayfa dönüyor mu?
- [ ] Dünyayı kapat-aç: 128'den sonraki yuvalar duruyor mu?
- [ ] Eski varlık sandıkları taşınıyor mu, robotlar yeni sandığa gidiyor mu?
- [ ] Robotun betikle kurduğu sandık düzgün mü?

## Yol haritası

1. **v0.2.9 · Aqualit sandığı** — testler geçti, oyunda denenecek. *Kapı: oyunda denendi, sorunlar düzeltildi.*
2. **v0.3.0 · Mimar (İnşaatçı)** — sıradaki iş: uçan inşaatçı, 40 yapı + 40 çiftlik, hologramla yer seçme, malzemesiz yapım, İnşa Çubuğu.
3. **v0.3.x · Organizatör ve Telefon** — bütün sandıklara erişen robot, görev zinciri, yazıyla görev verme.
4. **v0.4 · Tam Keşif** — DEVASA harita, binlerce blok ötedeki yapılar, köylü getirme, köy ve Trial Chambers bilgisi.
5. **v0.5 · Kılıçlı büyük güncelleme** — kalan 45 güç, kombolar, takım taktikleri, robot kostümü, %101 modu, yükseltme modülleri.

Her sürümde: iş robotu iyileştirmeleri, 4 denetim temiz, oyunda deneme listesi.

## Robot robot yapılacaklar

"Öneri" yazanlar onaylanmadı; başlamadan kullanıcıya sor.

### Mimar (İnşaatçı) — v0.3.0

Modeli hazır (baret, alet kemeri, sırtta plan rulosu); sandığı v0.2.9'da geldi; 25 yapı `gen/yapilar.py` içinde, oyuna bağlı değil.

- [ ] Robot eşyası ve tarifi. Öneri: diğer robotlar gibi, altta İnşa Çubuğu.
- [ ] Uçarak inşa eder; kimseyi taşıyamaz.
- [ ] Yapı kütüphanesi: 40 yapı + 40 çiftlik. Hazır 25: Minik Kulübe, Kamp Ateşi Alanı, Köy Kuyusu, Fener Direği, Çiçek
  Bahçesi, Çeşme, Ahşap Ev, İki Katlı Ev, Taş Ev, Çöl Evi, İglo, Cadı Kulübesi, Demirci, Kütüphane, Ambar, Yel Değirmeni,
  Gözetleme Kulesi, Deniz Feneri, Yağmacı Kulesi, Küçük Kale, End Şehri Kulesi, Buğday Tarlası, Hayvan Ağılı, Şeker Kamışı
  Çiftliği, End of Light Mega Çiftlik.
- [ ] İstenen ama olmayan yapılar: Küçük kulübe, Başlangıç evi, Büyük ev, Lüks ev, Mini villa, Orta villa, Büyük villa.
- [ ] 37 çiftlik daha, Bedrock kurallarına uygun: demir, altın (Nether), deneyim, yaratık, otomatik ekin, kavun-balkabak,
  bambu, yosun, bal, yün, tavuk, inek, köylü üretme, ticaret salonu, yağmacı baskını, gardiyan, balçık, creeper, cadı,
  blaze, wither iskeleti, enderman gibi.
- [ ] Menüde her yapının resmi ve 360° dönen 3B önizlemesi (menü dönen 3B gösteremez: menüde resim, dünyada döndürülebilir hologram).
- [ ] Hologramla yer seçme: dokunduğunda nereye bakıyorsan yapı o yöne döner.
- [ ] Malzemeyi sandıklardan toplar, eksikleri telsize yazar, Organizatör'den ister.
- [ ] Köylü gereken çiftliklerde: Mimar → Organizatör → Keşif en yakın köyden köylüleri ve eşyaları getirir.
- [ ] Ayar Dişlisi: adı "Ayar Dişlisi" (yaratıcı); Mimar için "malzeme toplamadan yap (Creative gibi)".
- [ ] İnşa Çubuğu (`insa.js` yazıldı, bağlanmadı): blok durumu, kopyala-yapıştır, suyla doldur, geri al.

### Organizatör ve Aqualit Telefon — v0.3.x

Kodda ve çizimlerde "Toplayıcı" adıyla model (sırt çantası, kulaklık, şapka, vizör) ve sandık hazır; Organizatör bu robot
olacak, adı kesinleşecek.

- [ ] Bütün sandıklara otomatik erişir (yine yalnız sahibinin), sandıkları türüne göre düzenler, görev zinciri kurar.
- [ ] Aqualit Telefon: yazıyla görev verme (şablonlu dil motoru, örnek "madenci 20 demir getir"), görev zincirleri, toplu komut.

### Keşif (tam) — v0.4

- [ ] Yapay zekâlı Keşif: binlerce blok ötedeki yapıları bulup gider (`calculateClosestBiomeFromSeed` + geçici yükleme).
- [ ] DEVASA harita: binlerce blok, robot hareket ettikçe yenilenir; bütün robotlar uzaktakini bununla bulur.
- [ ] Yapı bilgisi: köyde demirciye gider; Trial Chambers'ta mob keser, anahtar kullanır, sandık ve çömlek yağmalar
  (trial spawner yalnız oyuncu yakınken çalışır).
- [ ] Köylü taşıma, gerekli robotları yanına alma.

### Kılıçlı — büyük güncelleme

- [ ] Kalan 45 güç (`docs/ilk_plan_v1.txt` içindeki 50'lik liste).
- [ ] Kombolar ve takım kombolar, dizilim ve taktik ayarları.
- [ ] Ciddiyet %101 modu (10 sn zaman durur, sinematik kamera, hasar geri sarılır, oyunculara dokunmaz).
- [ ] Kılıçlı Robot Kostümü (oyuncu robota dönüşür, güçler eşya olarak, 9 hızlı erişim, 2 sayfa).
- [ ] Eşya toplama modunda portalla Nether ve End'e gitme, gerekirse portal yapma.
- [ ] Yükseltme Modülleri. Öneri: Model 2 = 2 Aqualit Bloğu + elmas; 3 = 3 blok + 2 elmas + kızıltaş bloğu;
  4 = 4 blok + 4 blaze çubuğu + ender incisi; 5 = 6 blok + Nether yıldızı + netherit külçesi.
- [ ] Bölge seçici düzeltmesi ve "bulunduğum yerin yarıçapını koru".
- [ ] Yer altındaki moblarla uğraşmasın; sahibine 1 kalpten fazla vuran her şeye saldırsın.
- [ ] Söz verilen 5 güç GIF'i.

### İş robotları (ortak)

- [ ] 1,5 blok zıplama (çit, duvar).
- [ ] Sandığın yanından geçerken eşyaları bırakma.
- [ ] Robota 2 sn basılı tutarak eşya verme.
- [ ] Çiftçi kemik tozu kullansın.
- [ ] Sınırsız robot envanteri.
- [ ] Kürekçi alanı düzleştirme ve geri doldurma.
- [ ] Canlı kontrol: takip ekranında "Kontrolü al" → turkuaz tuşlu panel, joystick/zıpla/eğil robota, kır/koy önündeki
  bloğa, kırmızı iptal bir adım geri.
- [ ] Takip ekranına gece görüşü ve kamera.

### Diğer

- [ ] Kabuk kitabı ganimetini daralt (çöl piramidi, Trial Chambers, maden sandıkları); şu an bütün doğal sandıklarda.
- [ ] Kitabın örsle basılması Bedrock'ta yok; şu an elde kullanılarak işleniyor.
- [ ] Claude'un önerdiği 7 fikirden kalan 6'sı: liste bu plana taşınamadı, kullanıcıya sor.

## Tarifler

K = Aqualit külçesi, B = Aqualit Bloğu, S = Aqualit Sandık, Ç = çubuk, R = kızıltaş; şablon üst / orta / alt.

| Sonuç | Tarif |
| --- | --- |
| Aqualit külçesi | Ham Aqualit ya da cevher fırında / yüksek fırında |
| Aqualit Bloğu | 9 külçe; geri 9 külçe |
| Aqualit aletleri | Normal alet şekilleri, K ve Ç |
| Aqualit Sandık | K K K / K sandık K / K K K |
| İş robotları ve Kılıçlı 1 | . B . / K S K / . alet . |
| Mini Keşif | . B . / K S K / . pusula . |
| Tür sandıkları (7) | Aqualit Sandık + tahta kazma/kürek/çapa/balta/kılıç, tuğla bloğu, fıçı; şekilsiz |
| Robot Telsizi | . K . / K R K / K K K |
| Takip Ekranı | K K K / K cam panel K / K pusula K |
| Görev Kumandası | K + R + taş düğme, şekilsiz |
| Komut Çubuğu | . R . / . K . / . K . |
| Bölge Seçici | . K altın / . Ç K / Ç . . |
| Aqualit Tamir Kiti | K + 2 demir + R, şekilsiz |
| Zırhlar | Zırh şekilleri: K (Aqualit), aynı ağacın kabuğu, taş, kırık derin kayrak |
| Kılıçlı 2–5, Ayar Dişlisi | Yalnız yaratıcı |
| Kabuk kitapları | Yalnız doğal sandıklar |

## Oyunda deneme listesi (her sürümde)

- [ ] Davranış ve Kaynak paketinde yeni sürüm; giriş mesajı; içerik günlüğünde kırmızı hata yok.
- [ ] Dört iş robotuna kısa görev (6 demir, 12 kum, 10 kütük, 8 buğday).
- [ ] Kılıçlı bir moba saldırıyor, güç efekti görünüyor.
- [ ] Telsiz, takip ekranı, konum çubuğu açılıyor; Keşif uçağa dönüşüp sürülüyor.
- [ ] Kabuk zırhla düşüş ve ateş hasarı beklendiği gibi.
- [ ] 12 robot birlikteyken oyun donmuyor.
