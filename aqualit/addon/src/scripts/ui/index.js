// Aqualit Robotları — arayüz giriş noktaları
// Yalnız kendi işlevleri dışarı verilir (başka modülden alınanı aynen dışarı vermek telefondaki oyun motorunda
// döngülü içe aktarmalarda "Could not find export" hatası veriyor; v0.3.2'de radar yüzünden bütün kod yüklenmemişti).
import * as M0 from "./task.js";
import * as M1 from "./radio.js";
import * as M2 from "./tracker.js";
import * as M3 from "./kilicli_ui.js";
import * as M4 from "./chest.js";
export function robotMenu(...a) { return M0.robotMenu(...a); }
export function remoteFromAir(...a) { return M0.remoteFromAir(...a); }
export function giveTask(...a) { return M0.giveTask(...a); }
export function renameRobot(...a) { return M0.renameRobot(...a); }
export function openRadio(...a) { return M1.openRadio(...a); }
export function radioRobot(...a) { return M1.radioRobot(...a); }
export function openMessages(...a) { return M1.openMessages(...a); }
export function openTracker(...a) { return M2.openTracker(...a); }
export function trackerList(...a) { return M2.trackerList(...a); }
export function startWatch(...a) { return M2.startWatch(...a); }
export function stopWatch(...a) { return M2.stopWatch(...a); }
export function openRod(...a) { return M3.openRod(...a); }
export function rodRobot(...a) { return M3.rodRobot(...a); }
export function rodComeHere(...a) { return M3.rodComeHere(...a); }
export function gearFromAir(...a) { return M3.gearFromAir(...a); }
export function gearForm(...a) { return M3.gearForm(...a); }
export function zoneCorner(...a) { return M3.zoneCorner(...a); }
export function zoneMenu(...a) { return M3.zoneMenu(...a); }
export function showZone(...a) { return M3.showZone(...a); }
export function chestMenu(...a) { return M4.chestMenu(...a); }
