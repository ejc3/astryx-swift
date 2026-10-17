import { Text } from "@astryxdesign/core/Text";
import type { AppSnapshot } from "@astryx-native/core";
import { set } from "./client.ts";
import { accentOf } from "./themes.ts";

/** The look, chosen from swatches in the nav. Every word, and the id the choice goes back under, is the core's. */
export function ThemeSwitcher({ theme }: { theme: AppSnapshot["theme"] }) {
  return (
    <div className="an-swatch-group">
    <Text type="supporting" size="xsm">{theme.label}</Text>
    <div className="an-swatches" role="radiogroup" aria-label={theme.label}>
      {theme.options.map((o) => {
        const accent = accentOf(o.value);
        const on = o.value === theme.id;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            className="an-swatch"
            data-on={on ? "" : undefined}
            style={{ ["--an-swatch-light" as string]: accent ? accent[0] : "var(--color-accent)", ["--an-swatch-dark" as string]: accent ? accent[1] : "var(--color-accent)" }}
            onClick={() => set(theme.setId, o.value)}
          />
        );
      })}
    </div>
    </div>
  );
}
