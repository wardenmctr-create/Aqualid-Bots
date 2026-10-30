// Aqualit Robotları — iş robotlarının görevleri (jeneratörler)
import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { V, DIRS4, wait, safe, rand, clamp, log } from "./util.js";
import { getProp } from "./store.js";
import * as B from "./blocks.js";
import { Kaynak } from "./kaynak.js";
import { canReach } from "./path.js";
import { WALK, RUN } from "./bot.js";
import { readAnswer } from "./messages.js";
import { mimarJob } from "./mimar.js";
import { yagmaGorevi } from "./yagma.js";

const M = (s) => "minecraft:" + s;

// ======================================================================= ortak
function gotMap(bot) {
  if (!bot.prog.got) bot.prog.got = {};
  return bot.prog.got;
}
function leftOf(task, got) {
  return (task.items ?? []).reduce((s, t) => s + Math.max(0, (t.amount ?? 0) - (got[t.key] ?? 0)), 0);
}
function wants(task, got, key) {
  return (task.items ?? []).some((t) => t.key === key && (got[t.key] ?? 0) < (t.amount ?? 0));
}
function summary(task, got, names) {
  return (task.items ?? [])
    .filter((t) => (got[t.key] ?? 0) > 0)
    .map((t) => `${got[t.key]} ${names[t.key]?.name ?? t.key}`)
    .join(", ");
}

/** Görev bitince: eve dön, gerekirse erit, sandığa koy, haber ver. */
export function* finishJob(bot, opts = {}) {
  bot.setStatus("Eve dönüyor");
  bot.setAct("none");
  const home = yield* bot.goHome({ run: opts.run });
  if (home) {
    if (bot.task?.finish === "smelt") yield* smeltAll(bot);
    bot.setStatus("Sandığa koyuyor");
    yield* bot.deposit(opts.keep ?? (() => 0));
  }
  if (opts.message) bot.say(opts.message);
  if (bot.task) {
    bot.task.done = true;
    bot.saveTask();
  }
  bot.prog = {};
  bot.save(true);
  bot.setAct("celebrate");
  yield* wait(50);
  bot.setAct("none");
  return home;
}

/** Hemen geri dön. */
export function* returnJob(bot, run = true) {
  bot.setStatus("Eve koşuyor");
  const ok = yield* bot.goHome({ run });
  if (ok) {
    bot.setStatus("Sandığa koyuyor");
    yield* bot.deposit(keepFor(bot));
    bot.say("Eve döndüm.");
  }
  if (bot.task) {
    bot.task.paused = true;
    bot.saveTask();
  }
  return yield* idleJob(bot);
}

export function keepFor(bot) {
  if (bot.type === "madenci") return (id) => (id === M("cobblestone") || id === M("cobbled_deepslate") ? 16 : 0);
  if (bot.type === "ciftci") {
    const seeds = new Set(B.CROPS.filter((c) => c.seed).map((c) => c.seed));
    return (id) => (seeds.has(id) ? 32 : 0);
  }
  if (bot.type === "oduncu") {
    const saps = new Set(B.LOGS.map((l) => l.sapling));
    return (id) => (saps.has(id) ? 16 : 0);
  }
  return () => 0;
}

/** Boşta bekleme: sandığının yanında durur, sahibi gelince el sallar. */
export function* idleJob(bot) {
  bot.setStatus("Bekliyor");
  bot.setMove("none");
  bot.setAct("none");
  safe(() => bot.e.triggerEvent("aqualit:tick_off"));
  let t = 0;
  for (;;) {
    yield* wait(20);
    t += 20;
    // boş zaman işleri: 30 saniyede bir yapılacak iş var mı bakar
    if (t % 600 === 0 && idleOn(bot)) {
      safe(() => bot.e.triggerEvent("aqualit:tick_on"));
      const did = yield* idleChores(bot);
      safe(() => bot.e.triggerEvent("aqualit:tick_off"));
      if (did) {
        yield* bot.goHome();
        bot.setStatus("Bekliyor");
        bot.setAct("none");
      }
      continue;
    }
    const owner = safe(() => bot.dim.getPlayers({ location: bot.loc, maxDistance: 6 }).find((p) => p.id === bot.owner));
    if (owner && t % 200 === 0) {
      bot.face(V.floor(owner.location));
      bot.setAct("wave");
      yield* wait(30);
      bot.setAct("none");
    } else if (t % 600 === 0) {
      bot.setAct(Math.random() < 0.5 ? "look" : "think");
      yield* wait(60);
      bot.setAct("none");
    }
  }
}

// ======================================================================= boş zaman işleri
const RAW_ORES = new Set([M("raw_iron"), M("raw_gold"), M("raw_copper"), "aqualit:raw_aqualit", M("ancient_debris")]);
const KIT_PARTS = [["aqualit:aqualit_ingot", 1], [M("iron_ingot"), 2], [M("redstone"), 1]];

export function idleOn(bot) {
  return getProp(bot.e, "aq:bos", true) !== false;
}

/** Sahibin, evin çevresindeki sandıklarındaki eşyaları say. */
function chestTotals(bot, radius = 16) {
  const m = new Map();
  let used = 0, size = 0;
  for (const ch of bot.chestsNear(bot.home ?? bot.loc, radius)) {
    const cc = safe(() => ch.getComponent("minecraft:inventory")?.container);
    if (!cc) continue;
    size += cc.size;
    for (let i = 0; i < cc.size; i++) {
      const it = cc.getItem(i);
      if (!it) continue;
      used++;
      m.set(it.typeId, (m.get(it.typeId) ?? 0) + it.amount);
    }
  }
  return { m, used, size };
}

/** Uzun aralıkla haber ver (aynı konu 30 dk'da bir). */
function report(bot, key, text) {
  bot._rep ??= {};
  const now = system.currentTick;
  if (now - (bot._rep[key] ?? -1e9) < 20 * 60 * 30) return;
  bot._rep[key] = now;
  bot.say(text);
}

function due(bot, key, ticks) {
  bot._chore ??= {};
  const now = system.currentTick;
  if (now - (bot._chore[key] ?? -1e9) < ticks) return false;
  bot._chore[key] = now;
  return true;
}

/**
 * Görev yokken yapılacak işler (her çağrıda en fazla biri). Bir şey yaptıysa true döner.
 *  · çiftçi olgun ekinleri toplar ve yeniden eker · oduncu fidan diker
 *  · ham madenleri fırında eritir · malzeme varsa tamir kiti yapar · yakıt azsa kömür bulur
 *  · eksikleri (fırın yok, yakıt yok, sandık doluyor) sahibine haber verir
 */
