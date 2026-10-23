/**
 * A stock Astryx template, refactored: its state, its sample data and its logic live here,
 * in the core; its JSX stays as Astryx wrote it (web/src/templates/<id>.tsx) and draws the
 * view model this module builds. The stock copy (web/src/stock/templates) keeps its own
 * React state and must look pixel-for-pixel the same: that is the refactor's test.
 *
 * A template's actions arrive with ids under its own prefix ("tpl.<id>.<what>[:arg]");
 * `reduce` receives them with the prefix removed.
 */
import type { Now } from "../format.ts";
import { emptyDoc, type Doc } from "../sync/doc.ts";
import type { MutationName } from "../sync/mutations.ts";

export type TemplateAction = { type: "press"; id: string } | { type: "set"; id: string; value: string | number | boolean };

export type TemplateModule<S, V> = {
  id: string;
  /** The Astryx template it refactors, as `npx astryx template` names it. */
  astryx: string;
  title: string;
  initial(now: Now): S;
  /**
   * The template's next view state. A change to saved data is asked for with `io.save`, never
   * made to `io.doc` directly (docs/SYNC.md); the core applies it before the next `view`.
   */
  reduce(state: S, action: TemplateAction, now: Now, io?: TemplateIO): S;
  /**
   * Everything the JSX shows: plain JSON, every word and number worked out. `doc` is the saved
   * data; `extras` is false where only stock Astryx's behaviour is wanted (see TemplateIO).
   */
  view(state: S, now: Now, doc?: Doc, extras?: boolean): V;
};

/** What a template's `reduce` may read and ask for, besides its own view state. */
export type TemplateIO = {
  /** The saved data as it stands before this action. */
  readonly doc: Doc;
  /** False when the page draws stock Astryx's behaviour only (the parity harness): nothing beyond stock happens, nothing is saved. */
  readonly extras: boolean;
  /** A new record's id, unique to this device's seed. */
  mint(): string;
  /** Asks for a mutation (sync/mutations.ts); it is checked, applied and sent after `reduce` returns. */
  save(name: MutationName, args: Record<string, unknown>): void;
};

/** For tests and callers with no saved data: an empty doc that refuses nothing and saves nowhere. */
export function detachedIO(saved: { name: MutationName; args: Record<string, unknown> }[] = [], doc: Doc = emptyDoc()): TemplateIO {
  let n = 0;
  return { doc, extras: true, mint: () => `test-${++n}`, save: (name, args) => void saved.push({ name, args }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTemplate = TemplateModule<any, unknown>;
