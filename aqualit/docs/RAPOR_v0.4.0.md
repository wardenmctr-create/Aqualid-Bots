# Aqualit Robotları v0.4.0: Portalcı, evcil dronlar, Organizatör üssü, tepeden harita

**Oyunda denenmedi.** Sahte test dünyasında denemeler geçiyor. Paket adları "Aqualit Robotları (Davranış/Kaynak) 4.0".

## Düzeltme: Takip Ekranı uzaktan izleme
- Takip Ekranı yine **robot listesiyle** açılıyor. Robota dokununca doğrudan canlı izleme başlıyor. Harita, listenin en
  üstündeki "Canlı harita" düğmesinde; haritadaki robot düğmeleri de doğrudan izlemeyi açıyor.
- **Robot uzaktaysa da (ya da başka boyuttaysa) izlenebiliyor.** Bu durumda sen görünmez seyirci olarak robotun yanına
  taşınıyorsun. İzleme bitince eski yerine ve eski oyun moduna dönüyorsun. İzlerken oyundan çıkarsan, girince yine geri
  dönüyorsun. Çıkmak için eğil.

## Yeni Keşif Haritası (eskisi tamamen kaldırıldı)
- Haritayı kullanınca dünyayı **tam tepeden** görüyorsun; kuzey yukarıda. Arazi gerçek dünyanın kendisi.
- Sen ortadaki **beyaz oksun** (Minecraft haritası gibi, baktığın yöne döner). Yürüdükçe harita da seninle kayıyor.
- **Yapılar** kendi küçük piksel simgesi ve altında adıyla görünüyor (köy, tapınaklar, anıt, kale, antik şehir, Nether
  kalesi vb.).
  - Ekrana sığmayan yapılar kenarda, yönünü gösteren sarı okla duruyor.
  - En yakın 3 yapının adı, koordinatı ve uzaklığı altta yazıyor.
  - Yapılar ayrıca **pusula çubuğunda** kendi simgeleriyle görünüyor.
- **Kullanım:**
  - Haritaya her basışında görüntü değişiyor: yakın → orta → uzak → kapalı.
  - Eğilince harita kapanıyor.
  - Eğilip haritayı kullanırsan bildiğin bütün yapıların listesi açılıyor.
- **Keşif'in haritası** (Keşif menüsü, "Haritam") robotları, sandıkları, Keşif'i, canavarları, hayvanları ve köylüleri de
  gösteriyor.

## Evcil mini dronlar (10 tür)
- Mimar, Keşif, Madenci, Kürekçi, Çiftçi, Oduncu, Kılıçlı, Organizatör, Portalcı ve Organizatör Yardımcısı dronları var.
- **Tarif:** robotu ortaya koy, çevresine 2 demir, 2 Aqualit külçesi ve 4 kızıltaş tozu. Robot geri gelir, yanında o
  robotun evcil dronu da gelir.
- **Yardımcı dronunun tarifi:** Organizatör ortada, çevresinde 3 demir, 3 Aqualit külçesi ve 2 kızıltaş tozu.
- **Kullanım:**
  - Eşyayı basılı tutunca dron omzunda süzülür.
  - Drona dokununca eşyaya döner.
  - Ölünce dron envanterine geri gelir.
  - Oyundan çıkıp girince omzunda yine belirir.

## Portalcı robot
- **Tarif:** diğer robotlar gibi; altta Ender gözü.
- Robot kafası boyunda bir dron: 4 halkalı pervane, arkasında dönen portal merceği ve kızakları var. Ona dokununca
  menüsü açılıyor.
- **Portal aç:** önüne kendi portalını açar (Minecraft portalı değil, içinde mor-turkuaz girdap döner).
  - Portal iki yönlüdür: Üst Dünya ile Nether arasında çalışır, End'den ise Üst Dünya'ya açılır.
  - Nether'de güvenli bir yere çıkarsın; güvenli yer yoksa obsidyen bir platform kurar.
  - Robotların da portaldan geçebilir. Portal 1 dakika açık kalır.