export function* idleChores(bot) {
  if (!bot.home || bot.dim.id !== bot.homeDim) return false;
  const home = bot.home;
  const { m, used, size } = chestTotals(bot);
  // 0) eksikleri haber ver
  if (size && used >= size * 0.9) report(bot, "dolu", `Sandıklarım dolmak üzere (${used}/${size} yuva). Yeni bir Aqualit sandık koyar mısın?`);
  // 1) çiftçi: olgun ekin
  if (bot.type === "ciftci" && due(bot, "hasat", 20 * 45)) {
    const ripe = bot.scan(B.CROPS.map((c) => c.block), home, 16, 6, 16, 24).filter((p) => {
      const b = safe(() => bot.dim.getBlock(p));
      return b && B.isMature(B.CROP_OF_BLOCK.get(b.typeId), b);
    });
    if (ripe.length) {
      bot.setStatus("Boş zamanında hasat ediyor");
      const got = {};
      for (const p of ripe.slice(0, 16)) {
        const crop = B.CROP_OF_BLOCK.get(safe(() => bot.dim.getBlock(p)?.typeId));
        if (crop) yield* harvest(bot, p, crop, got);
      }
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      return true;
    }
  }
  // 2) oduncu: kesilen yerlere fidan
  if (bot.type === "oduncu" && (bot.prog.trees?.length ?? 0) > 0 && due(bot, "fidan", 20 * 60)) {
    bot.setStatus("Boş zamanında fidan dikiyor");
    yield* sweepAndReplant(bot, { replant: true }, 12);
    return true;
  }
  // 3) ham madenleri erit
  const raw = [...m].filter(([id]) => RAW_ORES.has(id)).reduce((a, [, n]) => a + n, 0);
  if (raw > 0 && due(bot, "erit", 20 * 120)) {
    const furn = bot.scan([...B.FURNACES], home, 6, 3, 6, 2);
    const fuel = [...m].filter(([id]) => isFuel(id)).reduce((a, [id, n]) => a + B.fuelValue(id) * n, 0);
    if (!furn.length) report(bot, "firin", `Sandıkta ${raw} pişirilmemiş maden var ama yakında fırın yok. Sandığımın yanına fırın koyarsan eritirim.`);
    else if (fuel <= 0) report(bot, "yakit", `Sandıkta ${raw} pişirilmemiş maden var ama yakıt (kömür, odun) yok.`);
    else {
      bot.setStatus("Boş zamanında maden eritiyor");
      yield* bot.fetchFromChests((id) => RAW_ORES.has(id), 64);
      yield* smeltAll(bot);
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      return true;
    }
  }
  // 4) tamir kiti yap (sandıkta 2'den az kit varsa ve malzeme yeterliyse)
  const kits = m.get("aqualit:tamir_kiti") ?? 0;
  if (kits < 2 && KIT_PARTS.every(([id, n]) => (m.get(id) ?? 0) >= n) && due(bot, "kit", 20 * 300)) {
    bot.setStatus("Boş zamanında tamir kiti yapıyor");
    let ok = true;
    for (const [id, n] of KIT_PARTS) {
      if (bot.count(id) < n) yield* bot.fetchFromChests((x) => x === id, n - bot.count(id));
      if (bot.count(id) < n) ok = false;
    }
    if (ok) {
      const table = bot.scan([M("crafting_table")], home, 8, 3, 8, 1)[0];
      if (table) yield* bot.goReach(table, { maxNodes: 1200, radius: 16 });
      bot.setAct("place");
      yield* wait(30);
      for (const [id, n] of KIT_PARTS) bot.take(id, n);
      bot.addItem("aqualit:tamir_kiti", 1);
      bot.setAct("celebrate");
      yield* wait(20);
      bot.setAct("none");
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      bot.say("Boş zamanımda bir tamir kiti yapıp sandığa koydum.");
      return true;
    }
  }
  // 5) yakıt azsa: madenci görünen kömürü kazar
  const fuelAll = [...m].filter(([id]) => isFuel(id)).reduce((a, [id, n]) => a + B.fuelValue(id) * n, 0);
  if (bot.type === "madenci" && fuelAll < 16 && due(bot, "komur", 20 * 600)) {
    const coal = bot.scan([M("coal_ore"), M("deepslate_coal_ore")], home, 20, 10, 20, 8).filter((p) => exposed(bot, p));
    if (coal.length) {
      bot.setStatus("Boş zamanında yakıt için kömür kazıyor");
      for (const p of coal.slice(0, 6)) {
        if (!(yield* bot.goReach(p, { maxNodes: 1500, radius: 24 }))) continue;
        yield* bot.mine(p, { act: "mine" });
      }
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      return true;
    }
    report(bot, "yakit2", "Sandıklarda yakıt azaldı. Biraz kömür ya da odun koyarsan fırınları çalıştırabilirim.");
  }
  return false;
}

/** Sandık yakınındaki fırınlarda eritme. */
const COAL_LIKE = new Set([M("coal"), M("charcoal"), M("coal_block"), M("dried_kelp_block"), M("blaze_rod")]);
/** Görev ürünü mü? (robotun yanında taşıdığı kırık taşı eritmez) */
function smeltable(id) {
  return B.SMELT.has(id) && id !== M("cobblestone") && id !== M("cobbled_deepslate");
}
function isFuel(id) {
  return B.fuelValue(id) > 0 && !B.SMELT.has(id) && id !== M("lava_bucket") && id !== M("bucket");
}
function fuelIn(bot) {
  let f = 0;
  for (const [id, n] of bot.contents()) if (isFuel(id)) f += B.fuelValue(id) * n;
  return f;
}
/** Fırının yakıt yuvasını "n eşya eritecek kadar" doldur; koyulan yakıtın eritme gücünü döndürür. */
function fuelFurnace(bot, cc, n) {
  let cur = cc.getItem(1);
  let have = cur && isFuel(cur.typeId) ? B.fuelValue(cur.typeId) * cur.amount : 0;
  if (cur && !isFuel(cur.typeId)) return 0; // yuvada başka bir şey var (ör. boş kova)
  // önce kömür türleri, sonra tahta, en son kütük
  const order = [...bot.contents()].filter(([id]) => isFuel(id))
    .sort((a, b) => (COAL_LIKE.has(b[0]) ? 2 : b[0].endsWith("_planks") ? 1 : 0) - (COAL_LIKE.has(a[0]) ? 2 : a[0].endsWith("_planks") ? 1 : 0));
  let added = 0;
  for (const [fid, fn] of order) {
    if (have >= n) break;
    cur = cc.getItem(1);
    if (cur && cur.typeId !== fid) continue;
    const per = B.fuelValue(fid);
    const amt = Math.min(fn, Math.ceil((n - have) / per), 64 - (cur?.amount ?? 0));
    if (amt <= 0) continue;
    const tk = bot.take(fid, amt);
    if (tk <= 0) continue;
    if (cur) {
      cur.amount += tk;
      cc.setItem(1, cur);
    } else cc.setItem(1, new ItemStackSafe(fid, tk));
    have += tk * per;
    added += tk * per;
  }
  return added;
}

