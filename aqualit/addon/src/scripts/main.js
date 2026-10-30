// Aqualit Robotları — giriş (güvenli açılış, v0.3.1)
// Önce eşya bileşenleri kaydolur (kayit.js), sonra asıl kod (ana.js) yüklenir. Asıl kodda hata olursa eşyalar yine
// çalışır ve hata oyunculara sohbette yazılır (içerik günlüğü açmadan görülsün diye).
import { world, system } from "@minecraft/server";
import "./kayit.js";

let hata = null;
function yaz(p) {
  try {
    p.sendMessage(`§c[Aqualit Robotları] Kod yüklenirken hata: §f${hata}`);
    p.sendMessage("§7Bu yazının ekran görüntüsünü gönder.");
  } catch (e) { /* oyuncu çıkmış olabilir */ }
}
import("./ana.js").catch((e) => {
  hata = `${e?.name ?? ""}: ${e?.message ?? e} ${String(e?.stack ?? "").split("\n").slice(0, 3).join(" | ")}`.slice(0, 600);
  console.warn("[Aqualit] " + hata);
  system.runTimeout(() => { try { for (const p of world.getAllPlayers()) yaz(p); } catch (e) {} }, 100);
});
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (hata && ev.initialSpawn) system.runTimeout(() => yaz(ev.player), 80);
});
