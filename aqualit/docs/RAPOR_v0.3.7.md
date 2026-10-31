# Aqualit Robotları v0.3.7 — Keşif yeniden konuyor

**Oyunda denenmedi.** Sahte test dünyasında Keşif denemeleri geçiyor.

## Düzeltilen

- **v0.3.6'da Keşif hiçbir yere konamıyordu** ("Keşif buraya konamadı"). Oyun Keşif varlığını hiç yükleyememişti.
  v0.3.6'da Keşif'in davranış dosyasının biçimini 1.21.0'dan 1.26.0'a yükseltmiştim. Yeni biçim bileşenleri sıkı okur:
  biri hatalı ya da o biçimde tanınmıyorsa bütün varlık düşer. Biçim v0.3.5'te çalışan 1.21.0'a geri alındı
  (eski biçim tanımadığı bileşeni yok sayar). Sebebi kesinleştirmek için gerçek oyun sunucusunda deneme yapılamadı.
- Konamazsa oyun artık sebebini de sohbete yazar (bir daha olursa ekran görüntüsünü at).
- Uçak ve denizaltı için yedek: uçan binek sistemi (`input_air_controlled`) bu biçimde çalışmazsa betik bakış yönüne göre
  yine dikey hız verir (v0.3.5'teki gibi).

## Paket adları

Dünya ayarlarında artık sürüm de görünür: **Aqualit Robotları (Davranış) 3.7** ve **Aqualit Robotları (Kaynak) 3.7**.

v0.3.6'daki bütün yenilikler (Tırmanma Modu, düz |||| tutucular, eğim, robot hali animasyonları, 1 blok çıkma) bu sürümde de var:
bkz. `RAPOR_v0.3.6.md`.

## Oyunda denenecekler

1. Keşif yere konuyor mu? (Konmazsa sohbetteki gri yazıyı gönder.)
2. Uçak yukarı bakıp ileri basınca yükseliyor mu? Denizaltı dalıyor mu?
3. Arazi aracında Tırmanma Modu: tutucular çıkıyor mu, duvara tırmanıyor mu?
