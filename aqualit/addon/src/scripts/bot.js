// Aqualit Robotları — robot denetleyicisi (hareket, envanter, eylemler)
import { world, system, ItemStack, BlockVolume, BlockPermutation } from "@minecraft/server";
import { V, DIRS4, DIRS6, wait, yawOf, safe, log, clamp, rand } from "./util.js";
import { Grid, findPath, canReach } from "./path.js";
import { getJSON, setJSON, getProp, setProp, Robots, Chests } from "./store.js";
import { getSandik, resolveId, standSpot } from "./sandik.js";
import { sendMessage } from "./messages.js";
import * as B from "./blocks.js";
import { TYPE_TOOL, TYPE_NAME, CHEST_ID, ROBOT_ID } from "./constants.js";
import { Budget } from "./budget.js";

const ACT2 = new Set(["p_hook", "p_sword", "p_dash", "p_dome", "p_thunder", "water_throw", "water_catch", "water_pour", "kit",
  "fly", "hat_off", "hat_hold", "hat_on"]);
const ACT_FOR_TYPE = { madenci: "mine", kurekci: "dig", ciftci: "hoe", oduncu: "chop", kilicli: "attack", insaatci: "place" };
const WALK = 0.16;
const RUN = 0.27;

function encodeTrail(t) {
  return t.map((p) => `${p.x},${p.y},${p.z}`).join(";");
}
function decodeTrail(s) {
  if (typeof s !== "string" || !s) return [];
  return s.split(";").map((k) => V.parse(k)).filter((p) => Number.isFinite(p.x));
}

export class Bot {
  constructor(e) {
    this.e = e;
    this.id = e.id;
    this.reload();
    this.job = null;
    this.jobName = "";
    this.cmd = null;
    this._move = safe(() => e.getProperty("aqualit:move"), "none");
    const a2 = safe(() => e.getProperty("aqualit:act2"), "none");
    this._act = a2 && a2 !== "none" ? a2 : safe(() => e.getProperty("aqualit:act"), "none");
    this.ignored = new Set();
    this.idleTicks = 0;
    this.lastSave = 0;
    this.lastIndex = 0;
    this.trailDirty = false;
  }

  reload() {
    const e = this.e;
    this.owner = getProp(e, "aq:owner", "");
    this.ownerName = getProp(e, "aq:ownerName", "");
    this.rid = getProp(e, "aq:rid", "");
    this.type = getProp(e, "aq:type", safe(() => e.getProperty("aqualit:type"), "madenci"));
    this.model = getProp(e, "aq:model", 1);
    this.name = getProp(e, "aq:name", "Robot");
    this.home = getProp(e, "aq:home", undefined);
    this.homeDim = getProp(e, "aq:homeDim", "minecraft:overworld");
    this.chestId = getProp(e, "aq:chest", "");
    this.maxDist = getProp(e, "aq:maxd", 64);
    this.task = getJSON(e, "aq:task", null);
    this.prog = getJSON(e, "aq:prog", {});
    this.trail = decodeTrail(getProp(e, "aq:trail", ""));
    this.trailIndex = new Map(this.trail.map((p, i) => [V.key(p), i]));
    this.status = getProp(e, "aq:status", "Bekliyor");
  }

  get valid() {
    return safe(() => this.e.isValid, false);
  }
  get dim() {
    return this.e.dimension;
  }
  get loc() {
    return this.e.location;
  }
  get cell() {
    const l = this.e.location;
    return { x: Math.floor(l.x), y: Math.floor(l.y + 0.6), z: Math.floor(l.z) };
  }
  get entry() {
    return { rid: this.rid, name: this.name, type: this.type, model: this.model };
  }

