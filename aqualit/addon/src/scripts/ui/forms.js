// Aqualit Robotları — form yardımcıları
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { log } from "../util.js";

/** Formu gösterir; oyuncu meşgulse (sohbet açık vb.) biraz bekleyip yeniden dener. */
export async function show(form, player) {
  for (let i = 0; i < 30; i++) {
    let r;
    try {
      r = await form.show(player);
    } catch (e) {
      log("form hatası", e);
      return undefined;
    }
    if (r && r.canceled && r.cancelationReason === FormCancelationReason.UserBusy) {
      await system.waitTicks(5);
      continue;
    }
    return r;
  }
  return undefined;
}

/** Düğmeli menü. buttons: [{text, icon?, ...}] → seçilen düğme nesnesi ya da undefined */
export async function menu(player, title, body, buttons) {
  const f = new ActionFormData().title(title);
  if (body) f.body(body);
  for (const b of buttons) {
    if (b.icon) f.button(b.text, b.icon);
    else f.button(b.text);
  }
  const r = await show(f, player);
  if (!r || r.canceled || r.selection === undefined) return undefined;
  return buttons[r.selection];
}

/** Evet / hayır sorusu (iki düğmeli menü). */
export async function confirm(player, title, body, yes = "Evet", no = "Vazgeç") {
  const r = await menu(player, title, body, [{ text: `§a${yes}`, v: true }, { text: `§c${no}`, v: false }]);
  return r?.v === true;
}

/**
 * Ayar formu. fields: [{type:'slider'|'dropdown'|'toggle'|'text', label, ...}] → değer dizisi ya da undefined
 */
export async function modal(player, title, fields, submit = "Tamam") {
  const f = new ModalFormData().title(title);
  for (const x of fields) {
    if (x.type === "slider") f.slider(x.label, x.min, x.max, { defaultValue: x.value ?? x.min, valueStep: x.step ?? 1 });
    else if (x.type === "dropdown") f.dropdown(x.label, x.items, { defaultValueIndex: x.value ?? 0 });
    else if (x.type === "toggle") f.toggle(x.label, { defaultValue: !!x.value });
    else if (x.type === "text") f.textField(x.label, x.placeholder ?? "", { defaultValue: x.value ?? "" });
  }
  f.submitButton(submit);
  const r = await show(f, player);
  if (!r || r.canceled || !r.formValues) return undefined;
  const vals = r.formValues.filter((v) => v !== undefined);
  return vals.length === fields.length ? vals : r.formValues;
}

/** Simgeli çoklu seçim listesi (dokundukça işaretlenir). */
export async function pickMany(player, title, body, options, preselected = []) {
  const sel = new Set(preselected);
  for (;;) {
    const btns = [{ text: sel.size ? `§l§2Devam ▶§r §8(${sel.size} seçili)` : "§8Devam ▶ (önce seçim yap)", key: "__ok" }];
    for (const o of options) {
      btns.push({
        text: (sel.has(o.key) ? "§2✔ §l" : "§8") + o.name + "§r" + (o.note ? `\n§7${o.note}` : ""),
        icon: o.icon,
        key: o.key,
      });
    }
    const r = await menu(player, title, body, btns);
    if (!r) return undefined;
    if (r.key === "__ok") {
      if (sel.size) return [...sel];
      continue;
    }
    if (sel.has(r.key)) sel.delete(r.key);
    else sel.add(r.key);
  }
}

export const AMOUNTS = [1, 2, 4, 8, 16, 32, 48, 64, 96, 128, 192, 256, 384, 512];
export function amountIndex(n) {
  let best = 0;
  AMOUNTS.forEach((a, i) => {
    if (Math.abs(a - n) < Math.abs(AMOUNTS[best] - n)) best = i;
  });
  return best;
}
