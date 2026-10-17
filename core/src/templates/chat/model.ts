/**
 * Astryx's `ai-chat` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/chat.tsx; the stock copy is web/src/stock/templates/ai-chat.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type ChatState = Record<string, never>;
export type ChatView = Record<string, never>;

export const chat: TemplateModule<ChatState, ChatView> = {
  id: "chat",
  astryx: "ai-chat",
  title: "AI chat",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
