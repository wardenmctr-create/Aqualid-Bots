// v0.5.0: Kılıçlı güç efektleri. Her güç kullanılınca kendi 3D efekti (aqualit:guc_fx varlığı, içte opak parlak
// çubuklar + yarı saydam koyu kılıf) ve/veya 2D parçacık efekti (aqualit:g2_N) çıkar. Hangisi: Ayar Dişlisi →
// "Güç efektleri" (3D / 2D / İkisi / Kapalı; robot başına, varsayılan İkisi). Tasarımlar gen/guc_efekt.py. Oyunda denenmedi.
import { system, MolangVariableMap } from "@minecraft/server";
import { CASTS, POWER_LIST } from "./powers.js";
import { GUC_FX, GUC_FX_HAREKET } from "./guc_efekt_data.js";
import { safe } from "./util.js";

export const EFEKT_SECENEK = ["3d", "2d", "ikisi", "kapali"];
export const EFEKT_AD = ["3D", "2D", "İkisi", "Kapalı"];
const SURE = 26;     // tik

export function efektGoster(b, key, ctx) {
  const i = GUC_FX[key];
  if (i === undefined) return;
  const kip = b.stats?.efekt ?? "ikisi";
  if (kip === "kapali") return;
  const dim = b.dim, l = b.loc;
  const hedef = ctx?.nearest?.location;
  const yaw = hedef ? (Math.atan2(-(hedef.x - l.x), hedef.z - l.z) * 180) / Math.PI : safe(() => b.e.getRotation().y, 0) ?? 0;
  if (kip === "3d" || kip === "ikisi") {
    const e = safe(() => dim.spawnEntity("aqualit:guc_fx", { x: l.x, y: l.y, z: l.z }));
    if (e) {
      safe(() => e.setProperty("aqualit:fx", i));
      safe(() => e.setRotation({ x: 0, y: yaw }));
      system.runTimeout(() => safe(() => e.remove()), SURE);
    }
  }
  if (kip === "2d" || kip === "ikisi") {
    const mv = new MolangVariableMap();
    const r = (yaw * Math.PI) / 180;
    if (GUC_FX_HAREKET[key] === "isin") safe(() => mv.setVector3("variable.d", { x: -Math.sin(r), y: 0, z: Math.cos(r) }));
    safe(() => dim.spawnParticle(`aqualit:g2_${i}`, { x: l.x, y: l.y + 1, z: l.z }, mv));
  }
}

// her gücün kullanımı efektle başlasın (güçler powers*.js'te CASTS'e kayıtlı)
for (const key of POWER_LIST) {
  const asil = CASTS[key];
  if (typeof asil !== "function" || asil.__efektli) continue;
  const sarili = function* (b, ctx) {
    safe(() => efektGoster(b, key, ctx));
    return yield* asil(b, ctx);
  };
  sarili.__efektli = true;
  CASTS[key] = sarili;
}
