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

// The StyleX plugin appends the compiled CSS to one stylesheet only (the app page's). The stock
// page's Astryx CSS sits in a chunk shared with the app page, so it would draw Astryx's
// templates without their StyleX rules: give stock.html the same CSS as a file of its own.
const stylexPlugins = [stylex.vite({ unstable_moduleResolution: { type: "commonJS" } })].flat() as (Plugin & { __stylexCollectCss?: () => string })[];
const stylexForStock: Plugin = {
  name: "stylex-for-stock",
  enforce: "post",
  generateBundle(_options, bundle) {
    const css = stylexPlugins.map((p) => p.__stylexCollectCss?.() ?? "").join("\n").trim();
    const html = bundle["stock.html"];
    if (!css || !html || html.type !== "asset") return;
    const fileName = "assets/stylex-stock.css";
    this.emitFile({ type: "asset", fileName, source: css });
    const page = typeof html.source === "string" ? html.source : new TextDecoder().decode(html.source);
    html.source = page.replace("</head>", `  <link rel="stylesheet" href="./${fileName}">\n  </head>`);
  },
};

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    ...stylexPlugins.map((p: Plugin) => stockOnly(p)),
    stylexForStock,
    plainScripts,
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { index: here("index.html"), stock: here("stock.html") } },
  },
  server: { host: "localhost" },
  preview: { host: "localhost" },
});
