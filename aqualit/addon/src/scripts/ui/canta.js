// Aqualit Robotları — çanta / sandık ekranı: eşya adları oyuncunun dilinde (Türkçe), yanında eşyanın resmi;
// adet seçerek alma ve envanterden koyma. Büyülü ya da isimli eşyalar bozulmadan taşınır.
import { menu, modal } from "./forms.js";
import { ICONS } from "../ikon_data.js";
import { safe } from "../util.js";

const FALLBACK = "textures/items/aqualit_chest";
export const EDIT_RANGE = 8; // eşya alıp koymak için en fazla uzaklık

export function iconOf(id) {
  return ICONS[id] ?? FALLBACK;
}

function special(it) {
  if (it.nameTag) return true;
  const n = safe(() => it.getComponent("minecraft:enchantable")?.getEnchantments()?.length, 0) ?? 0;
  return n > 0;
}

/** Konteyneri türlere göre grupla: [{id, n, key, name, special, slots}] (çok olan önce) */
export function groups(container) {
  const m = new Map();
  for (let i = 0; i < (container?.size ?? 0); i++) {
    const it = safe(() => container.getItem(i));
    if (!it) continue;
    const sp = special(it);
    const gk = sp ? `${it.typeId}#${i}` : it.typeId;
    let g = m.get(gk);
    if (!g) {
      g = { id: it.typeId, n: 0, key: safe(() => it.localizationKey), name: it.nameTag, special: sp, slots: [] };
      m.set(gk, g);
    }
    g.n += it.amount;
    g.slots.push(i);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

/** "12× Demir Külçe" (ad oyuncunun dilinde gösterilir) */
export function label(g, prefix = "") {
  const parts = [{ text: `${prefix}§l${g.n}×§r ` }];
  if (g.name) parts.push({ text: `§o${g.name}§r` });
  else if (g.key) parts.push({ translate: g.key });
  else parts.push({ text: g.id.split(":")[1].replace(/_/g, " ") });
  if (g.special && !g.name) parts.push({ text: " §d✦" });
  return { rawtext: parts };
}

/** src'den dst'ye bu gruptan n tane taşı; taşınan adedi döndür. */
export function moveGroup(src, dst, g, n) {
  let left = n, moved = 0;
  for (const i of g.slots) {
    if (left <= 0) break;
    const it = safe(() => src.getItem(i));
    if (!it || it.typeId !== g.id) continue;
    const take = Math.min(left, it.amount);
    const part = it.clone();
    part.amount = take;
    const rest = safe(() => dst.addItem(part), part);
    const placed = take - (rest?.amount ?? 0);
    if (placed <= 0) break; // hedef dolu
    if (placed >= it.amount) src.setItem(i, undefined);
    else {
      it.amount -= placed;
      src.setItem(i, it);
    }
    moved += placed;
    left -= placed;
    if (rest) break;
  }
  return moved;
}

async function askAmount(player, g, question, submit) {
  if (g.n <= 1) return g.n;
  const title = g.key ? { rawtext: [{ translate: g.key }] } : g.id;
  const v = await modal(player, title, [
    { type: "slider", label: question, min: 1, max: g.n, step: 1, value: g.n },
  ], submit);
  return v ? v[0] : 0;
}

async function putMenu(player, inv, dst) {
  const gs = groups(inv);
  if (!gs.length) return player.sendMessage("§7Envanterin boş.");
  const r = await menu(player, "Çantaya eşya koy", "§7Koymak istediğin eşyaya dokun.",
    gs.map((g) => ({ text: label(g), icon: iconOf(g.id), g })));
  if (!r) return;
  const n = await askAmount(player, r.g, "Kaç tane koyayım?", "Koy");
  if (!n) return;
  const moved = moveGroup(inv, dst, r.g, n);
  player.sendMessage(moved ? `§a${moved} tane çantaya koydun.` : "§cÇanta dolu.");
}

/**
 * Çanta ekranı.
 * opts: { title, empty, container: () => Container, canEdit: () => bool }
 */
export async function bagMenu(player, opts) {
  for (let guard = 0; guard < 200; guard++) {
    const c = opts.container();
    if (!c) return;
    const edit = opts.canEdit ? !!opts.canEdit() : true;
    const gs = groups(c);
    const total = gs.reduce((a, g) => a + g.n, 0);
    let body = gs.length ? `§7${gs.length} çeşit, toplam ${total} eşya.` : `§7${opts.empty ?? "Çanta boş."}`;
    if (gs.length) body += edit ? " Almak için bir eşyaya dokun." : "\n§8Eşya alıp koymak için yanına git (8 blok).";
    const btns = [];
    if (edit) btns.push({ text: "§2§lEşya koy§r\n§7Envanterinden buraya", icon: "textures/items/aqualit_chest", act: "put" });
    if (edit && gs.length > 1) btns.push({ text: "§lHepsini al", icon: "textures/items/aqualit_chest", act: "all" });
    for (const g of gs) btns.push({ text: label(g), icon: iconOf(g.id), g });
    const r = await menu(player, opts.title, body, btns);
    if (!r) return;
    const inv = safe(() => player.getComponent("minecraft:inventory")?.container);
    if (!inv) return;
    if (r.act === "put") {
      await putMenu(player, inv, c);
      continue;
    }
    if (r.act === "all") {
      let moved = 0, full = false;
      for (const g of gs) {
        const m = moveGroup(c, inv, g, g.n);
        moved += m;
        if (m < g.n) full = true;
      }
      player.sendMessage(full ? `§e${moved} eşya aldın, envanterin doldu.` : `§a${moved} eşyanın hepsini aldın.`);
      continue;
    }
    if (r.g && edit) {
      const n = await askAmount(player, r.g, "Kaç tane alayım?", "Al");
      if (!n) continue;
      const moved = moveGroup(c, inv, r.g, n);
      player.sendMessage(moved ? `§a${moved} tane aldın.` : "§cEnvanterin dolu.");
    }
  }
}
