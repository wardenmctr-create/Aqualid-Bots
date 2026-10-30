// Aqualit Robotları — sabitler
export const ROBOT_ID = "aqualit:robot";
export const CHEST_ID = "aqualit:robot_chest";

export const TYPES = ["madenci", "kurekci", "ciftci", "oduncu", "kilicli", "insaatci"];
export const TYPE_NAME = {
  madenci: "Madenci",
  kurekci: "Kürekçi",
  ciftci: "Çiftçi",
  oduncu: "Oduncu",
  kilicli: "Kılıçlı",
  insaatci: "Mimar",
  kesif: "Keşif",
};
export const TYPE_TOOL = {
  madenci: "aqualit:aqualit_pickaxe",
  kurekci: "aqualit:aqualit_shovel",
  ciftci: "aqualit:aqualit_hoe",
  oduncu: "aqualit:aqualit_axe",
  kilicli: "aqualit:aqualit_sword",
  insaatci: "minecraft:brick_block",
};
export const TYPE_ICON = {
  madenci: "textures/items/robot_madenci",
  kurekci: "textures/items/robot_kurekci",
  ciftci: "textures/items/robot_ciftci",
  oduncu: "textures/items/robot_oduncu",
  kilicli: "textures/items/robot_kilicli_1",
  insaatci: "textures/items/robot_insaatci",
  kesif: "textures/items/robot_kesif",
};
export function robotIcon(type, model = 1) {
  return type === "kilicli" ? `textures/items/robot_kilicli_${model}` : TYPE_ICON[type];
}
export function robotItemId(type, model = 1) {
  return type === "kilicli" ? `aqualit:robot_kilicli_${model}` : `aqualit:robot_${type}`;
}

// sandik turleri -> esya
export const CHEST_KINDS = ["genel", "madenci", "kurekci", "ciftci", "oduncu", "kilicli", "insaatci", "toplayici"];
export const CHEST_ITEM = {
  genel: "aqualit:aqualit_chest",
  madenci: "aqualit:chest_miner",
  kurekci: "aqualit:chest_digger",
  ciftci: "aqualit:chest_farmer",
  oduncu: "aqualit:chest_lumber",
  kilicli: "aqualit:chest_kilicli",
  insaatci: "aqualit:chest_builder",
  toplayici: "aqualit:chest_collector",
};
export const CHEST_NAME = {
  genel: "Aqualit Sandık",
  madenci: "Madenci Sandığı",
  kurekci: "Kürekçi Sandığı",
  ciftci: "Çiftçi Sandığı",
  oduncu: "Oduncu Sandığı",
  kilicli: "Kılıçlı Sandığı",
  insaatci: "İnşaatçı Sandığı",
  toplayici: "Toplayıcı Sandığı",
};
export const CHEST_ICON = {
  genel: "textures/items/aqualit_chest",
  madenci: "textures/items/chest_miner",
  kurekci: "textures/items/chest_digger",
  ciftci: "textures/items/chest_farmer",
  oduncu: "textures/items/chest_lumber",
  kilicli: "textures/items/chest_kilicli",
  insaatci: "textures/items/chest_builder",
  toplayici: "textures/items/chest_collector",
};

// Kılıçlı seviye değerleri (can, hız seviyesi, hasar)
export const KILICLI_MODELS = {
  1: { can: 30, hiz: 3, hasar: 7, renk: "Kırmızı", kod: "§c" },
  2: { can: 60, hiz: 4, hasar: 8, renk: "Yeşil", kod: "§a" },
  3: { can: 100, hiz: 5, hasar: 10, renk: "Mor", kod: "§d" },
  4: { can: 160, hiz: 6, hasar: 12, renk: "Sarı", kod: "§e" },
  5: { can: 300, hiz: 7, hasar: 15, renk: "Mavi", kod: "§9" },
};
export const DMG_TIERS = [3, 5, 7, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50, 75, 100];
export const SPD_LEVELS = 10;
export const KILICLI_BASE_HEALTH = 40; // JSON'daki temel can; üstü sağlık takviyesi etkisiyle

// renkler (Bedrock biçim kodları). §s = elmas/turkuaz tonu
export const C = {
  tq: "§s",
  tq2: "§3",
  ok: "§a",
  bad: "§c",
  warn: "§6",
  dim: "§7",
  white: "§f",
  bold: "§l",
  r: "§r",
};

export const TICKS_PER_SECOND = 20;
export const MAX_ROBOTS_PER_PLAYER = 40;

// robotların sandıktan en fazla uzaklık seçenekleri (100000 = Sınırsız)
export const DIST_OPTS = [32, 64, 128, 256, 512, 100000];
export const DIST_LABELS = ["32 blok", "64 blok", "128 blok", "256 blok", "512 blok", "Sınırsız"];
export function distIndex(v) {
  let best = 0;
  DIST_OPTS.forEach((d, i) => {
    if (Math.abs(d - v) < Math.abs(DIST_OPTS[best] - v)) best = i;
  });
  return best;
}
export function distText(v) {
  return v >= 10000 ? "Sınırsız" : `${v} blok`;
}
