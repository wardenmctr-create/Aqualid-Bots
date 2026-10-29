# AQUALIT ROBOTLARI — AYRINTILI MOD PLANI (v0.2.9 → v1.0)

Tarih: 29 Ekim 2026. Kaynak: kullanıcının sohbete yapıştırdığı plan.

> **Not:** Plan iki mesajda geldi; ikinci mesaj bölüm 8'in sonunda bitti. Bölüm 9 (33 animasyon),
> bölüm 10 ve bölüm 11 (Yükseltme Modülleri önerisi) henüz gelmedi; gelince buraya eklenecek. Güncel yapılacaklar listesi için `PLAN.md` de geçerli.

## 0. Claude Code için kurallar

- Kullanıcıyla her zaman Türkçe konuş. Kod yorumları ve oyun içi yazılar Türkçe.
- 2-3 dakikada bir durum raporu: bütün işin yüzdesi + dürüst tahmini kalan dakika.
- Bitirilen her tasarımı (robot, eşya, blok, yapı, efekt) tek tek 3B önizlemeyle göster (GIF/MP4).
- Oyuncu Android telefonda oynuyor: dokunmatik kontrol; arayüz turkuaz, iptal tuşu kırmızı.
- Oyunda denemediğin şeye "oyunda denenmedi" de.
- "Öneri" ya da "açık karar" olan şeyleri yapmadan önce kullanıcıya sor.
- Önce `CLAUDE.md` (komutlar, tuzaklar) ve `PLAN.md` oku.

## 1. Teknik hedef ve komutlar

- Minecraft Bedrock 26.50+, min_engine_version 1.26.50, @minecraft/server 2.10.0, @minecraft/server-ui 2.2.0,
  manifest 2, eşya biçimi 1.26.30, blok 1.26.20. Manifesti geriletme, beta API kullanma.
- Derleme: `cd aqualit/addon && python3 build.py` → `out/Aqualit_Robotlari_vX.Y.Z.mcaddon`
  (gerekenler: Pillow, numpy, **scipy**, ffmpeg, Node 18+).
- Denetim: `python3 test/validate.py` (TOPLAM HATA: 0) · `python3 test/apicheck.py` (0 sorun)
- Deneme: `cd test/mock && rm -rf scripts && cp -r ../../src/scripts scripts && node sim.mjs`
- Şu an: 20 senaryo, 307 denetim geçiyor (sandık 91). Dördü temiz değilse sürüm verilmez.
- Sürüm numarası 3 yerde: `gen/content.py` VERSION, `src/scripts/main.js` (başlık + giriş mesajı), sürüm notu.
- Paket telefona: base64 metin → .zip kaydet → adını .mcaddon yap. Eski sürümün üstüne kurulur; dünya ayarlarında
  Davranış ve Kaynak paketinin ikisinde de yeni sürüm görünmeli.

## 2. Sürüm geçmişi

- V1–V2 (22–23 Ekim): Aqualit cevheri ve aletleri, 4 iş robotu, Kılıçlı (5 seviye), Görev Kumandası, Telsiz,
  Takip Ekranı, varlık sandıkları, kapalı robot (heykel) ve tamir kiti, kabuk/taş/Aqualit zırhları.
- v0.2.1 (23 Ekim): V2 düzeltmeleri.
- v0.2.2 (24 Ekim): sunucu çökmesi düzeltildi (sonsuz döngü, tik bütçesi), metalik robot sesleri.
- v0.2.3 (24 Ekim): Kılıçlı'nın 5 gücü, takım davranışı, tamir kiti taşıma, uzak görüş ve keşif, çanta ekranı,
  çiftçinin kova numarası, boş zaman işleri, konum çubuğu.
