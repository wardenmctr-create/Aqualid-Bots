// v0.4.4: Bölge koruma ayrıntıları. Bölgeyi koruyan Kılıçlı, bölgeye girenlere türüne göre tepki verir:
// yabancı oyuncular, hayvanlar ve canavarlar için ayrı ayrı "hiçbir şey / haber ver / dışarı it / saldır".
// Arkadaş listesindeki oyunculara ve sahibine asla dokunmaz. Ayarlar robotta (aq:koruma) ve sahibin varsayılanında.
// Oyunda denenmedi.
import { world, system } from "@minecraft/server";
import { getJSON, setJSON, Prefs } from "./store.js";
import { V, safe, fmtPos } from "./util.js";

export const TEPKILER = ["Hiçbir şey yapma", "Haber ver", "Dışarı it", "Saldır"];
const KOD = ["yok", "haber", "it", "saldir"];
export const VARSAYILAN = { oyuncu: "haber", hayvan: "yok", canavar: "saldir", arkadas: [] };
const TURLER = [
  { k: "oyuncu", ad: "Yabancı oyuncular" },
  { k: "hayvan", ad: "Hayvanlar" },
  { k: "canavar", ad: "Canavarlar" },
];

export function korumaAyari(b) {
  return { ...VARSAYILAN, ...(getJSON(b.e, "aq:koruma", null) ?? {}) };
}

/** Bölgenin kalıcı kaydı (eski kayıt nesne olarak yazılamıyordu). */
export function bolgeYukle(b) {
  if (b.zone) return b.zone;
  const z = getJSON(b.e, "aq:zone2", null);
  if (z) b.zone = z;
  return b.zone;
}
export function bolgeKaydet(b, z) {
  setJSON(b.e, "aq:zone2", z);
}