  // ---------------------------------------------------------------- kayıt
  save(force = false) {
    const now = system.currentTick;
    if (!force && now - this.lastSave < 40) return;
    this.lastSave = now;
    setJSON(this.e, "aq:prog", this.prog);
    setProp(this.e, "aq:status", this.status);
    if (this.trailDirty) {
      const t = this.trail.length > 1200 ? this.trail.slice(-1200) : this.trail;
      setProp(this.e, "aq:trail", encodeTrail(t));
      this.trailDirty = false;
    }
  }
  saveTask() {
    setJSON(this.e, "aq:task", this.task);
  }
  updateIndex(force = false) {
    const now = system.currentTick;
    if (!force && now - this.lastIndex < 100) return;
    this.lastIndex = now;
    if (!this.owner || !this.rid) return;
    const l = this.loc;
    Robots.upsert(this.owner, {
      rid: this.rid,
      eid: this.id,
      name: this.name,
      type: this.type,
      model: this.model,
      dim: this.dim.id,
      pos: { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) },
      home: this.home,
      homeDim: this.homeDim,
      status: this.status,
      job: this.jobName,
      upd: Date.now(),
    });
  }

  /** Sahibine konum gönder (konum çubuğunda iğne çıkar). */
  sendLocation(why) {
    return sendLocationHook(this, why);
  }

  say(text, opts) {
    if (!this.owner) return null;
    const now = system.currentTick;
    this._said ??= new Map();
    if (!opts?.force && now - (this._said.get(text) ?? -99999) < 20 * 60) return null; // aynı mesajı 1 dk içinde tekrarlama
    this._said.set(text, now);
    if (this._said.size > 40) this._said = new Map([...this._said].slice(-20));
    this.beep();
    return sendMessage(this.owner, this.entry, text, opts);
  }

  /** Konuşurken bip-bop sesi (çok sık konuşursa susar). */
  beep(volume = 0.8) {
    const now = system.currentTick;
    if (now - (this._lastBeep ?? -100) < 30) return;
    this._lastBeep = now;
    safe(() => this.dim.playSound("aqualit.robot.beep", this.loc, { volume, pitch: 0.9 + Math.random() * 0.25 }));
  }

  setStatus(s) {
    if (this.status !== s) {
      this.status = s;
      this.updateIndex(true);
    }
  }

  // ---------------------------------------------------------------- animasyon
  setMove(m) {
    if (this._move !== m) {
      this._move = m;
      safe(() => this.e.setProperty("aqualit:move", m));
    }
  }
  setAct(a) {
    if (this._act !== a) {
      this._act = a;
      // Bedrock enum özelliği en fazla 16 değer alır: yeni hareketler ikinci özellikte
      const two = ACT2.has(a);
      safe(() => this.e.setProperty("aqualit:act", two ? "none" : a));
      safe(() => this.e.setProperty("aqualit:act2", two ? a : "none"));
    }
  }
  workAct() {
    return ACT_FOR_TYPE[this.type] ?? "mine";
  }

  holdTool(itemId) {
    const id = itemId ?? TYPE_TOOL[this.type];
    const ok = safe(() => {
      const eq = this.e.getComponent("minecraft:equippable");
      if (!eq) return false;
      return eq.setEquipment("Mainhand", new ItemStack(id, 1));
    }, false);
    if (!ok) safe(() => this.e.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${id} 1`));
  }

  // ---------------------------------------------------------------- yönelme / ışınlanma
  tp(pos, yaw) {
    safe(() => this.e.teleport(pos, { rotation: { x: 0, y: yaw ?? this.e.getRotation().y }, keepVelocity: false }));
  }
  face(p) {
    const l = this.loc;
    const yaw = yawOf(p.x + 0.5 - l.x, p.z + 0.5 - l.z);
    safe(() => this.e.setRotation({ x: 0, y: yaw }));
  }

  standPos(c) {
    const below = safe(() => this.dim.getBlock({ x: c.x, y: c.y - 1, z: c.z }));
    const off = below ? B.lowOffset(below) : 0;
    return { x: c.x + 0.5, y: c.y - off, z: c.z + 0.5 };
  }

  recordCell(c) {
    const k = V.key(c);
    const i = this.trailIndex.get(k);
    if (i !== undefined) {
      if (i < this.trail.length - 1) {
        for (let j = i + 1; j < this.trail.length; j++) this.trailIndex.delete(V.key(this.trail[j]));
        this.trail.length = i + 1;
        this.trailDirty = true;
      }
      return;
    }
    this.trail.push(c);
    this.trailIndex.set(k, this.trail.length - 1);
    this.trailDirty = true;
  }
  resetTrail() {
    this.trail = [];
    this.trailIndex = new Map();
    if (this.home) this.recordCell(V.floor({ x: this.home.x, y: this.home.y + 0.6, z: this.home.z }));
    this.trailDirty = true;
  }

  /** Hücre yolunu adım adım yürür. dig=true ise yoldaki doğal blokları kazar. */
  *follow(path, opts = {}) {
    const speed = opts.speed ?? WALK;
    if (!path || path.length < 2) return true;
    this.setMove(speed > 0.2 ? "run" : "walk");
    for (let i = 1; i < path.length; i++) {
      if (this.abortMove) break;
      const c = path[i];
      const prev = path[i - 1];
      // kazı: hedef hücre (ve yukarı çıkarken baş üstü) açık değilse kaz
      if (opts.dig) {
        if (c.y > prev.y) {
          const head = { x: prev.x, y: prev.y + 1, z: prev.z };
          if (!this.cellOpen(head)) {
            this.setMove("none");
            if (!(yield* this.mine(head, { quiet: true, dig: true, filter: this.digFilter }))) return false;
          }
        }
        if (!this.cellOpen(c)) {
          this.setMove("none");
          if (!(yield* this.mine(c, { quiet: true, dig: true, filter: this.digFilter }))) return false;
        }
        if (opts.tall) {
          const h = { x: c.x, y: c.y + 1, z: c.z };
          const ht = safe(() => this.dim.getBlock(h)?.typeId, null);
          if (ht && B.isNatural(ht) && !B.isProtected(ht)) {
            this.setMove("none");
            yield* this.mine(h, { quiet: true, dig: true, filter: this.digFilter });
          }
        }
        this.setMove(speed > 0.2 ? "run" : "walk");
      } else if (!this.cellOpen(c)) {
        this.setMove("none");
        return false;
      }
      yield* this.doorAt(c);
      const target = this.standPos(c);
      const from = this.loc;
      const dy = target.y - from.y;
      const pts = [];
      if (dy > 0.2) pts.push({ x: from.x + (target.x - from.x) * 0.3, y: target.y + 0.15, z: from.z + (target.z - from.z) * 0.3 });
      else if (dy < -0.6) pts.push({ x: target.x, y: from.y, z: target.z });
      pts.push(target);
      for (const tgt of pts) {
        let guard = 0;
        while (guard++ < 80) {
          const loc = this.loc;
          const d = V.sub(tgt, loc);
          const L = V.len(d);
          const yaw = Math.abs(d.x) + Math.abs(d.z) > 0.02 ? yawOf(d.x, d.z) : undefined;
          const sp = dy > 0.2 && tgt !== target ? speed * 1.6 : speed;
          if (L <= sp) {
            this.tp(tgt, yaw);
            break;
          }
          this.tp(V.add(loc, V.mul(d, sp / L)), yaw);
          yield;
        }
      }
      this.recordCell(c);
      this.save();
    }
    this.setMove("none");
    return true;
  }

  cellOpen(p) {
    const t = safe(() => this.dim.getBlock(p)?.typeId, null);
    if (t === null) return false;
    return B.isPassableType(t) && !B.isDanger(t);
  }

  *doorAt(c) {
    const b = safe(() => this.dim.getBlock(c));
    if (!b || !B.isDoor(b.typeId)) return;
    const open = safe(() => b.permutation.getState("open_bit"));
    if (open === false) {
      safe(() => b.setPermutation(b.permutation.withState("open_bit", true)));
      safe(() => this.dim.playSound("random.door_open", c));
      later(this, 30, () => {
        const bb = safe(() => this.dim.getBlock(c));
        if (bb && B.isDoor(bb.typeId)) safe(() => bb.setPermutation(bb.permutation.withState("open_bit", false)));
        safe(() => this.dim.playSound("random.door_close", c));
      });
    }
  }

  /** Hedefe yürü. goal(p)->bool, h(p)->sayı. */
  *walkTo(goal, h, opts = {}) {
    const g = new Grid(this.dim);
    this.markChests(g);
    if (opts.dig) g.allowDig = true;
    const start = this.cell;
    if (goal(start)) return true;
    const path = yield* (opts.dig ? findDigPath(g, start, goal, h, opts) : findPath(g, start, goal, h, opts));
    if (!path) return false;
    return yield* this.follow(path, opts);
  }

  /** (x,z) sütununda robotun durabileceği yüzey hücresi: yaprak ve kütüklerin altındaki zemini bulur. */
  surfaceAt(x, z) {
    const top = safe(() => this.dim.getTopmostBlock({ x, z }));
    if (!top) return null;
    let y = top.y;
    for (let k = 0; k < 28; k++, y--) {
      const t = safe(() => this.dim.getBlock({ x, y, z })?.typeId);
      if (!t) return null;
      if (B.isWater(t)) return { x, y, z }; // su yüzeyi: yüzerek geçilir
      if (B.isDanger(t)) return null;
      if (B.isPassableType(t) || t.includes("leaves") || t.endsWith("_log") || t.endsWith("_stem") || t.includes("vine")) continue;
      return { x, y: y + 1, z };
    }
    return null;
  }

  /**
   * Uzak hedefe yürür: yolu ~22 blokluk bacaklara böler, her bacakta kısa yol bulur.
   * Yürüdükçe çevresi yüklenir; yüzlerce blok öteye gidebilir. near: varınca hedefe uzaklık.
   */
  *travelTo(target, opts = {}) {
    const near = opts.near ?? 2.5;
    const speed = opts.speed;
    let stuck = 0;
    for (let leg = 0; leg < 80; leg++) {
      if (this.abortMove) return false;
      const here = this.loc;
      const d = V.hdist(here, target);
      if (d <= 18) {
        const tc = V.floor(target);
        const ok = yield* this.walkTo((c) => V.dist(c, target) <= near + 0.5, (c) => V.manhattan(c, tc),
          { maxNodes: 2500, radius: 30, partial: true, speed });
        return ok || V.hdist(this.loc, target) <= near + 1.5;
      }
      const step = Math.min(22, d - 8);
      const ux = (target.x - here.x) / d, uz = (target.z - here.z) / d;
      const order = stuck ? [stuck * 35, -stuck * 35, 0, 70, -70, 110, -110] : [0, 20, -20, 45, -45, 75, -75];
      let wp = null;
      for (const deg of order) {
        const a = (deg * Math.PI) / 180;
        const dx = ux * Math.cos(a) - uz * Math.sin(a), dz = ux * Math.sin(a) + uz * Math.cos(a);
        wp = this.surfaceAt(Math.floor(here.x + dx * step), Math.floor(here.z + dz * step));
        if (wp) break;
      }
      if (!wp) return false;
      yield* this.walkTo((c) => V.hdist(c, wp) <= 3 && Math.abs(c.y - wp.y) <= 4, (c) => V.manhattan(c, wp),
        { maxNodes: 2500, radius: 34, partial: true, speed });
      const after = V.hdist(this.loc, target);
      if (d - after < 3) {
        if (++stuck >= 4) return false;
      } else stuck = 0;
      yield;
    }
    return false;
  }

  *goTo(p, opts = {}) {
    const range = opts.range ?? 0;
    return yield* this.walkTo(
      (c) => V.manhattan(c, p) <= range,
      (c) => V.manhattan(c, p),
      opts
    );
  }

  *goReach(b, opts = {}) {
    return yield* this.walkTo((c) => canReach(c, b), (c) => V.manhattan(c, b), opts);
  }

  markChests(g) {
    const ents = safe(() => this.dim.getEntities({ type: CHEST_ID, location: this.loc, maxDistance: 48 }), []);
    for (const ch of ents) g.blocked.add(V.key(V.floor(ch.location)));
  }

  // ---------------------------------------------------------------- kazma
  /** Bir bloğu kazar ve düşenleri toplar. opts: {filter(id)->bool, dig, quiet, count(id,n)} */
  *mine(p, opts = {}) {
    const blk = safe(() => this.dim.getBlock(p));
    if (!blk) return false;
    const t = blk.typeId;
    if (B.isAir(t) || B.isWater(t) || B.isLava(t)) return true;
    if (t === "minecraft:bedrock" || (B.isProtected(t) && !opts.force)) return false;
    if (opts.dig && !B.isNatural(t) && !B.isPassableType(t)) return false;
    this.face(p);
    this.setAct(opts.act ?? this.workAct());
    const ticks = Math.max(2, Math.round(B.mineTicks(t) * (opts.speed ?? 1)));
    const hit = B.digSound(t).replace("dig.", "hit.");
    for (let i = 0; i < ticks; i++) {
      if (i % 4 === 0) safe(() => this.dim.playSound(hit, V.mid(p), { volume: 0.5 }));
      yield;
    }
    const now = safe(() => this.dim.getBlock(p));
    if (!now || now.typeId !== t) {
      this.setAct("none");
      return true;
    }
    const perm = now.permutation;
    const drops = B.dropsFor(t, perm);
    safe(() => this.dim.setBlockType(p, "minecraft:air"));
    safe(() => this.dim.playSound(B.digSound(t), V.mid(p)));
    safe(() => this.dim.spawnParticle("minecraft:basic_smoke_particle", V.mid(p)));
    this.collect(drops, opts);
    if (!opts.noSeal) this.sealLava(p);
    if (!opts.keepAct) this.setAct("none");
    return true;
  }

  /** Açılan boşluğun yanında lav varsa taşla kapatır (robotun durduğu yer hariç). */
  sealLava(p) {
    for (const d of DIRS6) {
      const q = V.add(p, d);
      const t = safe(() => this.dim.getBlock(q)?.typeId, null);
      if (t && B.isLava(t)) {
        const use = this.count("minecraft:cobblestone") > 0 ? "minecraft:cobblestone"
          : this.count("minecraft:cobbled_deepslate") > 0 ? "minecraft:cobbled_deepslate" : "minecraft:cobblestone";
        this.take(use, 1);
        safe(() => this.dim.setBlockType(q, use));
        if (!this.prog.lavaWarned) {
          this.prog.lavaWarned = true;
          this.say("Lav buldum, taşla kapattım.");
        }
      }
    }
  }

  collect(drops, opts = {}) {
    for (const [id, n] of drops) {
      if (n <= 0) continue;
      if (opts.filter && !opts.filter(id)) continue;
      const left = this.addItem(id, n);
      if (opts.count) opts.count(id, n - left);
      if (left > 0) {
        this.full = true;
        safe(() => this.dim.spawnItem(new ItemStack(id, left), this.loc));
      }
    }
  }

  // ---------------------------------------------------------------- envanter
  get inv() {
    return safe(() => this.e.getComponent("minecraft:inventory")?.container);
  }
  addItem(id, n) {
    const c = this.inv;
    if (!c) return n;
    let left = n;
    while (left > 0) {
      const max = safe(() => new ItemStack(id, 1).maxAmount, 64);
      const amt = Math.min(left, max);
      const rest = safe(() => c.addItem(new ItemStack(id, amt)));
      if (rest) {
        left -= amt - rest.amount;
        return left;
      }
      left -= amt;
    }
    return 0;
  }
  addStack(stack) {
    const c = this.inv;
    if (!c) return stack;
    return safe(() => c.addItem(stack), stack);
  }
  count(id) {
    const c = this.inv;
    if (!c) return 0;
    let n = 0;
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it && it.typeId === id) n += it.amount;
    }
    return n;
  }
  take(id, n) {
    const c = this.inv;
    if (!c) return 0;
    let got = 0;
    for (let i = 0; i < c.size && got < n; i++) {
      const it = c.getItem(i);
      if (!it || it.typeId !== id) continue;
      const use = Math.min(it.amount, n - got);
      got += use;
      if (use >= it.amount) c.setItem(i, undefined);
      else {
        it.amount -= use;
        c.setItem(i, it);
      }
    }
    return got;
  }
  freeSlots() {
    return safe(() => this.inv.emptySlotsCount, 0);
  }
  isFull() {
    return this.full || this.freeSlots() <= 1;
  }
  contents() {
    const c = this.inv;
    const m = new Map();
    if (!c) return m;
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it) m.set(it.typeId, (m.get(it.typeId) ?? 0) + it.amount);
    }
    return m;
  }
  isEmptyInv() {
    return this.contents().size === 0;
  }

  // ---------------------------------------------------------------- yerleştirme
  *place(p, typeId, opts = {}) {
    const b = safe(() => this.dim.getBlock(p));
    if (!b) return false;
    if (!B.isAir(b.typeId) && !B.isPassableType(b.typeId) && !opts.replace) return false;
    this.face(p);
    this.setAct("place");
    yield* wait(6);
    if (opts.item) {
      if (this.take(opts.item, 1) < 1 && !opts.free) {
        this.setAct("none");
        return false;
      }
    }
    safe(() => (opts.permutation ? b.setPermutation(opts.permutation) : b.setType(typeId)));
    safe(() => this.dim.playSound(opts.sound ?? "dig.grass", V.mid(p)));
    yield* wait(4);
    this.setAct("none");
    return true;
  }

  // ---------------------------------------------------------------- sandıklar
  homeChest() {
    if (!this.chestId) return undefined;
    // yeni Aqualit sandığı (blok); eski kimlikler (taşınan varlık sandığı) kendiliğinden çevrilir
    const id = resolveId(this.chestId);
    const h = getSandik(id);
    if (h) {
      if (id !== this.chestId) {
        this.chestId = id;
        setProp(this.e, "aq:chest", id);
        const home = standSpot(h);
        if (!this.home || V.dist(this.home, home) > 0.6) {
          this.home = home;
          this.homeDim = h.dimension?.id ?? this.homeDim;
          setProp(this.e, "aq:home", home);
          setProp(this.e, "aq:homeDim", this.homeDim);
        }
      }
      return h.isValid ? h : undefined;
    }
    // henüz taşınmamış eski varlık sandığı
    const ch = safe(() => world.getEntity(this.chestId));
    return ch && safe(() => ch.isValid, false) ? ch : undefined;
  }
  canUseChest(ch) {
    const owner = getProp(ch, "aq:owner", "");
    if (owner !== this.owner) return false;
    const kind = safe(() => ch.getProperty("aqualit:kind"), "genel");
    const acc = getJSON(ch, "aq:access", { deny: [], allow: [] });
    if ((acc.deny ?? []).includes(this.rid)) return false;
    if ((acc.allow ?? []).includes(this.rid)) return true;
    if (acc.only) return false;
    return kind === "genel" || kind === this.type || ch.id === this.chestId;
  }
  chestsNear(center, radius = 16) {
    const out = [];
    const seen = new Set();
    for (const c of Chests.list(this.owner)) {
      if (c.dim !== this.dim.id || !c.pos || V.dist(c.pos, center) > radius + 1) continue;
      const h = getSandik(c.cid);
      if (!h || seen.has(h.id) || !h.isValid || !this.canUseChest(h)) continue;
      seen.add(h.id);
      out.push(h);
    }
    // henüz taşınmamış eski varlık sandıkları
    const ents = safe(() => this.dim.getEntities({ type: CHEST_ID, location: center, maxDistance: radius }), []);
    for (const e of ents) if (this.canUseChest(e)) out.push(e);
    return out;
  }

  /** Eve dön (sandığın yanına). */
  *goHome(opts = {}) {
    if (!this.home) return false;
    if (this.dim.id !== this.homeDim) {
      this.say("Sandığım başka bir boyutta, dönemiyorum. Beni o boyuta götürür müsün?");
      return false;
    }
    const target = V.floor(this.home);
    const speed = opts.run ? RUN : WALK;
    this.setStatus("Eve dönüyor");
    if (V.dist(this.loc, this.home) > 2.5) {
      // önce kısa yol dene
      if (V.dist(this.loc, this.home) < 40) {
        const ok = yield* this.walkTo((c) => V.hdist(c, target) <= 1.6 && Math.abs(c.y - target.y) <= 1,
          (c) => V.manhattan(c, target), { speed, maxNodes: 2500, radius: 48 });
        if (ok) return true;
      }
      // geldiği izi geri yürü
      const back = this.trail.slice().reverse();
      const here = this.cell;
      let startIdx = back.findIndex((p) => V.manhattan(p, here) <= 1);
      if (startIdx < 0) {
        // ize en yakın noktaya git
        let best = -1, bd = 1e9;
        back.forEach((p, i) => {
          const d = V.manhattan(p, here);
          if (d < bd) { bd = d; best = i; }
        });
        if (best >= 0) {
          const ok = yield* this.goTo(back[best], { speed, maxNodes: 2500, radius: 40, dig: this.type === "madenci" });
          if (ok) startIdx = best;
        }
      }
      if (startIdx >= 0) {
        const ok = yield* this.follow([this.cell, ...back.slice(startIdx)], { speed, dig: this.type === "madenci" });
        if (ok) {
          this.resetTrail();
          return true;
        }
      }
      // uzaktaysa bacaklar halinde yürü
      if (V.dist(this.loc, this.home) > 30 && (yield* this.travelTo(this.home, { near: 2, speed }))) {
        this.resetTrail();
        return true;
      }
      // son çare: kazarak dön (madenci) / yakına kadar
      const ok = yield* this.walkTo((c) => V.hdist(c, target) <= 1.6 && Math.abs(c.y - target.y) <= 1,
        (c) => V.manhattan(c, target), { speed, maxNodes: 6000, radius: 96, dig: this.type === "madenci", partial: true });
      if (!ok || V.dist(this.loc, this.home) > 3) {
        if (!sendLocationHook(this, "Eve dönerken yolum kapandı, beni almaya gelir misin?")) this.say("Eve dönerken yolum kapandı. Beni almaya gelir misin?");
        return false;
      }
    }
    this.resetTrail();
    return true;
  }

  /** Sandık(lar)a boşalt. keep(id)->bırakılacak adet. */
  *deposit(keep = () => 0) {
    const chests = [];
    const home = this.homeChest();
    if (home && this.canUseChest(home)) chests.push(home);
    for (const c of this.chestsNear(this.loc, 16)) if (!chests.some((x) => x.id === c.id)) chests.push(c);
    if (!chests.length) {
      this.say("Eşyaları koyacak sandık bulamadım.");
      return false;
    }
    const reserved = new Map();
    for (const [id, n] of this.contents()) reserved.set(id, Math.min(n, keep(id)));
    for (const ch of chests) {
      const ok = yield* this.goTo(V.floor(ch.location), { range: 2, maxNodes: 1500, radius: 24 });
      if (!ok && V.dist(this.loc, ch.location) > 3.5) continue;
      this.face(V.floor(ch.location));
      safe(() => ch.setProperty("aqualit:open", true));
      safe(() => this.dim.playSound("random.chestopen", ch.location, { volume: 0.6 }));
      this.setAct("place");
      yield* wait(10);
      const cc = safe(() => ch.getComponent("minecraft:inventory")?.container);
      const inv = this.inv;
      if (cc && inv) {
        for (let i = 0; i < inv.size; i++) {
          const it = inv.getItem(i);
          if (!it) continue;
          const r = reserved.get(it.typeId) ?? 0;
          if (r > 0) {
            const keepHere = Math.min(r, it.amount);
            reserved.set(it.typeId, r - keepHere);
            if (keepHere >= it.amount) continue;
            const move = it.clone();
            move.amount = it.amount - keepHere;
            const rest = safe(() => cc.addItem(move), move);
            it.amount = keepHere + (rest ? rest.amount : 0);
            inv.setItem(i, it);
            continue;
          }
          const rest = safe(() => cc.addItem(it), it);
          inv.setItem(i, rest ?? undefined);
        }
      }
      yield* wait(8);
      safe(() => ch.setProperty("aqualit:open", false));
      safe(() => this.dim.playSound("random.chestclosed", ch.location, { volume: 0.6 }));
      this.setAct("none");
      let leftAny = false;
      for (const [id, n] of this.contents()) if (n > (keep(id) ?? 0)) leftAny = true;
      if (!leftAny) break;
    }
    this.full = false;
    for (const [id, n] of this.contents()) {
      if (n > keep(id)) {
        this.say("Sandıklar dolu! Bazı eşyaları üzerimde tutuyorum.");
        this.full = true;
        break;
      }
    }
    return true;
  }

  /** Erişilebilir sandıklardan bir eşya al. */
  *fetchFromChests(pred, want, radius = 16) {
    let got = 0;
    for (const ch of this.chestsNear(this.home ?? this.loc, radius)) {
      const cc = safe(() => ch.getComponent("minecraft:inventory")?.container);
      if (!cc) continue;
      let has = false;
      for (let i = 0; i < cc.size; i++) {
        const it = cc.getItem(i);
        if (it && pred(it.typeId)) has = true;
      }
      if (!has) continue;
      yield* this.goTo(V.floor(ch.location), { range: 2, maxNodes: 1500, radius: 24 });
      safe(() => ch.setProperty("aqualit:open", true));
      this.setAct("place");
      yield* wait(8);
      for (let i = 0; i < cc.size && got < want; i++) {
        const it = cc.getItem(i);
        if (!it || !pred(it.typeId)) continue;
        const use = Math.min(it.amount, want - got);
        const mv = it.clone();
        mv.amount = use;
        const rest = this.addStack(mv);
        const moved = use - (rest ? rest.amount : 0);
        got += moved;
        if (moved >= it.amount) cc.setItem(i, undefined);
        else {
          it.amount -= moved;
          cc.setItem(i, it);
        }
      }
      safe(() => ch.setProperty("aqualit:open", false));
      this.setAct("none");
      if (got >= want) break;
    }
    return got;
  }

  // ---------------------------------------------------------------- tarama
  /**
   * Yakındaki blokları bul (en yakın önce). Alan 16x16'lık öbeklere bölünür, yalnızca yüklü öbekler
   * taranır ve her öbek tek bir hızlı sorguyla okunur; böylece büyük alanlar bile oyunu kilitlemez.
   */
  scan(types, center, rx, ry, rz, limit = 12) {
    const out = [];
    const valid = validTypes(types);
    if (!valid.length) return out;
    const min = { x: Math.floor(center.x - rx), y: Math.floor(center.y - ry), z: Math.floor(center.z - rz) };
    const max = { x: Math.floor(center.x + rx), y: Math.floor(center.y + ry), z: Math.floor(center.z + rz) };
    const hr = this.dim.heightRange;
    min.y = Math.max(min.y, hr.min);
    max.y = Math.min(max.y, hr.max - 1);
    if (max.y < min.y) return out;
    const here = this.loc;
    const chunks = chunkPieces(min, max, here);
    const fast = typeof this.dim.getBlocks === "function";
    let slowLeft = 6000; // yavaş yol için üst sınır (getBlocks yoksa)
    let far2 = Infinity;
    for (const c of chunks) {
      if (out.length >= limit && c.d2 > far2) break;
      if (!safe(() => this.dim.isChunkLoaded(c.a), true)) continue;
      if (fast) {
        const list = safe(() => this.dim.getBlocks(new BlockVolume(c.a, c.b), { includeTypes: valid }, false));
        if (!list) continue;
        const it = list.getBlockLocationIterator();
        for (let p = it.next(); !p.done; p = it.next()) {
          const v = p.value;
          if (!this.ignored.has(V.key(v))) out.push({ x: v.x, y: v.y, z: v.z });
        }
      } else {
        const set = new Set(valid);
        for (let x = c.a.x; x <= c.b.x && slowLeft > 0; x++)
          for (let y = c.a.y; y <= c.b.y && slowLeft > 0; y++)
            for (let z = c.a.z; z <= c.b.z && slowLeft > 0; z++) {
              slowLeft--;
              const t = safe(() => this.dim.getBlock({ x, y, z })?.typeId);
              if (t && set.has(t) && !this.ignored.has(`${x},${y},${z}`)) out.push({ x, y, z });
            }
      }
      if (out.length >= limit) {
        out.sort((a, b) => V.dist2(a, here) - V.dist2(b, here));
        out.length = Math.max(limit, Math.min(out.length, limit * 2));
        far2 = V.dist2(out[limit - 1], here);
      }
    }
    out.sort((a, b) => V.dist2(a, here) - V.dist2(b, here));
    return out.slice(0, limit);
  }

  /**
   * Uzak tarama (jeneratör): yüzlerce bloğa kadar yüklü öbekleri yakından uzağa tarar,
   * süre bütçesi dolunca bir sonraki tike bekler. filter(p) ek koşul. En yakın `limit` sonucu döndürür.
   */
  *scanFar(types, center, radius, ry, limit = 12, filter = null) {
    const valid = validTypes(types);
    const out = [];
    if (!valid.length) return out;
    const hr = this.dim.heightRange;
    const min = { x: Math.floor(center.x - radius), y: Math.max(hr.min, Math.floor(center.y - ry)), z: Math.floor(center.z - radius) };
    const max = { x: Math.floor(center.x + radius), y: Math.min(hr.max - 1, Math.floor(center.y + ry)), z: Math.floor(center.z + radius) };
    if (max.y < min.y) return out;
    const chunks = chunkPieces(min, max, center);
    let far2 = Infinity;
    for (const c of chunks) {
      if (out.length >= limit && c.d2 > far2) break;
      if (Budget.over()) yield;
      if (!safe(() => this.dim.isChunkLoaded(c.a), true)) continue;
      const list = safe(() => this.dim.getBlocks(new BlockVolume(c.a, c.b), { includeTypes: valid }, false));
      if (!list) continue;
      const it = list.getBlockLocationIterator();
      for (let p = it.next(); !p.done; p = it.next()) {
        const v = { x: p.value.x, y: p.value.y, z: p.value.z };
        if (this.ignored.has(V.key(v))) continue;
        if (filter && !filter(v)) continue;
        out.push(v);
      }
      if (out.length >= limit) {
        out.sort((a, b) => V.dist2(a, center) - V.dist2(b, center));
        out.length = limit;
        far2 = V.dist2(out[limit - 1], center);
      }
    }
    out.sort((a, b) => V.dist2(a, center) - V.dist2(b, center));
    return out.slice(0, limit);
  }

  ignore(p) {
    this.ignored.add(V.key(p));
    if (this.ignored.size > 600) this.ignored = new Set([...this.ignored].slice(-300));
  }
  withinRange(p) {
    if (!this.home) return true;
    return V.hdist(p, this.home) <= this.maxDist;
  }

  /** Yerdeki eşya varlıklarını topla. */
  pickupItems(radius = 5, filter) {
    const items = safe(() => this.dim.getEntities({ type: "minecraft:item", location: this.loc, maxDistance: radius }), []);
    let n = 0;
    for (const it of items) {
      const st = safe(() => it.getComponent("minecraft:item")?.itemStack);
      if (!st) continue;
      if (filter && !filter(st.typeId)) continue;
      const rest = this.addStack(st);
      if (!rest) {
        safe(() => it.remove());
        n += st.amount;
      }
    }
    if (n) safe(() => this.dim.playSound("random.pop", this.loc, { volume: 0.4 }));
    return n;
  }
}

// geçerli blok türleri (geçersiz tür sorguyu bozmasın)
const TYPE_OK = new Map();
function validTypes(types) {
  return types.filter((t) => {
    let ok = TYPE_OK.get(t);
    if (ok === undefined) {
      ok = !!safe(() => BlockPermutation.resolve(t));
      TYPE_OK.set(t, ok);
    }
    return ok;
  });
}

/** Alanı 16x16 öbek parçalarına böler, merkeze yakından uzağa sıralar. */
function chunkPieces(min, max, center) {
  const out = [];
  for (let cx = Math.floor(min.x / 16); cx <= Math.floor(max.x / 16); cx++)
    for (let cz = Math.floor(min.z / 16); cz <= Math.floor(max.z / 16); cz++) {
      const a = { x: Math.max(min.x, cx * 16), y: min.y, z: Math.max(min.z, cz * 16) };
      const b = { x: Math.min(max.x, cx * 16 + 15), y: max.y, z: Math.min(max.z, cz * 16 + 15) };
      const nx = Math.max(a.x, Math.min(center.x, b.x)), nz = Math.max(a.z, Math.min(center.z, b.z));
      out.push({ a, b, d2: (nx - center.x) ** 2 + (nz - center.z) ** 2 });
    }
  out.sort((p, q) => p.d2 - q.d2);
  return out;
}

/** Kazarak yol bulma: doğal bloklar ek maliyetle geçilebilir sayılır. */
function* findDigPath(g, start, goal, h, opts = {}) {
  const dg = Object.create(g);
  const passable = (p) => {
    if (g.passable(p)) return true;
    const t = g.type(p);
    if (t === null) return false;
    if (!B.isNatural(t) || B.isProtected(t) || t === "minecraft:obsidian") return false;
    if (g.nearLava(p)) return false;
    return true;
  };
  dg.passable = passable;
  dg.digMode = true;
  dg.standable = (p) => {
    if (!passable(p)) return false;
    const t = g.type(p);
    if (t && (B.isWater(t) || B.isClimb(t))) return true;
    const below = g.type({ x: p.x, y: p.y - 1, z: p.z });
    if (below === null) return false;
    return B.isSupportType(below) || B.isWater(below);
  };
  const extraCost = (p, from) => {
    let c = g.passable(p) ? 0 : 3;
    if (p.y > from.y && !g.passable({ x: from.x, y: from.y + 1, z: from.z })) c += 3;
    return c;
  };
  return yield* findPath(dg, start, goal, h, Object.assign({ maxNodes: 4000 }, opts, { extraCost }));
}

function later(bot, ticks, fn) {
  system.runTimeout(() => safe(fn), ticks);
}

export { WALK, RUN };

// konum.js kendini buraya bağlar (döngüsel içe aktarmayı önlemek için)
let LOC_HOOK = null;
export function setLocationHook(fn) {
  LOC_HOOK = fn;
}
function sendLocationHook(bot, why) {
  return LOC_HOOK ? safe(() => LOC_HOOK(bot, why), false) : false;
}