- v0.2.4: robotların görünmemesi düzeltildi (istemci varlığında sound_effects biçimi).
- v0.2.5: 5 güce epik efektler, 6 güç sesi.
- v0.2.6: Mini Keşif (uçak, gemi, denizaltı, arazi aracı, matkap; binme, sürme, 3x3 kazı).
- Kabuk Zırhları v1.0 (25–28 Ekim): ayrı paket (kabuk: namespace).
- v0.2.7 (28 Ekim): Kabuk Zırhları v1.2.1 birleştirildi.
- v0.2.8 (28 Ekim): taş zırh sadeleşti, derin kayrak biraz güçlü ama bakırın altında.
- v0.2.9 (29 Ekim): yeni Aqualit sandığı. Testler geçti, OYUNDA DENENMEDİ.

## 3. Oyunda şu an olanlar

Robot tarifi: üst `. B .` / orta `K S K` / alt `. ALET .` (B=Aqualit Bloğu, K=külçe, S=Aqualit Sandık).
Robot yere konunca yanına kendi türünde sandık kurulur, Görev Kumandası yoksa verilir. Oyuncu başına en çok 40 robot.

### İş robotları
- Madenci (kazma): Kömür, Demir, Bakır, Altın, Kızıltaş, Lapis, Elmas, Zümrüt, Aqualit, Nether Kuvarsı,
  Nether Altını, Antik Kalıntı, Ametist. Çoklu seçim + miktar; güzel şey bulursa Al/Alma/Bana sor;
  bitince sandığa getir ya da fırında eritip koy; kazdığı taşları da topla; uzaklık. Ayrı görev: Skyblock taş makinesi.
- Kürekçi (kürek): Kum, Kırmızı Kum, Çakıl, Toprak, Kil, Çamur, Ruh Kumu, Kar. Fırında erit (kum→cam, kil→tuğla).
- Çiftçi (çapa): Buğday, Havuç, Patates, Pancar, Nether Siğili, Şeker Kamışı, Bambu, Karpuz, Bal Kabağı,
  Tatlı Meyve, Kakao. Tarla yoksa açar; su uzaksa suyu havaya atıp 3B Aqualit kovayla yakalar.
