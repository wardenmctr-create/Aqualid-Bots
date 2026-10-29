// Aqualit Robotları — telsiz mesajları ve ekran bildirimi
import { world, system } from "@minecraft/server";
import { getJSON, setJSON } from "./store.js";
import { safe, fire } from "./util.js";

const MAX = 60;
const listeners = new Map(); // onay geri çağrıları: msgId -> fn(answer)

export function playerById(id) {
  return world.getPlayers().find((p) => p.id === id);
}

export function messages(ownerId) {
  return getJSON(world, `aq:msgs:${ownerId}`, []);
}
function saveMessages(ownerId, list) {
  setJSON(world, `aq:msgs:${ownerId}`, list.slice(-MAX));
}

export function unreadCount(ownerId) {
  return messages(ownerId).filter((m) => m.state === "new").length;
}

/**
 * Robot sahibine telsiz mesajı gönderir. Ekranı kesmez: eylem çubuğunda kısa bildirim + ses.
 * opts.confirm = {yes:"Evet", no:"Hayır", action, data}  → onay bekleyen mesaj
 */
export function sendMessage(ownerId, from, text, opts = {}) {
  const list = messages(ownerId);
  const msg = {
    id: Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    rid: from?.rid ?? "",
    from: from?.name ?? "Telsiz",
    type: from?.type ?? "",
    t: Date.now(),
    text,
    kind: opts.kind ?? "info",
    state: "new",
  };
  if (opts.confirm) msg.confirm = opts.confirm;
  list.push(msg);
  saveMessages(ownerId, list);
  const p = playerById(ownerId);
  if (p) notify(p, msg);
  return msg.id;
}

export function notify(player, msg) {
  const short = msg.text.length > 46 ? msg.text.slice(0, 44) + "…" : msg.text;
  const tag = msg.confirm ? "§e[Telsiz • onay bekliyor]§r" : "§s[Telsiz]§r";
  safe(() => player.onScreenDisplay.setActionBar(`${tag} §f${msg.from}: §7${short}`));
  safe(() => player.playSound(msg.confirm ? "note.chime" : "note.pling", { pitch: 1.6, volume: 0.6 }));
}

export function markAllRead(ownerId) {
  const list = messages(ownerId);
  let ch = false;
  for (const m of list) {
    if (m.state === "new" && !m.confirm) {
      m.state = "read";
      ch = true;
    }
  }
  if (ch) saveMessages(ownerId, list);
}

export function answer(ownerId, msgId, yes) {
  const list = messages(ownerId);
  const m = list.find((x) => x.id === msgId);
  if (!m) return;
  m.state = yes ? "yes" : "no";
  saveMessages(ownerId, list);
  const fn = listeners.get(msgId);
  if (fn) {
    listeners.delete(msgId);
    system.run(() => fire(() => fn(yes, m), "mesaj"));
  }
  // kalıcı onaylar: robot sonradan okur
  const k = `aq:answers:${ownerId}`;
  const ans = getJSON(world, k, {});
  ans[msgId] = yes;
  setJSON(world, k, ans);
}

export function markRead(ownerId, msgId) {
  const list = messages(ownerId);
  const m = list.find((x) => x.id === msgId);
  if (m && m.state === "new") {
    m.state = "read";
    saveMessages(ownerId, list);
  }
}

export function onAnswer(msgId, fn) {
  listeners.set(msgId, fn);
}

export function readAnswer(ownerId, msgId) {
  const ans = getJSON(world, `aq:answers:${ownerId}`, {});
  return ans[msgId];
}

export function clearMessages(ownerId) {
  saveMessages(ownerId, messages(ownerId).filter((m) => m.confirm && m.state === "new"));
}

export function timeAgo(t) {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s} sn önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}
