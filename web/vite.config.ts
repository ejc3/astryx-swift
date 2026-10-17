import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// The native app loads this build from a custom URL scheme, so assets are relative ("./assets/...")
// and the page needs no server. Module scripts there are same-origin; drop the `crossorigin`
// attribute so a scheme handler does not have to answer CORS requests.
const plainScripts: Plugin = {
  name: "plain-scripts",
  enforce: "post",
  transformIndexHtml: (html) => html.replace(/ crossorigin(="[^"]*")?/g, ""),
};

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Astryx's components ship pre-built, so the app (index.html) needs no StyleX compiler. Two of
// Astryx's own page templates are written with stylex.create(), so the compiler runs, over
// the stock copies (src/stock) and their refactored copies (src/templates) only.
const stockOnly = (plugin: Plugin): Plugin => {
  const transform = plugin.transform;
  if (typeof transform !== "function") return plugin;
  return { ...plugin, transform(code, id, ...rest) { return id.includes("/src/stock/") || id.includes("/src/templates/") ? transform.call(this, code, id, ...rest) : null; } };
};

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    ...[stylex.vite({ unstable_moduleResolution: { type: "commonJS" } })].flat().map((p: Plugin) => stockOnly(p)),
    plainScripts,
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { index: here("index.html"), stock: here("stock.html") } },
  },
  server: { host: "localhost" },
  preview: { host: "localhost" },
});