/** Ayar formu: bütün seçili robotlara uygulanır; sahibin varsayılanı olarak da saklanır. */
export async function korumaAyarMenu(player, list) {
  const { modal } = await import("./ui/forms.js");
  const pr = Prefs.get(player.id);
  const ilk = list[0] ? korumaAyari(list[0]) : { ...VARSAYILAN, ...(pr.koruma ?? {}) };
  const alanlar = TURLER.map((t) => ({ type: "dropdown", label: `§l${t.ad}§r bölgeye girince`, items: TEPKILER, value: Math.max(0, KOD.indexOf(ilk[t.k])) }));
  alanlar.push({ type: "text", label: "Arkadaşlar (virgülle ayır: bunlara asla dokunmaz)", placeholder: "Ali, Ayşe", value: (ilk.arkadas ?? []).join(", ") });
  const v = await modal(player, "Bölge koruma ayarları", alanlar, "Kaydet");
  if (!v) return undefined;
  const ayar = { arkadas: String(v[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30) };
  TURLER.forEach((t, i) => (ayar[t.k] = KOD[v[i]] ?? VARSAYILAN[t.k]));
  for (const b of list) setJSON(b.e, "aq:koruma", ayar);
  pr.koruma = ayar;
  Prefs.set(player.id, pr);
  player.sendMessage(`§sKoruma:§r oyuncu ${TEPKILER[KOD.indexOf(ayar.oyuncu)]}, hayvan ${TEPKILER[KOD.indexOf(ayar.hayvan)]}, canavar ${TEPKILER[KOD.indexOf(ayar.canavar)]}` +
    (ayar.arkadas.length ? `; arkadaşlar: ${ayar.arkadas.join(", ")}` : ""));
  return ayar;
}

/** Yeni korumaya başlayan robota sahibin varsayılan ayarını yazar (robotta ayar yoksa). */
export function varsayilaniUygula(b, playerId) {
  if (getJSON(b.e, "aq:koruma", null)) return;
  const pr = Prefs.get(playerId);
  if (pr.koruma) setJSON(b.e, "aq:koruma", pr.koruma);
}

function turu(e, canavar, canli) {
  const t = safe(() => e.typeId, "");
  if (!t || t.startsWith("aqualit:") || t === "minecraft:item" || t === "minecraft:xp_orb") return null;
  if (t === "minecraft:player") return "oyuncu";
  if (canavar.has(e.id)) return "canavar";
  if (canli.has(e.id)) return "hayvan";
  return null;
}

/** Bölgedeki davetsiz misafirler: [{ e, tur, tepki }] */
export function davetsizler(b) {
  const z = bolgeYukle(b);
  if (!z) return [];
  const a = korumaAyari(b);
  const dost = new Set((a.arkadas ?? []).map((s) => s.toLowerCase()));
  const q = { location: { x: z.x + 0.5, y: z.y, z: z.z + 0.5 }, maxDistance: z.r + 1 };
  const list = safe(() => b.dim.getEntities(q), []) ?? [];
  const canavar = new Set((safe(() => b.dim.getEntities({ ...q, families: ["monster"] }), []) ?? []).map((e) => e.id));
  const canli = new Set((safe(() => b.dim.getEntities({ ...q, families: ["mob"] }), []) ?? []).map((e) => e.id));
  const out = [];
  for (const e of list) {
    if (e.id === b.id || !safe(() => e.isValid, false)) continue;
    const tur = turu(e, canavar, canli);
    if (!tur) continue;
    if (tur === "oyuncu") {
      if (e.id === b.owner || dost.has(String(safe(() => e.name, "")).toLowerCase())) continue;
      if (safe(() => e.getGameMode?.(), "") === "Spectator") continue;
    }
    const tepki = a[tur] ?? "yok";
    if (tepki !== "yok") out.push({ e, tur, tepki });
  }
  return out;
}

function sahip(b) {
  return world.getAllPlayers().find((p) => p.id === b.owner);
}

function haberVer(b, e, tur) {
  b._haber ??= new Map();
  const now = system.currentTick;
  if ((b._haber.get(e.id) ?? -1e9) > now) return;
  b._haber.set(e.id, now + 600);
  const o = sahip(b);
  const ad = tur === "oyuncu" ? safe(() => e.name, "bir oyuncu") : safe(() => e.typeId.split(":")[1].replace(/_/g, " "), "bir canlı");
  safe(() => o?.sendMessage(`§e⚠ ${b.name}:§r bölgeye ${tur === "oyuncu" ? "oyuncu " : ""}§l${ad}§r girdi (${fmtPos(V.floor(e.location))}).`));
  safe(() => o?.playSound("note.pling", { pitch: 1.6 }));
}

function disariIt(b, e) {
  const z = b.zone;
  const d = { x: e.location.x - (z.x + 0.5), z: e.location.z - (z.z + 0.5) };
  const l = Math.hypot(d.x, d.z) || 1;
  safe(() => e.applyKnockback({ x: (d.x / l) * 1.6, z: (d.z / l) * 1.6 }, 0.45));
  b.face(V.floor(e.location));
  b.setAct("attack");
  b._attackUntil = system.currentTick + 8;
}

/** Kovalama işi: davetsizin yanına yürür; saldır ise vurur, it ise bölge dışına iter. Bölgeden çıkınca biter. */
function* kovala(b, hedef, tepki) {
  const z = b.zone;
  const st = b.stats ?? {};
  const icinde = () => safe(() => hedef.isValid, false) && V.hdist(hedef.location, z) <= z.r + 2;
  for (let i = 0; i < 40 && icinde(); i++) {
    const d = V.dist(hedef.location, b.loc);
    if (d > 2.6) {
      yield* b.goTo(V.floor(hedef.location), { range: 2, maxNodes: 800, radius: z.r + 8, speed: 0.26 });
      continue;
    }
    if (tepki === "saldir") {
      b.face(V.floor(hedef.location));
      safe(() => hedef.applyDamage(st.hasar ?? 7, { cause: "entityAttack", damagingEntity: b.e }));
      b.setAct("attack");
      b._attackUntil = system.currentTick + 8;
    } else disariIt(b, hedef);
    for (let t = 0; t < 12; t++) yield;
  }
  // bölgenin ortasına dön
  if (V.hdist(b.loc, z) > 3) yield* b.goTo(V.floor(z), { range: 2, maxNodes: 1500, radius: z.r + 16 });
}

/** Bölge korumadaki Kılıçlı için her 10 tikte bir (işi yokken). */
export function korumaTick(b) {
  if (b.mode !== "guard" || b.job || !bolgeYukle(b)) return;
  const list = davetsizler(b);
  if (!list.length) return;
  for (const x of list) if (x.tepki === "haber") haberVer(b, x.e, x.tur);
  // en yakın saldır/it hedefi; canavarları oyunun kendi saldırısı da kovalıyor
  const eylem = list.filter((x) => x.tepki === "saldir" || x.tepki === "it")
    .sort((p, q) => V.dist(p.e.location, b.loc) - V.dist(q.e.location, b.loc))[0];
  if (!eylem) return;
  if (eylem.tur === "canavar" && eylem.tepki === "saldir" && V.dist(eylem.e.location, b.loc) < 16) return;
  if (eylem.tur !== "hayvan") haberVer(b, eylem.e, eylem.tur);
  b.job = kovala(b, eylem.e, eylem.tepki);
}
