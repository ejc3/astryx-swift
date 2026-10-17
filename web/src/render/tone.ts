import type { Gap, Tone } from "@astryx-native/core";

/** Astryx's spacing steps for the core's four gaps. */
export const GAP = { xs: 1, sm: 2, md: 4, lg: 6 } as const satisfies Record<Gap, 1 | 2 | 4 | 6>;

/** A tone as a text color, from Astryx's tokens. */
export const TEXT_TONE: Record<Tone, string> = {
  neutral: "var(--color-text-secondary)",
  accent: "var(--color-text-accent)",
  success: "var(--color-success)",
  warning: "var(--color-text-orange)",
  danger: "var(--color-error)",
  info: "var(--color-text-blue)",
};

/** A tone as a fill: dots, bars, lines. */
export const FILL_TONE: Record<Tone, string> = {
  neutral: "var(--color-icon-secondary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-error)",
  info: "var(--color-icon-blue)",
};

/** The theme's accent, thinned out: Astryx's own muted accent does not follow a theme's accent override. */
export const ACCENT_SOFT = "color-mix(in srgb, var(--color-accent) 16%, transparent)";

/** A tone as a soft background behind an icon or a chip. */
export const SOFT_TONE: Record<Tone, string> = {
  neutral: "var(--color-background-muted)",
  accent: ACCENT_SOFT,
  success: "var(--color-success-muted)",
  warning: "var(--color-warning-muted)",
  danger: "var(--color-error-muted)",
  info: "var(--color-background-blue)",
};
