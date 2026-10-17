/**
 * The refactored stock Astryx templates, by id. Each lives in its own folder (model.ts).
 */
import { showcase } from "./showcase/model.ts";
import { dashboard } from "./dashboard/model.ts";
import { inbox } from "./inbox/model.ts";
import { kanban } from "./kanban/model.ts";
import { invoice } from "./invoice/model.ts";
import { calendar } from "./calendar/model.ts";
import { chat } from "./chat/model.ts";
import { checkout } from "./checkout/model.ts";
import { order } from "./order/model.ts";
import { settings } from "./settings/model.ts";
import type { AnyTemplate } from "./types.ts";

export const TEMPLATES: readonly AnyTemplate[] = [showcase, dashboard, inbox, kanban, invoice, calendar, chat, checkout, order, settings];

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

export function templateById(id: string): AnyTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