export function* smeltAll(bot) {
  const home = bot.home ?? bot.loc;
  const furnaces = bot.scan([...B.FURNACES], home, 6, 3, 6, 8);
  const toSmelt = [...bot.contents()].filter(([id]) => smeltable(id));
  if (!toSmelt.length) return;
  if (!furnaces.length) {
    bot.say("Sandığın yakınında fırın yok; eşyaları eritmeden sandığa koyuyorum.");
    return;
  }
  bot.setStatus("Eritiyor");
  const total = toSmelt.reduce((s, [, n]) => s + n, 0);
  // yakıt: önce kömür türleri, yetmezse tahta, en son kütük (lav kovasına dokunmaz)
  const phases = [
    [(id) => COAL_LIKE.has(id), 8],
    [(id) => id.endsWith("_planks") || id === M("stick") || id === M("bamboo"), 1.5],
    [(id) => isFuel(id), 1.5],
  ];
  for (const [pick, per] of phases) {
    const fuel = fuelIn(bot);
    if (fuel >= total) break;
    yield* bot.fetchFromChests((id) => pick(id) && isFuel(id), Math.ceil((total - fuel) / per));
  }
  if (fuelIn(bot) <= 0) {
    bot.say("Yakıt bulamadım (kömür, odun...). Eritmeden sandığa koyuyorum.");
    return;
  }
  // fırınlara paylaştır
  const assigned = [];
  const usable = furnaces.filter((fp) => !safe(() => bot.dim.getBlock(fp)?.typeId ?? "", "").includes("smoker"));
  for (let fi = 0; fi < usable.length; fi++) {
    const fp = usable[fi];
    const left = [...bot.contents()].filter(([id]) => smeltable(id));
    if (!left.length) break;
    const fb = safe(() => bot.dim.getBlock(fp));
    const isBlast = !!fb && fb.typeId.includes("blast");
    const ok = yield* bot.goReach(fp, { maxNodes: 1200, radius: 16 });
    if (!ok && V.dist(bot.loc, V.center(fp)) > 3) continue;
    const cc = safe(() => bot.dim.getBlock(fp)?.getComponent("minecraft:inventory")?.container);
    if (!cc) continue;
    const inSlot = cc.getItem(0), outSlot = cc.getItem(2);
    const pick = left.find(([id]) => (!isBlast || /raw_|ancient_debris/.test(id))
      && (!inSlot || inSlot.typeId === id) && (!outSlot || outSlot.typeId === B.SMELT.get(id)));
    if (!pick) continue;
    bot.face(fp);
    bot.setAct("place");
    yield* wait(8);
    const [id, n] = pick;
    const share = Math.ceil(n / Math.max(1, usable.length - fi));
    const room = 64 - (inSlot?.amount ?? 0);
    const put = Math.min(n, room, Math.max(share, 1));
    if (put <= 0) {
      bot.setAct("none");
      continue;
    }
    const taken = bot.take(id, put);
    if (inSlot) {
      inSlot.amount += taken;
      cc.setItem(0, inSlot);
    } else cc.setItem(0, new ItemStackSafe(id, taken));
    fuelFurnace(bot, cc, cc.getItem(0)?.amount ?? taken);
    assigned.push({ fp, last: cc.getItem(0)?.amount ?? 0, still: 0 });
    bot.setAct("none");
  }
  if (!assigned.length) return;
  // bekle ve topla (fırın 10 sn'de 1 eşya eritir; yüksek fırın 5 sn)
  const limit = clamp(Math.ceil(total / assigned.length) * 200 + 400, 1200, 20 * 60 * 12);
  let waited = 0;
  let noFuel = false;
  bot.setAct("sit");
  while (waited < limit) {
    yield* wait(60);
    waited += 60;
    let busy = false;
    for (const a of assigned) {
      const cc = safe(() => bot.dim.getBlock(a.fp)?.getComponent("minecraft:inventory")?.container);
      if (!cc) continue;
      const out = cc.getItem(2);
      if (out) {
        const rest = bot.addStack(out);
        cc.setItem(2, rest ?? undefined);
      }
      const inp = cc.getItem(0);
      if (!inp) continue;
      busy = true;
      if (inp.amount < a.last) a.still = 0;
      else a.still += 60;
      a.last = inp.amount;
      // yakıt bitmiş gibi: elindeki yakıttan ekle; o da yoksa kalanları geri al
      if (!cc.getItem(1) && a.still >= 240) {
        if (fuelFurnace(bot, cc, inp.amount) > 0) a.still = 0;
        else if (a.still >= 420) {
          const rest = bot.addStack(inp);
          cc.setItem(0, rest ?? undefined);
          noFuel = true;
        }
      }
    }
    bot.setStatus(`Eritiyor (${Math.floor(waited / 20)} sn)`);
    if (!busy) break;
  }
  // son çıktıları al
  let leftInside = 0;
  for (const a of assigned) {
    const cc = safe(() => bot.dim.getBlock(a.fp)?.getComponent("minecraft:inventory")?.container);
    const out = cc?.getItem(2);
    if (out) {
      const rest = bot.addStack(out);
      cc.setItem(2, rest ?? undefined);
    }
    leftInside += cc?.getItem(0)?.amount ?? 0;
  }
  bot.setAct("none");
  if (noFuel) bot.say("Yakıt yetmedi; erimeyenleri olduğu gibi sandığa koyuyorum.");
  if (leftInside > 0) bot.say(`Fırınlarda ${leftInside} eşya hâlâ eriyor; bitince alabilirsin.`);
}

function ItemStackSafe(id, n) {
  return new ItemStack(id, Math.max(1, n));
}

// ======================================================================= madenci
function oreCounter(got) {
  return (id, n) => {
    for (const o of B.ORES) if (o.drop[0] === id) got[o.key] = (got[o.key] ?? 0) + n;
  };
}

