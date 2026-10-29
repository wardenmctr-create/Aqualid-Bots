// Aqualit Robotları — Aqualit İnşa Çubuğu (geliştirilmiş hata ayıklama çubuğu)
// Dokun: seçili özelliğin sonraki değeri · Eğilip dokun: sonraki özellik · Havaya dokun: menü
import { world, system, BlockStates, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { safe, fire } from "./util.js";
import { show } from "./ui/forms.js";

export const ROD_ID = "aqualit:insa_cubugu";
const LOCKED = { "aqualit:kapali_robot": ["aqualit:tur"] };   // heykelin robot türü değiştirilemez
const NAMES = {
  facing_direction: "Yön", "minecraft:cardinal_direction": "Yön", "minecraft:facing_direction": "Yön",
  weirdo_direction: "Basamak yönü", upside_down_bit: "Ters", "minecraft:vertical_half": "Yarım blok yeri",
  pillar_axis: "Eksen", direction: "Yön", open_bit: "Açık", door_hinge_bit: "Menteşe", upper_block_bit: "Üst parça",
  powered_bit: "Güç", growth: "Büyüme", age: "Yaş", redstone_signal: "Kızıltaş gücü", lit: "Yanık",
  extinguished: "Sönük", hanging: "Asılı", torch_facing_direction: "Meşale yönü", button_pressed_bit: "Basılı",
  "minecraft:block_face": "Yüzey", liquid_depth: "Sıvı seviyesi", candles: "Mum sayısı", lit_bit: "Yanık",
  rail_direction: "Ray yönü", rail_data_bit: "Ray verisi", head_piece_bit: "Baş tarafı", occupied_bit: "Dolu",
  "aqualit:poz": "Poz", attached_bit: "Bağlı", hanging_bit: "Asılı", in_wall_bit: "Duvarda",
};
const VAL = (v) => (v === true ? "evet" : v === false ? "hayır" : String(v));

const sel = new Map();      // oyuncu -> { type, index }
const lastBlock = new Map();// oyuncu -> { dimId, pos }
const undo = new Map();     // oyuncu -> [{ dimId, pos, perm }]
const clip = new Map();     // oyuncu -> { type, states }
const opts = new Map();     // oyuncu -> { paste: bool, back: bool }

function O(p) {
  let o = opts.get(p.id);
  if (!o) {
    o = { paste: false, back: false };
    opts.set(p.id, o);
  }
  return o;
}

function bar(p, t) {
  safe(() => p.onScreenDisplay.setActionBar(t));
}

/** Bloğun değiştirilebilen özellikleri (gerçekten geçerli değerleriyle). */
export function editableStates(block) {
  const perm = block.permutation;
  const states = safe(() => perm.getAllStates(), {}) ?? {};
  const out = [];
  const locked = LOCKED[block.typeId] ?? [];
  for (const name of Object.keys(states).sort()) {
    if (locked.includes(name)) continue;
    const type = safe(() => BlockStates.get(name));
    let values = type ? [...type.validValues] : typeof states[name] === "boolean" ? [false, true] : [];
    values = values.filter((v) => !!safe(() => perm.withState(name, v), null));
    if (values.length > 1) out.push({ name, values, value: states[name] });
  }
  return out;
}

function remember(p, block) {
  const list = undo.get(p.id) ?? [];
  list.push({ dimId: block.dimension.id, pos: { x: block.x, y: block.y, z: block.z }, perm: block.permutation });
  while (list.length > 20) list.shift();
  undo.set(p.id, list);
}

function apply(p, block, perm, note) {
  remember(p, block);
  const ok = safe(() => {
    block.setPermutation(perm);
    return true;
  }, false);
  if (!ok) {
    bar(p, "§cBu değer bu bloğa uygulanamadı.");
    return false;
  }
  safe(() => block.dimension.playSound("block.click", block.center(), { pitch: 1.6, volume: 0.4 }));
  safe(() => block.dimension.spawnParticle("minecraft:villager_happy", block.center()));
  if (note) bar(p, note);
  return true;
}

/** Dokunma: değer değiştir; eğilerek: özellik seç; yapıştırma açıksa kopyalanan durumları uygula. */
export function rodTap(p, block) {
  lastBlock.set(p.id, { dimId: block.dimension.id, pos: { x: block.x, y: block.y, z: block.z } });
  const o = O(p);
  const c = clip.get(p.id);
  if (o.paste && c && !p.isSneaking) {
    if (c.type !== block.typeId) {
      bar(p, "§eYapıştırma için aynı türde bir bloğa dokun.");
      return;
    }
    let perm = block.permutation;
    for (const [k, v] of Object.entries(c.states)) perm = safe(() => perm.withState(k, v), perm) ?? perm;
    apply(p, block, perm, "§bDurumlar yapıştırıldı.");
    return;
  }
  const list = editableStates(block);
  if (!list.length) {
    bar(p, "§7Bu bloğun değiştirilebilen bir özelliği yok.");
    return;
  }
  let s = sel.get(p.id);
  if (!s || s.type !== block.typeId) s = { type: block.typeId, index: 0 };
  if (s.index >= list.length) s.index = 0;
  if (p.isSneaking) {
    s.index = (s.index + 1) % list.length;
    sel.set(p.id, s);
    const st = list[s.index];
    bar(p, `§sSeçili: §f${NAMES[st.name] ?? st.name}§7 = ${VAL(st.value)}  §8(${s.index + 1}/${list.length})`);
    return;
  }
  sel.set(p.id, s);
  const st = list[s.index];
  const i = st.values.indexOf(st.value);
  const ni = (i + (o.back ? -1 : 1) + st.values.length) % st.values.length;
  const nv = st.values[ni];
  const perm = safe(() => block.permutation.withState(st.name, nv));
  if (perm) apply(p, block, perm, `§f${NAMES[st.name] ?? st.name}§7: ${VAL(st.value)} → §a${VAL(nv)}`);
}

function lastOf(p) {
  const l = lastBlock.get(p.id);
  if (!l) return undefined;
  const b = safe(() => world.getDimension(l.dimId).getBlock(l.pos));
  return b && !b.isAir ? b : undefined;
}

/** Havaya dokununca açılan menü. */
export async function rodMenu(p) {
  const o = O(p);
  const b = lastOf(p);
  const f = new ActionFormData().title("Aqualit İnşa Çubuğu");
  f.body(b ? `Son blok: §s${b.typeId.replace("minecraft:", "")}§r (${b.x}, ${b.y}, ${b.z})` : "Önce bir bloğa dokun.");
  const items = [];
  const add = (label, fn) => {
    f.button(label);
    items.push(fn);
  };
  if (b) add("Bütün özellikleri ayarla", () => fullForm(p, b));
  if (b) add("Durumları kopyala", () => {
    clip.set(p.id, { type: b.typeId, states: safe(() => b.permutation.getAllStates(), {}) });
    bar(p, "§bDurumlar kopyalandı. Yapıştırma modunu açıp aynı türde bloklara dokun.");
  });
  add(o.paste ? "Yapıştırma modu: §aAÇIK" : "Yapıştırma modu: §cKAPALI", () => {
    o.paste = !o.paste;
    bar(p, o.paste ? "§bYapıştırma açık: dokunduğun bloğa kopyalanan durumlar uygulanır." : "§7Yapıştırma kapandı.");
  });
  add(o.back ? "Değiştirme yönü: §egeri" : "Değiştirme yönü: §aileri", () => {
    o.back = !o.back;
  });
  if (b && safe(() => b.canContainLiquid("Water"), false)) {
    add(b.isWaterlogged ? "Sudan çıkar" : "Suyla doldur", () => {
      remember(p, b);
      safe(() => b.setWaterlogged(!b.isWaterlogged));
    });
  }
  const u = undo.get(p.id) ?? [];
  if (u.length) add(`Geri al (${u.length})`, () => undoLast(p));
  add("Nasıl kullanılır?", () => help(p));
  const r = await show(f, p);
  if (!r || r.canceled || r.selection === undefined) return;
  await items[r.selection]?.();
}

async function fullForm(p, b) {
  const list = editableStates(b);
  if (!list.length) {
    bar(p, "§7Bu bloğun değiştirilebilen bir özelliği yok.");
    return;
  }
  const f = new ModalFormData().title(b.typeId.replace("minecraft:", ""));
  for (const st of list) {
    f.dropdown(NAMES[st.name] ? `${NAMES[st.name]} (${st.name})` : st.name, st.values.map(VAL),
      { defaultValueIndex: Math.max(0, st.values.indexOf(st.value)) });
  }
  const r = await show(f, p);
  if (!r || r.canceled) return;
  let perm = b.permutation;
  list.forEach((st, i) => {
    const v = st.values[r.formValues[i]];
    perm = safe(() => perm.withState(st.name, v), perm) ?? perm;
  });
  apply(p, b, perm, "§aBlok ayarlandı.");
}

function undoLast(p) {
  const list = undo.get(p.id) ?? [];
  const last = list.pop();
  if (!last) return;
  const b = safe(() => world.getDimension(last.dimId).getBlock(last.pos));
  if (b && b.typeId === last.perm.type.id) {
    safe(() => b.setPermutation(last.perm));
    bar(p, `§7Geri alındı (${list.length} kaldı).`);
  } else bar(p, "§7O blok değişmiş, geri alınamadı.");
}

function help(p) {
  p.sendMessage([
    "§s§lAqualit İnşa Çubuğu",
    "§f• Dokun: §7seçili özelliğin değerini değiştirir.",
    "§f• Eğilip dokun: §7başka bir özelliğe geçer.",
    "§f• Havaya dokun: §7menü (hepsini ayarla, kopyala/yapıştır, suyla doldur, geri al).",
  ].join("\n"));
}

// blokla etkileşimi kendimiz ele alalım (kapı açılmasın, sandık açılmasın)
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  if (ev.itemStack?.typeId !== ROD_ID) return;
  ev.cancel = true;
  if (ev.isFirstEvent === false) return;
  const p = ev.player, block = ev.block;
  system.run(() => fire(() => rodTap(p, block), "inşa çubuğu"));
});

export { BlockPermutation };
