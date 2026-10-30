# Aqualit Robotları v0.3.2

Sahte test dünyasında denendi; **oyunda denenmedi**.

## Yenilikler

### Birini takip et
- **Keşif menüsü → "Birini takip et":** başka bir Keşif'i, bir robotu ya da bir oyuncuyu seç.
  - Keşif hedefin ~7 blok arkasından gelir.
  - Hedef bir Keşif aracıysa aynı araca dönüşür (uçak uçağı, gemi gemiyi izler); hedef robot ya da oyuncuysa uçakla izler.
  - Çok geride kalırsa (80 blok) hedefin arkasına ışınlanır.
  - Durdurmak için: menüde "Görevi bırak".
- **Görev Kumandası → "Birini takip et"** (bütün iş robotları): başka bir robotun, Keşif'in ya da oyuncunun peşinden gider. "Takibi bırak" ile eve döner.

### Otopilot (Keşif'e binince gelir)
- **Kırmızı ekran:** otopilot kapalı, sen sürüyorsun.
- **Yeşil ekran:** otopilot açık, Keşif kendisi gidiyor, sen sadece binersin.
- **Açarken hedef:** radarda seçili bir yapı varsa oraya gider; yoksa liste açılır (bilinen yerler, ev, robotlar, koordinat).
- **Varınca:** araç olarak kalır, otopilot kendiliğinden kapanır (ekran kırmızıya döner).
- Yolda yeniden basarsan otopilot kapanır, sen devralırsın.
- Keşif kendisi giderken (otopilot, takip, "beni götür") senin sürüşün devreye girmez; önceden ikisi birbirini bozabiliyordu.

### 3B eşyalar
- **Sandıklar (8 tür), tam 3B:** oyunun sandığı gibi; envanterde ve elde gerçek 3B blok. Konunca hemen Aqualit sandığına dönüşür (eskisi gibi çalışır).
- **Cihazlar, yalnız elde 3B** (envanterde düz simge kalır): Görev Kumandası, Telsiz, Takip Ekranı, Komut Çubuğu, Bölge Seçici, Ayar Dişlisi, Tamir Kiti, Radar, Hız Sayacı, Otopilot.
  - Önizleme: `onizleme/68_elde_3b_cihazlar.png`.
- **Olduğu gibi kalanlar:** robotlar ve kapalı robotlar, aletler (Minecraft'taki gibi düz durmaları daha doğal), zırhlar, kabuklar, büyü kitapları, ham Aqualit ve külçe.

### Güvenli açılış (0.3.1 düzeltmesinden)
- Eşyalar her durumda kayda geçer. Kodda hata olursa sohbete kırmızı yazıyla yazılır; ekran görüntüsünü göndermen yeter.

## Oyunda denenecekler
1. Envanterde sandıklar 3B blok gibi görünüyor mu? Elde nasıl duruyor? Yere koyunca Aqualit sandığı oluyor mu?
2. Yan yana iki aynı tür sandık koy: çift sandık oluyor mu?
3. Kumanda, telsiz ve otopilot elde 3B mi? Elde çok büyük, küçük ya da yanlış açıyla duruyorsa söyle, açıyı ayarlarım.
4. Bir Keşif'e öbür Keşif'i takip ettir, öbürünü sür: arkandan gelmeli.
5. Keşif'e bin, otopilota bas, hedef seç: ekran yeşil olmalı, Keşif kendisi götürmeli; varınca kırmızıya dönmeli.
6. Bir robota "Birini takip et" ile başka bir robotu seç.
7. Dünyaya girince sohbette kırmızı hata yazısı çıkıyor mu?
