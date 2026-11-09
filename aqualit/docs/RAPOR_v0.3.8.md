# Aqualit Robotları v0.3.8 — 9 Kasım oyun raporu düzeltmeleri

**Oyunda denenmedi.** Sahte test dünyasında bütün denemeler geçiyor. Paket adları: "Aqualit Robotları (Davranış/Kaynak) 3.8".

## Keşif
- **Gemi:** zıplamıyor, suda tekne gibi kayıyor (suyun frenlemesi azaltıldı) ve neredeyse iki kat hızlı.
- **Denizaltı:** suda daha hızlı; gövdenin ortası sudan çıkınca yerçekimi gelir, uçamaz.
- **Uçak çarpınca robot ölmesi:** araçta giden robotlar hiç hasar almaz (çarpma, düşme, boğulma...).
- **Eğim:** arazi aracı, matkap inip çıkarken burnunu kaldırıp indirir (artık istemcide, dikey hızdan).
- **Tırmanma Modu:** eşya Keşif'e hangi hâlde binersen bin gelir, yalnız arazi aracında çalışır. Envanter doluysa
  uyarır; ayrıca Keşif menüsünden (eğilip dokun) de açılıp kapanır.
- **Kamera:** birinci şahısta araç görünmez, önün kapanmaz. Üçüncü şahısta kamera araca göre uzakta (uçakta 10 blok).
  Kamerayı parmakla yakınlaştırıp uzaklaştırmak oyunun izin verdiği bir şey değil; uzaklık araca göre sabit.
- **Gece görüşü:** Keşif'e binince her hâlde gelir, inince gider (matkapta, denizaltıda, gece).
- **Yapı bulma:** dronlar altındaki yığınları taramadan ilerlemiyor (eskiden sıra yükten düşüp hiç taranmıyordu);
  tik başına tarama süreyle sınırlı, daha çok yığın taranıyor.
- Keşif'in hasarsızlığı eski biçimde düzgün okunsun diye mantıksal değerle yazıldı.

## Kılıçlı ve robotlar
- **Keşif'i öldürme:** uçak çarpınca Keşif "sahibine saldıran" sayılıyordu. Kılıçlı artık Keşif'e, dronlara, sandıklara
  ve hiçbir Aqualit varlığına saldırmaz.
