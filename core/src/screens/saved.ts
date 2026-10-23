/**
 * The demo screens' data: the sample rows with the person's saved rows laid over them
 * (docs/SYNC.md, sync/areas/demo.ts and settings.ts). Pure functions of the saved `Doc`; a saved
 * row that is malformed or says something the screen cannot show is ignored, so a screen always
 * draws, and the sample value shows through.
 */
import { overlay, type Doc } from "../sync/doc.ts";
import { CART_QUANTITIES, CHAT, MESSAGES, PEOPLE, PRODUCTS, PROFILE_DEFAULTS, SHIPPING, TASKS, type Message, type Task } from "../sample.ts";
import { SETTINGS } from "../sync/areas/settings.ts";
import { MAX_QUANTITY, SHIP_ROW, TASK_COLUMNS } from "../sync/areas/demo.ts";

/** The inbox's messages: the sample, with the read, starred and archived flags the person set. */
export const messagesOf = (doc: Doc): Message[] => overlay(MESSAGES, doc.demo_message, () => null);

/** The task board's tasks: the sample, with the columns the person moved them to. */
export function tasksOf(doc: Doc): Task[] {
  return overlay(TASKS, doc.demo_task, () => null).map((t) => ((TASK_COLUMNS as readonly string[]).includes(t.column) ? t : { ...t, column: TASKS.find((x) => x.id === t.id)!.column }));
}

/** A line of the chat as drawn: a sample line has `minutesAgo`; a sent one has the absolute time `at` (epoch ms). */
export type ChatEntry = { id: string; from: string; text: string; minutesAgo?: number; at?: number };

/** The chat: the sample lines, then the lines sent, in the order they were sent. */
export function chatOf(doc: Doc): ChatEntry[] {
  const sent: ChatEntry[] = [];
  for (const r of Object.values(doc.demo_chat)) {
    if (typeof r.author === "string" && PEOPLE.some((p) => p.id === r.author) && typeof r.text === "string" && typeof r.at === "number") sent.push({ id: r.id, from: r.author, text: r.text, at: r.at });
  }
  sent.sort((a, b) => a.at! - b.at! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...CHAT, ...sent];
}

/** How many canned replies have been sent: the next one is `REPLIES[this % REPLIES.length]`, so the cycle carries on after a relaunch. */
export const repliesSent = (doc: Doc): number => Object.values(doc.demo_chat).filter((r) => typeof r.reply === "number").length;

/** Quantity of each product in the cart. */
export function cartOf(doc: Doc): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of PRODUCTS) {
    const q = doc.demo_cart[p.id]?.quantity;
    out[p.id] = typeof q === "number" && Number.isInteger(q) && q >= 0 && q <= MAX_QUANTITY ? q : CART_QUANTITIES[p.id] ?? 0;
  }
  return out;
}

/** The shipping address and delivery choice (never the card). */
export function shipOf(doc: Doc): { name: string; address: string; city: string; zip: string; shipping: string } {
  const r = doc.demo_checkout[SHIP_ROW];
  const text = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    name: text(r?.name), address: text(r?.address), city: text(r?.city),
    zip: /^\d{0,5}$/.test(text(r?.zip)) ? text(r?.zip) : "",
    shipping: SHIPPING.some((x) => x.value === r?.shipping) ? (r!.shipping as string) : SHIPPING[0]!.value,
  };
}

export type Profile = { -readonly [K in keyof typeof PROFILE_DEFAULTS]: (typeof PROFILE_DEFAULTS)[K] extends boolean ? boolean : string };

/** The demo account's saved settings over their defaults. */
export function profileOf(doc: Doc): Profile {
  const out: Record<string, string | boolean> = { ...PROFILE_DEFAULTS };
  for (const k of Object.keys(PROFILE_DEFAULTS)) {
    const key = `profile.${k}`;
    const v = doc.settings_value[key]?.value;
    if ((typeof v === "string" || typeof v === "boolean") && SETTINGS[key]!(v)) out[k] = v;
  }
  return out as Profile;
}

/** The theme the person chose, when one is saved. */
export function savedTheme(doc: Doc): string | undefined {
  const v = doc.settings_value["app.theme"]?.value;
  return typeof v === "string" && SETTINGS["app.theme"]!(v) ? v : undefined;
}
