# Aqualit Robotları — Claude Code çalışma rehberi

Bu klasör, Minecraft Bedrock 26.50 için **Aqualit Robotları** eklentisinin bütün kaynağı. Şu anki sürüm **v0.5.1** (canlı kontrol, onay sistemi, 27 yeni farm; v0.5.0: rampa, 51 güç efekti, Organizatör üssü, sınırsız çanta, sandık taşıma, yüzeyde sürüş; önceki: **v0.4.1**
(matkap X-ray, hız çubuğu 0-500, arazi sürüş motoru ve 4 blok basamak; 0.4.0: Portalcı, evcil dronlar, Organizatör Yardımcısı ve üssü, yeni vizör, tepeden kamera haritası, uzaktan izleme; 0.3.9: matkap ve cevher dürbünü; Keşif düzeltmeleri, uçan binek sistemi, arazi Tırmanma Modu; 0.3.5: mini tarama dronları; 0.3.2: takip, otopilot, 3B eşyalar). Sahte test dünyasındaki bütün denemeler geçiyor; **oyunda henüz denenmedi**.
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
                                     # eritme, zirh, guc, cokme, takim, uzak, canta, bos, konum, efekt, kesif, sandik, mimar,
                                     # kesifai, sefer, takip, kit, organizator, harita, tema; virgülle birden çok: kesif,tema)
```

Gerekenler: Python 3.10+ (Pillow, numpy, scipy, nbtlib), Node.js 18+, ffmpeg (önizleme ve ses). Bütün senaryolar ~10 dk sürer.
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
| `addon/gen/yapilar.py` | Elle yapılmış 25 yapı (palet çizimi) |
| `addon/gen/yapi_kutuphane.py`, `yapi_paket.py` | Kütüphaneyi pakete yazar: `structures/aqualit/*.mcstructure`, menü resimleri, `yapi_data.js` |
| `addon/gen/yapi_cevir.py`, `yapi_listesi.json`, `addon/yapilar/` | Java şeması → Bedrock çevirici, dış yapıların listesi ve çevrilmiş dosyaları (`yapi_ice_aktar.py` üretir) |
| `addon/gen/dron.py` | Mini dron mimar varlığı, modeli, animasyonları |
| `addon/gen/insa.py` | İnşa Çubuğu simgesi (**bağlı değil**) |
| `addon/src/scripts/` | Oyun içi JavaScript (aşağıda) |
| `addon/test/mock/` | Sahte `@minecraft/server` ve `@minecraft/server-ui` (`node_modules/`), `sim.mjs` senaryoları |
| `addon/test/validate.py`, `apicheck.py` | Paket ve API denetimi |
| `ref/` | Başvuru verileri (yukarıda) |
| kök `*.py` | Doku, model, ses ve önizleme betikleri; `dokular/`, `sesler/`, `vanilla/` girdileri; `onizleme/` çıktıları |

### Script modülleri (`addon/src/scripts`)

- `main.js` **güvenli açılış** (v0.3.1): `kayit.js` eşya bileşenlerini hemen kaydeder (işleyiciler `H` tablosunda,
  items.js doldurur), asıl kod `ana.js` dinamik yüklenir; hata olursa sohbete yazılır. Sürüm başlığı ve giriş mesajı `ana.js`'te. `store.js` kalıcı veri (dinamik özellikler; `Robots`, `Chests` kayıtları).
- `brain.js` bütün robotları her tik çalıştırır (round-robin + `budget.js` 10 ms bütçe). `bot.js` robot denetleyicisi
  (hareket, envanter, sandıklar, tarama). `path.js` A* (jeneratör). `jobs.js` iş robotlarının görevleri (jeneratör),
  uzak arama, boş zaman işleri. `kaynak.js` görülen kaynak yerleri.
- `kilicli.js` seviye/istatistik/modlar, `powers.js` 5 güç, `fx.js` efektler, `takim.js` takım davranışı.
- `sandik.js` **Aqualit sandığı (v0.2.9)**, `ui/chest.js` sandık paneli.
- `mimar.js` **Mimar (v0.3.0)**: kütüphane menüsü, çerçeveyle yer seçme, uçuş, dronlar, kat kat inşa, malzeme kemeri
  (`aq:mdepo`), blok yönü döndürme. `yapi_data.js` build.py üretir (yalnız bilgiler; bloklar yapı dosyalarında).
- `zirh.js` kabuk/taş/Aqualit zırh mekaniği ve kabuk kitabı ganimeti. `statue.js` kapalı robot ve tamir kiti.
- `kesif.js` Mini Keşif, `konum.js` konum çubuğu, `place.js` robot ve sandık koyma, `items.js` eşya bileşenleri,
  `messages.js` telsiz mesajları, `insa.js` İnşa Çubuğu (bağlı değil).
- **v0.3.1:** `kesif_ai.js` Keşif yapay zekâsı (yapı/biyom bulma, götürme, robot taşıma, oturma pozu, matkap kapısı ve deposu),
  `harita.js` keşif haritası + Bilinen yerler, `yapi_bilgi.js` 23 yapı ve her yapıda yapılacak işler, `yagma.js` yağma,
  `sefer.js` Keşif'le ekip seferi, `kesif_radar.js` radar + hız sayacı, `kesif_koltuk.js` oturma planı (**gen/kesif_oyun.py
  üretir**, elle değiştirme). Araç ölçeği `kesif_oyun.VS` (1.4); koltuklar model pikseli cinsinden `SEATS`.
- **v0.3.2:** `gen/esya3d.py`: sandık eşyaları aynı kimlikli 3B sandık blokları (`replace_block_item`; konunca sandik.js
  tuzaklı sandığa çevirir), cihazların elde 3B modelleri (attachable). Otopilot ve takip: `kesif_ai.js` (`otopilotBaslat`,
  `takipEt`), `kesif_radar.js` (`otopilotMenu`), robot takibi `jobs.js takipIsi`. Sim senaryosu: `takip`.
- **v0.3.5–0.3.6:** `kesif_dron.js` (+ `gen/kesif_dron.py`) mini tarama dronları. Sürüş oyunun binek sistemiyle:
  yer araçları `input_ground_controlled` + `variable_max_auto_step`, uçak/denizaltı `input_air_controlled` (betikle itki
  binilen araçta işlemiyor). Bileşen grubu kaldırmak bileşen değerini sıfırlamaz: karşıt grubu ekle (`k_gecis`/`k_gecis0`,
  `k_arazi_yer`/`k_tirman`, `k_denizalti_su`/`_kara`). Render controller parça gizlemesi oyunda işlemedi; gizleme `gizle`
  animasyonunda ölçek 0. Arazi Tırmanma Modu: `kesif_radar.js tirmanMenu`, `kesif.js tirman`.
- **v0.3.8:** `kesif_harita.js` Keşif Haritası (glif kareleri: `gen/harita_glif.py` → RP `font/glyph_E1/E2.png` +
  `harita_glif.js`), oyuncu yürüdükçe harita dolar (`harita.js` bölgeleri bellekte, 5 sn'de bir yazılır), dron ordusu
  (`dronTara` + `atla`). Keşif temaları: `gen/kesif_tema.py` (malzeme dokusu, süs kemikleri tn_/te_), `q.skin_id = tema*2 +
  tutucu` (`aqualit:skin_N` olayları); `kesif.js temaUygula`, lav sisi (`fog push aqualit:lav_berrak`), End boşluk kurtarma,
  yapışkan tırmanma (`tirman`, `cevreYuzey`).
- `dil.js` Türkçe dil anlama, `organizator.js`, `org_ui.js`, `org_uretim.js` Organizatör (v0.4.0'da sürüyor).
- `ui/` menüler: `forms.js` (menu/modal/confirm), `task.js` Görev Kumandası, `radio.js` Telsiz, `tracker.js` Takip Ekranı,
  `kilicli_ui.js` Komut Çubuğu/Ayar Dişlisi/Bölge Seçici, `canta.js` çanta ekranı.

### v0.4.0 modülleri
- `kesif_harita.js`: harita = tepeden serbest kamera (kuzey yukarı); işaretler tek parçacık `aqualit:harita_isaret`
  (atlas `gen/harita_isaret.py`, hücre `v.u/v.v`), kameranın D=8 blok önüne küçültülerek çizilir (arazi örtmez).
  Yakın/orta/uzak = `YUKSEK`; sis `aqualit:harita_sis`; pusula çubuğu simgeleri `textures/ui/aqualit_yapi/<tür>`.
  Eski glif haritası kaldırıldı (glif sayfaları yalnız cevher dürbünü için duruyor).
- `ui/tracker.js`: Takip Ekranı = liste (dokun = canlı izle). Uzak/başka boyuttaki robot: oyuncu seyirci olur, yanına
  taşınır, dönüşte `aq:izle_geri` ile eski yer ve mod geri gelir.
- `evcil.js` + `gen/evcil_oyun.py`: tek varlık `aqualit:evcil`, tür `aqualit:tur` (0-9); modeller `tasarim/` dosyalarından.
  Tarif sonucu dizi (robot + evcil). Cam yarı saydam: `K.SON_UV['cam']` adası alfa 128, malzeme `entity_alphablend`.
- `portalci.js` + `gen/portalci_oyun.py`: `aqualit:portalci` (dron, binilir, `aqualit:kucuk`), `aqualit:portal`
  (girdap 8 kare, render controller `uv_anim`). `guvenliYer` tickingarea ile yükletip arar, yoksa obsidyen platform.
  Çırak seferi `netherIsi` robota `startJob` ile verilir.
- `yardimci.js` + `gen/yardimci_oyun.py`: Organizatör sandığa yürümez, `yardimciGonder` (Aktarım Bloğu yanındaysa uçmaz).
  Organizatör'de gezinme yok: `random_stroll` artık `aqualit:gezin` grubunda (`gezin_on/off`).
- `us.js` + `gen/org_ussu_oyun.py`: `aqualit_firin` (durum `aqualit:yanik` hayir/evet), `aqualit_kablo` (durumlar
  `aqualit:n/s/w/e/u/d` yok/var, kemik görünürlüğü), `aqualit_aktarim`, platform varlığı `aqualit:org_platform`.
  Blok durumlarında bool/int şemadan geçmiyor: metin değer kullan.
- Organizatör vizörü: `robot.py` `vz_*` parçaları; cam `visor_cam` kemiğinde, ayrı render controller (alphablend).

### v0.5.1 notları
- `gen/farmlar2.py`: 27 farm daha (toplam 51 `ciftlik`); `yapilar.py` döngüsel içe aktarım yüzünden önce `yapilar` yüklenmeli.
- `zirh.js yapiTuru(dim, pos)`: piramit / trial / maden; kabuk kitabı yalnız piramit ve Trial Chambers sandığında,
  maden için `minecraft:chest_minecart` etkileşimi (`aq:acildi` varlık özelliği).
- Onay: `messages.js answer({degis})`, `zamanAsimi`; canlı kontrol `ui/tracker.js kontrolAl`.

### v0.5.0 modülleri
- `guc_efekt.js` + `gen/guc_efekt.py`: 51 güce 3D (`aqualit:guc_fx`, özellik `aqualit:fx`) ve 2D (`aqualit:g2_N`) efekt;
  CASTS sarılır; robot ayarı `stats.efekt`. `rampa.js` + `gen/rampa.py` (eğim blokları `rampa_e1..8`, durum kayma/parca).
- `kilicli_ek.js` (sahibe vurana saldırı, boyuta portalla geçiş), `koruma.js` (bölge tepkileri), `kostum.js` (Robot Kostümü),
  `alan.js` (Kürekçi düzleştir/doldur), `tasima.js` (sandık taşıma, `aq:tasinan` ile sürer), `bot.js` taşma deposu
  (`aq:tasma`, `canta()`), `us.js usuSifirdanKur` + panel varlığı `aqualit:org_panel`, `portalci.js ucarakGit/netherAvi`.
- `kesif.js tirman`: yüzeyde sürüş (`aqualit:yuzey`, `aqualit:yon`, kemik `a_yuzey`); hız grupları `hz_<araç>_<yüzde>`.

### v0.4.1 modülleri
- **v0.4.7: eski saydam taş X-ray kaldırıldı**; `xray.js` artık cevher görüşünü aç/kapat (`gorusAcik`, kişisel) ve
  eski kayıtlı hayalet taşları geri çevirir. Aşağıdaki satır eski sistem:
- `xray.js` + `gen/xray.py`: hayalet taşlar `aqualit:xr_<tür>_y|t` (`fillBlocks` + `includeTypes`, yığın dilimi 16x16x128,
  tik başına 6 çağrı), ayar `aq:xray_ayar`, geri çevrilecekler `aq:xray_kalan`. `blocks.js asil()` hayaleti asıl sayar.
  Matkap `KEEP` hayaletleri kazar. Eşya yalnız matkapta (`kesif_radar.js esyalariVer`).
- `kesif.js formOf`: biçim `aq:form` dinamik özelliği + varlık özelliği. Hız: `aq:hiz` 0-5, `hizMenu` canlı CustomForm.
- **v0.4.6** `cevher_durbunu.js` cevher görüşü: matkapta cevher işaretleri (parçacık `aqualit:cevher`, atlas `gen/cevher_gorus.py`) gözden cevhere çizgide, ilk duvarın önünde (`getBlockFromRay`), boy = KAT·0,5·D/uzaklık (KAT 1,5: bloğun 1,5 katı). Mimar menü resimleri gerçek dokularla (`gen/blok_doku.py`, atlas `ref/yapi_cevir/blok_dokulari.*`).
- `surus.js` toz/ses; gövde hareketi `gen/kesif_oyun.py` pre_animation (`v.kayma`, `v.yatma`, `v.sh`).

## Kodlama kuralları

- Oyun API çağrıları `safe(() => ...)` içinde; bir hata bütün robotları durdurmamalı. Formlar `fire(() => ...)` ile.
- **Asla tiki kilitleme:** uzun iş = jeneratör (`function*`) + döngülerde `yield`; tarama yalnız yüklü yığınlarda,
  `getBlocks(..., {includeTypes})` ile. Watchdog (uzun tik) dünyayı çökertir — v0.2.2'de bu yüzden iki sunucu çöktü.
- Her yeni özellik için `sim.mjs`'ye senaryo ya da denetim ekle. Yeni bir oyun API'si kullanırsan önce sahte dünyaya
  (`test/mock/node_modules/@minecraft/server/index.js`) ekle, sonra `apicheck.py` ile gerçek tanımda var mı bak.
- Sürüm numarası üç yerde birlikte değişir: `gen/content.py` (VERSION), `src/scripts/ana.js` (başlık + giriş mesajı),
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

## v0.3.0 Mimar — bilinmesi gerekenler

- Yapılar `world.structureManager.get("aqualit:<kimlik>")` ile okunur; `getBlockPermutation` boşlukta `undefined` verir.
  Yapının önü (kapı) +Z kabul edilir; döndürme `rotXZ` + `rotateStates` (saat yönü, yukarıdan).
- Mimar sahibin genel ve İnşaatçı sandıklarından malzemeyi kemerine alır (sınırsız, varlık özelliği `aq:mdepo`); artanı
  eve dönünce sandığa koyar. Görev: `{type:'insaatci', yapi, at, rot, dim, free}`; ilerleme `prog.i/done` (devam edilebilir).
- Dronlar `aqualit:dron`; çalışan dron kimlikleri bellekte (`live`). Dünya yeniden yüklenince sahipsiz dron silinir.
- Yeni dış yapı eklemek: `gen/yapi_listesi.json`'a satır → `python3 yapi_ice_aktar.py <şema_klasörü>` → build.
  Şema arşivi: rom1504/minecraft-schematics-dataset (GitLab'de tfrecord parçaları).
- `sim.mjs` yapı dosyalarını `out/Aqualit_BP/structures` içinden okur: **önce build.py çalışmalı.**

## Sürüm verme

1. VERSION + main.js + sürüm notu. 2. Dört denetim temiz. 3. Yeni/ değişen tasarımların 3B önizlemesi.
4. Kullanıcıya `.mcaddon` dosyasını ver; neyin değiştiğini ve **oyunda neyi denemesi gerektiğini** yaz.
Kullanıcı daha önce paketi, bir indirme sayfasından base64 metin olarak indirip `.zip` diye kaydediyor, adını
`.mcaddon` yapıyordu; doğrudan dosya da açılabiliyorsa o daha kolay. Eski sürümün üstüne kurulur; dünya ayarlarında
Davranış ve Kaynak paketinin ikisinde de yeni sürüm görünmeli.