function chooseDir(bot) {
  // evden uzaklaşan, en az engelli yön
  const c = bot.cell;
  let best = DIRS4[Math.floor(Math.random() * 4)];
  let bestScore = -1;
  for (const d of DIRS4) {
    let score = 0;
    for (let i = 1; i <= 6; i++) {
      const p = { x: c.x + d.x * i, y: c.y, z: c.z + d.z * i };
      const t = safe(() => bot.dim.getBlock(p)?.typeId, null);
      if (!t) continue;
      if (B.isProtected(t)) score -= 5;
      else if (B.isNatural(t) || B.isPassableType(t)) score += 1;
      if (B.isLava(t)) score -= 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function targetDepth(task, got, dim) {
  const need = (task.items ?? []).filter((t) => (got[t.key] ?? 0) < t.amount).map((t) => B.ORE_BY_KEY[t.key]);
  if (!need.length) return 12;
  need.sort((a, b) => b.value - a.value);
  const hr = dim.heightRange;
  return clamp(need[0].y, hr.min + 5, hr.max - 10);
}

export function* minerJob(bot) {
  const T = bot.task;
  if (T.mode === "skyblock") return yield* skyblockJob(bot);
  const got = gotMap(bot);
  const count = oreCounter(got);
  safe(() => bot.e.triggerEvent("aqualit:tick_on"));
  bot.setStatus("Maden arıyor");
  if (!bot.trail.length) bot.resetTrail();
  const st = bot.prog.st ?? (bot.prog.st = { dir: chooseDir(bot), seg: 0, approved: [], asked: [] });
  const keepStone = (id) => {
    if (T.stone) return true;
    if (id === M("cobblestone") || id === M("cobbled_deepslate")) return bot.count(id) < 24;
    return false;
  };
  const filter = (id) => {
    for (const o of B.ORES) if (o.drop[0] === id) return true;
    return keepStone(id) || id === M("flint");
  };
  bot.digFilter = filter;
  let fails = 0;
  let idleSearch = 0;
  while (leftOf(T, got) > 0) {
    yield; // her turda en az bir tik bekle: hiçbir durumda oyunu kilitlemez
    if (bot.cmd === "soft") {
      yield* softExtras(bot, count, filter);
      break;
    }
    if (bot.isFull()) {
      bot.say("Çantam doldu, sandığa boşaltıp geri geleceğim.");
      const back = bot.cell;
      if (!(yield* bot.goHome())) break;
      yield* bot.deposit(keepFor(bot));
      yield* bot.goTo(back, { dig: true, tall: true, maxNodes: 6000, radius: 128, partial: true });
      continue;
    }
    // 1) hedef madenler (onaylananlar dahil)
    const wantTypes = (T.items ?? []).filter((t) => wants(T, got, t.key)).flatMap((t) => B.ORE_BY_KEY[t.key].blocks);
    let found = bot.scan(wantTypes, bot.loc, 9, 6, 9, 6).filter((p) => bot.withinRange(p));
    for (const a of st.approved) if (V.dist(a, bot.loc) < 24) found.unshift(a);
    if (found.length) {
      const p = found[0];
      st.approved = st.approved.filter((a) => !V.eq(a, p));
      const ok = yield* mineVein(bot, p, count, filter);
      if (!ok) {
        bot.ignore(p);
        fails++;
      } else fails = 0;
      bot.save();
      continue;
    }
    // 2) güzel şeyler (bonus)
    if (T.bonus && T.bonus !== "alma") {
      const bonusKeys = [...B.VALUABLE].filter((k) => !(T.items ?? []).some((t) => t.key === k));
      const bt = bonusKeys.flatMap((k) => B.ORE_BY_KEY[k].blocks);
      const bf = bot.scan(bt, bot.loc, 5, 4, 5, 3).filter((p) => bot.withinRange(p));
      if (bf.length) {
        const p = bf[0];
        const ore = B.ORE_OF_BLOCK.get(safe(() => bot.dim.getBlock(p)?.typeId));
        if (T.bonus === "al") {
          yield* mineVein(bot, p, count, filter);
          continue;
        }
        if (T.bonus === "sor" && ore && !st.asked.some((a) => V.dist(a.p, p) < 4)) {
          const id = bot.say(`Yakında ${ore.name} buldum (${p.x}, ${p.y}, ${p.z}). Alayım mı?`, {
            kind: "ask", confirm: { yes: "Al", no: "Bırak" },
          });
          st.asked.push({ id, p, key: ore.key });
        }
        for (const v of veinOf(bot, p, 12)) bot.ignore(v);
      }
      // cevaplanan sorular
      for (const a of st.asked) {
        if (a.done) continue;
        const ans = readAnswer(bot.owner, a.id);
        if (ans === true) {
          st.approved.push(a.p);
          a.done = true;
          bot.ignored.delete(V.key(a.p));
        } else if (ans === false) a.done = true;
      }
    }
    // 3) tünel kaz
    const ty = targetDepth(T, got, bot.dim);
    const ok = yield* tunnelStep(bot, st, ty);
    if (!ok) {
      fails++;
      st.dir = turnRight(st.dir);
      if (fails % 4 === 0) st.dir = chooseDir(bot);
    } else {
      fails = Math.max(0, fails - 1);
    }
    if (fails > 16 || ++idleSearch > 900) {
      bot.say("Daha fazla maden bulamadım, bulduklarımla dönüyorum.");
      break;
    }
    bot.setStatus(`Kazıyor (y=${bot.cell.y}) · kalan ${leftOf(T, got)}`);
  }
  const s = summary(T, got, B.ORE_BY_KEY);
  return yield* finishJob(bot, {
    keep: keepFor(bot),
    message: s ? `Görev tamamlandı: ${s} topladım.` : "Görev bitti ama maden bulamadım.",
  });
}

function turnRight(d) {
  return { x: -d.z, y: 0, z: d.x };
}

function veinOf(bot, p, max = 16) {
  const t0 = safe(() => bot.dim.getBlock(p)?.typeId);
  if (!t0) return [];
  const ore = B.ORE_OF_BLOCK.get(t0);
  const types = new Set(ore ? ore.blocks : [t0]);
  const seen = new Set([V.key(p)]);
  const out = [p];
  const q = [p];
  while (q.length && out.length < max) {
    const c = q.shift();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dy && !dz) continue;
          const n = { x: c.x + dx, y: c.y + dy, z: c.z + dz };
          const k = V.key(n);
          if (seen.has(k)) continue;
          seen.add(k);
          const t = safe(() => bot.dim.getBlock(n)?.typeId);
          if (t && types.has(t)) {
            out.push(n);
            q.push(n);
          }
        }
  }
  return out;
}

function* mineVein(bot, p, count, filter) {
  bot.setStatus("Maden kazıyor");
  const ok = yield* bot.goReach(p, { dig: true, tall: true, maxNodes: 3000, radius: 24 });
  if (!ok) return false;
  const vein = veinOf(bot, p, 16);
  for (const v of vein) {
    if (!canReach(bot.cell, v)) {
      const r = yield* bot.goReach(v, { dig: true, tall: true, maxNodes: 800, radius: 8 });
      if (!r) continue;
    }
    yield* bot.mine(v, { count, filter, keepAct: true });
  }
  bot.setAct("none");
  return true;
}

function* tunnelStep(bot, st, ty) {
  const c = bot.cell;
  const d = st.dir;
  let tgt;
  if (c.y > ty + 1) tgt = { x: c.x + d.x * 4, y: Math.max(ty, c.y - 4), z: c.z + d.z * 4 };
  else if (c.y < ty - 1) tgt = { x: c.x + d.x * 4, y: Math.min(ty, c.y + 4), z: c.z + d.z * 4 };
  else tgt = { x: c.x + d.x * 6, y: c.y, z: c.z + d.z * 6 };
  if (!bot.withinRange(tgt)) {
    // yılan desen: yana 4 kaydır, yönü ters çevir
    const side = turnRight(d);
    st.dir = { x: -d.x, y: 0, z: -d.z };
    tgt = { x: c.x + side.x * 4, y: c.y, z: c.z + side.z * 4 };
    if (!bot.withinRange(tgt)) {
      st.dir = turnRight(st.dir);
      return false;
    }
  }
  return yield* bot.walkTo((p) => V.manhattan(p, tgt) <= 1, (p) => V.manhattan(p, tgt),
    { dig: true, tall: true, maxNodes: 1500, radius: 12 });
}

function* softExtras(bot, count, filter) {
  bot.setStatus("Yakındakileri alıp dönüyor");
  const keys = [...B.VALUABLE];
  const types = keys.flatMap((k) => B.ORE_BY_KEY[k].blocks);
  let n = 0;
  for (const p of bot.scan(types, bot.loc, 6, 4, 6, 3)) {
    if (n >= 3) break;
    if (yield* mineVein(bot, p, count, filter)) n++;
  }
  bot.cmd = null;
}

// ---------------------------------------------------------------------- skyblock taş makinesi
function isGenerator(bot, p) {
  let water = false, lava = false;
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -2; dz <= 2; dz++) {
        const t = safe(() => bot.dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz })?.typeId);
        if (!t) continue;
        if (B.isWater(t)) water = true;
        if (B.isLava(t)) lava = true;
      }
  return water && lava;
}

export function* skyblockJob(bot) {
  const T = bot.task;
  const got = gotMap(bot);
  const want = (T.items?.[0]?.amount) ?? 64;
  safe(() => bot.e.triggerEvent("aqualit:tick_on"));
  bot.setStatus("Taş makinesi arıyor");
  const stones = [M("cobblestone"), M("stone"), M("basalt"), M("cobbled_deepslate")];
  let gen = bot.prog.gen;
  if (!gen) {
    const cands = bot.scan(stones, bot.home ?? bot.loc, 12, 5, 12, 40).filter((p) => isGenerator(bot, p));
    if (!cands.length) {
      bot.say("Yakında taş makinesi (su + lav arasında taş) bulamadım.");
      return yield* finishJob(bot, {});
    }
    gen = cands[0];
    bot.prog.gen = gen;
  }
  if (!(yield* bot.goReach(gen, { maxNodes: 2000, radius: 24 }))) {
    bot.say("Taş makinesine ulaşamıyorum.");
    return yield* finishJob(bot, {});
  }
  got.tas = got.tas ?? 0;
  let empty = 0;
  while (got.tas < want) {
    yield; // her turda en az bir tik bekle: hiçbir durumda oyunu kilitlemez
    if (bot.cmd === "soft") break;
    if (bot.isFull() || bot.freeSlots() < 2) {
      yield* bot.deposit(() => 0);
      yield* bot.goReach(gen, { maxNodes: 2000, radius: 24 });
    }
    const t = safe(() => bot.dim.getBlock(gen)?.typeId);
    if (t && stones.includes(t)) {
      empty = 0;
      yield* bot.mine(gen, { count: (id, n) => (got.tas += n), act: "mine", noSeal: true });
      bot.setStatus(`Taş kırıyor ${got.tas}/${want}`);
    } else {
      yield* wait(5);
      if (++empty > 200) {
        bot.say("Taş makinesi taş üretmiyor gibi.");
        break;
      }
    }
  }
  return yield* finishJob(bot, { message: `Taş makinesinden ${got.tas} taş topladım.` });
}

// ======================================================================= kürekçi
function exposed(bot, p) {
  for (const d of [{ x: 0, y: 1, z: 0 }, ...DIRS4]) {
    const t = safe(() => bot.dim.getBlock(V.add(p, d))?.typeId, null);
    if (t && (B.isAir(t) || B.isWater(t) || B.isPassableType(t))) return true;
  }
  return false;
}

