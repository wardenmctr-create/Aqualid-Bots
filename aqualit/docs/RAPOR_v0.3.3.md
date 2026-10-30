# Aqualit Robotları v0.3.3 — düzeltme

Oyunda denenmedi.

- **Hata:** v0.3.2'de dünyaya girince sohbette "SyntaxError: Could not find export 'YAPI' in module 'kesif_radar.js'" çıkıyordu.
  - Bu yüzden kodun hiçbiri yüklenmiyordu: robotlar yere konmuyordu, menüler açılmıyordu.
- **Sebep:** bir modül, başka modülden aldığı adı (`YAPI`) aynen dışarı veriyordu. Telefondaki oyun motoru, birbirini içe aktaran modüllerde bu zinciri çözemiyor (bilgisayardaki test motorları çözüyordu).
- **Düzeltme:**
  - Bütün bu tür aktarımlar kaldırıldı (`kesif_ai.js`, `ui/index.js`, `zirh.js`).
  - `test/validate.py` artık bunu hata sayıyor; bir daha pakete giremez.
- Eşyaların 3B görünüşü, takip ve otopilot v0.3.2'deki gibi.

## Oyunda denenecekler
1. Dünyaya girince "v0.3.3 yüklendi" yazısı gelmeli, kırmızı hata yazısı gelmemeli.
2. Robotlar ve Keşif yere konabiliyor mu?
3. v0.3.2 notundaki maddeler (takip, otopilot, 3B sandık).
