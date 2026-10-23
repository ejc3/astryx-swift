/** Settings: one saved row per setting, keyed by its name. Passwords and card numbers are never here. */
import { define, fields, isText, oneOf, put } from "../check.ts";
import type { Field } from "../doc.ts";
import { THEME_INPUTS } from "../../themes.ts";

export const tables = {
  settings_value: { value: "json" },
} as const;


export const DIGESTS = ["daily", "weekly", "never"] as const;
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

/** Every saved setting and the values it takes. Passwords and card numbers are never here. */
export const SETTINGS: Record<string, (v: unknown) => boolean> = {
  // The settings template's account fields.
  "account.username": isText(64),
  "account.firstName": isText(80),
  "account.lastName": isText(80),
  "account.email": isText(254),
  "account.dataExport": (v) => typeof v === "boolean",
  "account.adminMembers": (v) => typeof v === "boolean",
  "account.twoFactor": (v) => typeof v === "boolean",
  // The demo's Settings screen and Profile (the person's name, email and bio are shown on both).
  "profile.name": (v) => isText(80)(v) && (v as string).trim() !== "",
  "profile.email": isText(254),
  "profile.bio": isText(160),
  "profile.emailNotes": isBool,
  "profile.pushNotes": isBool,
  "profile.digest": oneOf(DIGESTS),
  "profile.density": oneOf(DENSITIES),
  "profile.reduceMotion": isBool,
  "profile.following": isBool,
  // The look of the app (a theme id, themes.ts).
  "app.theme": (v) => typeof v === "string" && THEME_INPUTS.some((t) => t.id === v),
};

const settingsSet = define<{ key: string; value: Field }>({
  check: (a) => {
    const o = fields<{ key: string; value: Field }>(a, { key: (v) => typeof v === "string" && v in SETTINGS, value: () => true });
    return o && SETTINGS[o.key]!(o.value) ? o : null;
  },
  writes: (a) => [put("settings_value", a.key, { value: a.value })],
});


export const mutations = {
  "settings.set": settingsSet,
};