export function* diggerJob(bot) {
  const T = bot.task;
  const got = gotMap(bot);
  safe(() => bot.e.triggerEvent("aqualit:tick_on"));
  const count = (id, n) => {
    for (const s of B.SHOVEL) {
      if (s.blocks.includes(id) || (s.key === "kil" && id === M("clay_ball")) || (s.key === "kar" && id === M("snowball"))
        || (s.key === "toprak" && id === M("dirt"))) {
        got[s.key] = (got[s.key] ?? 0) + n;
        return;
      }
    }
  };
  let misses = 0;
  while (leftOf(T, got) > 0) {
    yield; // her turda en az bir tik bekle: hiçbir durumda oyunu kilitlemez
    if (bot.cmd === "soft") {
      bot.cmd = null;
      break;
    }
    if (bot.isFull()) {
      yield* bot.goHome();
      yield* bot.deposit(() => 0);
      continue;
    }
    const types = (T.items ?? []).filter((t) => wants(T, got, t.key)).flatMap((t) => B.SHOVEL_BY_KEY[t.key].blocks);
    const home = bot.home ?? bot.loc;
    const ok = (p) => bot.withinRange(p) && V.hdist(p, home) > 2.5 && exposed(bot, p);
    let cand = bot.scan(types, bot.loc, 10, 5, 10, 24).filter(ok);
    if (!cand.length) cand = bot.scan(types, home, 22, 8, 22, 24).filter(ok);
    if (!cand.length) {
      if (yield* farSearch(bot, "kazi:" + types.join(","), types, (p) => exposed(bot, p) && V.hdist(p, home) > 2.5, "kazılacak blok")) continue;
      if (++misses > 0) {
        bot.say(`İstediğin bloklardan bulamadım (${rangeText(bot)} aradım). Uzaklık sınırını artırabilirsin.`);
        break;
      }
      bot.setAct("look");
      yield* wait(40);
      bot.setAct("none");
      continue;
    }
    misses = 0;
    const p = cand[0];
    bot.setStatus(`Kazıyor · kalan ${leftOf(T, got)}`);
    const reached = yield* bot.goReach(p, { maxNodes: 2000, radius: 32 });
    if (!reached) {
      bot.ignore(p);
      continue;
    }
    yield* bot.mine(p, { count, act: "dig", keepAct: true });
    // aynı yerden ulaşılabilen komşuları da al
    for (const q of bot.scan(types, bot.loc, 2, 2, 2, 6)) {
      if (leftOf(T, got) <= 0) break;
      if (canReach(bot.cell, q) && exposed(bot, q) && V.hdist(q, home) > 2.5) {
        yield* bot.mine(q, { count, act: "dig", keepAct: true });
      }
    }
    bot.setAct("none");
    bot.save();
  }
  const s = summary(T, got, B.SHOVEL_BY_KEY);
  return yield* finishJob(bot, { message: s ? `Görev tamamlandı: ${s} topladım.` : "Görev bitti." });
}

// ======================================================================= uzak arama
/** Robotun arama sınırı: Sınırsız seçiliyse keşifte en çok 400 blok uzaklaşır. */
export function searchRange(bot) {
  return bot.maxDist >= 10000 ? 400 : bot.maxDist;
}
export function rangeText(bot) {
  return bot.maxDist >= 10000 ? "400 blok çevreyi" : `${bot.maxDist} blok çevreyi`;
}

/**
 * Yakında yoksa uzakta ara: önce hatırlanan yerler, sonra oyunun yüklü alanının tamamı (yüzlerce blok),
 * o da yoksa halkalar halinde keşfe çık. Bulursa yakınına gider ve true döner.
 */
export function* farSearch(bot, kind, types, filter, label) {
  const home = bot.home ?? bot.loc;
  const range = searchRange(bot);
  const dimId = bot.dim.id;
  const ok = (p) => bot.withinRange(p) && !bot.ignored.has(V.key(p)) && (!filter || filter(p));
  // 1) hatırlanan yerler
  const mem = Kaynak.list(bot.owner, kind, dimId).filter(ok)
    .sort((a, b) => V.dist2(a, bot.loc) - V.dist2(b, bot.loc)).slice(0, 3);
  for (const m of mem) {
    bot.setStatus(`Hatırladığı ${label} yerine gidiyor`);
    if (yield* bot.travelTo(m, { near: 6 })) {
      if (bot.scan(types, bot.loc, 12, 10, 12, 8).some(ok)) return true;
    }
    Kaynak.remove(bot.owner, kind, dimId, m);
  }
  // 2) yüklü alanın tamamı
  bot.setStatus(`Uzakta ${label} arıyor`);
  const far = yield* bot.scanFar(types, home, Math.min(range, 192), 28, 16, ok);
  for (const p of far.slice(0, 3)) {
    Kaynak.add(bot.owner, kind, dimId, far.slice(0, 8));
    const dist = Math.round(V.hdist(p, bot.loc));
    if (dist > 30) bot.say(`${dist} blok ötede ${label} gördüm, oraya gidiyorum.`);
    if (yield* bot.travelTo(p, { near: 6, speed: dist > 40 ? RUN : undefined })) return true;
    bot.ignore(p);
    Kaynak.remove(bot.owner, kind, dimId, p);
  }
  // 3) keşif: evin çevresinde 96 bloklık halkalar, her halkada 8 yön; her durakta 64 blok çevresini tarar.
  //    Bir çağrıda en çok 4 durak gider; arama sürüyorsa "more" döner (iş döngüsü tekrar çağırır).
  const ex = (bot.prog.explore ??= { k: 0, idx: Math.floor(Math.random() * 8), n: 0 });
  for (let legs = 0; legs < 4; legs++) {
    const r = (ex.k + 1) * 96;
    if (r > range) {
      bot.prog.explore = null; // bütün halkalar bitti
      return false;
    }
    const a = ((ex.idx % 8) * Math.PI) / 4;
    const target = { x: home.x + Math.cos(a) * r, y: home.y, z: home.z + Math.sin(a) * r };
    ex.idx++;
    if (++ex.n % 8 === 0) ex.k++;
    bot.setStatus(`${label} bulmak için keşfe çıktı (${r} blok)`);
    if (!(yield* bot.travelTo(target, { near: 8, speed: RUN }))) continue;
    const found = yield* bot.scanFar(types, bot.loc, 64, 28, 12, ok);
    if (found.length) {
      Kaynak.add(bot.owner, kind, dimId, found.slice(0, 8));
      bot.prog.explore = null;
      if (!bot.sendLocation(`Keşifte ${label} buldum (${Math.round(V.hdist(found[0], home))} blok ötede).`))
        bot.say(`Keşifte ${label} buldum (${Math.round(V.hdist(found[0], home))} blok ötede).`);
      if (yield* bot.travelTo(found[0], { near: 6, speed: RUN })) return true;
    }
  }
  return "more";
}

/** Kütüğün üstünde/yanında yaprak var mı (ev kirişini ağaçla karıştırmamak için). */
function looksLikeTree(bot, p, leafTypes) {
  const set = new Set(leafTypes);
  for (let dy = 1; dy <= 6; dy++)
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = safe(() => bot.dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz })?.typeId);
      if (t && set.has(t)) return true;
    }
  return false;
}

// ======================================================================= oduncu
function treeBase(bot, p, logType) {
  let c = { ...p };
  for (let i = 0; i < 40; i++) {
    const below = { x: c.x, y: c.y - 1, z: c.z };
    const t = safe(() => bot.dim.getBlock(below)?.typeId);
    if (t === logType) c = below;
    else return B.SOIL_FOR_SAPLING.has(t) || t === M("netherrack") ? c : null;
  }
  return null;
}

function treeBlocks(bot, base, logType, leafTypes) {
  const logs = [];
  const seen = new Set([V.key(base)]);
  const q = [base];
  let leaves = 0;
  while (q.length && logs.length < 160) {
    const c = q.shift();
    logs.push(c);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = 0; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const n = { x: c.x + dx, y: c.y + dy, z: c.z + dz };
          const k = V.key(n);
          if (seen.has(k)) continue;
          seen.add(k);
          const t = safe(() => bot.dim.getBlock(n)?.typeId);
          if (t === logType) q.push(n);
          else if (t && leafTypes.includes(t)) leaves++;
        }
  }
  return { logs, leaves };
}

