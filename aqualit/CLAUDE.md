# Aqualit Robotları — Claude Code çalışma rehberi

Bu klasör, Minecraft Bedrock 26.50 için **Aqualit Robotları** eklentisinin bütün kaynağı. Şu anki sürüm **v0.2.9**
(yeni Aqualit sandığı). Sahte test dünyasındaki bütün denemeler geçiyor; **oyunda henüz denenmedi**.
Ayrıntılı yol haritası ve yapılacaklar: `PLAN.md`. Eski kararlar: `docs/`.

## Kullanıcı (kalıcı istekler — her oturumda uy)

- **Her zaman Türkçe konuş.** Kullanıcı İngilizce anlamıyor. Kod yorumları, oyun içi yazılar, raporlar Türkçe.
- **Her 1 dakikada bir durum raporu** (29 Ekim'de 2-3 dk'dan 1 dk'ya indi): yüzde kaç bitti ve tahmini kalan dakika. Tahminler dürüst olsun;
  "yüzde" bütün işin yüzdesi olmalı, o anki küçük adımın değil.
- **Bitirilen her tasarımı tek tek 3B önizlemeyle göster** (GIF ya da MP4): robot, eşya, blok, yapı, efekt.
  Çizim betikleri kökte (`robot.py`, `sandiklar.py`, `cift_sandik.py`, `kesif_donusum.py`, `addon/test/render_z.py` ...).
- **Yeni doku yapınca görselini (PNG) göster; yeni animasyon yapınca GIF/MP4 göster.**
- Bir API oyunda işe yaramıyorsa araştır ve oyundaki başka umut veren API'leri dene (yine kararlı API'ler; beta yok).
- Kullanıcı oyunu **Android telefonda** oynuyor; dokunmatik kontroller. Arayüz turkuaz, iptal tuşu kırmızı.
- Oyunda deneyemediğin her şeyi açıkça "oyunda denenmedi" diye yaz; sahte dünyada geçmek oyunda çalışır demek değil.
- Kullanıcı "aga" diye hitap eder, kısa ve net cevap sever. Eleştiri gelirse sebebi kısaca söyle ve düzeltmeye geç.
- "Açık karar" ya da "öneri" olarak işaretli şeyleri (PLAN.md) yapmadan önce kullanıcıya sor.

## Komutlar

```bash
cd addon
python3 build.py                     # paket: out/Aqualit_Robotlari_vX.Y.Z.mcaddon (+ out/Aqualit_BP, out/Aqualit_RP)
python3 test/validate.py             # "TOPLAM HATA: 0" olmalı
python3 test/apicheck.py             # "0 sorun" olmalı (gerçek @minecraft/server 2.10.0 tanımlarına göre)
cd test/mock && rm -rf scripts && cp -r ../../src/scripts scripts && node sim.mjs          # bütün senaryolar
node sim.mjs sandik                  # tek senaryo (madenci, kurekci, oduncu, ciftci, skyblock, kilicli, ui, heykel,
                                     # eritme, zirh, guc, cokme, takim, uzak, canta, bos, konum, efekt, kesif, sandik)
```

Gerekenler: Python 3.10+ (Pillow, numpy, scipy), Node.js 18+, ffmpeg (önizleme ve ses). Bütün senaryolar ~10 dk sürer.
**Sürüm vermeden önce dördü de temiz olmalı.** Başvuru verileri `ref/` klasöründe (Mojang bedrock-samples:
script API tanımları, JSON şemaları, oyunun blok/eşya listeleri, oyunun varlık dosyaları); `AQUALIT_REF`
ortam değişkeniyle başka yer gösterilebilir.

## Klasörler

