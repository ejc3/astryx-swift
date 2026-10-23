/**
 * Every change to saved data, by name (docs/SYNC.md). A mutation checks its arguments and turns
 * them into row writes, with no reads: the core applies the writes to its own `Doc`, Zero's client
 * applies them to its local store, and the server applies them to Postgres inside its transaction,
 * setting each row's owner from the signed-in user. Because nothing here reads, the three cannot
 * disagree about what a mutation does.
 *
 * A template's `reduce` asks for a mutation by calling `io.save(name, args)`; it never edits the
 * doc itself.
 */
import type { Write } from "./doc.ts";
import type { Args, MutationDef } from "./check.ts";
import * as kanban from "./areas/kanban.ts";
import * as settings from "./areas/settings.ts";
import * as inbox from "./areas/inbox.ts";
import * as chat from "./areas/chat.ts";
import * as checkout from "./areas/checkout.ts";
import * as order from "./areas/order.ts";
import * as demo from "./areas/demo.ts";

export { isId } from "./check.ts";
export { KANBAN_COLUMNS, KANBAN_PRIORITIES, MAX_TITLE } from "./areas/kanban.ts";
export { SETTINGS } from "./areas/settings.ts";

/** Every area's tables, for doc.ts's SCHEMA. An area is one file in ./areas; a table is added there and nowhere else. */
export const AREA_TABLES = { ...kanban.tables, ...settings.tables, ...inbox.tables, ...chat.tables, ...checkout.tables, ...order.tables, ...demo.tables };

/** Every area's mutations, by name ("<area>.<what>"). */
export const MUTATIONS = {
  ...kanban.mutations,
  ...settings.mutations,
  ...inbox.mutations,
  ...chat.mutations,
  ...checkout.mutations,
  ...order.mutations,
  ...demo.mutations,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, MutationDef<any>>;

export type MutationName = keyof typeof MUTATIONS;
export type Mutation = { name: MutationName; args: Args };
export const isMutationName = (name: string): name is MutationName => name in MUTATIONS;

/** The writes a mutation makes, or `null` when its name or arguments are refused. */
export function writesOf(name: string, args: unknown): Write[] | null {
  if (!isMutationName(name)) return null;
  const def = MUTATIONS[name] as MutationDef<Args>;
  const checked = def.check(args);
  return checked ? def.writes(checked) : null;
}
