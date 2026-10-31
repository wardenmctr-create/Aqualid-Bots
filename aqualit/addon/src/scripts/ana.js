// Aqualit Robotları — asıl giriş (main.js güvenli açılışla yükler)
// Sürüm 0.3.7 (Keşif yine konuyor: varlık biçimi 1.21.0; paket adlarında sürüm. 0.3.6: uçan binek, 1 blok çıkma, eğim, Tırmanma Modu)
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
    safe(() => p.sendMessage("§s§lAqualit Robotları§r §7v0.3.7 yüklendi. Keşif yeniden konuyor; arazi aracında Tırmanma Modu!"));
    if (!cleaned) {
      cleaned = true;
      fxCleanup(); // önceki oturumdan kalmış güç efekti varlıkları
    }
  }, 60);
});