| Yol | İçinde |
| --- | --- |
| `addon/build.py` | Paket üretici. Sıra: manifests, items, blocks, worldgen, recipes, entities, sounds, particles, armor_rp, lang, zirh_data, scripts |
| `addon/gen/content.py` | **VERSION**, eşya/robot/cihaz/sandık listeleri, bütün tarifler, Türkçe adlar |
| `addon/gen/entities.py`, `robotgeo.py` | Robot varlığı (BP+RP), modeller, animasyonlar, `aqualit:act`/`act2` durumları |
| `addon/gen/zirh.py`, `aqualit_set.py` | Kabuk/taş/Aqualit zırhları, kabuk büyü kitapları |
| `addon/gen/sandik_gen.py` | v0.2.9 sandığı: tuzaklı sandık dokusu, amblem plakası, depo varlıkları, sayfa okları |
| `addon/gen/efekt.py`, `kesif_oyun.py`, `statue.py`, `sesler_def.py`, `ikon_haritasi.py`, `kafa_ikon.py` | Efektler, Keşif araçları, kapalı robot, sesler, menü simgeleri, konum çubuğu kafaları |
| `addon/gen/yapilar.py`, `insa.py` | Mimar'ın 25 yapısı ve İnşa Çubuğu (**yazıldı, pakete/oyuna bağlı değil**) |
| `addon/src/scripts/` | Oyun içi JavaScript (aşağıda) |
| `addon/test/mock/` | Sahte `@minecraft/server` ve `@minecraft/server-ui` (`node_modules/`), `sim.mjs` senaryoları |
| `addon/test/validate.py`, `apicheck.py` | Paket ve API denetimi |
| `ref/` | Başvuru verileri (yukarıda) |
| kök `*.py` | Doku, model, ses ve önizleme betikleri; `dokular/`, `sesler/`, `vanilla/` girdileri; `onizleme/` çıktıları |

### Script modülleri (`addon/src/scripts`)

- `main.js` giriş (sürüm başlığı ve giriş mesajı burada). `store.js` kalıcı veri (dinamik özellikler; `Robots`, `Chests` kayıtları).
- `brain.js` bütün robotları her tik çalıştırır (round-robin + `budget.js` 10 ms bütçe). `bot.js` robot denetleyicisi
  (hareket, envanter, sandıklar, tarama). `path.js` A* (jeneratör). `jobs.js` iş robotlarının görevleri (jeneratör),
  uzak arama, boş zaman işleri. `kaynak.js` görülen kaynak yerleri.
- `kilicli.js` seviye/istatistik/modlar, `powers.js` 5 güç, `fx.js` efektler, `takim.js` takım davranışı.
- `sandik.js` **Aqualit sandığı (v0.2.9)**, `ui/chest.js` sandık paneli.
- `zirh.js` kabuk/taş/Aqualit zırh mekaniği ve kabuk kitabı ganimeti. `statue.js` kapalı robot ve tamir kiti.
- `kesif.js` Mini Keşif, `konum.js` konum çubuğu, `place.js` robot ve sandık koyma, `items.js` eşya bileşenleri,
  `messages.js` telsiz mesajları, `insa.js` İnşa Çubuğu (bağlı değil).
- `ui/` menüler: `forms.js` (menu/modal/confirm), `task.js` Görev Kumandası, `radio.js` Telsiz, `tracker.js` Takip Ekranı,
  `kilicli_ui.js` Komut Çubuğu/Ayar Dişlisi/Bölge Seçici, `canta.js` çanta ekranı.

## Kodlama kuralları

- Oyun API çağrıları `safe(() => ...)` içinde; bir hata bütün robotları durdurmamalı. Formlar `fire(() => ...)` ile.
- **Asla tiki kilitleme:** uzun iş = jeneratör (`function*`) + döngülerde `yield`; tarama yalnız yüklü yığınlarda,
  `getBlocks(..., {includeTypes})` ile. Watchdog (uzun tik) dünyayı çökertir — v0.2.2'de bu yüzden iki sunucu çöktü.
- Her yeni özellik için `sim.mjs`'ye senaryo ya da denetim ekle. Yeni bir oyun API'si kullanırsan önce sahte dünyaya
  (`test/mock/node_modules/@minecraft/server/index.js`) ekle, sonra `apicheck.py` ile gerçek tanımda var mı bak.
- Sürüm numarası üç yerde birlikte değişir: `gen/content.py` (VERSION), `src/scripts/main.js` (başlık + giriş mesajı),
  sürüm notu (`docs/RAPOR_vX.Y.Z.md`).
- Eski dünyalar bozulmamalı: kimlikler (`aqualit:...`) değişmez; kaldırılan eşya/özellik için geçiş kodu yazılır
  (örnek: `zirh.js` migrateBark/migrateStone, `sandik.js` migrateOld).

## Bedrock tuzakları (hepsi bu projede bir kez sorun çıkardı)

