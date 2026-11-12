// Aqualit Robotları — asıl giriş (main.js güvenli açılışla yükler)
// Sürüm 0.5.0 (sınırsız çanta, Kürekçi alan işleri, Kılıçlı 51 güç efekti, Organizatör üssü kendisi kurar, sandık taşıma, rampa, yüzeyde sürüş, araç hızları; 0.4.9: X-ray işaretleri 1,5 kat; 0.4.8: X-ray işaretleri cevherin 2 katı boyda; 0.4.7: yeni kişisel X-ray, Nether madenleri Portalcı çırağıyla, Portalcı dokusu ve taşırken bakış; 0.4.6: matkapta cevherler ekranda, panelsiz; 0.4.5: Robot Kostümü, bölge koruma ayarları, rampa fırlatma, gerçek dokulu Mimar resimleri, yeni araba sesi; 0.4.4: Kılıçlı 50 güç, 7 kombo, takım taktikleri, %101; 0.4.3: 21 yeni farm, hologram önizleme, İnşa Çubuğu, köylü getirme; 0.4.2: havada yönlendirme, üs ağı, mini harita, küçük istekler; 0.4.1: matkap X-ray, hız çubuğu 0-500, arazi 4 blok basamak, tırmanma düzeltmesi; 0.4.0: Portalcı, evcil dronlar, Organizatör Yardımcısı ve üssü, yeni vizör, tepeden harita, uzaktan izleme)
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
import "./kostum.js";
import "./kilicli_ek.js";
import "./tasima.js";
import { safe } from "./util.js";
import { fxCleanup } from "./fx.js";

let cleaned = false;
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  system.runTimeout(() => {
    safe(() => p.sendMessage("§s§lAqualit Robotları§r §7v0.5.0 yüklendi. Yeni: rampa, güç efektleri, Organizatör üssü, sınırsız robot çantası ve daha fazlası!"));
    if (!cleaned) {
      cleaned = true;
      fxCleanup(); // önceki oturumdan kalmış güç efekti varlıkları
    }
  }, 60);
});
