/**
 * Runs one template as the core does: its view state, the saved doc, and the mutations it asks
 * for, applied through the same checks and writes as the core (state.ts `save`). A test reads the
 * view, the doc and the mutations; `same` says an action changed nothing at all.
 */
import { applyWrites, emptyDoc, type Doc } from "../../src/sync/doc.ts";
import { writesOf, type Mutation } from "../../src/sync/mutations.ts";
import type { Now } from "../../src/format.ts";
import type { TemplateAction, TemplateModule } from "../../src/templates/types.ts";

export type World<S> = { state: S; doc: Doc; saved: Mutation[]; minted: number };

export function harness<S, V>(t: TemplateModule<S, V>, now: Now, extras = true) {
  const act = (w: World<S>, action: TemplateAction): World<S> => {
    const asked: Mutation[] = [];
    let minted = w.minted;
    const state = t.reduce(w.state, action, now, {
      doc: w.doc,
      extras,
      mint: () => `dev-${(++minted).toString(36)}`,
      save: (name, args) => void asked.push({ name, args }),
    });
    if (state === w.state && asked.length === 0) return w;
    let doc = w.doc;
    for (const m of asked) {
      const writes = writesOf(m.name, m.args);
      if (!writes) throw new Error(`refused: ${m.name} ${JSON.stringify(m.args)}`);
      doc = applyWrites(doc, writes);
    }
    return { state, doc, saved: [...w.saved, ...asked], minted };
  };
  return {
    start: (doc: Doc = emptyDoc()): World<S> => ({ state: t.initial(now), doc, saved: [], minted: 0 }),
    press: (w: World<S>, id: string) => act(w, { type: "press", id }),
    set: (w: World<S>, id: string, value: string | number | boolean) => act(w, { type: "set", id, value }),
    view: (w: World<S>, at: Now = now): V => t.view(w.state, at, w.doc, extras),
  };
}
