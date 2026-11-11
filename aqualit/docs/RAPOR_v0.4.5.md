# Aqualit Robotları v0.4.5: Robot Kostümü, bölge koruma ayarları, rampa fırlatma

**Oyunda denenmedi.** Sahte test dünyasında bütün senaryolar geçti (toplu çalıştırmada eskiden beri takılan Keşif
yapay zekâsı denemeleri tek başına geçiyor). Paket adları "Aqualit Robotları (Davranış/Kaynak) 4.5".

## Kılıçlı Robot Kostümü
- Komut Çubuğu → robot → "Kostüm olarak giy". Envanter ve zırh yuvaları boş olmalı.
- Oyuncu görünmez olur; yerinde Kılıçlı robotun modeli yürür (kamera üçüncü kişi). Robotun canı, gücü, hızı ve kılıcı
  oyuncuya geçer.
- "Kostüm Güçleri" eşyası: robotun açık güçlerinden birini hemen kullanır. "Kostümden Çık": eski haline dönersin,
  robot yanında belirir ve takip eder. Robot kostüm süresince görünmez bekler. Ölünce kostüm çıkar.
- Sınır: elindeki eşya havada görünebilir (oyuncu görünmezken elde tutulan eşya çizilir).

## Bölge koruma ayarları
- Komut Çubuğu → "Koruma ayarları" (hepsi) ya da robot menüsünde. Yabancı oyuncular, hayvanlar ve canavarlar için
  ayrı ayrı: Hiçbir şey yapma / Haber ver / Dışarı it / Saldır. Arkadaş listesine yazılan oyunculara ve sahibine dokunmaz.

## Keşif arazi aracı
- Rampa: en az 0,5 sn rampada kalınca araç tek bir itkiyle FIRLAR, sonra vagon gibi normal yerçekimiyle düşer
  (süzülme kaldırıldı). Hız, rampa eğimi ve rampanın yüksekliği ne kadar yükseğe/uzağa gideceğini belirler; havada
  baktığın yöne dönebilirsin. İtki oyunda binilen araçta işlemezse kısa ve sert bir kaldırma devreye girer.
- Motor sesi yeniden yapıldı (yumuşak uğultu), motor, kayma ve iniş sesleri kısıldı.

## Mimar
- Yapı listesindeki resimler artık gerçek blok dokularıyla çiziliyor (oyunun kendi dokuları).

## Oyunda denenecekler
1. Kostümü giy: robot modeli seninle yürüyor mu, güçler çalışıyor mu, çıkınca her şey eski haline dönüyor mu?
2. Bölge koruma: yabancı oyuncu/hayvan girince haber veriyor, itiyor ya da saldırıyor mu?
3. Uzun bir rampadan hızla çık: araç fırlıyor mu, balon gibi değil düşerek mi iniyor?
4. Mimar listesindeki resimler dokulu görünüyor mu?
