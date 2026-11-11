// Aqualit Robotları — Sandığın yanından geçerken eşya bırakma (v0.4.2)
// Görevdeki robotun çantası yarıdan doluysa ve sahibinin bir Aqualit sandığının 3 blok yakınından geçiyorsa,
// işine gereken eşyalar (tohum, fidan, taş vb.) dışındakileri o sandığa bırakır; yoluna devam eder.
import { system } from "@minecraft/server";
import { safe, V } from "./util.js";
import { bots } from "./brain.js";
import { Chests } from "./store.js";
import { UnitContainer } from "./sandik.js";
import { keepFor } from "./jobs.js";

export function gecerkenBirak(b) {
  if (b.jobName !== "gorev" || b.type === "toplayici" || b.type === "kilicli") return 0;
  const ci = b.inv;
  if (!ci) return 0;
  let dolu = 0;
  for (let i = 0; i < ci.size; i++) if (ci.getItem(i)) dolu++;
  if (dolu < ci.size / 2) return 0;
  const ch = Chests.list(b.owner).find((c) => c.pos && c.dim === b.dim.id && V.dist(c.pos, b.loc) <= 3.5);
  if (!ch) return 0;
  const k = safe(() => new UnitContainer(ch.cid));
  if (!k?.isValid) return 0;
  const keep = keepFor(b);
  const gorev = new Set((b.task?.items ?? []).map((x) => x.id).filter(Boolean));
  let n = 0;
  for (let i = 0; i < ci.size; i++) {
    const it = ci.getItem(i);
    if (!it || keep(it.typeId) > 0 || gorev.has(it.typeId) || it.typeId.startsWith("aqualit:")) continue;
    const rest = safe(() => k.addItem(it), it);
    n += it.amount - (rest?.amount ?? 0);
    ci.setItem(i, rest ?? undefined);
  }
  if (n) {
    safe(() => b.dim.playSound("random.pop", ch.pos, { volume: 0.5, pitch: 1.3 }));
    b.setStatus?.(`Geçerken sandığa ${n} eşya bıraktı`);
  }
  return n;
}

system.runInterval(() => {
  for (const b of bots.values()) if (b.valid) safe(() => gecerkenBirak(b));
}, 40);
