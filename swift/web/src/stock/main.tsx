// Astryx as it is today: its own page templates with their own React state, dropped in as they
// were generated. Nothing here knows about the app's core, so state is not shared on purpose.
import { defineTheme, Theme } from "@astryxdesign/core/theme";
import { lazy, StrictMode, Suspense, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

const load = (importer: () => Promise<{ default: ComponentType }>) => lazy(importer);

/** The templates, by the name of the `astryx template` that made each. The first is the default. */
const TEMPLATES: Record<string, ComponentType> = {
  "theme-showcase": load(() => import("./templates/theme-showcase.tsx")),
  dashboard: load(() => import("./templates/dashboard.tsx")),
  "table-inbox": load(() => import("./templates/table-inbox.tsx")),
  "kanban-board": load(() => import("./templates/kanban-board.tsx")),
  "table-page": load(() => import("./templates/table-page.tsx")),
  CalendarShowcase: load(() => import("./templates/CalendarShowcase.tsx")),
  "ai-chat": load(() => import("./templates/ai-chat.tsx")),
  "checkout-wizard": load(() => import("./templates/checkout-wizard.tsx")),
  "detail-page": load(() => import("./templates/detail-page.tsx")),
  settings: load(() => import("./templates/settings.tsx")),
};

/** Shorter names the host may use for the same templates. */
const ALIASES: Record<string, string> = {
  components: "theme-showcase",
  inbox: "table-inbox",
  kanban: "kanban-board",
  table: "table-page",
  calendar: "CalendarShowcase",
  chat: "ai-chat",
  checkout: "checkout-wizard",
  profile: "detail-page",
};

const FIRST = Object.keys(TEMPLATES)[0]!;

function resolve(name: string | null | undefined): string {
  if (name && name in TEMPLATES) return name;
  const alias = name ? ALIASES[name] : undefined;
  return alias ?? FIRST;
}

declare global {
  interface Window {
    /** The native app calls this when the person changes screens. */
    __astryxStock?: { show(name: string): void };
  }
}

const theme = defineTheme({ name: "astryx", tokens: {} });

function Stock() {
  const [name, setName] = useState(() => resolve(new URLSearchParams(window.location.search).get("template")));
  useEffect(() => {
    window.__astryxStock = { show: (next) => setName(resolve(next)) };
    return () => { delete window.__astryxStock; };
  }, []);
  const Page = TEMPLATES[name]!;
  return (
    <Theme theme={theme} mode="system">
      <Suspense fallback={null}>
        {/* A bare component block (the calendar) gets a margin; the page templates fill the window. */}
        <div style={name === "CalendarShowcase" ? { padding: 24 } : undefined}>
          <Page key={name} />
        </div>
      </Suspense>
    </Theme>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Stock />
  </StrictMode>,
);
