// Aqualit Robotları — asıl giriş (main.js güvenli açılışla yükler)
// Sürüm 0.4.2 (havada yönlendirme, üs ağı, mini harita, küçük istekler; 0.4.1: matkap X-ray, hız çubuğu 0-500, arazi 4 blok basamak, tırmanma düzeltmesi; 0.4.0: Portalcı, evcil dronlar, Organizatör Yardımcısı ve üssü, yeni vizör, tepeden harita, uzaktan izleme)
import { world, system } from "@minecraft/server";
import "./brain.js";
import "./items.js";
import "./place.js";
import "./statue.js";
import "./zirh.js";
import "./sandik.js";
import "./konum.js";
import "./cevher_durbunu.js";
import "./surus.js";
import "./gecerken.js";
import { safe } from "./util.js";
import { fxCleanup } from "./fx.js";

let cleaned = false;
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  system.runTimeout(() => {
    safe(() => p.sendMessage("§s§lAqualit Robotları§r §7v0.4.2 yüklendi. Organizatör üs ağı, havada yönlendirme, mini harita ve daha fazlası!"));
    if (!cleaned) {
      cleaned = true;
      fxCleanup(); // önceki oturumdan kalmış güç efekti varlıkları
    }
  }, 60);
});
