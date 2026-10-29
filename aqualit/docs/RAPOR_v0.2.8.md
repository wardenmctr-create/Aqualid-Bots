# Aqualit Robotları v0.2.7–0.2.8: Kabuk Zırhları v1.2.1 birleştirmesi ve sade taş zırh

Hedef: Minecraft Bedrock 26.50+ (`min_engine_version` 1.26.50, `@minecraft/server` 2.10.0, `@minecraft/server-ui` 2.2.0; manifest sürümleri geriletilmedi).

**Oyunda test edilmedi.** Aşağıdaki "geçti" sonuçları sahte dünya (mock) denemeleri ve statik denetimlerdir.

## Ne değişti

### Eşyalar
- **12 kabuk** ve **48 zırh**: 10 eski tür aynı `aqualit:` kimlikleriyle kaldı. Kızıl Nether ve Çarpık Nether eklendi (`aqualit:kabuk_*_kizil_nether`, `aqualit:kabuk_*_carpik_nether`).
- **Zırh değerleri:** koruma göğüslük 2, pantolon 1, miğfer 1, bot 1, tam set 5. Pantolon 2'den 1'e indi.
- **Dayanıklılık:** gerçek dayanıklılık çubuğu kullanılıyor (miğfer 40, göğüslük 60, pantolon 55, bot 45). Eski açıklama satırındaki "Dayanıklılık x/27" kaldırıldı.
- **Yığın ve büyü:** yığın 1. Vanilya büyüleri örste basılabilir (`minecraft:enchantable` miğfer/göğüs/bacak/ayak, değer 12).
- **Onarım:** aynı türün kabuğu %25 onarır. Aynı parçadan iki tanesi birleştirilebilir.
- **Dokular:** kaynak paketindeki 66 eşya ve 48 zırh PNG'si birebir aynı. 114 dosya md5 ile karşılaştırıldı, 0 fark. Nether PNG'leri `dokular/kabuk_hazir/` klasöründen olduğu gibi kopyalanıyor.
- **Geometri:** 4 kabuk geometrisi kaynaktakilerle birebir aynı. Yalnız kimlik `geometry.aqualit.kabuk_*` kaldı.

### Mekanik (`scripts/zirh.js`)
- **Tek dosya:** bütün kabuk mekaniği burada. Ayrıca bir `kabuk:` işleyicisi, hareket döngüsü ya da hasar dinleyicisi yok.
- **Hareket denetleyicisi:** kabuk hızı ve Aqualit setinin su hızı aynı denetleyiciden geçer. Hız veya yavaşlık iksiri varken kabuk bonusu geri çekilir. Zırh çıkınca hız eski haline döner.
- **Parça payları:** göğüslük .75, pantolon .50, miğfer .25, bot .25. Toplam pay en çok 1.
  - Hız: (%20 + %5 × Hafif Adımlar) × pay.
  - Düşüş azaltma: (%30 + %5 × Esnek Lifler) × pay.
  - Karışık türler serbest. Farklı parçalardaki aynı büyüden en yüksek seviye geçerli.
- **Ateş (yeni):**
  - Normal kabuk yanıcı: %15 fazladan hasar.
  - Nether kabuğu ateşe dayanıklı: tam sette %50 koruma.
  - **Reçine Koruması** (I–III): normal kabukta fazladan hasar %10, %5, %0; Nether kabukta koruma %60, %70, %80.
  - Karışık sette normal ve Nether payları oranlanır, toplam pay 1'i geçmez. Lav bağışıklığı yok.
  - Bu kitap kullanıcının isteğiyle eski Reçine Koruması'nın yerine geçti. Normal kabuğun ateşteki ek aşınması kaldırıldı.
- **Düşüşte aşınma:** oyun düşüşte zırhı aşındırmaz, kabuk zırhı aşınır. Düşüş Aşınması seviye başına %25 azaltır, Kırılmazlık büyüsü şansı böler.
- **Son Kabuk:** ölümcül darbeyi bir kez engeller. Büyülü parça parçalanır, kısa Can Yenilenmesi verir.
- **Orman Gölgesi:** eğilirken kısa görünmezlik. Hafif Adımlar ile birlikte işlenemez.
- **Kaldırılan eski davranışlar:** yumruğa karşı savunma, uzak canavar yavaşlatma, boğulurken yüzeye itme, kırılınca yedek parça giyme.
- **Kabuk düşürme:** kütük ya da gövde baltayla gerçekten soyulunca 1 kabuk düşer. Toplam 24 blok, Nether gövde ve hifleri dahil. Soyulmuş kütük ve basılı tutma tekrarı ikinci kabuk vermez.
- **Eski eşya geçişi:** v0.2.6 kabuk zırhlarındaki "x/27" aşınması gerçek dayanıklılığa oranlanır, büyüler korunur. Bu hem giyilenlere hem envanterdekilere uygulanır. Eski 8'li yığınlar teker teker ayrılır.

