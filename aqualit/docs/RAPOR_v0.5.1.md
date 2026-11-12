# Aqualit Robotları v0.5.1

**Oyunda denenmedi.** Sahte test dünyasında senaryolar geçti. Paket adları "Aqualit Robotları (Davranış/Kaynak) 5.1".

## Keşif
- **Uçak canlı:** burun uçtuğu yöne bakar (yükselirken kalkar, alçalırken eğilir), sağa sola dönerken hafifçe yana yatar.

## Takip ekranı
- **Canlı kontrol:** robotu izlerken zıpla tuşu → kontrolü al: yön tuşlarıyla robotu yürüt, zıpla = kaz/çık, eğil = bırak.
- İzlerken gece görüşü.

## İş robotları
- **Onay sistemi:** robot bir şey sorunca telsizde Onayla / Reddet / Değiştir (sayı çubuğu). 5 dakika cevap yoksa
  varsayılan karar uygulanır.
- **"Acil işin yoksa geri dön":** acil işi (taşıma, koruma) olan robot önce onu bitirir, sonra döner; işi yoksa hemen döner.
- **Organizatör:** üssünü kendiliğinden kurmak için 1 dakika boş kalmasını bekler (işlerini aksatmaz).

## Mimar
- **27 yeni farm (toplam 51):** otomatik şeker kamışı, çiçek, çimen/tohum, yosun bloğu, lav (damlataş), sivri damlataş,
  sonsuz su, düz taş üretici, havuç/patates/pancar tarlaları, bal (arı kovanı), parlak meyve, kıvrık sarmaşık,
  kaplumbağa, buz, kar golemi, balık tutma, huş/dev ladin/dev orman/kara meşe/kiraz/akasya/mangrov ağaç farmları,
  domuz ağılı, süper fırın (8 fırın). Önizleme: `onizleme/farmlar_v051.png`.

## Zırhlar
- **Kabuk kitabı ganimeti** artık yalnız çöl piramidi ve Trial Chambers sandıklarında (ilk açılışta %25) ve maden
  ocağındaki sandıklı vagonlarda. Yapı, sandığın çevresindeki bloklardan tanınır.

## Oyunda denenecekler
1. Uçakla uç: burun yukarı/aşağı eğiliyor mu, dönerken yatıyor mu?
2. Takip ekranında robotu izlerken zıpla: robot yön tuşlarıyla yürüyor mu? Eğilince bırakıyor mu?
3. Robot soru sorunca telsizde Onayla/Reddet/Değiştir çıkıyor mu?
4. Mimar → Farmlar: yeni farmlar kuruluyor mu, çalışıyorlar mı (lav damlıyor mu, şeker kamışı kesiliyor mu)?
5. Çöl piramidi sandığı ve maden vagonu: bazen kabuk kitabı çıkıyor mu? Köy sandığında çıkmamalı.