- Hedef: `min_engine_version` 1.26.50, `@minecraft/server` 2.10.0, `@minecraft/server-ui` 2.2.0, manifest 2.
  Eşya biçimi 1.26.30, blok 1.26.20. Manifest sürümlerini geriletme, beta API kullanma.
- İstemci varlığında `sound_effects` değerleri **düz yazı** olmalı; nesne olunca model hiç çizilmez (v0.2.2–0.2.3'te
  robotlar görünmüyordu).
- Varlık özelliği (enum) ve blok durumu **en çok 16 değer** (robot hareketleri `act` + `act2` diye bölündü).
- Dinamik özellik yazısı en çok 32767 karakter: kayıtları sahip/bölge başına böl.
- Varlık envanteri: varlık başına **en çok 128 yuva** kullan (kayıtta yuva numarası bir bayt).
- Özel blok envanter tutamaz → Aqualit sandığı = oyunun `minecraft:trapped_chest` bloğu + önündeki `aqualit:sandik_depo`
  varlığı (+ gerekirse görünmez `aqualit:sandik_ek`). Bu yüzden oyundaki sıradan tuzaklı sandıklar da Aqualit
  görünümünde olur.
- Menüler (server-ui) dönen 3B gösteremez, yalnız resim. Eşya adları için `{translate: itemStack.localizationKey}`.
- `/locate` çıktısı okunamaz; uzak arama için `calculateClosestBiomeFromSeed`. `tickingarea` en çok 10.
  Trial spawner yalnız oyuncu yakınken çalışır. Özel büyü kitabı örste basılamaz (elde kullanılarak işleniyor).
- Konum çubuğu: `EntityWaypoint`, `LocationWaypoint`, özel simge (`CustomTexture`). Sandık açılış/kapanış:
  `world.afterEvents.blockContainerOpened/Closed` (`openSource.entity`). İmleç: `minecraft:cursor_inventory`.
- Telefon performansı: her tik ağır iş, çok parçacık, çok varlık kötü. `sim.mjs cokme` 12 robotla en uzun tiki ölçer.

## v0.2.9 Aqualit sandığı — bilinmesi gerekenler

- Kayıtlar (dünya dinamik özellikleri): `aq:sk:<o|n|e:x:y:z>` blok → sandık kimliği; `aq:su:<kimlik>` sandık kaydı
  `{id, dim, blocks:[{x,y,z,e,ek}], owner, ownerName, kind, name, access, added, double, page}`;
  `aq:salias` eski kimlik → yeni kimlik; `aq:sandik_ters` yön ölçümü (ilk oyuncu koyuşunda).
- Depo düzeni: önce blokların ana depoları (`e`), sonra ek depoları (`ek`); mantıksal yuva bunların art arda dizilişi.
  Ek depo kapasite 128'i aşınca konur; düzen değişirse eşyalar aynı mantıksal yerlerine geri konur (`snapshot/restore`).
- Sandık kapalıyken boştur; açılınca o anki sayfa sandığa taşınır (`startSession`), kapanınca geri alınır (`endSession`).
  Sayfa okları ve kilitli yuvalar işaret eşyalarıdır (`aqualit:sayfa_ileri/sayfa_geri/kilitli_yuva`), oyuncuya kaçarsa silinir.
- Robot kodu sandığı `Sandik` tutamacıyla kullanır (eski varlık sandığı gibi davranır; `getComponent("minecraft:inventory")`
  bütün sayfaları tek depo gibi gösterir: `UnitContainer`).
- Oyunda doğrulanacaklar PLAN.md'de ("v0.2.9 Aqualit sandığı").

## Sürüm verme

1. VERSION + main.js + sürüm notu. 2. Dört denetim temiz. 3. Yeni/ değişen tasarımların 3B önizlemesi.
4. Kullanıcıya `.mcaddon` dosyasını ver; neyin değiştiğini ve **oyunda neyi denemesi gerektiğini** yaz.
Kullanıcı daha önce paketi, bir indirme sayfasından base64 metin olarak indirip `.zip` diye kaydediyor, adını
`.mcaddon` yapıyordu; doğrudan dosya da açılabiliyorsa o daha kolay. Eski sürümün üstüne kurulur; dünya ayarlarında
Davranış ve Kaynak paketinin ikisinde de yeni sürüm görünmeli.
