# Aqualit Robotları v0.3.5 — Keşif onarımı

Sahte dünyada denendi; **oyunda denenmedi**.

## Düzeltmeler
- **Bütün araç halleri üst üste çiziliyordu.** Aktif olmayan haller artık animasyonla sıfır boyuta iniyor (oyunda parça gizleme uygulanmıyordu, animasyonlar ise çalışıyordu).
- **Araçlar sürülemiyordu.** Artık oyunun kendi sürüş sistemi kullanılıyor (`input_ground_controlled`).
  - Uçak ve denizaltının yukarı-aşağısını bakış yönüne göre betik veriyor.
  - Yön tuşuna basınca otopilot ya da yarım kalan görev bırakılıyor, kontrol sana geçiyor (önceden bitmeyen bir görev sürüşü kilitliyordu).
- **Hız sayacı** oyunun hız etkisiyle çalışıyor.
- **Otopilot ilerleyemezse** (oyunda itki işlemezse) adım adım ışınlanarak gidiyor, inen yolcuyu geri bindiriyor.
- **Mesajlarda koordinat:** bulunan yapı ve radar mesajlarında artık koordinat da yazıyor.

## Yenilikler
- **Mini Keşif dronları:** küp gövde, ekranda iki dikey göz; iki yanda yatay kare çember, içinde dönen pervane.
  - Keşif yerinde durur, dronlar geniş alanı tarar (yapı arama 384 blok, keşif istenen kadar).
  - Dron sayısı alanla büyür (en çok 100).
  - Uzak yerleri yükletme izni oyunda en çok 10; dronlar bu izni sırayla kullanır.
  - Keşif artık yüklenmemiş her yığının üstüne uçup git-gel yapmıyor.
- **Otopilot:**
  - **Yapı bul:** listeden yapı seç. Biliyorsa gider; bilmiyorsa dronlarla arar, yoksa uygun biyoma gidip yeniden arar.
  - **En son bulunan yapı** seçeneği.
- **Organizatör (önizleme):** robot, Aqualit Telefon, yazıyla görev, sandık düzenleme, Nerede?, getirme, üretim (fırın gerektirmeyenler).
  - Aqualit Fırın, üs platformu, kablo ve aktarım bloğu henüz yok.

## Oyunda denenecekler
1. Keşif'i koy: yalnız robot görünmeli. Kitle uçak seç: yalnız uçak görünmeli.
2. Uçağa bin, ileri bas: gitmeli; yukarı bak: yükselmeli. Gemi, arazi aracı ve matkapla da dene.
3. Otopilot → Yapı bul → Köy: dronlar çıkmalı; köy bulunursa koordinatıyla yazmalı ve oraya gitmeli.
4. Keşif menüsü → Çevreyi keşfet: Keşif dönmeden durmalı, dronlar tarayıp dönmeli.
