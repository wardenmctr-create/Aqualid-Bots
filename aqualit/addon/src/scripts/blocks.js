// Aqualit Robotları — blok sınıflandırma ve oyun verileri
import { safe, rand } from "./util.js";

const M = (s) => "minecraft:" + s;
const set = (arr) => new Set(arr.map((s) => (s.includes(":") ? s : M(s))));

export const AIR = set(["air", "void_air", "structure_void"]);
export const WATER = set(["water", "flowing_water", "bubble_column"]);
export const LAVA = set(["lava", "flowing_lava"]);

const PASS = set([
  "short_grass", "tall_grass", "fern", "large_fern", "deadbush", "short_dry_grass", "tall_dry_grass", "bush",
  "firefly_bush", "seagrass", "kelp", "kelp_plant", "waterlily", "vine", "glow_lichen", "sculk_vein", "hanging_roots",
  "cave_vines", "cave_vines_body_with_berries", "cave_vines_head_with_berries", "twisting_vines", "weeping_vines",
  "spore_blossom", "torch", "redstone_wire", "rail", "lever", "tripwire_hook", "trip_wire", "snow_layer",
  "dandelion", "golden_dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip", "orange_tulip",
  "white_tulip", "pink_tulip", "oxeye_daisy", "cornflower", "lily_of_the_valley", "sunflower", "lilac", "rose_bush",
  "peony", "torchflower", "pitcher_plant", "pink_petals", "wildflowers", "leaf_litter", "open_eyeblossom",
  "closed_eyeblossom", "brown_mushroom", "red_mushroom", "crimson_fungus", "warped_fungus", "crimson_roots",
  "warped_roots", "nether_sprouts", "wheat", "carrots", "potatoes", "beetroot", "torchflower_crop", "pitcher_crop",
  "melon_stem", "pumpkin_stem", "nether_wart", "sweet_berry_bush", "small_dripleaf_block", "cactus_flower",
  "standing_banner", "wall_banner", "standing_sign", "wall_sign", "darkoak_standing_sign", "darkoak_wall_sign",
  "unlit_redstone_torch", "redstone_torch", "soul_torch", "copper_torch", "underwater_torch",
  "colored_torch_blue", "colored_torch_green", "colored_torch_purple", "colored_torch_red",
]);
const PASS_SUFFIX = ["_sapling", "_button", "_pressure_plate", "_sign", "_carpet", "_rail", "_coral", "_coral_fan",
  "_coral_wall_fan", "_propagule", "light_block_"];
const CLIMB = set(["ladder", "scaffolding", "vine", "twisting_vines", "weeping_vines", "cave_vines",
  "cave_vines_body_with_berries", "cave_vines_head_with_berries"]);
const DANGER = set(["lava", "flowing_lava", "fire", "soul_fire", "magma", "cactus", "sweet_berry_bush", "wither_rose",
  "powder_snow", "campfire", "soul_campfire", "web"]);

export function isAir(t) {
  return AIR.has(t);
}
export function isWater(t) {
  return WATER.has(t);
}
export function isLava(t) {
  return LAVA.has(t);
}
export function isDanger(t) {
  return DANGER.has(t);
}
export function isClimb(t) {
  return CLIMB.has(t);
}
export function isDoor(t) {
  return t.endsWith("_door") && t !== M("iron_door") && !t.includes("trapdoor");
}
export function isTall(t) {
  return (t.endsWith("_fence") || t.endsWith("_wall") || t.endsWith("fence_gate") || t === M("cobblestone_wall"))
    && !t.endsWith("_sign");
}

/** Robotun ayaklarının girebileceği hücre mi? (hava, ot, çiçek, su, merdiven, kapı) */
export function isPassableType(t) {
  if (AIR.has(t) || PASS.has(t) || WATER.has(t) || CLIMB.has(t)) return true;
  if (isDoor(t)) return true;
  for (const s of PASS_SUFFIX) if (t.endsWith(s) || t.includes(s)) return true;
  return false;
}