/** Yere düşen fidan/elma/çubukları topla, kesilen yerlere fidan dik. */
function* sweepAndReplant(bot, T, radius = 12) {
  const saps = new Set(B.LOGS.map((l) => l.sapling));
  const want = (id) => saps.has(id) || id === M("apple") || id === M("stick") || B.LOG_OF_BLOCK.has(id);
  let n = 0;
  for (let pass = 0; pass < 6; pass++) {
    const items = safe(() => bot.dim.getEntities({ type: "minecraft:item", location: bot.loc, maxDistance: radius }), [])
      .filter((it) => want(safe(() => it.getComponent("minecraft:item")?.itemStack?.typeId, "")))
      .filter((it) => bot.withinRange(it.location));
    if (!items.length) break;
    items.sort((a, b) => V.dist2(a.location, bot.loc) - V.dist2(b.location, bot.loc));
    const target = V.floor(items[0].location);
    bot.setStatus("Düşen fidanları topluyor");
    const ok = yield* bot.goTo(target, { range: 1, maxNodes: 1200, radius: radius + 6 });
    n += bot.pickupItems(2.5, want);
    if (!ok) bot.pickupItems(4, want);
  }
  if (T.replant === false) return n;
  const trees = bot.prog.trees ?? [];
  for (const t of trees.slice()) {
    const sap = t.sapling;
    if (bot.count(sap) <= 0) continue;
    const here = safe(() => bot.dim.getBlock(t.base)?.typeId);
    const below = safe(() => bot.dim.getBlock({ x: t.base.x, y: t.base.y - 1, z: t.base.z })?.typeId);
    if (here !== M("air") || !B.SOIL_FOR_SAPLING.has(below)) {
      if (here && here !== M("air")) bot.prog.trees = (bot.prog.trees ?? []).filter((x) => !V.eq(x.base, t.base));
      continue;
    }
    if (yield* bot.goReach(t.base, { maxNodes: 1500, radius: 24 })) {
      if (yield* bot.place(t.base, sap, { item: sap, sound: "dig.grass" })) {
        bot.prog.trees = (bot.prog.trees ?? []).filter((x) => !V.eq(x.base, t.base));
      }
    }
  }
  return n;
}

export function* lumberJob(bot) {
  const T = bot.task;
  const got = gotMap(bot);
  safe(() => bot.e.triggerEvent("aqualit:tick_on"));
  let misses = 0;
  while (leftOf(T, got) > 0) {
    yield; // her turda en az bir tik bekle: hiçbir durumda oyunu kilitlemez
    if (bot.cmd === "soft") {
      bot.cmd = null;
      break;
    }
    if (bot.isFull()) {
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      continue;
    }
    yield* sweepAndReplant(bot, T, 10);
    const want = (T.items ?? []).filter((t) => wants(T, got, t.key)).map((t) => B.LOG_BY_KEY[t.key]);
    const types = want.map((w) => w.log);
    const home = bot.home ?? bot.loc;
    const logsNear = bot.scan(types, bot.loc, 14, 10, 14, 30).concat(bot.scan(types, home, 26, 12, 26, 30));
    let base = null, info = null;
    const seen = new Set();
    for (const p of logsNear) {
      const t = safe(() => bot.dim.getBlock(p)?.typeId);
      const w = B.LOG_OF_BLOCK.get(t);
      if (!w || !bot.withinRange(p)) continue;
      const b = treeBase(bot, p, t);
      if (!b || seen.has(V.key(b)) || bot.ignored.has(V.key(b))) continue;
      seen.add(V.key(b));
      info = { w, t };
      base = b;
      break;
    }
    if (!base) {
      const leafTypes = want.flatMap((w) => w.leaves);
      if (yield* farSearch(bot, "agac", types, (p) => looksLikeTree(bot, p, leafTypes), "ağaç")) continue;
      if (++misses > 0) {
        bot.say(`Kesecek ağaç bulamadım (${rangeText(bot)} aradım). Uzaklık sınırını artırabilirsin.`);
        break;
      }
      bot.setAct("look");
      yield* wait(40);
      bot.setAct("none");
      continue;
    }
    misses = 0;
    const tree = treeBlocks(bot, base, info.t, info.w.leaves);
    if (tree.leaves < 3) {
      // yaprak yok: muhtemelen ev/yapı, dokunma
      bot.ignore(base);
      continue;
    }
    bot.setStatus(`Ağaç kesiyor · kalan ${leftOf(T, got)}`);
    const reached = yield* bot.goReach(base, { maxNodes: 2500, radius: 32 });
    if (!reached) {
      bot.ignore(base);
      continue;
    }
    const logs = tree.logs.sort((a, b) => a.y - b.y || V.dist2(a, base) - V.dist2(b, base));
    const cnt = (id, n) => {
      if (id === info.t) got[info.w.key] = (got[info.w.key] ?? 0) + n;
    };
    for (const lp of logs) {
      yield* bot.mine(lp, { count: cnt, act: "chop", speed: 0.7, keepAct: true, force: true });
    }
    if (T.leaves) {
      const leafSet = new Set(info.w.leaves);
      for (const lp of logs.slice(-6)) {
        for (let dx = -2; dx <= 2; dx++)
          for (let dy = -1; dy <= 2; dy++)
            for (let dz = -2; dz <= 2; dz++) {
              const q = { x: lp.x + dx, y: lp.y + dy, z: lp.z + dz };
              const t = safe(() => bot.dim.getBlock(q)?.typeId);
              if (t && leafSet.has(t)) yield* bot.mine(q, { act: "chop", speed: 0.4, keepAct: true, force: true });
            }
      }
    }
    bot.setAct("none");
    yield* wait(10);
    bot.pickupItems(7, (id) => id === info.w.sapling || id === M("apple") || id === M("stick") || id === info.t);
    // kesilen yeri hatırla; fidan varsa hemen dik, yoksa sonra toplayınca dikilir
    (bot.prog.trees ??= []).push({ base, sapling: info.w.sapling });
    if (bot.prog.trees.length > 24) bot.prog.trees.shift();
    if (T.replant !== false) {
      const below = safe(() => bot.dim.getBlock({ x: base.x, y: base.y - 1, z: base.z })?.typeId);
      if (bot.count(info.w.sapling) > 0 && B.SOIL_FOR_SAPLING.has(below)) {
        if (yield* bot.place(base, info.w.sapling, { item: info.w.sapling, sound: "dig.grass" })) {
          bot.prog.trees = bot.prog.trees.filter((x) => !V.eq(x.base, base));
        }
      }
    }
    bot.save();
  }
  // son tur: düşen fidanları topla ve dik
  yield* sweepAndReplant(bot, T, 14);
  const s = summary(T, got, B.LOG_BY_KEY);
  return yield* finishJob(bot, { keep: keepFor(bot), message: s ? `Görev tamamlandı: ${s} kütük kestim.` : "Görev bitti." });
}

// ======================================================================= çiftçi
function harvestDrops(crop) {
  return crop.drops.map(([id, a, b]) => [id, rand(a, b)]);
}

