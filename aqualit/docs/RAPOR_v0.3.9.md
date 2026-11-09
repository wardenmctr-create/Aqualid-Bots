# Aqualit Robotları v0.3.9 — Matkap: baktığın yöne kazma ve cevher dürbünü

**Oyunda denenmedi.** Sahte test dünyasında denemeler geçiyor. Paket adları: "Aqualit Robotları (Davranış/Kaynak) 3.9".
v0.3.8'deki her şey (harita, Nether/End temaları, düzeltmeler) bu sürümde de var.

## Matkap
- **Baktığın yöne kazar** (yeni varsayılan kazma yönü): yukarı, aşağı, çapraz dahil bakış yönünde 3x3 tünel açar.
  Matkap uçmaz: yerçekimi hep var; yukarı kazarken açtığı basamaklara kendiliğinden çıkar, aşağı kazarken çukura iner.
  Eski yönler (düz ileri, aşağı, çapraz aşağı) araç menüsünde duruyor.
- **Cevher dürbünü:** matkaba binince ekranın altında canlı mini harita: matkabın önü ve yanları (11x8 kare), 4 blok
  altından 4 blok üstüne kadar. Her cevher kendi renkli karesiyle (antik enkaz, elmas, zümrüt, altın, lapis, kızıltaş,
  demir, bakır, kuvars, kömür), taş koyu. Altında en değerli cevher, uzaklığı ve kaç blok aşağıda/yukarıda olduğu yazar.
- **Gerçek yarı x-ray olmadı:** oyun taş gibi blokların görünüşünü oyuncuya göre değiştirmeye izin vermiyor (kaynak
  paketiyle saydam yapılsa her yerde ve herkes için olurdu, oyun da taşı saydam çizmiyor). Dürbün bunun yerine.

## Oyunda denenecekler
1. Matkapla yukarı, aşağı ve çapraz bakarak sür: o yöne kazıyor mu, uçmuyor mu, kazdığı basamaklara çıkıyor mu?
2. Dürbün ekranın altında görünüyor mu, cevherler doğru yerde mi? Kareler okunuyor mu? (Radar açıkken ikisi aynı yeri
   kullanır; sırayla görünebilir.)
