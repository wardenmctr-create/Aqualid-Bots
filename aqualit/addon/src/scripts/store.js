// Aqualit Robotları — kalıcı veri (dünya ve varlık dinamik özellikleri)
import { world } from "@minecraft/server";
import { safe, log } from "./util.js";

export function getJSON(holder, key, def) {
  const raw = safe(() => holder.getDynamicProperty(key));
  if (typeof raw !== "string" || !raw.length) return def;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return def;
  }
}

export function setJSON(holder, key, val) {
  try {
    holder.setDynamicProperty(key, val === undefined ? undefined : JSON.stringify(val));
    return true;
  } catch (e) {
    log("kaydedilemedi", key, e);
    return false;
  }
}

export function getProp(holder, key, def) {
  const v = safe(() => holder.getDynamicProperty(key));
  return v === undefined ? def : v;
}
export function setProp(holder, key, val) {
  return safe(() => {
    holder.setDynamicProperty(key, val);
    return true;
  }, false);
}

// ------------------------------------------------------------------ sahipler
export function owners() {
  return getJSON(world, "aq:owners", []);
}
function addOwner(ownerId) {
  const o = owners();
  if (!o.includes(ownerId)) {
    o.push(ownerId);
    setJSON(world, "aq:owners", o);
  }
}

// ------------------------------------------------------------------ robot dizini
// her kayıt: {rid, eid, name, type, model, dim, pos, home, homeDim, status, task, upd}
export const Robots = {
  list(ownerId) {
    return getJSON(world, `aq:robots:${ownerId}`, []);
  },
  save(ownerId, list) {
    setJSON(world, `aq:robots:${ownerId}`, list);
  },
  get(ownerId, rid) {
    return this.list(ownerId).find((r) => r.rid === rid);
  },
  upsert(ownerId, entry) {
    addOwner(ownerId);
    const list = this.list(ownerId);
    const i = list.findIndex((r) => r.rid === entry.rid);
    if (i >= 0) list[i] = Object.assign(list[i], entry);
    else list.push(entry);
    this.save(ownerId, list);
    const map = getJSON(world, "aq:ridowner", {});
    if (map[entry.rid] !== ownerId) {
      map[entry.rid] = ownerId;
      setJSON(world, "aq:ridowner", map);
    }
  },
  remove(ownerId, rid) {
    this.save(ownerId, this.list(ownerId).filter((r) => r.rid !== rid));
    const map = getJSON(world, "aq:ridowner", {});
    delete map[rid];
    setJSON(world, "aq:ridowner", map);
  },
  ownerOf(rid) {
    return getJSON(world, "aq:ridowner", {})[rid];
  },
  nextNumber(ownerId, type) {
    const k = `aq:cnt:${ownerId}:${type}`;
    const n = (getProp(world, k, 0) || 0) + 1;
    setProp(world, k, n);
    return n;
  },
};

// ------------------------------------------------------------------ sandık dizini
// {cid, eid, kind, dim, pos, name}
export const Chests = {
  list(ownerId) {
    return getJSON(world, `aq:chests:${ownerId}`, []);
  },
  save(ownerId, list) {
    setJSON(world, `aq:chests:${ownerId}`, list);
  },
  upsert(ownerId, entry) {
    addOwner(ownerId);
    const list = this.list(ownerId);
    const i = list.findIndex((c) => c.cid === entry.cid);
    if (i >= 0) list[i] = Object.assign(list[i], entry);
    else list.push(entry);
    this.save(ownerId, list);
  },
  remove(ownerId, cid) {
    this.save(ownerId, this.list(ownerId).filter((c) => c.cid !== cid));
  },
};

// ------------------------------------------------------------------ oyuncu ayarları
export const Prefs = {
  get(playerId) {
    return getJSON(world, `aq:prefs:${playerId}`, {});
  },
  set(playerId, prefs) {
    setJSON(world, `aq:prefs:${playerId}`, prefs);
  },
};