### Büyü kitapları
- **6 kabuk kitabı:** Esnek Lifler, Hafif Adımlar, Orman Gölgesi, Reçine Koruması, Son Kabuk, Düşüş Aşınması.
- **Üretilemez:** 6 kitabın tarifleri silindi. Taş büyü kitapları üretilebilir kaldı.
- **Tek işleyici:** `items.js` → `aqualit:buyu` → `applyBook`. Kitap elde kullanılır, önce göğüslüğe işlenir. Seviye sınırı dolunca kitap harcanmaz.
- **Ganimet:**
  - Doğal sandık, tuzaklı sandık ya da varil ilk açılışında %16 olasılıkla boş bir yuvaya 1 kitap konur.
  - Ağırlıklar: Esnek 20, Hafif 20, Orman 18, Reçine 18, Düşüş 18, Son Kabuk 6. Kaynaktaki "6. kitap hiç çıkmıyor" hatası düzeltildi.
  - Oyuncunun koyduğu sandıklar ve önceden açılmış sandıklar işaretlenir. Çift sandığın öbür yarısı da işaretlenir.
  - İşaretler 64×64 bölge başına tek dünya özelliğinde tutulur, dünya özelliği şişmez.
  - Oyunun ganimet tablolarına dokunulmaz.
- **Çifte kurulum uyarısı:** ayrı "Kabuk Zırhları" paketi de açıksa giriş sırasında uyarı verilir.

## Test raporu

| Denetim | Sonuç | Tür |
|---|---|---|
| `test/validate.py` (JSON, kimlik, doku, giyilebilir, kütük blokları) | 0 hata | statik |
| `test/apicheck.py` (@minecraft/server 2.10.0 tanımlarına göre API) | 0 sorun | statik |
| Kaynak dokuları ile çıktı (114 PNG) | birebir aynı | statik |
| Tarifler: kabuk kitabı üreten tarif | yok | statik |
| Tarifler: zırh | 48, kopya yok | statik |
| Eşyalar | 12 kabuk + 48 zırh + 6 kabuk kitabı (+5 taş kitabı) | statik |
| Sahte dünya `zirh` senaryosu | 60/60 geçti | mock |
| Sahte dünya tüm senaryolar (robotlar, Kılıçlı, Keşif, efektler, taş/Aqualit zırh) | hepsi geçti | mock |

**Oyunda doğrulanması gerekenler:**
- `world.beforeEvents.entityHurt` içinde hasar değiştirme ve iptal (düşüş, ateş, Son Kabuk).
- `blockContainerOpened` olayının ganimet dolduktan sonra gelmesi.
- Örsle vanilya büyüsü basma.
- Kitabın elde kullanımı.
- Çok oyunculu oyun ve Realms.

## v0.2.8: Taş zırh sadeleşti (kullanıcı isteği)

- **Kaldırılanlar:** taş setin özel özelliği (5+ hasarlı darbeyi kesme, kırılma hakkı, kırılınca 5 sn bekleme) ve 5 taş büyü kitabı (Sarsılmaz, Yankı, Kaya Takviyesi, Hızlı Kuşanma, Son Sarsıntı). Kitapların eşya, tarif, simge ve dil kayıtları silindi. Dünyada kalan kitaplar oyundan kalkar.
- **Görünüş:** dokular, modeller ve giyilebilirler değişmedi. 28 dosyanın önceki sürümle aynı olduğu md5 ile doğrulandı.
- **Taş zırh (deri zırhla aynı):** koruma 1/3/2/1 = 7, dayanıklılık 55/80/75/65, büyülenebilirlik 15, taşla onarılır.
- **Derin kayrak:** koruma 2/3/2/1 = 8, dayanıklılık 88/128/120/104, büyülenebilirlik 12, kırık derin kayrakla onarılır.
- **Karşılaştırma:** bakır zırh 2/4/3/1 = 10, dayanıklılık 121/176/165/143. Derin kayrak her değerde bakırın altında kalıyor.
- **Eski veri:** eski taş zırhların "kırılma hakkı" açıklaması ve gizli verisi otomatik silinir, hem giyilenlerde hem envanterdekilerde.
- **Denemeler:** sahte dünyada tüm senaryolar geçti (216 denetim; zırh senaryosu 60). validate 0 hata, apicheck 0 sorun.
