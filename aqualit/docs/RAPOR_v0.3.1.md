# Aqualit Robotları v0.3.1 — Keşif ara sürümü

Sahte test dünyasında denendi; **oyunda denenmedi**.

## Yenilikler

### Keşif
- **Dokununca menü açılmıyordu, düzeldi.** Araçken menü için eğilip dokun, eğilmeden dokununca binersin.
- **Yapay zekâ:**
  - 23 yapı türünü bulur (köy, tapınaklar, deneme odası, Nether kalesi...) ve biyom bulur.
  - Çevreyi keşfedip harita çıkarır, bulduklarını "Bilinen yerler"e yazar.
  - Seni ya da robotlarını götürür; uzun yolda uçak, suda gemi, yer altında matkap olur.
- **Sefer:** robot ekibini seçilen yapıya götürür.
  - Kılıçlılar yeri korur, iş robotları yağmalar, hep birlikte eve dönülür.
- **10 robot taşır; her aracın kendi oturma planı var** (`onizleme/64_oturma_*.png`):
  - **Uçak:** 2 koltuk, 4 kanat, 2 arka kanat, tekerleklerde tutunan 2 robot.
  - **Gemi:** güverte, pruva, kıç ve tavanda yan yana iki robot.
  - **Arazi aracı:** 5 koltuk, kaput, iki çamurluk, tavanda yan yana iki robot.
  - **Matkap:** sürücü, içeride 4, arka platformda 5 robot. Arka kapı robot binmişken açık; yalnız oyuncu binince ya da Keşif tek giderken kapanır.
  - **Denizaltı:** robotların hepsi içeride (dışarıda boğulmasınlar).
  - Yer kalmazsa kalan robotlar aracın içine girer (görünmez); araç inince çıkarlar.
  - Binen robotlar hep oturur, ayakta durmaz.
- **Araçlar 1.4 kat büyüdü** (robot hali aynı boyda).
- **Matkap deposu:** matkabın kazdıkları depoya girer, yakında madenci varsa ona verilir. Menüden "Matkap deposu → bana ver" de var.
- **Keşif'e binince iki eşya gelir** (inince geri alınır):
  - **Yer Bulucu Radar** (basılı tut):
    - Yapı listesi açılır. Seçince en yakın yapıya konum çubuğunda simge çıkar ve Keşif'ten radar sesi gelir; ses yaklaştıkça sıklaşır.
    - Yakında yoksa uygun biyoma göre tahmini yer gösterir; oraya yaklaşınca tam yeri arar.
    - Radar açıkken basınca listede yalnız **İptal et** olur.
  - **Hız Sayacı:** Yavaş, Normal, Hızlı. Yaratıcı modda **Ekstra hızlı** ve **Max hız** da var (yalnız uçakta tavsiye edilir).
- Eşya simgesi yenilendi (radar çanaklı, gözlüklü kâşif).

### Bütün robotlar
- **Yağmala:** sandık, fıçı ve çömleklere bakar; kasayı anahtarla açar.
  - Üssün 24 blok çevresindeki sandıklara dokunmaz.
  - Yapıya göre iş yapar: çöl tapınağında TNT tuzağını söker, şüpheli kumu fırçalar; orman tapınağında teli keser...
- **Beni takip et / Takibi bırak** (Görev Kumandası).
  - Kılıçlıda bu, zaten var olan "Takip et ve koru" modudur.
- Kılıçlı, Warden'a kendiliğinden saldırmaz.

### Mimar
- **Malzeme listesi değiştirilebilir:** maddeye dokununca en iyi alternatifler çıkar.
  - Hayatta kalmada bulunmayan bloklar "yok", zor bulunanlar "zor" diye işaretli.
- **Yer seçerken panel birkaç saniye kaybolur**, sonra onay tuşuyla geri gelir.

## Oyunda denenecekler
1. Keşif'e eğilmeden dokun: menü açılmalı. Araçken eğilip dokun: menü; normal dokun: bin.
2. "Yapı bul → Köy": Keşif uçup köyü bulmalı, konum göndermeli.
3. Sefer: 4 Kılıçlı ve 6 madenci seç, en yakın deneme odasına git. Robotlar oturmalı, tekerlektekiler tutunmalı, matkapta kapı açık olmalı.
   - Deneme odasındaki canavar yumurtlatıcı yalnız sen yakındayken çalışır.
4. Denizaltıya robotlu bin: robotlar görünmez olmalı, inince çıkmalı.
5. Araçların yeni boyu: dar yerlere sığıyor mu? Matkap 3x3 tünel kazıyor.
6. Radar: basılı tut, listeden köyü seç. Konum çubuğunda simge ve radar sesi gelmeli; ikinci basışta yalnız "İptal et" olmalı.
7. Hız sayacı: hayatta kalmada 3, yaratıcıda 5 seçenek olmalı.
8. Matkapla kaz, yanında madenci olsun: kazılanlar madenciye geçmeli.
9. Bir robota "Beni takip et" de, yürü: peşinden gelmeli. Tuş "Takibi bırak" olmalı.
10. Mimar: malzeme değiştir; yer seçerken panel kaybolup geri gelmeli.

## Bilinen eksikler
- Radar, hız sayacı, takip ve matkap deposu için sahte dünyada ayrı senaryo yok; yalnız paket ve API denetiminden geçti.
- Organizatör robot bir sonraki sürümde.