- **Beni taşı:** seni omuzlarından tutup uçurur. Baktığın yöne yürüyünce uçar, eğilince inersin.
- **Omzuma gel:** küçülüp omzunda süzülür. "Yanımda uç" ve "Burada bekle" seçenekleri de var.
- **Çırağı yap:** bir robota yardım eder ve onun omzunda durur.
  - O robotla Nether'den malzeme getirir: kuvars, altın, ışıltaş, netherrack, kara taş, kütük, ruh kumu, magma ya da
    antik enkaz (16, 32 ya da 64 tane).
  - Robotu omuzlarından tutup cevherin yanına uçurur.
  - Robot topladıklarını portalla geri getirip kendi sandığına koyar.

## Organizatör
- **Yeni vizör:** mavi, yarı saydam, kalın cam; kenarları koyu ve opak. Gözler camın ardından görünüyor.
- **Artık sebepsiz dolaşmıyor.**
  - Boştayken yerinde duruyor.
  - Sandıklara kendisi yürümüyor. Büyük **Organizatör Yardımcısı** dronu gövdesinden çıkıp sandığa uçuyor, eşyaları
    turkuaz ışınla ışınlıyor ve geri dönüyor.
  - Yerdeki eşyaları da Yardımcı alıyor.
- **Boş zamanda eksikleri tamamlatıyor.** Kömür, demir, buğday, odun, taş ya da kum azalınca boştaki robotlara toplatıyor.
- **Birden çok Organizatör varsa işi bölüşüyorlar.** Ortak işleri en eskisi yapıyor; istekleri en yakındaki alıyor.
- **Robotlar Organizatör'den istiyor.** Yakıtı ya da tohumu bitenler Organizatör'den istiyor; Mimar eksik malzemesini
  zaten istiyordu.

## Organizatör üssü
- **Aqualit Fırın**
  - Elektrikli. Bir Aqualit Bloğu'na doğrudan ya da kabloyla bağlıysa çok hızlı eritir; güç yoksa yavaş eritir.
  - Yalnız Organizatör kullanır; oyuncu dokununca güç durumunu görür.
  - Organizatör fırını kendisi yapıp kurabilir.
- **Aqualit Kablo:** komşu kablolara, Aqualit Bloğu'na, Fırın'a ve Aktarım Bloğu'na kendiliğinden bağlanır.
- **Uzaktan Aktarım Bloğu:** 3 blok yakınındaki sandıklara Organizatör eşyayı uzaktan ışınlar; Yardımcı uçmaz.
- **Organizatör Platformu**
  - 9x9 bloklık tek parça yapı; bloklardan kurulmuyor. Ortasında Organizatör duruyor, önünde dokunmatik panel var.
  - Yere basınca kuruluyor, en yakın Organizatör üstüne geçiyor.
  - Panele dokununca açılan menü: Organizatör'le konuş, üs durumu (fırınlar, güç, aktarım, kablo), Organizatör'ü çağır,
    platformu kaldır.

## Oyunda denenecekler
1. Takip Ekranı: yakın ve uzak bir robota dokun. Canlı izleme açılıyor mu, eğilince yerine dönüyor musun?
2. Keşif Haritası:
   - Tepeden görüntü açılıyor mu, simgeler ve adlar okunuyor mu?
   - Yakın/orta/uzak geçişi çalışıyor mu?
   - Kenar okları ve pusula çubuğu simgeleri görünüyor mu?
   - Simgeler çok küçük ya da çok büyükse söyle, boyunu ayarlarım.
3. Evcil dronlar:
   - Tarifler çalışıyor mu, robot geri geliyor mu?
   - Dron omzunda düzgün süzülüyor mu?
   - Organizatör ve Yardımcı dronlarının camı yarı saydam mı?
4. Portalcı:
   - Portal açılıyor mu, Nether'de güvenli yere çıkıyor musun?
   - "Beni taşı" ile uçabiliyor musun?
   - Çırak seferinde robot malzemeyle dönüyor mu?
5. Organizatör:
   - Yardımcı sandıklara uçuyor mu?
   - Organizatör yerinde duruyor mu, vizör nasıl görünüyor?
6. Üs: kablolar bağlanıyor mu, fırın güçlü olunca hızlı eritiyor mu, platform kuruluyor mu?

## Sorulacak
- Mimar'ın pistonları ters koyduğu yapı hangisi? Döndürme kodu doğru görünüyor; o yapıyı bilirsem tek tek bakarım.