/** Üstünde durulabilir mi? */
export function isSupportType(t) {
  if (isPassableType(t) || LAVA.has(t)) return false;
  if (isTall(t)) return false;
  if (t === M("fire") || t === M("soul_fire") || t === M("powder_snow")) return false;
  return true;
}

/** Yarım yükseklik (alt basamak/yarım blok): robot 0.5 aşağıda durur. */
export function lowOffset(block) {
  if (!block) return 0;
  const t = block.typeId;
  if (t.endsWith("_stairs")) return 0.5;
  if (t.endsWith("_slab") && !t.endsWith("double_slab")) {
    const half = safe(() => block.permutation.getState("minecraft:vertical_half"));
    const top = safe(() => block.permutation.getState("top_slot_bit"));
    if (half === "top" || top === true) return 0;
    return 0.5;
  }
  return 0;
}

// ---------------------------------------------------------------- doğal bloklar (madenci kazabilir)
const NATURAL = set([
  "stone", "cobblestone", "mossy_cobblestone", "granite", "diorite", "andesite", "deepslate", "cobbled_deepslate",
  "tuff", "calcite", "dripstone_block", "smooth_basalt", "dirt", "coarse_dirt", "grass_block", "dirt_with_roots",
  "podzol", "mycelium", "moss_block", "gravel", "sand", "red_sand", "clay", "sandstone", "red_sandstone", "mud",
  "netherrack", "basalt", "blackstone", "end_stone", "soul_sand", "soul_soil", "magma", "obsidian", "snow",
  "hardened_clay", "amethyst_block", "pointed_dripstone", "infested_stone", "infested_deepslate", "crimson_nylium",
  "warped_nylium", "glowstone", "packed_ice", "ice", "sculk", "cinnabar", "sulfur",
]);
export function isNatural(t) {
  if (NATURAL.has(t)) return true;
  if (t.endsWith("_terracotta") && !t.includes("glazed")) return true;
  if (t.endsWith("_ore") || t === M("ancient_debris") || t.startsWith("aqualit:") && t.endsWith("_ore")) return true;
  return false;
}

/** Kazma süresi (tik). */
export function mineTicks(t) {
  if (t === M("obsidian") || t === M("crying_obsidian")) return 60;
  if (t === M("ancient_debris")) return 40;
  if (t.endsWith("_ore") || t.startsWith("aqualit:")) return 14;
  if (t.includes("deepslate")) return 12;
  if (t.includes("stone") || t === M("granite") || t === M("diorite") || t === M("andesite") || t === M("tuff")
    || t === M("basalt") || t === M("calcite") || t.includes("terracotta") || t === M("hardened_clay")) return 9;
  if (t.endsWith("_log") || t.endsWith("_stem") || t.includes("planks")) return 10;
  if (t.includes("leaves") || t.includes("wart_block")) return 3;
  if (t === M("netherrack")) return 4;
  return 6;
}

export function digSound(t) {
  if (t.endsWith("_log") || t.endsWith("_stem") || t.includes("planks") || t.includes("wood")) return "dig.wood";
  if (t.includes("gravel")) return "dig.gravel";
  if (t.includes("sand") && !t.includes("sandstone")) return "dig.sand";
  if (t.includes("dirt") || t.includes("grass") || t === M("podzol") || t === M("mycelium") || t === M("clay")
    || t === M("farmland") || t.includes("mud") || t.includes("moss")) return "dig.grass";
  if (t.includes("leaves") || t === M("reeds") || t === M("bamboo") || t.includes("melon") || t.includes("pumpkin")
    || t === M("wheat") || t === M("carrots") || t === M("potatoes") || t === M("beetroot")) return "dig.grass";
  if (t.includes("snow")) return "dig.snow";
  return "dig.stone";
}

