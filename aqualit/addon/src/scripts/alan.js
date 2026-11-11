// v0.5.0: Kürekçi alan işleri (Bölge Seçici ile seçilen alan).
//  düzleştir: alt köşenin yüksekliği (L) zemin olur; L'nin üstündeki bloklar kazılır (en çok 24 kat), L ve 3 blok
//             altına kadar olan çukurlar toprakla (kazdığı toprak/kırık taş ya da sandıktan) doldurulur.
//  doldur:    alandaki bütün boşluklar seçilen blokla doldurulur (alttan üste).
// Korunan bloklara (sandık, fırın, robot blokları...) dokunmaz. En çok 32x32 alan. Oyunda denenmedi.
import { system } from "@minecraft/server";
import { V, safe, wait } from "./util.js";
import * as B from "./blocks.js";

export const ALAN = { EN_GENIS: 32, YUKARI: 24, CUKUR: 3 };
export const DOLGU = [
  { id: "minecraft:dirt", ad: "Toprak" }, { id: "minecraft:cobblestone", ad: "Kırık taş" },
  { id: "minecraft:stone", ad: "Taş" }, { id: "minecraft:sand", ad: "Kum" }, { id: "minecraft:oak_planks", ad: "Meşe tahta" },
];
const DUZ_DOLGU = ["minecraft:dirt", "minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:stone", "minecraft:gravel", "minecraft:sand"];

export function alanSinir(z) {
  return {
    x0: Math.min(z.a.x, z.b.x), x1: Math.max(z.a.x, z.b.x),
    y0: Math.min(z.a.y, z.b.y), y1: Math.max(z.a.y, z.b.y),
    z0: Math.min(z.a.z, z.b.z), z1: Math.max(z.a.z, z.b.z),
  };
}
export function alanUygun(z) {
  if (!z?.a || !z?.b) return "Önce Bölge Seçici ile alanın iki köşesini seç.";
  const s = alanSinir(z);
  if (s.x1 - s.x0 + 1 > ALAN.EN_GENIS || s.z1 - s.z0 + 1 > ALAN.EN_GENIS) return `Alan en çok ${ALAN.EN_GENIS}x${ALAN.EN_GENIS} olabilir.`;
  return null;
}

const bos = (t) => B.isAir(t) || B.isWater(t) || (B.isPassableType(t) && !t.includes("torch") && !t.includes("rail"));
const kazilir = (t) => !B.isAir(t) && !B.isWater(t) && !B.isLava(t) && t !== "minecraft:bedrock" && !B.isProtected(t);

/** Yılan sırası: her katta satır satır gidip gelir (robot az yürür). */
function* katHucreleri(s, y) {
  for (let x = s.x0; x <= s.x1; x++) {
    const ileri = (x - s.x0) % 2 === 0;
    for (let i = 0; i <= s.z1 - s.z0; i++) yield { x, y, z: ileri ? s.z0 + i : s.z1 - i };
  }
}

function* dolguAl(bot, adaylar, n) {
  for (const id of adaylar) if (bot.count(id) > 0) return id;
  yield* bot.fetchFromChests((t) => adaylar.includes(t), n, 24);
  for (const id of adaylar) if (bot.count(id) > 0) return id;
  return null;
}

function* koy(bot, p, adaylar) {
  const id = yield* dolguAl(bot, adaylar, 64);
  if (!id) return false;
  yield* bot.goTo(p, { range: 4, maxNodes: 1200, radius: 48 });
  return yield* bot.place(p, id, { item: id, replace: true, sound: "dig.gravel" });
}

/** Kürekçi görevi: { type:'kurekci', mode:'alan', is:'duzlestir'|'doldur', zone:{a,b,dim}, blok } */
export function* alanIsi(bot) {
  const T = bot.task;
  const s = alanSinir(T.zone);
  const dim = bot.dim;
  let kazilan = 0, konan = 0, eksik = false;
  const tip = (p) => safe(() => dim.getBlock(p)?.typeId, "minecraft:air") ?? "minecraft:air";
  if (T.is === "duzlestir") {
    bot.setStatus("Alanı düzleştiriyor");
    const L = s.y0;
    const ust = Math.min(s.y1 + ALAN.YUKARI, L + ALAN.YUKARI);
    // 1) yukarıdan aşağı kaz
    for (let y = ust; y > L; y--) {
      let katta = 0;
      for (const p of katHucreleri(s, y)) {
        const t = tip(p);
        if (!kazilir(t)) continue;
        katta++;
        if (V.dist(bot.loc, p) > 4.5) yield* bot.goTo(p, { range: 4, maxNodes: 1200, radius: 48 });
        if (yield* bot.mine(p, {})) kazilan++;
        if (bot.isFull()) { yield* bot.deposit((id) => (DUZ_DOLGU.includes(id) ? 256 : 0)); }
      }
      if (!katta) yield;
    }
    // 2) çukurları doldur (aşağıdan yukarı): L'den CUKUR blok aşağıya kadar
    for (let y = L - ALAN.CUKUR; y <= L; y++) {
      for (const p of katHucreleri(s, y)) {
        if (!bos(tip(p))) continue;
        // yalnız gerçek çukur: altı dolu ya da daha önce doldurulmuş
        if (y < L && bos(tip({ x: p.x, y: p.y - 1, z: p.z }))) continue;
        if (yield* koy(bot, p, DUZ_DOLGU)) konan++;
        else { eksik = true; break; }
      }
      if (eksik) break;
      yield;
    }
  } else {
    const blok = T.blok ?? "minecraft:dirt";
    bot.setStatus("Alanı dolduruyor");
    for (let y = s.y0; y <= s.y1 && !eksik; y++) {
      for (const p of katHucreleri(s, y)) {
        if (!bos(tip(p))) continue;
        // içine kendini gömmesin: robotun durduğu yerse bir kenara çekil
        if (V.floor(bot.loc).x === p.x && V.floor(bot.loc).z === p.z && Math.abs(V.floor(bot.loc).y - p.y) <= 1) {
          yield* bot.goTo({ x: p.x, y: s.y1 + 1, z: s.z1 + 2 }, { range: 2, maxNodes: 800, radius: 48 });
        }
        if (yield* koy(bot, p, [blok])) konan++;
        else { eksik = true; break; }
      }
      yield;
    }
  }
  yield* wait(4);
  yield* bot.deposit();
  T.done = true;
  bot.saveTask();
  const ne = T.is === "duzlestir" ? `Alanı düzleştirdim: ${kazilan} blok kazdım, ${konan} çukur doldurdum.` : `Alanı doldurdum: ${konan} blok koydum.`;
  bot.say(eksik ? `${ne} Malzemem bitti, kalanı için sandığa ${T.is === "doldur" ? "dolgu bloğu" : "toprak ya da taş"} koy.` : ne, { force: true });
  bot.setStatus("Hazır");
  void system;
}