function* harvest(bot, p, crop, got) {
  const reached = yield* bot.goReach(p, { maxNodes: 2000, radius: 24 });
  if (!reached) {
    bot.ignore(p);
    return false;
  }
  const mainId = crop.drops[0][0];
  const cnt = (id, n) => {
    if (id === mainId) got[crop.key] = (got[crop.key] ?? 0) + n;
  };
  bot.face(p);
  bot.setAct("hoe");
  yield* wait(8);
  const blk = safe(() => bot.dim.getBlock(p));
  if (!blk || blk.typeId !== crop.block) {
    bot.setAct("none");
    return true;
  }
  if (crop.kind === "column") {
    // en alttakini bırak, üsttekileri kes
    let bottom = { ...p };
    for (let i = 0; i < 24; i++) {
      const b = { x: bottom.x, y: bottom.y - 1, z: bottom.z };
      if (safe(() => bot.dim.getBlock(b)?.typeId) === crop.block) bottom = b;
      else break;
    }
    let top = { x: bottom.x, y: bottom.y + 1, z: bottom.z };
    const col = [];
    while (safe(() => bot.dim.getBlock(top)?.typeId) === crop.block && col.length < 24) {
      col.push({ ...top });
      top = { x: top.x, y: top.y + 1, z: top.z };
    }
    for (const q of col.reverse()) {
      safe(() => bot.dim.setBlockType(q, "minecraft:air"));
      bot.collect([[mainId, 1]], { count: cnt });
      safe(() => bot.dim.playSound("dig.grass", V.mid(q)));
      yield* wait(3);
    }
  } else if (crop.kind === "fruit") {
    safe(() => bot.dim.setBlockType(p, "minecraft:air"));
    bot.collect(harvestDrops(crop), { count: cnt });
    safe(() => bot.dim.playSound("dig.wood", V.mid(p)));
  } else if (crop.kind === "bush" || crop.kind === "pod") {
    safe(() => blk.setPermutation(blk.permutation.withState(crop.state, crop.reset)));
    bot.collect(harvestDrops(crop), { count: cnt });
    safe(() => bot.dim.playSound("block.sweet_berry_bush.pick", V.mid(p)));
  } else {
    bot.collect(harvestDrops(crop), { count: cnt });
    safe(() => bot.dim.playSound("dig.grass", V.mid(p)));
    // yeniden ek
    if (crop.seed && bot.take(crop.seed, 1) > 0) {
      safe(() => blk.setPermutation(BlockPermutation.resolve(crop.block, { [crop.state]: 0 })));
    } else safe(() => bot.dim.setBlockType(p, "minecraft:air"));
  }
  bot.setAct("none");
  return true;
}

function isSource(bot, p) {
  const b = safe(() => bot.dim.getBlock(p));
  if (!b || b.typeId !== M("water")) return false;
  return safe(() => b.permutation.getState("liquid_depth"), 0) === 0;
}

function tillable(bot, p) {
  const t = safe(() => bot.dim.getBlock(p)?.typeId);
  const up = safe(() => bot.dim.getBlock({ x: p.x, y: p.y + 1, z: p.z })?.typeId);
  return !!t && B.TILLABLE.has(t) && !!up && (B.isAir(up) || (B.isPassableType(up) && !B.isWater(up) && !up.includes("_sapling")));
}

function* makeFarm(bot, crop, plots) {
  const home = bot.home ?? bot.loc;
  bot.setStatus("Tarla hazırlıyor");
  let center = null;
  const waters = bot.scan([M("water")], home, 16, 4, 16, 30).filter((p) => isSource(bot, p) && V.hdist(p, home) > 3);
  for (const w of waters) {
    let n = 0;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (tillable(bot, { x: w.x + dx, y: w.y, z: w.z + dz })) n++;
    if (n >= Math.min(plots, 8)) {
      center = w;
      break;
    }
  }
  if (!center) {
    // kendi su gözünü aç
    const spot = findFlatSpot(bot, home);
    if (!spot) {
      bot.say("Tarla açacak düz bir yer bulamadım.");
      return false;
    }
    let src = bot.scan([M("water")], bot.loc, 24, 8, 24, 10).find((p) => isSource(bot, p));
    if (!src) {
      const far = yield* bot.scanFar([M("water")], home, 64, 12, 6, (p) => isSource(bot, p));
      src = far[0];
      if (src) Kaynak.add(bot.owner, "su", bot.dim.id, far);
    }
    if (src) {
      bot.setStatus("Su getiriyor");
      if (V.hdist(src, bot.loc) > 24) yield* bot.travelTo(src, { near: 4 });
      if (yield* bot.goReach(src, { maxNodes: 3000, radius: 32 })) {
        bot.face(src);
        bot.setAct("place");
        safe(() => bot.dim.playSound("bucket.fill_water", V.mid(src)));
        yield* wait(15);
        bot.setAct("carry");
      }
      if (V.hdist(spot, bot.loc) > 24) yield* bot.travelTo(spot, { near: 3 });
      yield* bot.goReach(spot, { maxNodes: 3000, radius: 32 });
      bot.setAct("place");
      safe(() => bot.dim.setBlockType(spot, M("water")));
      safe(() => bot.dim.playSound("bucket.empty_water", V.mid(spot)));
      yield* wait(10);
      bot.setAct("none");
    } else {
      // su çok uzakta: Aqualit kova numarası
      bot.say("Yakında su yok, Aqualit kovamla suyu kendim getiriyorum.");
      yield* conjureWater(bot, spot);
    }
    center = spot;
  }
  // çapala ve ek
  const cells = [];
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = -4; dz <= 4; dz++) {
      if (!dx && !dz) continue;
      cells.push({ x: center.x + dx, y: center.y, z: center.z + dz });
    }
  cells.sort((a, b) => V.dist2(a, center) - V.dist2(b, center));
  let made = 0;
  if (crop.seed && bot.count(crop.seed) < plots) yield* bot.fetchFromChests((id) => id === crop.seed, plots);
  for (const q of cells) {
    if (made >= plots) break;
    if (!tillable(bot, q)) continue;
    if (!(yield* bot.goReach(q, { maxNodes: 1200, radius: 20 }))) continue;
    bot.face(q);
    bot.setAct("hoe");
    yield* wait(8);
    safe(() => bot.dim.getBlock({ x: q.x, y: q.y + 1, z: q.z })?.setType("minecraft:air"));
    safe(() => bot.dim.setBlockPermutation(q, BlockPermutation.resolve(M("farmland"), { moisturized_amount: 7 })));
    safe(() => bot.dim.playSound("dig.gravel", V.mid(q)));
    if (crop.seed && bot.take(crop.seed, 1) > 0) {
      safe(() => bot.dim.setBlockPermutation({ x: q.x, y: q.y + 1, z: q.z }, BlockPermutation.resolve(crop.block, { [crop.state]: 0 })));
    }
    made++;
  }
  bot.setAct("none");
  bot.prog.farmMade = true;
  if (made) bot.say(`${made} karelik ${crop.name} tarlası hazırladım.`);
  return made > 0;
}

/**
 * Su çok uzaksa: robot suyu yukarı fırlatır, su düşerken 3D Aqualit kovayı çıkarıp yakalar
 * ve tarlanın ortasına dökerek su gözü açar.
 */
export function* conjureWater(bot, spot) {
  bot.setStatus("Aqualit kovayla su getiriyor");
  yield* bot.goReach(spot, { maxNodes: 2000, radius: 32 });
  const dim = bot.dim;
  bot.face(spot);
  bot.setMove("none");
  const l = bot.loc;
  const hand = { x: l.x, y: l.y + 1.3, z: l.z };
  bot.setAct("water_throw");
  yield* wait(5);
  safe(() => dim.playSound("bucket.empty_water", hand, { pitch: 1.3, volume: 0.7 }));
  for (let i = 0; i <= 12; i++) { // su topu yükselir
    const p = { x: hand.x, y: hand.y + 3 * Math.sin((i / 12) * Math.PI / 2), z: hand.z };
    safe(() => dim.spawnParticle("aqualit:su_topu", p));
    yield;
  }
  // eldeki çapa kaybolur, 3D Aqualit kova görünür (kova robot modelinin parçası, water_catch/water_pour'da açılır)
  safe(() => bot.e.getComponent("minecraft:equippable")?.setEquipment("Mainhand", undefined));
  bot.setAct("water_catch");
  for (let i = 12; i >= 0; i--) { // su düşer, kova yakalar
    const p = { x: hand.x, y: hand.y + 0.6 + 3 * (1 - Math.cos((i / 12) * Math.PI / 2)), z: hand.z };
    safe(() => dim.spawnParticle("aqualit:su_topu", p));
    yield;
  }
  safe(() => dim.spawnParticle("aqualit:su_sicrama", { x: hand.x, y: hand.y + 1, z: hand.z }));
  safe(() => dim.playSound("bucket.fill_water", hand, { volume: 0.9 }));
  yield* wait(12);
  bot.face(spot);
  bot.setAct("water_pour");
  yield* wait(8);
  safe(() => dim.setBlockType(spot, M("water")));
  safe(() => dim.spawnParticle("aqualit:su_sicrama", { x: spot.x + 0.5, y: spot.y + 1, z: spot.z + 0.5 }));
  safe(() => dim.playSound("bucket.empty_water", V.mid(spot)));
  yield* wait(10);
  bot.setAct("none");
  bot.holdTool();
  return true;
}

