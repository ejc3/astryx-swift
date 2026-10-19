import type { Action } from "@astryx-native/core";

/**
 * What a refactored template gets: its view model from the core (the type is its model's
 * `View`, exported from core/src/templates/<id>/model.ts; cast `view` to it), and `send`,
 * which dispatches an action. A template's own action ids start "tpl.<template id>.".
 */
export type TemplateProps = { view: unknown; send: (action: Action) => void };
