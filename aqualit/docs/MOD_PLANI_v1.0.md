# AQUALIT ROBOTLARI — AYRINTILI MOD PLANI (v0.2.9 → v1.0)

Tarih: 29 Ekim 2026. Kaynak: kullanıcının sohbete yapıştırdığı plan.

> **Not:** Plan sohbete gelirken v0.5.x bölümünün "Bölge koruma ayrıntıları" maddesinde ("Takip m...") kesildi.
> Kalan bölümler (v0.5.x sonu, v0.6.0, v1.0, bölüm 7–11: yapı listesi, modül önerileri vb.) kullanıcıdan gelince
> buraya eklenecek. Güncel yapılacaklar listesi için `PLAN.md` de geçerli.

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
- [ ] Hedef 40 yapı + 40 çiftlik (liste bölüm 8 — plan metninde gelmedi).
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
      dost oyuncu listesi; kurulumda içerideki moblar kaydedilir. *(metin burada kesildi)*