function findFlatSpot(bot, home) {
  let best = null, bestN = 0;
  for (let r = 4; r <= 12; r += 4) {
    for (const d of [{ x: r, z: 0 }, { x: -r, z: 0 }, { x: 0, z: r }, { x: 0, z: -r }, { x: r, z: r }, { x: -r, z: -r }]) {
      const top = safe(() => bot.dim.getTopmostBlock({ x: Math.floor(home.x + d.x), z: Math.floor(home.z + d.z) }));
      if (!top) continue;
      const c = { x: top.x, y: top.y, z: top.z };
      if (!tillable(bot, c)) continue;
      let n = 0;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (tillable(bot, { x: c.x + dx, y: c.y, z: c.z + dz })) n++;
      if (n > bestN) {
        bestN = n;
        best = c;
      }
    }
    if (bestN >= 40) break;
  }
  return bestN >= 12 ? best : null;
}

function* plantEmpty(bot, crops) {
  const plantable = crops.filter((c) => c.plant);
  if (!plantable.length) return false;
  const home = bot.home ?? bot.loc;
  const fields = bot.scan([M("farmland")], home, 16, 4, 16, 40);
  let n = 0;
  for (const f of fields) {
    const up = { x: f.x, y: f.y + 1, z: f.z };
    const t = safe(() => bot.dim.getBlock(up)?.typeId);
    if (!t || !B.isAir(t)) continue;
    const crop = plantable.find((c) => bot.count(c.seed) > 0);
    if (!crop) break;
    if (!(yield* bot.goReach(up, { maxNodes: 1000, radius: 20 }))) continue;
    bot.face(up);
    bot.setAct("place");
    yield* wait(5);
    if (bot.take(crop.seed, 1) > 0) {
      safe(() => bot.dim.setBlockPermutation(up, BlockPermutation.resolve(crop.block, { [crop.state]: 0 })));
      n++;
    }
    bot.setAct("none");
    if (n >= 24) break;
  }
  return n > 0;
}

export function* farmerJob(bot) {
  const T = bot.task;
  const got = gotMap(bot);
  safe(() => bot.e.triggerEvent("aqualit:tick_on"));
  let waited = 0;
  let lastLeft = leftOf(T, got);
  while (leftOf(T, got) > 0) {
    yield; // her turda en az bir tik bekle: hiçbir durumda oyunu kilitlemez
    if (bot.cmd === "soft") {
      bot.cmd = null;
      break;
    }
    if (bot.isFull()) {
      yield* bot.goHome();
      yield* bot.deposit(keepFor(bot));
      continue;
    }
    const crops = (T.items ?? []).filter((t) => wants(T, got, t.key)).map((t) => B.CROP_BY_KEY[t.key]);
    const home = bot.home ?? bot.loc;
    const ripe = bot.scan(crops.map((c) => c.block), home, 16, 6, 16, 40)
      .filter((p) => bot.withinRange(p))
      .filter((p) => {
        const b = safe(() => bot.dim.getBlock(p));
        return b && B.isMature(B.CROP_OF_BLOCK.get(b.typeId), b);
      });
    if (ripe.length) {
      const p = ripe[0];
      const crop = B.CROP_OF_BLOCK.get(safe(() => bot.dim.getBlock(p)?.typeId));
      bot.setStatus(`Hasat ediyor · kalan ${leftOf(T, got)}`);
      yield* harvest(bot, p, crop, got);
      waited = 0;
      bot.save();
      continue;
    }
    // olgun yok: tarla yoksa kur, boş tarlaya ek
    const plantable = crops.filter((c) => c.plant);
    if (plantable.length && T.makeFarm !== false && !bot.prog.farmMade) {
      const fields = bot.scan([M("farmland")], home, 16, 4, 16, 4);
      const existing = bot.scan(plantable.map((c) => c.block), home, 16, 4, 16, 4);
      if (!fields.length && !existing.length) {
        const c = plantable[0];
        const need = leftOf(T, got);
        const per = c.key === "havuc" || c.key === "patates" ? 3 : 1;
        const made = yield* makeFarm(bot, c, clamp(Math.ceil(need / per), 4, 80));
        if (!made) {
          bot.prog.farmFail = (bot.prog.farmFail ?? 0) + 1;
          if (bot.prog.farmFail >= 3) {
            bot.say("Tarla kuramadım, görevi bırakıyorum. Düz bir yer ya da hazır bir tarla olursa tekrar denerim.");
            break;
          }
          bot.setStatus("Tarla yeri arıyor");
          yield* wait(600);
        }
        continue;
      }
    }
    // tohum yoksa sandıktan al
    for (const c of plantable) if (bot.count(c.seed) === 0) yield* bot.fetchFromChests((id) => id === c.seed, 16);
    const planted = yield* plantEmpty(bot, crops);
    if (!planted) {
      bot.setStatus("Ekinlerin büyümesini bekliyor");
      bot.setAct("sit");
      yield* wait(200);
      bot.setAct("none");
      waited += 200;
      const nowLeft = leftOf(T, got);
      if (nowLeft < lastLeft) {
        waited = 0;
        lastLeft = nowLeft;
      }
      if (waited > 20 * 60 * 25) {
        bot.say("Uzun süredir olgunlaşan ekin yok; topladıklarımı sandığa koyuyorum.");
        break;
      }
    }
  }
  const s = summary(T, got, B.CROP_BY_KEY);
  return yield* finishJob(bot, { keep: keepFor(bot), message: s ? `Görev tamamlandı: ${s} topladım.` : "Görev bitti." });
}

// ======================================================================= dağıtıcı
/** "Beni takip et": oyuncunun peşinden gelir (4 bloktan uzaklaşınca yürür, çok uzakta kalırsa yanına ışınlanır). */
export function* takipIsi(bot) {
  const T = bot.task;
  bot.say(`Peşindeyim, ${T.ad}!`);
  for (;;) {
    if (bot.task !== T || T.done || T.paused) return;
    // hedef: oyuncu, robot ya da Keşif (varlık kimliği)
    const pl = world.getAllPlayers().find((p) => p.id === T.kim) ?? safe(() => world.getEntity(T.kim));
    if (!pl || !safe(() => pl.isValid, false) || safe(() => pl.dimension.id) !== bot.dim.id) {
      bot.setMove("none");
      bot.setStatus(`${T.ad} bekleniyor`);
      yield* wait(40);
      continue;
    }
    const at = pl.location;
    const d = V.dist(bot.loc, at);
    if (d > 48) {
      // çok geride kaldı: oyuncunun arkasına ışınlanır (evcil hayvanlar gibi)
      const dir = safe(() => pl.getViewDirection(), { x: 0, y: 0, z: 1 });
      safe(() => bot.e.teleport({ x: at.x - dir.x * 2, y: at.y, z: at.z - dir.z * 2 }));
      yield* wait(10);
      continue;
    }
    if (d > 4) {
      bot.setStatus(`${T.ad} takip ediliyor`);
      yield* bot.goTo(V.floor(at), { range: 3, maxNodes: 1500, radius: 48, run: d > 12 });
    } else {
      bot.setMove("none");
      bot.face(at);
      yield* wait(10);
    }
    yield;
  }
}

export function jobFor(bot) {
  if (!bot.task || bot.task.done || bot.task.paused) return idleJob(bot);
  if (bot.task.mode === "yagma") return yagmaGorevi(bot);
  if (bot.task.mode === "takip") return takipIsi(bot);
  switch (bot.type) {
    case "madenci": return minerJob(bot);
    case "kurekci": return diggerJob(bot);
    case "ciftci": return farmerJob(bot);
    case "oduncu": return lumberJob(bot);
    case "insaatci": return mimarJob(bot);
    default: return idleJob(bot);
  }
}
