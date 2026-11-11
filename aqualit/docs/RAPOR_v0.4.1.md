# Aqualit Robotları v0.4.1: Matkap X-ray, hız çubuğu, sürüş motoru, arazi düzeltmeleri

**Oyunda denenmedi.** Sahte test dünyasında denemeler geçiyor. Paket adları "Aqualit Robotları (Davranış/Kaynak) 4.1".

## Matkap X-ray
- Yalnız matkaba binince gelen **X-ray eşyası**. Basılı tutunca: Kapalı / Yarı saydam / Tam saydam / Ayarlar.
- Seçince matkabın çevresindeki yüklü yığınlarda (9x9 yığın, en yakından başlayarak) taşlar aynı eşyayı düşüren
  "hayalet" kopyalarla değişir: taş, derin kayrak, granit, diyorit, andezit, tüf, kalsit, toprak, Nether taşı, kara taş,
  bazalt, End taşı. Cevherler olduğu gibi kalır, tam görünür. Hayalet taşlar ışığı geçirir (cevherler karanlıkta kalmaz).
- Kazınca asıl taşın eşyasını düşürür; robotlar ve matkap da onları asıl taş sayar.
- **Ayarlar:** hangi blok türünün saydamlaşacağını tek tek aç/kapa.
- Matkaptan inince, "Kapalı" seçince ya da başka biçime geçince her şey eski hâline döner. Oyun kapanırsa açılışta döner.

## Hız Sayacı
- 5 seçenek yerine **0% – 500% çubuk** (10'ar). Altında hıza göre canlı renk değiştiren kare: gri (0) → mavi → yeşil
  (100) → sarı → turuncu → kırmızı; 500'de koyu kırmızı ve ortasında sarı ünlem.

## Arazi aracı
- **Tırmanma (yapışkan) modu düzeltmesi:** araç biçimi artık iki yerde tutuluyor; "yalnız arazi aracında" hatası
  çıkarsa mesajın sonunda ne gördüğü yazar (teşhis için bana söyle).
- **Her biçimin kendi eşyası:** Tırmanma eşyası yalnız arazi aracında, X-ray yalnız matkapta.
- **Yapışkansız modda 4 bloğa kadar** kendiliğinden çıkar; burun 45°'ye kadar kalkar.
- **Sürüş motoru:** hızlı dönüşte gövde kayar (drift açısı) ve yana yatar; ani frende öne dalıp yaylanır; tekerleklerden
  zemin renginde toz (kumda sarı, karda beyaz, toprakta kahve); drift ve sert frende toz bulutu ve lastik sesi.
  Not: oyun binilen araca betikle itki uygulatmıyor; kayma gövde açısıyla görünüyor, aracın yolu oyunun sürüşüyle.

- **Rampa uçuşu:** hızla (yaklaşık 6 blok/sn üstü) bir rampadan çıkınca araç havalanıyor ve havada süzülüyor
  (en çok 6 sn). İnince burun yaylanıyor, dört tekerlekten toz kalkıyor. Ekranda uçuş süresi ve mesafe; rekor kırınca
  "YENİ REKOR!". Hız çubuğunu yükseltince daha uzağa uçar. Yapışkan modda kapalı (yüzeye tutunur).

## Oyunda denenecekler
1. Matkapta X-ray: üç kip, ayarlar, inince eski hâline dönüş. Telefon yavaşlıyor mu?
2. Hız çubuğu ve kare: kaydırırken renk değişiyor mu?
3. Arazi: Tırmanma Modu açılıyor mu (açılmazsa sohbetteki teşhis yazısını gönder), 4 blok çıkıyor mu, burun kalkıyor mu?
4. Drift, fren sallanması ve toz hoşuna gitti mi? Fazla/az ise ayarlarım.
5. Rampa uçuşu: rampadan hızla çık. Havada kalma süresi az/çok mu? Merdiven çıkarken yanlışlıkla havalanıyor mu?
