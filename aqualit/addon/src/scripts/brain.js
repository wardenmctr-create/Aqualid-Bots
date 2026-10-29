// Aqualit Robotları — robot beyni: tüm robotları her tik çalıştırır
import { world, system } from "@minecraft/server";
import { Bot } from "./bot.js";
import { jobFor, idleJob, returnJob } from "./jobs.js";
import { kilicliInit, kilicliTick } from "./kilicli.js";
import { wireChain } from "./powers.js";
import { wireTeam } from "./takim.js";
import { ROBOT_ID } from "./constants.js";
import { safe, log } from "./util.js";
import { Budget } from "./budget.js";
import { Robots, getJSON, setJSON, setProp } from "./store.js";

export const bots = new Map(); // varlık kimliği -> Bot

export function getBot(entity) {
  if (!entity || safe(() => entity.typeId) !== ROBOT_ID) return undefined;
  let b = bots.get(entity.id);
  if (!b) {
    b = new Bot(entity);
    bots.set(entity.id, b);
    begin(b);
  } else if (b.e !== entity) {
    b.e = entity;
  }
  return b;
}

wireChain(getBot); // yıldırım kılıcı: vuruşlar zincirleme atlar
wireTeam(getBot); // takım arkadaşına saldırı olunca kılıçlılar yardıma koşar

export function botByRid(rid) {
  for (const b of bots.values()) if (b.rid === rid) return b;
  return undefined;
}

function begin(b) {
  if (!b.owner) return; // henüz kurulmadı
  if (b.type === "kilicli") {
    kilicliInit(b);
    return;
  }
  b.holdTool();
  b.job = jobFor(b);
  b.jobName = b.task && !b.task.done && !b.task.paused ? "gorev" : "bekleme";
  // telsizden, robot uzaktayken verilmiş komut
  const k = `aq:pending:${b.rid}`;
  const p = getJSON(world, k, null);
  if (p) {
    setJSON(world, k, undefined);
    system.run(() => commandReturn(b, p.cmd === "soft"));
  }
}

/** Robotu yeni bir işe başlat (eski iş bırakılır). */
export function startJob(b, gen, name) {
  b.setMove("none");
  b.setAct("none");
  b.abortMove = false;
  b.job = gen;
  b.jobName = name;
  b.updateIndex(true);
}

export function startTask(b) {
  b.prog = {};
  if (b.task?.maxDist) {
    b.maxDist = b.task.maxDist;
    setProp(b.e, "aq:maxd", b.task.maxDist);
  }
  b.ignored.clear();
  b.cmd = null;
  if (b.task) {
    b.task.done = false;
    b.task.paused = false;
    b.saveTask();
  }
  b.resetTrail();
  b.save(true);
  startJob(b, jobFor(b), "gorev");
}

export function commandReturn(b, soft) {
  if (b.type === "kilicli") return;
  if (soft) {
    if (b.jobName === "gorev") {
      b.cmd = "soft";
      b.say("Tamam, yakındakileri toplayıp döneceğim.");
    } else startJob(b, returnJob(b, false), "donus");
  } else {
    b.say("Hemen geliyorum!");
    startJob(b, returnJob(b, true), "donus");
  }
}

export function commandStop(b) {
  if (b.task) {
    b.task.paused = true;
    b.saveTask();
  }
  startJob(b, idleJob(b), "bekleme");
}

export function commandResume(b) {
  if (!b.task) return false;
  b.task.paused = false;
  b.task.done = false;
  b.saveTask();
  b.cmd = null;
  startJob(b, jobFor(b), "gorev");
  return true;
}

let scanned = false;
function scanAll() {
  for (const id of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    const dim = safe(() => world.getDimension(id));
    if (!dim) continue;
    for (const e of safe(() => dim.getEntities({ type: ROBOT_ID }), [])) getBot(e);
  }
  scanned = true;
}

world.afterEvents.worldLoad.subscribe(() => system.runTimeout(scanAll, 20));
world.afterEvents.entityLoad.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) === ROBOT_ID) system.run(() => getBot(ev.entity));
});
world.afterEvents.entityRemove.subscribe((ev) => {
  if (ev.typeId === ROBOT_ID) bots.delete(ev.removedEntityId);
});

function tickBot(id, b) {
  if (!b.valid) {
    bots.delete(id);
    return;
  }
  if (!b.owner) return;
  if (b.type === "kilicli") {
    try {
      kilicliTick(b);
    } catch (e) {
      log("kılıçlı hata", e, e?.stack);
    }
    return;
  }
  if (!b.job) return;
  try {
    const r = b.job.next();
    if (r.done) {
      b.job = idleJob(b);
      b.jobName = "bekleme";
    }
  } catch (e) {
    log("robot hata", b.name, e, e?.stack);
    b.errors = (b.errors ?? 0) + 1;
    b.setMove("none");
    b.setAct("think");
    if (b.errors < 5 && b.jobName === "gorev") {
      b.job = jobFor(b);
    } else {
      b.say("Kafam karıştı, görevi bıraktım. Bana yeniden görev verebilirsin.");
      b.job = idleJob(b);
      b.jobName = "bekleme";
      b.errors = 0;
    }
  }
  b.updateIndex();
}

// Her tik robotlar sırayla çalışır; süre bütçesi dolarsa kalanlar bir sonraki tike kalır (dönüşümlü).
let rr = 0;
system.runInterval(() => {
  Budget.begin();
  if (!scanned && system.currentTick > 100) scanAll();
  const list = [...bots.entries()];
  const n = list.length;
  if (!n) return;
  const first = rr % n;
  for (let k = 0; k < n; k++) {
    const [id, b] = list[(first + k) % n];
    tickBot(id, b);
    if (k < n - 1 && Budget.over()) {
      rr = first + k + 1;
      return;
    }
  }
  rr = first + 1;
}, 1);
