# Aqualit Robotları v0.3.4 — Keşif düzeltmesi

Oyunda denenmedi. Paket v0.3.3 üzerine yalnız bu değişikliklerle kuruldu (v0.4.0 Organizatör kodu dahil değil).

- **Keşif dokunma:** koyunca menü açılmıyor, yalnız vurulabiliyordu.
  - Dokunma artık Keşif'in temel bileşenlerinde; oyun başlangıç olayını çalıştırmasa da var.
- **Bütün araç halleri üst üste çiziliyordu.** Gizleme, büyütme ve geçiş artık q.variant (sayı) ile yapılıyor, yazı karşılaştırmasıyla değil.
- **Dönüşüm Kiti:**
  - İlk Keşif'i koyunca gelir ve kaybolmaz.
  - Envanterinde varsa yenisi verilmez; envanter doluysa önüne bırakılır.
  - Kitle Keşif'e basılı tut (ya da binmişken kullan): araç listesi açılır.
- **Robot çağır** (Keşif menüsü): robotlarını seç; uzaktakiler hızlı koşar, 20 bloğa girince normal hızla gelip biner.

## Oyunda denenecekler
1. Keşif'i koy: kit gelmeli, dokununca menü açılmalı.
2. Kitle basılı tut: listeden uçak seç; yalnız uçak görünmeli.
3. Menüden "Robot çağır": robotlar koşarak gelip binmeli.
