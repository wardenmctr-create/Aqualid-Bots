# Aqualit Robotları v0.5.0

**Oyunda denenmedi.** Sahte test dünyasında yeni senaryolar (kilicli2, tasma, alan, us, rampa, tasima, guc, kesif)
geçti. Paket adları "Aqualit Robotları (Davranış/Kaynak) 5.0".

## Kılıçlı
- **51 güç efekti:** her güce kendi 3D efekti (içte tam opak parlak çubuklar, etrafında yarı saydam daha koyu kılıf;
  dönen parçalar) ve kendi 2D parçacık efekti. Ayar Dişlisi → "Güç efektleri": 3D / 2D / İkisi / Kapalı.
- Sahibine 1 kalpten fazla vuran her şeye (oyuncu da) saldırır.
- Yer altındaki görünmeyen moblarla uğraşmaz (güç seçiminde görüş çizgisi; hedef seçiminde yer altı süzgeci).
- Sahibi başka boyuta geçince takip eden Kılıçlı kendi portalını açıp yanına gelir; eşya toplamada da önce yanına gelir.
- Portalcı çırağı varsa: "Nether'e ava git" (alaz çubuğu, magma kremi ... ganimeti).

## İş robotları
- **Sınırsız çanta:** 27 yuva dolunca sade eşyalar taşma deposuna (~1024 yuva); çanta ekranında görünür, sandığa boşalır.
- **Kürekçi:** Bölge Seçici alanını düzleştirir (alt köşe zemin olur) ya da seçilen blokla doldurur.
- **Nether kilidi:** Portalcı çırağı olan robotun görev listesinde Nether malzemeleri açılır (Madenci: kuvars, Nether
  altını, antik kalıntı, kara taş, ışıltaş, magma; Kürekçi: ruh kumu, çakıl, netherrack; Oduncu: kızıl/çarpık kütük;
  Çiftçi: Nether siğili). Seçince Portalcıyla Nether'e gidip getirir.
- Portalcı çırağı olan robot uzun yolları kendiliğinden uçarak gider.
- **Sandık taşıma:** Organizatör menüsü → "Sandıkları merkeze topla": boştaki robotlar sandığını içindekilerle alıp
  merkeze getirir, meşguller not alır ve işi bitince getirir.

## Organizatör
- **Üssünü kendisi kurar (malzemesiz):** yeri düzler, platform + panel, enerji bloğu, 2 güçlü fırın, çalışma masası,
  ağ sandığı, kablolar ve evdeki sandığa aktarım bloğu. Menüden "Üssünü kur"; platformu yoksa boştayken bir kez kendisi kurar.
- Platform zemini toprakla aynı hizada; Organizatör ortadaki dairenin üstünde durur (içine gömülmüyordu).
  Önündeki panele dokunmak menüyü açar.
- Kablonun kuzey/güney kolları ters görünüyordu, düzeldi.
- Eşya resmi: mavi cam vizörlü yeni hâli.

## Keşif
- **Yüzeyde sürüş (yapışkan mod):** duvar ve tavan yeni zemin olur; araç yüzeye döner, ileri/geri/sağ/sol sürülür,
  düşmez (yerçekimi tutunduğu yüzeye doğru), kenarda durur; duvar → tavan → duvar → yer geçişleri kendiliğinden.
  Kamera yüzeye göre arkadan bakar (Bedrock kamerası yana yatamaz; binen oyuncu dik oturur).
- **Araç hızları:** gemi ve denizaltı yapılarına uygun hıza indi; hız çubuğu araç başına bileşen grubuyla (suda ve
  havada da işler), varsayılan %100.
- **Rampa:** sarı-siyah ok desenli, altı boş, yarım blok kalın eğik plaka. Varsayılan 2 kalınlık, 10 uzunluk, 6
  yükseklik. Rampa Ayarlayıcı: basılı tut → ölçüler; rampaya dokun → kaldırır.

## Portalcı
- Menüde "Robota ışınla": uzaklık ve boyut fark etmez.
- Taşırken kafa çevrilebiliyor; doku düzeltildi; cam yarı saydam; girdap dönen sabit renkli disk.

## Oyunda denenecekler
1. Kılıçlı güçlerinde 3D/2D efektler görünüyor mu? Ayar Dişlisi'nden değişiyor mu?
2. Arazi aracında tutucular açıkken duvara sür: duvarda yerdeymiş gibi gidebiliyor musun, tavana geçiyor mu?
3. Rampayı koy: rampa doğru yöne mi kuruluyor, araçla çıkınca fırlıyor mu?
4. Organizatör menüsü → Üssünü kur: platform ve parçalar kuruluyor mu, fırınlar güçlü mü?
5. Sandıkları merkeze topla: robotlar sandıklarını getiriyor mu, içindekiler kayboluyor mu?
6. Portalcı çırağıyla Nether malzemesi seç; çıraklı robot uzağa uçarak gidiyor mu?
