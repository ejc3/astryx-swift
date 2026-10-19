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

export type TemplateAction = { type: "press"; id: string } | { type: "set"; id: string; value: string | number | boolean };

export type TemplateModule<S, V> = {
  id: string;
  /** The Astryx template it refactors, as `npx astryx template` names it. */
  astryx: string;
  title: string;
  initial(now: Now): S;
  reduce(state: S, action: TemplateAction, now: Now): S;
  /** Everything the JSX shows: plain JSON, every word and number worked out. */
  view(state: S, now: Now): V;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTemplate = TemplateModule<any, unknown>;
