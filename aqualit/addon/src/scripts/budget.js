// Aqualit Robotları — tik süre bütçesi: ağır işler (yol bulma, tarama) her tike yayılır,
// böylece telefonda bile oyunun "takılma bekçisi" dünyayı kapatmaz.
let start = 0;

export const BUDGET_MS = 10; // bir tikte robotlara ayrılan toplam süre

export const Budget = {
  begin() {
    start = Date.now();
  },
  elapsed() {
    return Date.now() - start;
  },
  /** Bu tikte ayrılan süre aşıldı mı? */
  over(ms = BUDGET_MS) {
    return Date.now() - start > ms;
  },
};
