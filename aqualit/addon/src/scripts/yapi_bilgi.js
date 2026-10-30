// Aqualit Robotları — Minecraft yapıları bilgi bankası (bütün robotlar kullanır)
// Her yapı için: nasıl tanınır (imza bloklar, biyom, yükseklik), ne değerli, ne tehlikeli, robotlar orada ne yapar.
//   blocks: biri yeter · all: hepsi aynı yığında · y: aranacak yükseklik · alti: yer altında · biomes: önce bu biyomlar
//   isler: iş robotlarının sırayla yaptığı işler (yagma.js'deki işler) · kilicli: Kılıçlıların kestiği moblar
//   kacin: dokunulmaması gereken mob/blok · not: sahibine söylenen bilgi
const I = (k) => k;   // simge anahtarı (ikon_data ile çözülür)
const OVER = ["minecraft:overworld"];
const NETHER = ["minecraft:nether"];
const END = ["minecraft:the_end"];

export const YAPI = {
  koy: { ad: "Köy", icon: I("bell"), blocks: ["minecraft:bell"], y: [40, 160], dims: OVER,
    biomes: ["plains", "sunflower_plains", "desert", "savanna", "taiga", "ice_plains", "meadow", "cold_taiga"],
    deger: "Demirci ve ev sandıkları, köylülerle ticaret, tarlalar, yatak",
    isler: ["yagma"], kilicli: ["zombie", "zombie_villager", "pillager", "vindicator"],
    kacin: ["villager", "iron_golem", "bed", "bell", "workstation"],
    not: "Köylülere ve demir golemlere dokunulmaz; yataklar ve iş blokları kırılmaz. Kılıçlılar köyü zombilerden korur." },
  col_tapinagi: { ad: "Çöl tapınağı", icon: I("blue_terracotta"), blocks: ["minecraft:blue_terracotta"], y: [40, 120], dims: OVER,
    biomes: ["desert", "desert_hills"], deger: "Gizli odadaki 4 sandık (elmas, altın, zümrüt, büyülü kitap), TNT, arkeoloji kumu",
    isler: ["tuzak_tnt", "arkeoloji", "yagma"], kilicli: ["husk"],
    not: "Gizli odanın altında basınç levhalı TNT tuzağı var: robotlar önce levhayı ve TNT'leri söker." },
  orman_tapinagi: { ad: "Orman tapınağı", icon: I("sticky_piston"), blocks: ["minecraft:sticky_piston"],
    all: ["minecraft:sticky_piston", "minecraft:mossy_cobblestone"], y: [50, 140], dims: OVER,
    biomes: ["jungle", "jungle_hills", "bamboo_jungle", "jungle_mutated"], deger: "2 sandık, ok atan dağıtıcılar (ok), kızıltaş",
    isler: ["tuzak_ip", "yagma"], kilicli: [], not: "Tel tuzakları ve ok atan dağıtıcılar var: robotlar önce teli keser." },
  cadi_kulubesi: { ad: "Cadı kulübesi", icon: I("cauldron"), blocks: ["minecraft:cauldron"], y: [55, 100], dims: OVER,
    biomes: ["swampland", "swampland_mutated"], deger: "Kazan, saksı, cadının düşürdükleri (kızıltaş, glowstone, şişe)",
    isler: ["yagma"], kilicli: ["witch"], not: "Cadı iksir atar; Kılıçlılar önce cadıyı keser." },
  iglo: { ad: "İglo", icon: I("snowball"), blocks: ["minecraft:white_carpet"], all: ["minecraft:white_carpet", "minecraft:snow"],
    y: [55, 140], dims: OVER, biomes: ["ice_plains", "cold_taiga", "ice_plains_spikes"],
    deger: "Bazen bodrum: sandık (altın elma), simya standı", isler: ["yagma"], kilicli: [],
    not: "Bodrum halının altındaki kapaktadır; robotlar sandığı bulursa boşaltır." },
  karakol: { ad: "Yağmacı karakolu", icon: I("crossbow"), blocks: ["minecraft:dark_oak_log"],
    all: ["minecraft:dark_oak_log", "minecraft:birch_planks"], y: [55, 160], dims: OVER,
    biomes: ["plains", "desert", "savanna", "taiga", "ice_plains", "grove", "meadow", "cherry_grove", "snowy_slopes"],
    deger: "Tepedeki sandık (arbalet, ok, şişe), kafesteki allaylar", isler: ["yagma"], kilicli: ["pillager", "vindicator", "ravager"],
    not: "Yağmacılar uzaktan ok atar; Kılıçlılar önce onları temizler." },
  orman_kosku: { ad: "Orman köşkü", icon: I("dark_oak_planks"), blocks: ["minecraft:dark_oak_planks"],
    all: ["minecraft:dark_oak_planks", "minecraft:birch_planks", "minecraft:cobblestone"], y: [55, 120], dims: OVER,
    biomes: ["roofed_forest", "roofed_forest_mutated"], deger: "Sandıklar, ölümsüzlük totemi (çağırıcıdan), gizli odalar",
    isler: ["yagma"], kilicli: ["evocation_illager", "vindicator", "vex"], not: "Çağırıcılar vex çağırır; Kılıçlılar toplu savaşır." },
  okyanus_aniti: { ad: "Okyanus anıtı", icon: I("prismarine_shard"), blocks: ["minecraft:sea_lantern"],
    all: ["minecraft:sea_lantern", "minecraft:dark_prismarine"], y: [30, 64], dims: OVER,
    biomes: ["deep_ocean", "deep_cold_ocean", "deep_lukewarm_ocean", "deep_frozen_ocean"],
    deger: "8 altın blok (merkez), ıslak süngerler, prizmarin, deniz feneri", isler: ["altin", "sunger", "yagma"],
    kilicli: ["guardian", "elder_guardian"], not: "Su altında: robotlar su altında nefes alır. Yaşlı muhafız yorgunluk verir." },
  deneme_odasi: { ad: "Deneme odası (Trial Chambers)", icon: I("trial_key"), blocks: ["minecraft:trial_spawner", "minecraft:vault"],
    y: [-40, 0], dims: OVER, alti: true, deger: "Kasalar (anahtarla), sandıklar, çömlekler, ağır çekirdek, rüzgâr yükü",
    isler: ["yagma"], kilicli: ["breeze", "zombie", "skeleton", "stray", "husk", "spider", "cave_spider", "slime", "bogged"],
    not: "Çıkarıcılar yalnız sen yakındayken mob çıkarır ve anahtar düşürür; anahtarla kasalar açılır." },
  maden_ocagi: { ad: "Terk edilmiş maden ocağı", icon: I("rail"), blocks: ["minecraft:web"], all: ["minecraft:web", "minecraft:rail"],
    y: [-60, 50], dims: OVER, alti: true, deger: "Sandıklı vagonlar, raylar, ağlar (ip)", isler: ["vagon", "yagma"],
    kilicli: ["cave_spider"], not: "Mağara örümceği çıkarıcısı zehirler; Kılıçlılar örümcekleri keser." },
  zindan: { ad: "Zindan", icon: I("mossy_cobblestone"), blocks: ["minecraft:mob_spawner"],
    all: ["minecraft:mob_spawner", "minecraft:mossy_cobblestone"], y: [-60, 60], dims: OVER, alti: true,
    deger: "1-2 sandık (eyer, ad etiketi, müzik plağı)", isler: ["yagma"], kilicli: ["zombie", "skeleton", "spider"],
    not: "Çıkarıcı yalnız sen yakındayken mob çıkarır." },
  kale_yeralti: { ad: "Kale (Stronghold)", icon: I("ender_eye"), blocks: ["minecraft:end_portal_frame"], y: [-60, 60], dims: OVER,
    alti: true, deger: "Kütüphane sandıkları (büyülü kitap), End portalı", isler: ["yagma"], kilicli: ["silverfish"],
    kacin: ["end_portal_frame"], not: "End portalı çerçevelerine dokunulmaz." },
  antik_sehir: { ad: "Antik şehir", icon: I("echo_shard"), blocks: ["minecraft:reinforced_deepslate", "minecraft:sculk_shrieker"],
    y: [-58, -20], dims: OVER, alti: true, biomes: ["deep_dark"], deger: "Sandıklar (yankı parçası, kurtarma pusulası, büyülü kitap)",
    isler: ["yagma"], kilicli: [], kacin: ["warden", "sculk_shrieker", "sculk_sensor"],
    not: "Warden'a kimse saldırmaz; çığlıkçılara dokunulmaz. Kılıçlılar yalnız savunur." },
  yikik_portal: { ad: "Yıkık Nether portalı", icon: I("flint_and_steel"), blocks: ["minecraft:crying_obsidian"], y: [-50, 160],
    dims: [...OVER, ...NETHER], deger: "Sandık (altın eşyalar), altın blok, ağlayan obsidyen", isler: ["altin", "yagma"], kilicli: [] },
  gemi_enkazi: { ad: "Batık / gemi enkazı", icon: I("filled_map"), blocks: ["minecraft:chest"], all: ["minecraft:chest", "minecraft:water"],
    y: [20, 64], dims: OVER, biomes: ["ocean", "deep_ocean", "warm_ocean", "lukewarm_ocean", "cold_ocean", "beach"],
    deger: "Hazine haritası, zümrüt, demir", isler: ["yagma"], kilicli: ["drowned"] },
  okyanus_harabesi: { ad: "Okyanus harabesi", icon: I("prismarine_shard"), blocks: ["minecraft:suspicious_sand", "minecraft:suspicious_gravel"],
    all: ["minecraft:stone_bricks"], y: [20, 64], dims: OVER, biomes: ["ocean", "warm_ocean", "lukewarm_ocean", "cold_ocean"],
    deger: "Sandık, arkeoloji (çömlek parçası, zümrüt)", isler: ["arkeoloji", "yagma"], kilicli: ["drowned"] },
  iz_harabesi: { ad: "İz harabesi (Trail Ruins)", icon: I("brush"), blocks: ["minecraft:suspicious_gravel"],
    all: ["minecraft:suspicious_gravel", "minecraft:terracotta"], y: [30, 80], dims: OVER,
    biomes: ["taiga", "mega_taiga", "birch_forest", "jungle"], deger: "Arkeoloji: çömlek parçaları, zırh süsleri", isler: ["arkeoloji"], kilicli: [] },
  col_kuyusu: { ad: "Çöl kuyusu", icon: I("sandstone"), blocks: ["minecraft:suspicious_sand"], all: ["minecraft:suspicious_sand", "minecraft:sandstone_slab"],
    y: [55, 110], dims: OVER, biomes: ["desert"], deger: "Arkeoloji (çömlek parçası)", isler: ["arkeoloji"], kilicli: [] },
  fosil: { ad: "Fosil", icon: I("bone_block"), blocks: ["minecraft:bone_block"], y: [-60, 50], dims: [...OVER, ...NETHER], alti: true,
    deger: "Kemik blokları (kemik tozu)", isler: ["kemik"], kilicli: [] },
  geod: { ad: "Ametist geodu", icon: I("amethyst_shard"), blocks: ["minecraft:budding_amethyst"], y: [-60, 30], dims: OVER, alti: true,
    deger: "Ametist kümeleri (ametist parçası)", isler: ["ametist"], kilicli: [], kacin: ["budding_amethyst"],
    not: "Tomurcuklu ametist kırılmaz (yeniden büyüsün)." },
  nether_kalesi: { ad: "Nether kalesi", icon: I("blaze_rod"), blocks: ["minecraft:nether_brick_fence"], y: [30, 110], dims: NETHER,
    deger: "Nether siğili, sandıklar (elmas, at zırhı), blaze çubuğu, wither iskeleti kafası", isler: ["sigil", "yagma"],
    kilicli: ["blaze", "wither_skeleton", "magma_cube"], not: "Blazeler ateş atar; Kılıçlılar ateşe dayanıklı." },
  burc_kalintisi: { ad: "Burç kalıntısı (Bastion)", icon: I("gold_ingot"), blocks: ["minecraft:gilded_blackstone"], y: [30, 110],
    dims: NETHER, deger: "Altın bloklar, sandıklar (antik kalıntı, netherit parçası, büyülü eşya)", isler: ["altin", "yagma"],
    kilicli: ["piglin_brute", "hoglin", "piglin", "magma_cube"], not: "Sandık açılınca piglinler kızar; Kılıçlılar korur." },
  end_sehri: { ad: "End şehri", icon: I("elytra"), blocks: ["minecraft:purpur_block", "minecraft:end_rod"], y: [40, 160], dims: END,
    deger: "Sandıklar (elmas eşya), shulker kabukları, gemideki elytra", isler: ["yagma"], kilicli: ["shulker", "enderman"],
    not: "Shulkerlar havaya kaldırır; robotlar düşme hasarı almaz." },
};

/** Bir yapının iş robotu için iş listesi. */
export function islerOf(tur) {
  return YAPI[tur]?.isler ?? ["yagma"];
}

/** Robot bu yapıda bu bloğu kırmamalı mı? */
export function dokunma(tur, typeId) {
  const k = YAPI[tur]?.kacin ?? [];
  const t = typeId.replace("minecraft:", "");
  if (k.includes("bed") && t.endsWith("bed")) return true;
  if (k.includes("workstation") && /smithing|fletching|cartography|loom|lectern|composter|barrel|blast_furnace|smoker|grindstone|stonecutter|brewing|cauldron/.test(t)) return true;
  return k.includes(t);
}
