/**
 * Saved data for the chat template (core/src/templates/chat; docs/SYNC.md): the messages the person
 * sends. The sample conversation is not saved; a sent message is drawn after it, in time order.
 */
import { define, fields, isId, isInstant, oneOf, put } from "../check.ts";

export const CHAT_MODES = ["ask", "edit"] as const;
export const MAX_MESSAGE = 8000;

export const tables = {
  chat_message: { text: "string", mode: "string", sentAt: "number" },
} as const;

const chatSend = define<{ id: string; text: string; mode: string; at: number }>({
  check: (a) => fields(a, { id: isId, text: (v) => typeof v === "string" && v.trim() !== "" && v.length <= MAX_MESSAGE, mode: oneOf(CHAT_MODES), at: isInstant }),
  writes: (a) => [put("chat_message", a.id, { text: a.text.trim(), mode: a.mode, sentAt: a.at })],
});

export const mutations = {
  "chat.send": chatSend,
};
