# Aqualit Robotları v0.2.9: yeni Aqualit sandığı

Hedef: Minecraft Bedrock 26.50+ (`@minecraft/server` 2.10.0, `@minecraft/server-ui` 2.2.0). **Oyunda test edilmedi.**

## Ne değişti

- Aqualit sandığı artık oyunun gerçek sandığı (tuzaklı sandık bloğu, dokusu Aqualit sandığı): dokun aç, basılı tut kır,
  eğil + basılı tut panel. Aynı türden iki tanesi yan yana çift sandık olur.
- Sayfalar (▶◀), kilitli yuvalar, kapasite: tek 27 / çift 54, her normal sandık +27, en çok tek 200 / çift 500.
- Sahibine özel; patlama kırmaz; yan yana koyma kuralları.
- Yeni tür sandıkları: Kılıçlı, İnşaatçı, Toplayıcı (Aqualit Sandık + tahta kılıç / tuğla bloğu / fıçı).
- Depo: amblem plakası varlığı (128 yuva) + gerekirse görünmez ek depo (128 yuva). Sahipsiz depo varlığının eşyaları
  sandığa ya da yere aktarılır; eşya kaybolmaz.
- Eski varlık sandıkları yüklenince yerinde gerçek sandığa dönüşür (eşya, ad, erişim, robot bağlantısı korunur).
- Robotların evi sandığın önündeki boş hücre.
- Aqualit sandığına doğal sandık ganimeti (kabuk kitabı) konmaz.
- Konum iğnesi yükseklik farkında da (ağaç tepesi) varınca kalkar.

## Test

| Denetim | Sonuç |
| --- | --- |
| `test/validate.py` | 0 hata |
| `test/apicheck.py` | 34 dosya, 0 sorun |
| `sim.mjs` bütün senaryolar | 20 senaryo, 307 denetim geçti (sandık 91) |

Oyunda doğrulanacaklar: PLAN.md → "v0.2.9 Aqualit sandığı".
