/**
 * Words the native hosts draw but the web page does not carry (the web copy keeps Astryx's own
 * JSX, which writes them inline). They ride in each template's view model under `words`, and
 * the web drawing ignores them. `COMMON_WORDS` is shared by the checkout, order and settings
 * templates: field marks, the keyboard's buttons and a collapsible section's state.
 */
export const COMMON_WORDS = {
  optional: "Optional",
  /** Spoken before an error's message. */
  errorPrefix: "Error:",
  expanded: "Expanded",
  collapsed: "Collapsed",
  expandHint: "Expands this section",
  collapseHint: "Collapses this section",
  previous: "Previous",
  next: "Next",
  done: "Done",
};
export type CommonWords = typeof COMMON_WORDS;
