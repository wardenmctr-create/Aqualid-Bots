// Aqualit Robotları — kaynak hafızası: robotların gördüğü ağaç, su, kum gibi yerler.
// Aynı sahibin bütün robotları paylaşır; uzaktaki bir yeri bir kez bulan robot sonra oraya doğrudan gider.
import { world } from "@minecraft/server";
import { getJSON, setJSON } from "./store.js";

const KEY = (owner) => `aq:kay:${owner}`;
const NEAR = 8; // bu kadar yakın kayıtlar tek yer sayılır
const MAX = 40; // tür başına en çok kayıt

const close = (e, p) => Math.abs(e.x - p.x) + Math.abs(e.z - p.z) < NEAR;

export const Kaynak = {
  list(owner, kind, dim) {
    const all = getJSON(world, KEY(owner), {});
    return (all[kind] ?? []).filter((e) => !dim || e.d === dim);
  },
  add(owner, kind, dim, pts) {
    if (!owner || !pts.length) return;
    const all = getJSON(world, KEY(owner), {});
    const arr = all[kind] ?? [];
    for (const p of pts) {
      if (arr.some((e) => e.d === dim && close(e, p))) continue;
      arr.unshift({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), d: dim });
    }
    all[kind] = arr.slice(0, MAX);
    setJSON(world, KEY(owner), all);
  },
  remove(owner, kind, dim, p) {
    const all = getJSON(world, KEY(owner), {});
    const arr = all[kind] ?? [];
    all[kind] = arr.filter((e) => !(e.d === dim && close(e, p)));
    setJSON(world, KEY(owner), all);
  },
};
