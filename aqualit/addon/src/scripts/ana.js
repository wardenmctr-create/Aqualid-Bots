// Aqualit Robotları — asıl giriş (main.js güvenli açılışla yükler)
// Sürüm 0.3.2 (birini takip et, Keşif otopilotu; 0.3.1: Keşif yapay zekâsı, sefer, yağma, radar, hız sayacı)
import { world, system } from "@minecraft/server";
import "./brain.js";
import "./items.js";
import "./place.js";
import "./statue.js";
import "./zirh.js";
import "./sandik.js";
import "./konum.js";
import { safe } from "./util.js";
import { fxCleanup } from "./fx.js";

let cleaned = false;
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  system.runTimeout(() => {
    safe(() => p.sendMessage("§s§lAqualit Robotları§r §7v0.3.2 yüklendi. Yeni: birini takip et ve Keşif otopilotu!"));
    if (!cleaned) {
      cleaned = true;
      fxCleanup(); // önceki oturumdan kalmış güç efekti varlıkları
    }
  }, 60);
});