- **Enerji sistemi kalktı:** güçler her zaman kullanılabilir (yalnız kısa bekleme süresi).
- **Blok çıkma:** bütün robotlar bir bloğa zıplamadan yürüyerek çıkar.
- **Sandık:** Kılıçlı konulunca yanına Kılıçlı Sandığı gelir (Organizatör'ünki zaten geliyordu; adı "Organizatör Sandığı").
- **Eşya topla:** Kılıçlı menüsünde (Görev Kumandası): çevredeki yere düşmüş eşyaları toplar, sandığına koyar.

## Mimar
- **Kapı, meşale, flama, yatak, fener, tabela, merdiven...:** yapı bitince son turda konur (dayandıkları blok yerindeyken);
  kapı ve yatak gibi iki parçalı blokların iki yarısı aynı anda konur. Eskiden yarım kapı hemen kırılıyordu.
- **Dronlar işi böler:** her dronun kendi şeridi var; aynı yere üşüşmezler.
- **Cevherler:** inşa alanında çıkan cevherler (ve doğal taşlar: kumtaşı, netherrack, kırık taş...) kırılır; cevherin
  düşürdüğü (ham demir, elmas...) bitince Organizatör'ün dizinindeki uygun sandığa gider.
- **Yer seçme:** toz tanecikleri yerine kalın, parlak, kesintisiz turkuaz çerçeve; kapı tarafı turuncu.
- **Yapı arama:** kütüphanede "Yapı ara" kutusu; yazım hatasını ve eş anlamlıları anlar ("japn ev" → Japon Evi,
  "şato" → kaleler, "küçük" ≠ "büyük").
- **Piston yönü:** döndürme kodu ve Java çeviri tablosu denetlendi, ikisi de doğru çıktı. Hangi yapıda ters konduğunu
  söylersen o yapıya bakarım.

## Yeni: Keşif Haritası ve Dron Ordusu
- **Keşif Haritası** (eşya; tarif: ortada boş harita, yanlarda 3 Aqualit, altta pusula). Basılı tut: devasa harita
  (en uzakta 1600x1600 blok). Sen hep ortadasın (baktığın yöne ok); kaydır, yakınlaştır, uzaklaştır.
  Oyuncu haritasında yalnız biyomlar ve yapılar var. Her yapı kendi renkli rozetiyle, altında kısa adı; yanda tam adı,
  koordinatı, uzaklığı ve yönü yazar. Gidilmeyen yerler karanlık.
- Sen yürüdükçe oyunun çevrende yüklediği bütün alan bir seferde haritaya işlenir.
- **Keşif'in haritası** (Keşif menüsü → Haritam): ek olarak robotlar, sandıklar, Keşif'ler, canavarlar, hayvanlar, köylüler.
- **Keşif Dron Ordusu** (yalnız yaratıcı menüde): basılı tut, 400/800/1600 blok seç: 25 dron haritanın keşfedilmemiş
  yerlerine uçar (bilinen yerleri atlar), yapıları bulup haritaya işler.
- Keşif de orduyu gönderir: menüde "Dron ordusu gönder"; ayrıca boştayken, sen yakınındayken ve çevrenin en az üçte biri
  haritada boşsa 15 dakikada bir kendiliğinden (menüden kapatılır).

## Yeni: Keşif'in Nether ve End temaları
- Keşif'in 6 hâli (robot dahil) bulunduğu boyuta göre otomatik kaplanır: Nether'de Nether tuğlası, kuvars, kara taş,
  kızıl kalas, lav ışıklı camlar, parlayan magma çatlakları, kızıl mantarlar ve ruh feneri; End'de purpur, End taşı,
  obsidyen, End çubukları ve süzülen End kristali. Ekranlar hep siyah; gözlerin rengi temaya göre (turuncu / pembe-mor).
  Tekerlekler ve paletler değişmez.
- **Nether:** gemi lavın üstünde yüzer, denizaltı lavda dalar (lavın içinde/üstünde dönüşebilir). Binenler ateşe dayanıklı.
  Denizaltıyla lavın içindeyken lav sisi kalkar: lav büyük ölçüde saydam görünür, altını görürsün.
  Ekrandaki alev görüntüsünü oyun kendisi çiziyor; kalkıp kalkmadığını oyunda denemek gerek.
- **End:** Keşif boşluğa düşerse son güvenli yere döner (binenlerle birlikte).

## Tırmanma Modu (yapışkan)
- Tutucular açıkken araç duvarda yalnız yukarı değil, baktığın yöne gider: yukarı bakıp ileri = tırman, yana bak = duvarda
  yana, aşağı bak ya da geri = in. Hiç havada kalmaz: uçurum kenarından ya da duvarın üstünden çıkınca yanındaki
  yüzeye yapışıp onu takip eder; düz yere inince normal sürüşe döner.

## Tasarımlar (v0.4.0'da oyuna girecek)
Organizatör cam vizörü, Portalcı, Organizatör Yardımcısı, portal, 10 evcil dron: `onizleme/80-85_*`.
Mimar ve Keşif dronlarının yüzü yeni (çerçevesiz ekran, 2 piksel göz) ve gövdeleri 1 piksel kısa; bu sürümde oyunda.

## Oyunda denenecekler
1. Gemi suda kayıyor mu, hızlı mı? Denizaltı sudan çıkınca düşüyor mu?
2. Uçağa robot bindirip bir yere çarp: robot ölüyor mu? Kılıçlı Keşif'e saldırıyor mu?
3. Birinci şahısta araç önünü kapatıyor mu? Üçüncü şahısta kamera uzakta mı?
4. Arazi aracı inip çıkarken eğiliyor mu? Tırmanma eşyası geldi mi, menüden açılıyor mu?
5. Mimar'a kapılı bir ev yaptır: kapılar, meşaleler duruyor mu? Yer seçme çerçevesi net görünüyor mu? "Yapı ara" çalışıyor mu?
6. Kılıçlı'ya "Eşya topla" ver; güçlerini enerji derdi olmadan kullanıyor mu?
7. Keşif Haritası: yürüyünce doluyor mu, yapı rozetleri ve adları okunuyor mu? Dron ordusu çalışıyor mu?
8. Nether'e geç: Keşif kaplandı mı? Gemi lavda yüzüyor, denizaltı lavda dalıyor mu, lav saydam mı? End'de boşluktan kurtuluyor mu?
9. Tırmanma Modu açıkken duvarda yana gidebiliyor musun, uçurumdan inerken duvara yapışıyor mu?