// ---------------------------------------------------------------- madenler
export const ORES = [
  { key: "komur", name: "Kömür", icon: "textures/items/coal", blocks: ["coal_ore", "deepslate_coal_ore"],
    drop: ["minecraft:coal", 1, 1], y: 40, value: 1 },
  { key: "demir", name: "Demir", icon: "textures/items/raw_iron", blocks: ["iron_ore", "deepslate_iron_ore"],
    drop: ["minecraft:raw_iron", 1, 1], smelt: "minecraft:iron_ingot", y: 16, value: 2 },
  { key: "bakir", name: "Bakır", icon: "textures/items/raw_copper", blocks: ["copper_ore", "deepslate_copper_ore"],
    drop: ["minecraft:raw_copper", 2, 5], smelt: "minecraft:copper_ingot", y: 48, value: 1 },
  { key: "altin", name: "Altın", icon: "textures/items/raw_gold", blocks: ["gold_ore", "deepslate_gold_ore"],
    drop: ["minecraft:raw_gold", 1, 1], smelt: "minecraft:gold_ingot", y: -16, value: 3 },
  { key: "kiziltas", name: "Kızıltaş", icon: "textures/items/redstone_dust",
    blocks: ["redstone_ore", "deepslate_redstone_ore", "lit_redstone_ore", "lit_deepslate_redstone_ore"],
    drop: ["minecraft:redstone", 4, 5], y: -58, value: 2 },
  { key: "lapis", name: "Lapis Lazuli", icon: "textures/items/dye_powder_blue", blocks: ["lapis_ore", "deepslate_lapis_ore"],
    drop: ["minecraft:lapis_lazuli", 4, 9], y: 0, value: 2 },
  { key: "elmas", name: "Elmas", icon: "textures/items/diamond", blocks: ["diamond_ore", "deepslate_diamond_ore"],
    drop: ["minecraft:diamond", 1, 1], y: -58, value: 5 },
  { key: "zumrut", name: "Zümrüt", icon: "textures/items/emerald", blocks: ["emerald_ore", "deepslate_emerald_ore"],
    drop: ["minecraft:emerald", 1, 1], y: 64, value: 5 },
  { key: "aqualit", name: "Aqualit", icon: "textures/items/raw_aqualit",
    blocks: ["aqualit:aqualit_ore", "aqualit:deepslate_aqualit_ore"],
    drop: ["aqualit:raw_aqualit", 1, 1], smelt: "aqualit:aqualit_ingot", y: -20, value: 4 },
  { key: "kuvars", name: "Nether Kuvarsı", icon: "textures/items/quartz", blocks: ["quartz_ore"],
    drop: ["minecraft:quartz", 1, 1], y: 60, nether: true, value: 1 },
  { key: "nether_altin", name: "Nether Altını", icon: "textures/items/gold_nugget", blocks: ["nether_gold_ore"],
    drop: ["minecraft:gold_nugget", 2, 6], y: 60, nether: true, value: 1 },
  { key: "antik", name: "Antik Kalıntı", icon: "textures/blocks/ancient_debris_side", blocks: ["ancient_debris"],
    drop: ["minecraft:ancient_debris", 1, 1], smelt: "minecraft:netherite_scrap", y: 15, nether: true, value: 6 },
  { key: "ametist", name: "Ametist", icon: "textures/items/amethyst_shard", blocks: ["amethyst_cluster"],
    drop: ["minecraft:amethyst_shard", 4, 4], y: -20, value: 2 },
];
for (const o of ORES) o.blocks = o.blocks.map((b) => (b.includes(":") ? b : M(b)));
export const ORE_BY_KEY = Object.fromEntries(ORES.map((o) => [o.key, o]));
export const ORE_OF_BLOCK = new Map();
for (const o of ORES) for (const b of o.blocks) ORE_OF_BLOCK.set(b, o);
export const VALUABLE = new Set(["elmas", "zumrut", "altin", "aqualit", "antik", "lapis", "kiziltas", "demir"]);

