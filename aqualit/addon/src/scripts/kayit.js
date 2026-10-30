// Aqualit Robotları — eşya/blok bileşen kaydı (güvenli açılış, v0.3.1)
// Bileşenler oyun açılırken burada kaydolur; işleri items.js'teki işleyicilere aktarılır (H tablosu).
// Böylece kodun geri kalanı yüklenirken bir hata olsa bile robot, kumanda ve diğer eşyalar kaybolmaz.
import { system } from "@minecraft/server";

export const H = {};      // bileşen adı -> { onUse, onUseOn, ... } (items.js doldurur)
const ITEM = { "aqualit:robot_item": ["onUseOn"], "aqualit:device": ["onUse", "onUseOn"], "aqualit:statue_item": ["onUseOn"],
  "aqualit:buyu": ["onUse"], "aqualit:repair_kit": ["onUse"], "aqualit:tool": ["onMineBlock", "onUseOn"] };
const BLOCK = { "aqualit:statue": ["onPlayerInteract"] };

function aktar(ad, olaylar) {
  const o = {};
  for (const ol of olaylar) o[ol] = (e, p) => H[ad]?.[ol]?.(e, p);
  return o;
}

system.beforeEvents.startup.subscribe((ev) => {
  for (const [ad, ol] of Object.entries(ITEM)) {
    try { ev.itemComponentRegistry.registerCustomComponent(ad, aktar(ad, ol)); } catch (e) { console.warn(`[Aqualit] ${ad}: ${e}`); }
  }
  for (const [ad, ol] of Object.entries(BLOCK)) {
    try { ev.blockComponentRegistry.registerCustomComponent(ad, aktar(ad, ol)); } catch (e) { console.warn(`[Aqualit] ${ad}: ${e}`); }
  }
});
