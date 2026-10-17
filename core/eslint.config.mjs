import { builtinModules } from "node:module";
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// The core: every screen's content, every word, every sort, filter and check. The web page
// and the Swift apps run it as it is; what differs between them comes in as arguments.
const NEUTRAL = "core/src is platform-neutral.";
const CLOCK = "Time comes in as an argument; core/src has no clock.";
const PORTABLE_CORE = {
  files: ["src/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [
      { group: ["node:*", ...builtinModules, ...builtinModules.map((m) => `${m}/*`)], message: NEUTRAL },
      { group: ["@astryxdesign/*", "react", "react-dom"], message: "core/src reads Astryx through themes.generated.ts." }] }],
    "no-restricted-properties": ["error",
      { object: "Math", property: "random", message: "The core has no randomness." },
      { object: "Date", property: "now", message: CLOCK },
      { object: "globalThis", message: NEUTRAL }],
    "no-restricted-syntax": ["error",
      { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: CLOCK },
      { selector: "CallExpression[callee.name='Date']", message: CLOCK }],
    "no-restricted-globals": ["error",
      ...["process", "window", "self", "document", "crypto", "performance", "localStorage",
        "setTimeout", "clearTimeout", "setInterval", "Intl"].map((name) => ({ name, message: NEUTRAL })),
      { name: "fetch", message: "core/src does no I/O. The host fetches." }],
  },
};

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.strict,
  PORTABLE_CORE,
  // noUncheckedIndexedAccess makes every index read optional; where it is known to be in range, `!` says so.
  { rules: { "@typescript-eslint/no-non-null-assertion": "off" } },
  globalIgnores(["node_modules/**", "scripts/**"]),
]);
