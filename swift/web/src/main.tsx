import { Theme } from "@astryxdesign/core/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./styles.css";
import { useApp } from "./client.ts";
import { Shell } from "./Shell.tsx";
import { TemplateNode } from "./render/template.tsx";
import { THEMES } from "./themes.ts";

/**
 * `?bare=1`: a template screen alone, wrapped exactly as the stock page wraps its copy
 * (stock.html), so the two can be compared pixel for pixel (scripts/parity.mjs).
 */
const bare = new URLSearchParams(window.location.search).get("bare") === "1";
if (bare) document.documentElement.setAttribute("data-bare", "");

function App() {
  const app = useApp();
  // In the native app's web view the first snapshot comes from the host; until then, a blank page.
  if (!app) return null;
  const theme = THEMES[app.theme.id] ?? THEMES["astryx"]!;
  const body = app.screen.body;
  if (bare && body.kind === "template") {
    return (
      <Theme theme={theme} mode="system">
        <div style={body.template === "calendar" ? { padding: 24 } : undefined}>
          <TemplateNode node={body} />
        </div>
      </Theme>
    );
  }
  return (
    <Theme theme={theme} mode="system">
      <Shell app={app} />
    </Theme>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
