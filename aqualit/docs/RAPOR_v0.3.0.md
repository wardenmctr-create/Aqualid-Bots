# Aqualit Robotları v0.3.0: Mimar

Hedef: Minecraft Bedrock 26.50+ (`@minecraft/server` 2.10.0, `@minecraft/server-ui` 2.2.0). **Oyunda test edilmedi.**

## Ne değişti

- **Mimar Robot** (`aqualit:robot_insaatci`). Tarifi diğer robotlar gibi: üst `. B .` / orta `K S K` / alt `. tuğla bloğu .`.
  Yere konunca yanına İnşaatçı Sandığı kurulur. Canı bitince "Kapalı Mimar Robot" olur.
- **Yapı kütüphanesi: 217 yapı.** 213'ü yapı, 4'ü farm; 12 kategoride. 25'i elle yapıldı (`gen/yapilar.py`). 192'si
  Planet Minecraft'ta ücretsiz paylaşılan şemalardan Bedrock'a çevrildi. Yazarları ve kaynakları
  `docs/YAPI_KAYNAKLARI.md` dosyasında; eser yazarlarına ait, kişisel kullanım için.
- **Menü:** Görev Kumandası → Mimar → Görev ver → kategori → resimli liste → yapı kartı. Kartta boyut, blok sayısı,
  dron sayısı ve malzeme listesi (Türkçe eşya adlarıyla) var. Seçenekler: "Yer seç" ya da (yaratıcıda)
  "Malzemesiz yap".
- **Yer seçme:** Baktığın bloğun üstüne turkuaz bir çerçeve çizilir. Kapı tarafı sana bakar ve turuncu kıvılcımla
  gösterilir. Seçenekler: Onayla / 90° çevir / kırmızı İptal.
- **İnşa:** Mimar sandıklardan malzemeyi kemerine alır, yapı yerine uçar ve bareti çıkarıp ters tutar. Baretin içinden
  **1–10 mini dron mimar** çıkar (yapı büyüdükçe daha çok). Yapı alttan üste kat kat kurulur. Her katta yapının
  kapladığı alandaki doğal bloklar (toprak, taş, ağaç, ot...) temizlenir; sandıklara ve oyuncu yapılarına dokunulmaz.
  Blok yönleri yapının dönüşüne göre çevrilir. İlerleme %25'te bir telsize yazılır. Malzeme yetmezse eksik listesi
  telsize gelir. İş bitince dronlar barete döner, Mimar bareti takar, eve uçup kalan malzemeyi sandığa koyar.
- **Yeni varlık:** `aqualit:dron` (mini dron mimar): pervane, mini baret, ışıklı gözler; uçma / blok koyma / çıkış /
  dönüş hareketleri.
- **Robotun yeni hareketleri:** `fly`, `hat_off`, `hat_hold`, `hat_on`. Uçarken yerçekimi ve çarpışma kapalı
  (`aqualit:fly_on/off`).
- **Çevirici:** `gen/yapi_cevir.py` dönüştürme zincirini kuruyor: eski şema sayıları → Java 1.13+ → Bedrock 1.19 →
  Bedrock 26.x (pmmp yükseltme şemaları). Sonuç her zaman oyunun blok listesiyle denetleniyor.
- **Düzeltme:** Elle yapılmış eski yapılardaki geçersiz bloklar giderildi (`oak_fence_gate` → `fence_gate`,
  çit kapısına bağlantı durumu, kesme kumtaşına eksen verilmesi).

## Test

| Denetim | Sonuç |
| --- | --- |
| `test/validate.py` | 0 hata (217 yapı dosyası blok blok denetlendi) |
| `test/apicheck.py` | 36 dosya, 0 sorun |
| `sim.mjs` bütün senaryolar | 21 senaryo, 326 denetim geçti (mimar 19) |

Sim'de Japon Kalesi (17.893 blok, 10 dron) eksiksiz ve doğru yönde kuruldu: oyun saatiyle ~14 dakika sürdü, en uzun
tik 10 ms.

## Oyunda denenecekler

- Mimar uçuyor mu, yere sağlam iniyor mu? Uçarken duvarlardan geçmesi sorun çıkarıyor mu?
- Baret animasyonu doğru görünüyor mu? Dronlar baretin içinden çıkıyor mu?
- Menüdeki yapı resimleri görünüyor mu? Malzeme adları Türkçe mi?
- Çerçeve doğru yerde ve doğru yönde mi? "90° çevir" çerçeveyi çeviriyor mu?
- Kapılar, merdivenler, yataklar ve meşaleler doğru yöne bakıyor mu? (Yönler veriden çevrildi, oyunda denenmedi.)
- Uzaktaki yapıda yüklü olmayan yığınlarda bekliyor mu?
- Büyük bir yapıda (Japon Kalesi, Leyer Kalesi) telefon kasıyor mu?
- Yapı dosyaları paketi şişirdi mi? (.mcaddon ~3,3 MB; kurulunca yapı dosyaları ~68 MB)

## Henüz yok

- 360° dönen hologram önizleme ve tam boy hologramla yer seçme (şimdilik resim + çerçeve).
- 50 farm hedefinin 46'sı (Bedrock'ta çalışacak farm tasarımları ayrı iş).
- İnşa Çubuğu eşyası (kod hazır, bağlanmadı), Organizatör'den malzeme isteme (v0.3.1).
