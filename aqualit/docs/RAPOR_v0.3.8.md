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
