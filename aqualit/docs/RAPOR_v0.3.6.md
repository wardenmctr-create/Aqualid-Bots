# Aqualit Robotları v0.3.6 — Keşif düzeltmeleri + arazi aracı Tırmanma Modu

**Hepsi oyunda denenmedi.** Sahte test dünyasında bütün Keşif denemeleri geçiyor (kesif, kit, takip, kesifai, sefer, ui).

## Düzeltilenler (v0.3.5 sonrası oyunda bildirilen sorunlar)

| Sorun | Sebep | Düzeltme |
| --- | --- | --- |
| Dönüşünce her hal (robot dahil) küçük kalıyor, araca tersten biniliyor | Dönüşüm işareti (`mark_variant`) grubu kaldırılınca sıfırlanmıyordu; model katlanma animasyonunun son karesinde kalıyordu (0,22 boy, 540° = 180° dönük) | İşaret ayrı grupla açıkça 0'a çekilir; istemci geçişi yalnız işaret **ve** `aqualit:gecis` özelliği açıkken oynatır (biri sıfırlansa takılmaz) |
| Uçak birkaç bloktan yükseğe çıkamıyor, denizaltı dalamıyor | Betikle dikey itki, oyuncu binince oyunda işlemiyor | Uçak ve denizaltı oyunun uçan binek sistemiyle sürülür (`minecraft:input_air_controlled`, Mutlu Ghast gibi): baktığın yöne gider; yukarı bakıp ileri bas = yüksel, aşağı bak = alçal/dal |
| Denizaltı karada | — | Suyun dışında yerçekimi gelir, çok yavaş sürünür; suya girince yine uçan sisteme döner |
| Araçlar 1 blok çıkamıyor | — | `minecraft:variable_max_auto_step` (1 blok) |
| İnip çıkarken düz duruyorlar | — | Arazi aracı ve matkap yükseklik değişimine göre burnunu kaldırır/indirir (`aqualit:egim`); denizaltı ve uçak bakış açısına göre |
| Robot hali heykel gibi | — | Öteki robotlardaki gibi bekleme animasyonu (nefes, kollar, atkı), yürürken bacaklar, oyuncuya ve etrafa bakma (`look_at_player`, `look_at_target`) |

## Yeni: Tırmanma Modu (arazi aracı)

- Yalnız **arazi aracına binince** envantere gelir (inince, ya da araç başka şeye dönüşünce geri alınır).
- **Basılı tut:** tekerleklerin sırtında (üst, alt, ön, arka yüzde) düz (||||), yan yana üçer kabarık, mavi parlayan 3B çubuk çıkar (boyları lastik kalınlığından biraz kısa); eşya maviye döner. Bir daha basılı tut: kapanır.
- Tutucular açıkken **düz duvara doğru sür**: araç duvara yapışır, burnu dikilir (80°), yukarı tırmanır. Üste varınca yerçekimi geri gelir.
  Basmayı bırakınca duvarda tutunur, düşmez; **geri** basınca aşağı iner.
- Duvarın üstü 64 bloğa kadar aranır; yoksa tavana kadar tırmanır.
- Tırmanırken araç yerçekimsiz ve uçan binek sistemiyle sürülür. Betik ileri basınca yukarı iter; oyun binilen araçta bu itkiyi
  almazsa **yukarı bakarak ileri bas** (ekranda yazar). Bunu ilk denemede bildir.

## Oyunda denenecekler

1. Keşif'i koy: robot hali nefes alıyor, sana bakıyor mu?
2. Uçağa dönüştür: normal büyüklükte mi, öne doğru mu biniyorsun? Yukarı bakıp ileri basınca yükseliyor mu?
3. Suda denizaltı: aşağı bakınca dalıyor mu?
4. Arazi aracı: tek bloğa çıkıyor mu, inip çıkarken burnu eğiliyor mu?
5. Tırmanma Modu: eşya geldi mi, tutucular görünüyor mu, düz duvara tırmanıyor mu, üste çıkıyor mu?

Önizleme: `onizleme/73_arazi_tirman.gif`, simgeler `onizleme/72_tirmanma_modu.png`.
