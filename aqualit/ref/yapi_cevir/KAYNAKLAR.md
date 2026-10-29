# Yapı çevirici verileri (Java şeması → Bedrock 26.x)

| Dosya | Kaynak | Lisans |
| --- | --- | --- |
| `java_legacy.json` | PrismarineJS/minecraft-data `data/pc/common/legacy.json` (eski sayı:veri → Java 1.13 adı) | MIT |
| `java_bedrock_1.19.1.json` | PrismarineJS/minecraft-data `data/bedrock/1.19.1/blockMappings.json` (Java durumu → Bedrock 1.19.1 durumu) | MIT |
| `upgrade/*.json` | pmmp/BedrockBlockUpgradeSchema `nbt_upgrade_schema/` (Bedrock 1.19 → 1.26.60 durum yükseltmesi) | CC0 1.0 |

Kullanan kod: `addon/gen/yapi_cevir.py`. Sonuç her zaman `vanilladata_modules/mojang-blocks.json` ile denetlenir.