/** Herhangi bir bloğun robotça kazıldığında bıraktığı eşyalar: [[id, adet], ...] */
export function dropsFor(t, perm) {
  const ore = ORE_OF_BLOCK.get(t);
  if (ore) return [[ore.drop[0], rand(ore.drop[1], ore.drop[2])]];
  switch (t) {
    case M("stone"): return [[M("cobblestone"), 1]];
    case M("deepslate"): return [[M("cobbled_deepslate"), 1]];
    case M("grass_block"): case M("podzol"): case M("mycelium"): case M("dirt_with_roots"): case M("grass_path"):
    case M("farmland"):
      return [[M("dirt"), 1]];
    case M("clay"): return [[M("clay_ball"), 4]];
    case M("snow"): return [[M("snowball"), 4]];
    case M("snow_layer"): return [[M("snowball"), 1]];
    case M("glowstone"): return [[M("glowstone_dust"), rand(2, 4)]];
    case M("gravel"): return Math.random() < 0.1 ? [[M("flint"), 1]] : [[M("gravel"), 1]];
    case M("ice"): case M("budding_amethyst"): case M("infested_stone"): case M("infested_deepslate"):
    case M("pointed_dripstone"):
      return t === M("pointed_dripstone") ? [[M("pointed_dripstone"), 1]] : [];
    case M("short_grass"): case M("tall_grass"): case M("fern"): case M("large_fern"):
      return Math.random() < 0.125 ? [[M("wheat_seeds"), 1]] : [];
    default:
      break;
  }
  if (t.endsWith("_leaves") || t.includes("wart_block")) return leafDrops(t);
  if (isPassableType(t) && !t.endsWith("_sapling")) return [];
  const item = safe(() => perm.getItemStack(1));
  return item ? [[item.typeId, 1]] : [[t, 1]];
}

// ---------------------------------------------------------------- kürekçi
export const SHOVEL = [
  { key: "kum", name: "Kum", icon: "textures/blocks/sand", blocks: ["sand"], smelt: "minecraft:glass", smeltName: "Cam" },
  { key: "kirmizi_kum", name: "Kırmızı Kum", icon: "textures/blocks/red_sand", blocks: ["red_sand"],
    smelt: "minecraft:glass", smeltName: "Cam" },
  { key: "cakil", name: "Çakıl", icon: "textures/blocks/gravel", blocks: ["gravel"] },
  { key: "toprak", name: "Toprak", icon: "textures/blocks/dirt",
    blocks: ["dirt", "coarse_dirt", "grass_block", "podzol", "mycelium", "dirt_with_roots"] },
  { key: "kil", name: "Kil", icon: "textures/items/clay_ball", blocks: ["clay"], smelt: "minecraft:brick",
    smeltName: "Tuğla" },
  { key: "camur", name: "Çamur", icon: "textures/blocks/mud", blocks: ["mud"] },
  { key: "ruh_kumu", name: "Ruh Kumu", icon: "textures/blocks/soul_sand", blocks: ["soul_sand", "soul_soil"] },
  { key: "kar", name: "Kar", icon: "textures/items/snowball", blocks: ["snow", "snow_layer"] },
];
for (const s of SHOVEL) s.blocks = s.blocks.map(M);
export const SHOVEL_BY_KEY = Object.fromEntries(SHOVEL.map((s) => [s.key, s]));
export const SHOVEL_OF_BLOCK = new Map();
for (const s of SHOVEL) for (const b of s.blocks) SHOVEL_OF_BLOCK.set(b, s);

// ---------------------------------------------------------------- oduncu
const WOODS = [
  ["mese", "Meşe", "oak", "textures/blocks/log_oak"],
  ["ladin", "Ladin", "spruce", "textures/blocks/log_spruce"],
  ["hus", "Huş", "birch", "textures/blocks/log_birch"],
  ["orman", "Orman", "jungle", "textures/blocks/log_jungle"],
  ["akasya", "Akasya", "acacia", "textures/blocks/log_acacia"],
  ["koyu_mese", "Koyu Meşe", "dark_oak", "textures/blocks/log_big_oak"],
  ["mangrov", "Mangrov", "mangrove", "textures/blocks/mangrove_log_side"],
  ["kiraz", "Kiraz", "cherry", "textures/blocks/cherry_log_side"],
  ["solgun_mese", "Solgun Meşe", "pale_oak", "textures/blocks/pale_oak_log_side"],
  ["kavak", "Kavak", "poplar", "textures/blocks/poplar_log_side"],
];
export const LOGS = WOODS.map(([key, name, id, icon]) => ({
  key, name, icon,
  log: M(`${id}_log`),
  sapling: id === "mangrove" ? M("mangrove_propagule") : M(`${id}_sapling`),
  leaves: id === "poplar" ? [M("orange_poplar_leaves"), M("red_poplar_leaves"), M("yellow_poplar_leaves")]
    : [M(`${id}_leaves`)].concat(id === "oak" ? [M("azalea_leaves"), M("azalea_leaves_flowered")] : []),
}));
LOGS.push({ key: "kizil", name: "Kızıl Gövde", icon: "textures/blocks/huge_fungus/crimson_log_side", log: M("crimson_stem"),
  sapling: M("crimson_fungus"), leaves: [M("nether_wart_block"), M("shroomlight")], nether: true });