- Oduncu (balta): Meşe, Ladin, Huş, Orman, Akasya, Koyu Meşe, Mangrov, Kiraz, Solgun Meşe, Kavak. Fidan diker.
- Uzaklık: 32/64/128/256/512/Sınırsız (400'e kadar keşif). Önce hafıza → ev çevresi 192 blok → 8 yönde 96 blokluk
  keşif halkaları.
- Boş zaman işleri (30 sn'de bir): sandık dolu uyarısı, hasat, fidan, ham maden eritme, tamir kiti yapma, kömür bulma.
- Kapalı robot: canı biten robot heykele döner (9 tür); tamir kitiyle uyanır.

### Kılıçlı
- Modlar: Takip et ve koru, Bölgeyi koru (2 köşe ya da 4–48 blok çevre), Burada bekle. EŞYA TOPLAMA MODU YOK.
- Seviyeler: 1 Kırmızı (30/7), 2 Yeşil (60/8), 3 Mor (100/10), 4 Sarı (160/12), 5 Mavi (300/15).
  Hayatta kalmada yalnız Seviye 1 tarifle; 2–5 yaratıcıda.
- Güçler 5/50: Elektrik kancası (S2, 20/8/15), Yıldırım kılıcı (S3, 30/18/30), Gölge adım (S4, 25/6/25),
  Elektrik kubbe (S4, 40/30/40), Gök gürültüsü (S5, 60/40/70). (enerji/bekleme sn/ciddiyet)
- Dövüş tarzı: Dengeli, Saldırgan, Gizli. Durum ciddiyeti 1–100.
- Takım: can %35 altı → kit ya da geri çekilme (%70'te döner); saldırılan arkadaşa koşar; %40 altındakini onarır;
  kapalı robotları uyandırır.

### Cihazlar
- Görev Kumandası, Robot Telsizi, Takip Ekranı (CANLI KONTROL YOK), Komut Çubuğu, Bölge Seçici,
  Kılıçlı Ayar Dişlisi (yaratıcı), Aqualit Tamir Kiti (5 kullanım), Konum çubuğu, Çanta ekranı, Mini Keşif.

### Cevher, aletler, zırhlar
- Cevher: taş ve derin kayrakta, y -48..16, yığın başına 7 deneme, 5'lik damar. 9 külçe = blok.
- Aletler: dayanıklılık 937, kazma hızı 10, hasar kazma 5 / kürek 4 / balta 6 / çapa 4 / kılıç 7.
- Aqualit zırh: 3/8/6/3, dayanıklılık 330/480/450/390; tam set Çabukluk I + suda nefes + suda %40 hız.
- Kabuk zırh (12 ağaç × 4): tam set 5 koruma, %20 hız, %30 az düşüş hasarı; Reçine Koruması I–III;
  kitaplar yalnız doğal sandıkların ilk açılışında %16.
- Taş zırh 7 koruma, derin kayrak 8 koruma.

## 4. v0.2.9 Aqualit sandığı (bitti, oyunda denenecek)

- Tuzaklı sandık üzerine kurulu: dokun = aç, basılı tut = kır, eğil + basılı tut = panel.
- Sayfalar ▶ / ◀. Kapasite tek 27 / çift 54; her normal sandık +27; en çok tek 200 / çift 500.
- 8 tür: Aqualit, Madenci, Kürekçi, Çiftçi, Oduncu, Kılıçlı, İnşaatçı, Toplayıcı.
- Depo: `aqualit:sandik_depo` (128) + `aqualit:sandik_ek` (128).
- Yan etki: sıradan tuzaklı sandıklar da Aqualit görünümünde.
- OYUNDA DENE: sandık konuyor mu ve sana dönük mü; çift sandık 54 mü; plaka ön yüzde mi; plakaya dokununca açılıyor mu;
  telefonda ▶◀ çalışıyor mu; kapat-aç sonrası 128+ yuvalar duruyor mu; eski sandıklar taşınıyor mu;
  robotun kurduğu sandık çalışıyor mu.

## 5. Yol haritası

v0.2.9 oyun testi → v0.2.10 düzeltmeler + küçük istekler → v0.3.0 Mimar → v0.3.1 Organizatör + Telefon
→ v0.4.0 Tam Keşif + dev harita → v0.5.x Kılıçlı büyük güncelleme → v0.6.0 canlı kontrol ve akıllı işler → v1.0 cilalama.

## 6. Sürüm sürüm iş planı

### v0.2.10 — Oyun testi düzeltmeleri ve küçük istekler
- [ ] Sandık testinde çıkanlar: block_placer sandık koymuyorsa onUseOn + betikle koyma; çift sandık 54 görünmüyorsa
      eşleştirmeyi kayıtla yap; oklar çalışmıyorsa panelde "Sayfa" düğmesi. (sandik.js, ui/chest.js)
- [ ] Kılıçlı yer altındaki moblarla uğraşmasın: yolu olmayan ve 6+ blok aşağıdakileri atla. (kilicli.js, powers.js)
- [ ] Sahibine 1 kalpten (2 can) fazla vuran her şeye saldırsın; dost oyuncular ve kendi robotları hariç. (takim.js)
- [ ] Bölge Seçici: dokun = 1. köşe, basılı tut = 2. köşe (olmazsa eğil + dokun). (ui/kilicli_ui.js, items.js)
- [ ] 1,5 blok zıplama: çit/duvar/kapı çerçevesi 1,5 sayılır; zıplama itkisi. (path.js, bot.js, blocks.js)
- [ ] Sandığın yanından geçerken eşya bırakma (3 blok, çanta yarıdan doluysa, görev eşyaları hariç). (bot.js)
- [ ] Robota 2 sn basılı tutarak eşya verme (40 tik). (items.js)
- [ ] Çiftçi kemik tozu kullansın (buğday/havuç/patates/pancar). (jobs.js farmerJob)
- [ ] "İş bitince: sana getir" seçeneği. (ui/task.js, jobs.js)
- [ ] Ayar Dişlisi adı "Ayar Dişlisi"; Mimar'ın "malzemesiz yap" ayarına yer.
- [ ] Kabuk kitabı ganimetini daralt. **ÖNERİ — kullanıcıya sor:** vanilya ganimet tablolarının kopyasına kitap havuzu;
      risk: Mojang tabloyu güncellerse bizimki eski kalır.
- [ ] Sim senaryoları: kilicli_hedef, ziplama, gecerken_birak, el_ver, kemik_tozu, sana_getir.

### v0.3.0 — Mimar (İnşaatçı)
Hazır: model (v.t==5), İnşaatçı Sandığı, 25 yapı verisi (gen/yapilar.py), İnşa Çubuğu kodu (insa.js, gen/insa.py). Oyuna bağlı değil.
- [ ] Robot eşyası `aqualit:robot_insaatci`; tarif önerisi `. B .` / `K S K` / `. İnşa Çubuğu .`; kapalı robot türü.
- [ ] Uçar, binilemez: yerçekimsiz, çarpışmasız, küçük teleport adımları, turkuaz iz, "fly" animasyonu. (mimar.js, gen/entities.py)
- [ ] Yapı verisi: yapilar.py → src/scripts/yapi_data.js; malzeme listesi otomatik; blok adları validate.py'de denetlenir.
- [ ] Kütüphane menüsü: kategori → resimli liste → yapı kartı → Önizle / Yer seç / İptal.
- [ ] Dönen hologram önizleme (10 sn, greedy meshing, saydam turkuaz). Yedek: parlak çerçeve + kat kat parçacık.
- [ ] Hologramla yer seçme: bakılan bloğa yapışır, bakışa göre 90° döner; dokun = onay, eğil + dokun = çevir, kırmızı İptal.
- [ ] İnşa: alan temizleme, alttan üste, blok durumları yöne göre çevrilir, tik başına 2–4 blok, ilerleme telsize.
- [ ] Malzeme sandıklardan; eksik listesi telsize. Malzemesiz yap (yaratıcı).
- [ ] Köylü/mob gereken çiftlikler kartta yazar.
- [ ] İnşa Çubuğu `aqualit:insa_cubugu` (tarif önerisi 2 külçe + çubuk + kızıltaş).
- [ ] Hedef **100 yapı + 50 Minecraft farmı** (liste bölüm 8).
- [ ] Sim "mimar": Minik Kulübe 4 yönde, eksik malzeme, malzemesiz mod, hologram, Küçük Kale'de en uzun tik < 50 ms.

### v0.3.1 — Organizatör ve Aqualit Telefon
- [ ] Robot eşyası, adı (öneri: Organizatör), tarif önerisi `. B .` / `K S K` / `. fıçı .`
- [ ] Sahibinin bütün sandıklarına erişir; başkasınınkine asla. (bot.js canUseChest)
- [ ] Sandık düzeni (türe göre), yarım yığın birleştirme, oyuncu açıkken dokunmaz.
- [ ] Envanter dizini + telsizde "Nerede?" araması.
- [ ] İstek aracılığı: sandık → iş robotu → Keşif → kullanıcı.
- [ ] Aqualit Telefon: şablonlu Türkçe dil motoru, eş anlamlılar, "Şunu mu demek istedin?".
- [ ] Görev zincirleri ve kuyruk; uzun zincirde onay.
- [ ] Dil motoruna en az 40 cümlelik birim testi; sim "organizator".

### v0.4.0 — Tam Keşif, DEVASA harita, yapı bilgisi
- [ ] DEVASA harita (robotlar için; 16x16 yığın başına biyom, yükseklik, kaynak, yapı; 512x512 bölge kaydı). (harita.js)
- [ ] Uzaktaki yapıyı bulma: calculateClosestBiomeFromSeed → biyom → yapı imzası (köy, Trial Chambers, piramit, maden ocağı).
- [ ] Keşif robotu: araç seçer, yanına robot alır (5 yer), konum gönderir.
- [ ] Yapı bilgisi: demirci sandığı, Trial Chambers yağması (sınırlar: spawner oyuncu ister, kasa anahtarı oyuncu ister).
- [ ] Köylü getirme (betikle bindirme; yedek ışınlama).
- [ ] Sim "kesif_harita": 3000 blok yolculuk, en uzun tik < 50 ms.

### v0.5.x — Kılıçlı büyük güncellemesi (3 parça önerisi)
- v0.5.0: güç motoru genişlemesi + hareket güçleri (7, 8, 19, 20, 26–30, 32, 50) + kombolar.
- v0.5.1: zaman (9–11), enerji/yıldırım (13–18, 31, 33, 34, 48, 49), destek (21–25, 35–40, 46, 47), nanobotlar (41–45);
  takım taktikleri ve takım kombolar.
- v0.5.2: %101 modu, Robot Kostümü, Eşya toplama modu (Nether/End), Yükseltme Modülleri, bölge korumasının ayrıntıları.
- [ ] Güç motoru (aqualit:pw 0–64 sayı özelliği), güç seçimi, kombolar (7), takım taktikleri (6), takım kombolar (4).
- [ ] %101 modu, Kılıçlı Robot Kostümü, Eşya toplama modu, Yükseltme Modülleri (öneri bölüm 11 — plan metninde gelmedi).
- [ ] Bölge koruma ayrıntıları: saldırgan / sonradan gelen barışçıl / oyuncu için "saldır" ya da "haber ver";
      dost oyuncu listesi; kurulumda içerideki moblar kaydedilir. Takip modunda birden fazla canlı korunur, öncelik sahip.
- [ ] Söz verilen 5 güç GIF'i + her yeni gücün 3B önizlemesi.
- Riskler: telefon parçacık sınırı (sadeleştir, örn. daha kısa duvar koşusu); nanobot görüşü için özel arayüz katmanı
  gerekir, olmazsa sis efekti; zaman durdurma mob yapay zekâsını kapatamaz, yalnız yerinde tutar.

### v0.6.0 — Canlı kontrol, eşya yapma, onaylar
- [ ] Canlı kontrol: canlı izlerken "Kontrolü al" → oyuncunun dokunmatik paneli gizlenir, yerine oyunun tuşlu panelinin
      turkuaz kopyası (ortada artı, ekrana dokunma yok). Joystick robotu yürütür, zıpla/eğil robota geçer
      (inputInfo.getMovementVector, getButtonState), kır/koy robotun önündeki bloğu işler. Kırmızı iptal bir adım geri:
      kontrol → izleme → kendi ekranın. Çıkınca robot işine döner. Gerçek vücut yerinde kilitli + kısa koruma;
      biri vurursa izleme biter. Panel değiştirmek JSON UI ister, bazı cihazlarda çalışmayabilir →
      yedek: telsiz menüsünde turkuaz kır/koy düğmeleri.
- [ ] Takip ekranı: izlerken gece görüşü, kamera seçenekleri; harita ilk planda ~25x25 hücre (şu an 15 satır).
- [ ] Eşya yapma zinciri: iş eşya isterse malzemesi varsa çalışma masası aramadan yapar, yoksa malzemeyi en kısa yoldan
      toplar. Liste: taş/demir kazma, balta, çakmak, kova, meşale, kalas, çubuk, külçe eritme, yakıt (genişletilebilir).
      Yaptıkları normal kırılır; ana alet kırılmaz. Uzun zincirde önce plan + onay.
- [ ] Onay sistemi: Onayla/Reddet/Değiştir; cevap yoksa 5 dk bekler, sonra sandığına dönüp bekler. Bilgi turkuaz,
      yardım çağrısı kırmızı; ekranı kesmez, küçük bildirim.
- [ ] Sınırsız robot envanteri: 27 yuvayı aşan kısım robota bağlı görünmez depolara (sandıktaki 128'lik yöntem);
      **öneri** 1024 yuva.
- [ ] Kürekçi alan düzleştirme ve geri doldurma (Bölge Seçici ile alan, hedef yükseklik, çukurları toprakla doldur).
- [ ] "Acil işin yoksa geri dön" tam hali: yakındaki güzel cevherden birkaç tane, yanına koyduğu masa/fırınları toplar.
- [ ] Sim: kontrol, esya_yap, onay (5 dk zaman aşımı).

### v1.0 — Cilalama
- [ ] 33 animasyonun tamamı (bölüm 9).
- [ ] Çok oyunculu ve Realms denemesi (sahiplik, performans).
- [ ] Denge: cevher sıklığı, alet gücü, Kılıçlı seviyeleri, enerji, zırh sayıları.
- [ ] Telefon performansı: 20 robot + 6 Kılıçlı güç + 5 büyük sandık açıkken en uzun tik.
- [ ] Eski sürüm geçişleri (kabuk, taş, sandık) en eski sürümden denenir.
- [ ] **Öneri:** oyun içi rehber kitap (Aqualit Rehberi) ve İngilizce dil dosyası.

## 7. Kılıçlı — 50 güç tam listesi ([VAR] = oyunda var)

Seviye 2: 1 Duvar koşusu (duvarda koşar, duvardan duvara sıçrayıp düşmanın üstüne iner) · 2 Elektrik kancası [VAR]
Seviye 3: 3 Uzun uçuş (sırt iticileriyle enerji bitene kadar uçar, havadan saldırır) · 4 Yıldırım kılıcı [VAR]
Seviye 4: 5 Gölge adım [VAR] (12 bloğa kadar, düşmanın arkasında belirir) · 6 Elektrik kubbe [VAR] (10 sn, kendini/sahibini/takımı korur)

Seviye 5 (44 güç):

| # | Güç | Ne yapar |
| --- | --- | --- |
| 7 | Ayna klonları | 6 klona bölünür, klonlar gerçek hasar vurur |
| 8 | Klon fırtınası | bütün klonlar aynı anda farklı yönlerden atılır |
| 9 | Zaman yavaşlatma | 6 sn her şey yavaşlar, robot normal hızda |
| 10 | Zaman durdurma | 3 sn her şey donar, vurulan hasar sonunda tek seferde patlar |
| 11 | Geri sarma | ağır hasarda 5 sn önceki yerine ve canına döner |
| 12 | Gök gürültüsü [VAR] | gökten dev yıldırım, geniş alan hasarı |
| 13 | Yıldırım fırtınası | 10 sn yalnız düşmanlara yıldırım yağar |
| 14 | Plazma lazeri | kol topundan 60 bloğa kadar delici, süpürülebilen ışın |
| 15 | Enerji küresi | çarpınca patlar, sersemletir |
| 16 | Kara delik | içine çeker, sıkıştırır, patlatır |
| 17 | Yerçekimi kontrolü | havaya kaldırır, savurur, yere çarpar |
| 18 | Manyetik fırtına | ok, mermi, ateş toplarını durdurup geri yollar |
| 19 | Faz geçişi | 5 sn duvarlardan geçer, hasar almaz |
| 20 | Görünmezlik | 10 sn; arkadan ilk darbe 3 kat |
| 21 | Drone sürüsü | 6 mini drone 20 sn lazer atar |
| 22 | Roket yumruk | kolunu fırlatır, düşmanı savurur, kol döner |
| 23 | Kalkan fırlatma | kalkan düşmanlar arasında sekip döner |
| 24 | Kılıç kasırgası | dönerek hortum, çekip savurur |
| 25 | Bumerang kılıç | düşmandan düşmana zıplayıp ele döner |
| 26 | Meteor dalışı | yüksekten çakılır, şok patlaması (blok kırmaz) |
| 27 | Deprem darbesi | halka halka şok dalgası, havaya fırlatır |
| 28 | Hayalet adımlar | 6 düşmanın arasından vurarak geçer |
| 29 | Seken basış zinciri | 5 düşmana kadar kafasına basıp seker |
| 30 | Yapışık saldırı | sırtına yapışıp kaldırır, yere çakar |
| 31 | Elektrik ağı | 5 sn hareket edemezler |
| 32 | Enerji kanatları | süzülür, enerji tüyleri yağdırır |
| 33 | Işık kılıcı formu | menzil ve hasar 2 kat, kalkan deler |
| 34 | Yansıtıcı zırh | 6 sn hasarı saldırana yansıtır |
| 35 | Nano onarım | kendini ve sahibini iyileştirir, takımın zırhını onarır |
| 36 | Kalkan uyduları | sahibin etrafında 3 kalkan |
| 37 | Portal kapısı | 30 bloğa kadar iki portal; dostlar geçer, düşmanlar başka yere düşer |
| 38 | Savaş analizi | sonraki 10 vuruş kritik |
| 39 | Taktik görüş | duvar arkasındaki düşmanları görür ve işaretler |
| 40 | Son form | 20 sn bekleme süreleri sıfır, şimşek aurası, sonra kısa yorgunluk |
| 41 | Nanobot sürüsü | yüzlerce nanobot (2 piksel blok); alan hasarıyla ölürler |
| 42 | Nanobot görüşü | düşman oyuncunun ekranında görüşü kısıtlar; moblarda körlük ve şaşkınlık |
| 43 | Nanobot ısırığı | yapışıp sürekli hasar |
| 44 | Nanobot bulutu | taşır, kaldırır, fırlatır, çakar |
| 45 | Nanobot zırhı | sahibe/robota zırh olur, hasar emer |
| 46 | Akıllı karşılık | havaya atılırsa dönüp çakılır, yere düşerse takla atıp karşı saldırır |
| 47 | Savaş öğrenmesi | aynı düşman türüne karşı öğrenir, daha az hasar alır |
| 48 | EMP darbesi | sersemletir, havadaki mermileri düşürür |
| 49 | Yıldız kılıçları | 8 enerji kılıcı yağmur gibi iner |
| 50 | Dev form | 15 sn 3 kat büyür, adımları şok dalgası |

Her gücün kendi animasyonu var (ilk plandaki tarifler: `docs/ilk_plan_v1.txt`). Kalp ışığı = enerji göstergesi.

Modeller: 1 Kırmızı (can 30, hasar 7) · 2 Yeşil (60, %10 hızlı, 8) · 3 Mor (100, %20, 10) · 4 Sarı (160, %35, 12)
· 5 Mavi (300, %50, 15). Pelerin, gözler, anten ucu, kalp, omuzluklar model renginde; yanaklar her seviyede kırmızı.

Kombolar: Sallanan şimşek (S3: kanca + yıldırım kılıcı) · Gölge şimşek (S4: gölge adım + yıldırım kılıcı) ·
Yıldırım düşüşü (S5: koş, duvar koşusu, uçuş, meteor dalışı) · Klon kuşatması (S5: zaman yavaşlar, klonlar, klon fırtınası) ·
Kara delik tuzağı (S5: elektrik ağı, kara delik, gök gürültüsü) · Hayalet avcı (S5: görünmezlik, gölge adım,
hayalet adımlar) · Son kale (S5: kubbe + kalkan uyduları + plazma lazeri).

Takım taktikleri: Kuşatma · Öncü ve destek · Yem ve pusu · Kalkan halkası · Sıralı vuruş · Hava ve yer.
Takım kombolar: Çapraz kanca · Şimşek ağı · Çifte gölge · Fırtına çemberi.
Dövüş tarzları: Dengeli, Saldırgan, Gizli [VAR]. Takım halinde dövüş ve akıllı güç seçimi ciddiyetten bağımsız, hep açık.

## 8. Mimar yapı listesi (hedef 100 yapı + 50 Minecraft farmı)

> Kullanıcı düzeltmesi (29 Ekim): kütüphane 40 + 40 değil, **100 yapı + 50 farm**. Farm = gerçek Minecraft farmı
> (mob farmı, creeper/barut, şeker kamışı, bambu ...). Hazır: 21 yapı + 4 farm. Gereken: **79 yapı + 46 farm** daha.

Hazır 25 (`gen/yapilar.py`, oyuna bağlı değil):
- Küçük: Minik Kulübe 7x7x7, Kamp Ateşi Alanı 7x3x7, Köy Kuyusu 6x6x6, Fener Direği 3x5x1, Çiçek Bahçesi 9x2x9, Çeşme 9x5x9
- Ev: Ahşap Ev 9x9x9, İki Katlı Ev 11x13x11, Taş Ev 9x8x11, Çöl Evi 9x6x9, İglo 9x6x11, Cadı Kulübesi 7x9x9
- Köy: Demirci 11x8x9, Kütüphane 11x9x13, Ambar 11x10x15, Yel Değirmeni 9x17x10
- Kule: Gözetleme Kulesi 7x17x7, Deniz Feneri 9x25x9, Yağmacı Kulesi 11x24x11, Küçük Kale 23x14x23, End Şehri Kulesi 11x32x11
- Çiftlik: Buğday Tarlası 11x3x11, Hayvan Ağılı 13x6x13, Şeker Kamışı Çiftliği 11x5x4
- Dev: End of Light Mega Çiftlik (Bedrock'a uyarlanmış)

Eklenecek yapılar — listede 19 tane var (21 + 19 = 40), **60 yapı daha seçilmeli**: kullanıcının istedikleri — Küçük kulübe (**Minik Kulübe karşılıyor mu, sor**),
Başlangıç evi, Büyük ev, Lüks ev, Mini villa, Orta villa, Büyük villa — + **öneriler**: Ağaç ev, Robot atölyesi
(Aqualit temalı), Depo binası (Organizatör için sandık odası), Sera, Liman/iskele, Köprü, Pazar yeri, Nether portalı
çerçevesi, Tapınak, Kule ev, Karakol, Su değirmeni.

Eklenecek farmlar — listede 36 tane var (4 + 36 = 40), **10 farm daha seçilmeli** (hepsi Bedrock kurallarına göre, oyunda denenmeli): Demir (köylü + yatak + zombi
korkutma) · Otomatik ekin (köylü çiftçi + huni) · Kavun-balkabağı (gözlemci + piston) · Otomatik şeker kamışı · Bambu ·
Kaktüs · Yosun · Bal ve petek · Yün (koyun + makaslı dağıtıcı) · Tavuk/yumurta · İnek · Köylü üretme · Ticaret salonu ·
Karanlık oda yaratık · Örümcek spawner · Zombi/iskelet spawner deneyim · Yağmacı baskını · Gardiyan · Balçık ·
Creeper/barut · Cadı · Blaze · Wither iskeleti · Altın (zombi piglin) · Enderman · Shulker · Mürekkep balığı ·
Kurbağa ışığı · Ağaç · Mantar · Nether siğili · Tatlı meyve · Kakao · Taş üretici · Bazalt üretici · Kemik tozu (kompost).

Her yapının: anahtar, ad, kategori, boyut, malzeme listesi, menü resmi, hologram modeli, gereken köylü/mob/kızıltaş.

<!-- Bölüm 9 (33 animasyon), 10, 11 (Yükseltme Modülleri) gelmedi. -->
