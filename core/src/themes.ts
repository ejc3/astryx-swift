/**
 * The looks the demo offers, as Astryx theme overrides: the same inputs Astryx's own
 * `defineTheme` takes. The web page hands them to `defineTheme`; `scripts/themes.mjs`
 * runs Astryx's resolver over them at build time and writes
 * `themes.generated.ts`, which is what the Swift apps paint with. One list, so the three hosts cannot drift.
 */
export type ThemeInput = {
  id: string;
  label: string;
  /** Astryx token overrides: a string for both modes, or [light, dark]. */
  tokens: Record<string, string | readonly [string, string]>;
};

export const THEME_INPUTS: readonly ThemeInput[] = [
  { id: "astryx", label: "Astryx", tokens: {} },
  {
    id: "ocean",
    label: "Ocean",
    tokens: { "--color-accent": ["#0F766E", "#2DD4BF"], "--radius-container": "20px", "--radius-element": "12px" },
  },
  {
    id: "ember",
    label: "Ember",
    tokens: { "--color-accent": ["#C2410C", "#FB923C"], "--radius-container": "6px", "--radius-element": "4px" },
  },
  {
    id: "grape",
    label: "Grape",
    tokens: { "--color-accent": ["#7C3AED", "#A78BFA"], "--radius-container": "16px", "--radius-element": "999px" },
  },
];

/** One mode of one theme, resolved: colors as #RRGGBBAA, sizes in points. */
export type ResolvedMode = { colors: Record<string, string>; sizes: Record<string, number> };
export type ResolvedTheme = { id: string; label: string; light: ResolvedMode; dark: ResolvedMode };
export type ThemesFile = { source: string; themes: ResolvedTheme[] };