LOGS.push({ key: "carpik", name: "Çarpık Gövde", icon: "textures/blocks/huge_fungus/warped_stem_side", log: M("warped_stem"),
  sapling: M("warped_fungus"), leaves: [M("warped_wart_block"), M("shroomlight")], nether: true });
export const LOG_BY_KEY = Object.fromEntries(LOGS.map((l) => [l.key, l]));
export const LOG_OF_BLOCK = new Map(LOGS.map((l) => [l.log, l]));
export const LEAF_OF_BLOCK = new Map();
for (const l of LOGS) for (const b of l.leaves) LEAF_OF_BLOCK.set(b, l);

export function leafDrops(t) {
  const l = LEAF_OF_BLOCK.get(t);
  const out = [];
  if (!l) return out;
  if (Math.random() < 0.06) out.push([l.sapling, 1]);
  if (Math.random() < 0.02) out.push([M("stick"), rand(1, 2)]);
  if ((t === M("oak_leaves") || t === M("dark_oak_leaves")) && Math.random() < 0.005) out.push([M("apple"), 1]);
  return out;
}

export const SOIL_FOR_SAPLING = set(["dirt", "grass_block", "podzol", "coarse_dirt", "mycelium", "dirt_with_roots",
  "moss_block", "mud", "farmland", "muddy_mangrove_roots", "crimson_nylium", "warped_nylium"]);

// ---------------------------------------------------------------- çiftçi
export const CROPS = [
  { key: "bugday", name: "Buğday", icon: "textures/items/wheat", block: M("wheat"), state: "growth", max: 7,
    drops: [[M("wheat"), 1, 1], [M("wheat_seeds"), 0, 3]], seed: M("wheat_seeds"), soil: M("farmland"), plant: true },
  { key: "havuc", name: "Havuç", icon: "textures/items/carrot", block: M("carrots"), state: "growth", max: 7,
    drops: [[M("carrot"), 2, 5]], seed: M("carrot"), soil: M("farmland"), plant: true },
  { key: "patates", name: "Patates", icon: "textures/items/potato", block: M("potatoes"), state: "growth", max: 7,
    drops: [[M("potato"), 2, 5]], seed: M("potato"), soil: M("farmland"), plant: true },
  { key: "pancar", name: "Pancar", icon: "textures/items/beetroot", block: M("beetroot"), state: "growth", max: 7,
    drops: [[M("beetroot"), 1, 1], [M("beetroot_seeds"), 1, 3]], seed: M("beetroot_seeds"), soil: M("farmland"),
    plant: true },
  { key: "nether_sigili", name: "Nether Siğili", icon: "textures/items/nether_wart", block: M("nether_wart"),
    state: "age", max: 3, drops: [[M("nether_wart"), 2, 4]], seed: M("nether_wart"), soil: M("soul_sand") },
  { key: "seker_kamisi", name: "Şeker Kamışı", icon: "textures/items/reeds", block: M("reeds"), kind: "column",
    drops: [[M("sugar_cane"), 1, 1]] },
  { key: "bambu", name: "Bambu", icon: "textures/blocks/bamboo_stem", block: M("bamboo"), kind: "column",
    drops: [[M("bamboo"), 1, 1]] },
  { key: "karpuz", name: "Karpuz", icon: "textures/items/melon", block: M("melon_block"), kind: "fruit",
    drops: [[M("melon_slice"), 3, 7]] },
  { key: "balkabagi", name: "Bal Kabağı", icon: "textures/blocks/pumpkin_side", block: M("pumpkin"), kind: "fruit",
    drops: [[M("pumpkin"), 1, 1]] },
  { key: "tatli_meyve", name: "Tatlı Meyve", icon: "textures/items/sweet_berries", block: M("sweet_berry_bush"),
    state: "growth", min: 2, kind: "bush", reset: 1, drops: [[M("sweet_berries"), 1, 3]] },
  { key: "kakao", name: "Kakao", icon: "textures/items/dye_powder_brown", block: M("cocoa"), state: "age", max: 2,
    kind: "pod", reset: 0, drops: [[M("cocoa_beans"), 2, 3]] },
];
export const CROP_BY_KEY = Object.fromEntries(CROPS.map((c) => [c.key, c]));
export const CROP_OF_BLOCK = new Map(CROPS.map((c) => [c.block, c]));
export const TILLABLE = set(["dirt", "grass_block", "grass_path", "coarse_dirt", "dirt_with_roots"]);

