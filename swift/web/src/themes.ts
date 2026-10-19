import { defineTheme, type DefinedTheme } from "@astryxdesign/core/theme";
import { THEME_INPUTS } from "@astryx-native/core";

/**
 * The core's theme inputs are Astryx theme overrides; hand each one to Astryx's own
 * `defineTheme`, as the Swift apps' generated tokens were resolved from the same inputs.
 */
export const THEMES: Record<string, DefinedTheme> = Object.fromEntries(
  THEME_INPUTS.map((t) => [
    t.id,
    defineTheme({
      name: `an-${t.id}`,
      tokens: Object.fromEntries(Object.entries(t.tokens).map(([k, v]) => [k, typeof v === "string" ? v : [v[0], v[1]]])),
    }),
  ]),
);

/** The accent of a theme in light and dark, for the switcher's swatches. */
export function accentOf(id: string): readonly [string, string] | null {
  const accent = THEME_INPUTS.find((t) => t.id === id)?.tokens["--color-accent"];
  if (!accent) return null;
  return typeof accent === "string" ? [accent, accent] : accent;
}