/** Ekin olgun mu? */
export function isMature(crop, block) {
  if (!crop) return false;
  if (crop.kind === "column") {
    // en alttaki kalır; üstünde aynı bitkiden varsa hasat edilir
    const below = safe(() => block.below(1));
    return !!below && below.typeId === crop.block;
  }
  if (crop.kind === "fruit") return true;
  const v = safe(() => block.permutation.getState(crop.state));
  if (typeof v !== "number") return false;
  if (crop.min !== undefined) return v >= crop.min;
  return v >= crop.max;
}

// ---------------------------------------------------------------- yakıt ve fırın
export const FUELS = new Map([
  [M("coal"), 8], [M("charcoal"), 8], [M("coal_block"), 80], [M("blaze_rod"), 12], [M("lava_bucket"), 100],
  [M("dried_kelp_block"), 20], [M("bamboo"), 0.25], [M("stick"), 0.5],
]);
export function fuelValue(t) {
  if (FUELS.has(t)) return FUELS.get(t);
  if (t.endsWith("_log") || t.endsWith("_wood") || t.endsWith("_stem") || t.endsWith("_hyphae")) return 1.5;
  if (t.endsWith("_planks")) return 1.5;
  return 0;
}
export const FURNACES = set(["furnace", "lit_furnace", "blast_furnace", "lit_blast_furnace", "smoker", "lit_smoker"]);
export const SMELT = new Map([
  [M("raw_iron"), M("iron_ingot")], [M("raw_gold"), M("gold_ingot")], [M("raw_copper"), M("copper_ingot")],
  ["aqualit:raw_aqualit", "aqualit:aqualit_ingot"], [M("ancient_debris"), M("netherite_scrap")],
  [M("sand"), M("glass")], [M("red_sand"), M("glass")], [M("clay_ball"), M("brick")],
  [M("cobblestone"), M("stone")], [M("cobbled_deepslate"), M("deepslate")],
]);

// ---------------------------------------------------------------- korunacak bloklar (robot asla kırmaz)
const PROTECTED_SUFFIX = ["chest", "furnace", "_bed", "_door", "shulker_box", "barrel", "crafting_table", "_planks",
  "_glass", "glass", "bricks", "_stairs", "_slab", "_fence", "_wall", "_sign", "_banner", "beacon", "anvil",
  "enchanting_table", "hopper", "dispenser", "dropper", "lectern", "bookshelf", "_concrete", "wool", "lantern",
  "spawner", "bedrock", "end_portal", "portal", "command_block", "structure_block", "barrier", "jigsaw", "light_block"];
export function isProtected(t) {
  if (t.startsWith("aqualit:") && !t.endsWith("_ore")) return true;
  if (t === M("bedrock") || t === M("barrier") || t === M("end_portal_frame") || t === M("reinforced_deepslate")) return true;
  for (const s of PROTECTED_SUFFIX) if (t.endsWith(s)) return true;
  return false;
}
