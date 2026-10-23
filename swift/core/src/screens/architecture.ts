/**
 * "How it works": the architecture of the whole project as a `diagram` node (ui.ts), drawn by
 * every host. Every box is something in this repository or a service it runs against; every edge
 * is a call, a payload or a build step the code makes. The numbers come from the core's own lists
 * where it has them (templates, mutations, tables, scenarios, themes); the rest are constants that
 * core/test/architecture.test.ts checks against the files they come from.
 */
import { SCENARIOS } from "../scenarios.generated.ts";
import { TABLES } from "../sync/doc.ts";
import { MUTATIONS } from "../sync/mutations.ts";
import { TEMPLATES } from "../templates/index.ts";
import { THEMES } from "../themes.generated.ts";
import { THEME_INPUTS } from "../themes.ts";
import { SHARED_SHARE } from "./story.ts";
import type { State } from "../state.ts";
import type { DiagramArea, DiagramBox, DiagramEdge, DiagramEdgeStyle, DiagramGroup, DiagramNode, DiagramPanel, DiagramRoute, Screen } from "../ui.ts";
import { grouped } from "../format.ts";
import { BOX_AREAS, columnRoutes, GRIDS, GROUP_AREAS, neighbours, singleAreas, WIDE_ROUTES, withMargins } from "./architecture.layout.ts";

/** Pinned exactly in web/package.json and core/package.json. */
export const ASTRYX_VERSION = "0.7.1";
/** Pinned in sync/, server/ and apps/native/package.json. */
export const ZERO_VERSION = "1.11.0";
/** apps/native/package.json: React Native on iOS, react-native-macos on the Mac. */
export const REACT_NATIVE = { ios: "0.83.10", macos: "0.83.0" };
/** The parity harness's last full run (README.md): comparisons identical, of all made. */
export const PARITY = { identical: 1216, total: 1216 };

/** "How this was built" (story.ts, `SHARED`): the share of all hand-written code that the core and sync/ are. */
export const SHARED_PERCENT = SHARED_SHARE;

export const SELECT = "how.select";
export const CLOSE = "how.close";
/** The diagram's own width below which the narrow arrangement is drawn, and the single column. */
export const NARROW_BELOW = 700;
export const SINGLE_BELOW = 320;
/** The fixtures core/scripts/fixtures.ts writes (checked against the folder by the tests). */
export const FIXTURES = { screens: 17, templates: 10, themes: 4 };

type BoxSpec = Pick<DiagramBox, "id" | "title" | "detail" | "group" | "shared"> & { about: string; files: string[]; facts: { label: string; value: string }[] };

const n = (x: number) => grouped(x);
const mutationAreas = new Set(Object.keys(MUTATIONS).map((name) => name.split(".")[0])).size;
const steps = SCENARIOS.reduce((sum, s) => sum + s.steps.length, 0);
const firstTheme = THEMES.themes[0]!;
const tokensPerMode = Object.keys(firstTheme.light.colors).length + Object.keys(firstTheme.light.sizes).length;

const GROUP_TITLES: Record<string, string> = {
  astryx: "Astryx", core: "Headless core", app: "Apple app", drawings: "Drawings", proof: "Proof", sync: "Data and sync",
};

const BOXES: BoxSpec[] = [
  {
    id: "cli", group: "astryx", title: "Astryx CLI", detail: "@astryxdesign/cli", shared: false,
    about: "Astryx's command line. npx astryx template generates its page templates; ten of them are kept here exactly as generated, and each is refactored onto the core.",
    files: ["web/package.json", "web/src/stock/templates/"],
    facts: [{ label: "Version", value: `${ASTRYX_VERSION}, pinned exactly` }, { label: "Templates refactored", value: n(TEMPLATES.length) }],
  },
  {
    id: "components", group: "astryx", title: "Astryx components", detail: "@astryxdesign/core", shared: false,
    about: "Meta's design system: React 19 components with pre-built CSS, themed through CSS custom properties. Both web drawings and stock Astryx are built from its components; its theme resolver makes the tokens Swift paints with.",
    files: ["web/package.json", "core/package.json"],
    facts: [{ label: "Version", value: `${ASTRYX_VERSION}, pinned exactly` }, { label: "Themes defined here", value: n(THEME_INPUTS.length) }],
  },
  {
    id: "templates", group: "core", title: "Templates", detail: "initial · reduce · view", shared: true,
    about: "Each stock template's state, sample data and logic, taken out of React. reduce returns the next state and asks for the mutations to save; it never edits saved data itself. Pure TypeScript: no DOM, no Intl, no clock (now is an argument), no randomness.",
    files: ["core/src/templates/types.ts", "core/src/templates/", "core/src/state.ts"],
    facts: [{ label: "Templates", value: n(TEMPLATES.length) }, { label: "Runs in", value: "Node, browsers, Hermes" }, { label: "Shared code", value: `The core and sync: ${SHARED_PERCENT} of all hand-written code` }],
  },
  {
    id: "view", group: "core", title: "View model", detail: "Words, rules, results", shared: true,
    about: "The view function returns plain JSON: every label, count, sort, filter, validation message, layout threshold and search result. The app store holds the current screen's; hosts draw it and send actions back with its ids.",
    files: ["core/src/app.ts", "core/src/ui.ts"],
    facts: [{ label: "Stores", value: "app, theme" }, { label: "Visible words in hosts", value: "none" }],
  },
  {
    id: "tokens", group: "core", title: "Theme tokens", detail: "Resolved, light and dark", shared: true,
    about: "A build step runs Astryx's own theme resolver over the core's theme inputs and writes the resolved tokens. The core publishes them as the theme store; SwiftUI reads each token by name.",
    files: ["core/src/themes.ts", "core/scripts/themes.mjs", "core/src/themes.generated.ts"],
    facts: [{ label: "Themes", value: n(THEMES.themes.length) }, { label: "Tokens per mode", value: n(tokensPerMode) }],
  },
  {
    id: "saved", group: "core", title: "Saved data", detail: "Doc, mutations by area", shared: true,
    about: "What a person made or changed, as rows in named tables (the Doc). Every change is a named mutation: a pure function from checked arguments to row writes, so the core, Zero's client and the API all write the same rows.",
    files: ["core/src/sync/doc.ts", "core/src/sync/mutations.ts", "core/src/sync/areas/"],
    facts: [{ label: "Mutations", value: n(Object.keys(MUTATIONS).length) }, { label: "Areas", value: n(mutationAreas) }, { label: "Tables", value: n(TABLES.length) }],
  },
  {
    id: "hermes", group: "app", title: "Hermes", detail: "Headless React Native", shared: false,
    about: "Hermes runs the core and sync in the app. React Native's factory starts the runtime and no root view or surface: nothing is drawn by React Native. The bundle is the core, the sync layer and a little glue, compiled to Hermes bytecode.",
    files: ["apps/native/js/index.ts", "apps/native/apple/Host/ReactRuntime.swift", "apps/native/scripts/bundle.mjs"],
    facts: [{ label: "Runs", value: "the core, sync and the glue" }, { label: "iOS", value: `React Native ${REACT_NATIVE.ios}` }, { label: "Mac", value: `react-native-macos ${REACT_NATIVE.macos}` }],
  },
  {
    id: "axclient", group: "app", title: "AXClient", detail: "The TurboModule bridge", shared: false,
    about: "One native module. JavaScript calls connected, changed (a store's snapshot JSON), answered and start (the first screen and saved doc); the host calls in with onCall events (getSnapshot, dispatch with action JSON, auth), answered by id.",
    files: ["apps/native/js/specs/NativeAXClient.ts", "apps/native/apple/Host/AXClientModule.mm", "apps/native/apple/Host/ClientHost.swift"],
    facts: [{ label: "Methods", value: "connected, changed, answered, start" }, { label: "Event", value: "onCall (getSnapshot, dispatch, auth)" }, { label: "Stores", value: "app, theme, doc" }],
  },
  {
    id: "webviews", group: "app", title: "WKWebView panes", detail: "Served by astryx://", shared: false,
    about: "The web build ships inside the app and a custom astryx:// scheme handler serves it, so nothing is fetched. The pane on the shared core gets every snapshot through window.__astryx.receive and posts its actions back.",
    files: ["apps/native/apple/Host/WebPane.swift"],
    facts: [{ label: "Panes", value: "web on Hermes, own core, stock" }],
  },
  {
    id: "swiftui", group: "drawings", title: "AstryxKit", detail: "SwiftUI: Mac, iPhone", shared: false,
    about: "A Swift package that decodes each snapshot and draws every node and template, painted with Astryx's tokens. It has no visible words of its own, and sends the core's action ids exactly.",
    files: ["apps/native/apple/AstryxKit/Sources/AstryxKit/", "apps/native/apple/AstryxKit/Sources/AstryxKit/Protocol/Node.swift"],
    facts: [{ label: "Runs on", value: "iOS 17, macOS 14 and later" }],
  },
  {
    id: "jsx", group: "drawings", title: "Web on Hermes", detail: "Astryx JSX, app's core", shared: false,
    about: "The refactored page in the app's web view, drawing the shared core's snapshots. Each template keeps Astryx's JSX as generated and draws the view model instead of local state; its handlers dispatch actions.",
    files: ["web/src/templates/", "web/src/render/", "web/src/client.ts"],
    facts: [{ label: "Templates", value: n(TEMPLATES.length) }],
  },
  {
    id: "own", group: "drawings", title: "Web, own core", detail: "Same code, own core", shared: false,
    about: "The same refactored page code, standalone, on a core of its own in the page and no Hermes: the web app as it ships, and what the parity harness compares with stock. In the app it follows the current screen and nothing else.",
    files: ["web/src/client.ts", "web/index.html"],
    facts: [{ label: "Shares with the app", value: "the current screen" }],
  },
  {
    id: "stock", group: "drawings", title: "Stock Astryx", detail: "Reference, own state", shared: false,
    about: "Astryx's templates exactly as the CLI generated them, built from its components, on their own React state. They are never edited: they are the specification the refactored copies are held to.",
    files: ["web/src/stock/templates/", "web/stock.html"],
    facts: [{ label: "Shares with the app", value: "which template" }],
  },
  {
    id: "fixtures", group: "proof", title: "Swift fixtures", detail: "Snapshots, decoded", shared: false,
    about: "A script writes every screen's snapshot and every theme as JSON from the core; AstryxKit's tests decode each one and draw it to an image.",
    files: ["core/scripts/fixtures.ts", "apps/native/apple/AstryxKit/Tests/AstryxKitTests/Fixtures/"],
    facts: [{ label: "Screens", value: n(FIXTURES.screens) }, { label: "Templates", value: n(FIXTURES.templates) }, { label: "Themes", value: n(FIXTURES.themes) }],
  },
  {
    id: "replay", group: "proof", title: "Scenario replay", detail: "Recorded, both sides", shared: false,
    about: "Each template's parity steps are recorded once: where a person acted, and what the core received. They replay headless on fresh pages, and in the app driven from native or from the web while the other drawings follow.",
    files: ["web/scripts/record-scenarios.mjs", "core/src/scenarios.generated.ts", "apps/native/apple/Host/ClientHost.swift"],
    facts: [{ label: "Scenarios", value: n(SCENARIOS.length) }, { label: "Steps", value: n(steps) }],
  },
  {
    id: "parity", group: "proof", title: "Parity", detail: `${PARITY.identical} of ${PARITY.total} identical`, shared: false,
    about: "Each template's steps run in the stock page and the refactored one, and every full-page capture is compared with pixelmatch at threshold 0. Stock is never changed to make it pass.",
    files: ["web/scripts/parity.mjs", "web/scripts/parity-steps/"],
    facts: [{ label: "Identical", value: `${PARITY.identical} of ${PARITY.total}` }, { label: "Browsers", value: "Chromium, WebKit" }, { label: "Modes", value: "light, dark" }, { label: "Sizes", value: "1440 × 900, 390 × 844" }],
  },
  {
    id: "device", group: "sync", title: "Device copy", detail: "The doc, signed out", shared: false,
    about: "Signed out, everything works and the core's doc is written to the device after each change: Application Support in the apps, localStorage in the page.",
    files: ["apps/native/apple/Host/SavedDoc.swift", "web/src/client.ts"],
    facts: [{ label: "Sign-in", value: "optional" }],
  },
  {
    id: "zero", group: "sync", title: "Zero client", detail: "op-sqlite or IndexedDB", shared: true,
    about: "Signed in, sync subscribes to one query per table and hands the rows to the core, and sends each mutation to the Zero mutator made from the core's. Its store is op-sqlite in Hermes and IndexedDB in the page.",
    files: ["sync/src/client.ts", "sync/src/mutators.ts", "sync/src/queries.ts"],
    facts: [{ label: "Zero", value: ZERO_VERSION }, { label: "Queries", value: n(TABLES.length) }],
  },
  {
    id: "cache", group: "sync", title: "zero-cache", detail: "Replicates Postgres", shared: false,
    about: "Zero's server. It keeps a replica of Postgres, keeps each client's queries live, and asks the API what a query may read and how to run a mutation.",
    files: ["sync/scripts/e2e-sync.ts", "docs/SYNC.md"],
    facts: [{ label: "Zero", value: ZERO_VERSION }, { label: "Runs (docs/SYNC.md)", value: "Fargate, beside the API" }],
  },
  {
    id: "api", group: "sync", title: "API", detail: "Runs core mutations", shared: false,
    about: "Hono on Node. /api/zero/mutate runs the same core mutations in a Postgres transaction as the signer; /api/zero/query reads only the signer's rows. It checks zero-cache's key and the person's token.",
    files: ["server/src/zero.ts", "server/src/app.ts", "sync/src/schema.ts"],
    facts: [{ label: "Mutators", value: n(Object.keys(MUTATIONS).length) }, { label: "Runs (docs/SYNC.md)", value: "Fargate, beside zero-cache" }],
  },
  {
    id: "postgres", group: "sync", title: "Postgres", detail: "The source of truth", shared: false,
    about: "One table per saved table, keyed by owner and id, with logical replication on so zero-cache can follow it.",
    files: ["sync/src/schema.ts"],
    facts: [{ label: "Tables", value: n(TABLES.length) }, { label: "Runs (docs/SYNC.md)", value: "Amazon RDS" }],
  },
  {
    id: "access", group: "sync", title: "Cloudflare Access", detail: "Signs people in", shared: false,
    about: "Access does the signing in, and nothing here stores a password. Behind it, the API's sign-in path answers with a token of its own, an Ed25519 JWT, which the app gives to Zero.",
    files: ["server/src/access.ts", "server/src/tokens.ts"],
    facts: [{ label: "Token", value: "Ed25519 JWT, the API's own" }],
  },
];

type EdgeSpec = Pick<DiagramEdge, "id" | "from" | "to" | "label" | "style"> & { toGroup?: boolean; direction?: "forward" | "both"; key?: boolean; quiet?: boolean };

/**
 * Every edge, in the order labels are placed. `key`: labelled even when nothing is selected.
 * `quiet`: the way back of a pair beside it, never labelled on the drawing (its box's panel says
 * it). Where each one runs is in architecture.layout.ts.
 */
const EDGES: EdgeSpec[] = [
  { id: "hermes-core", from: "hermes", to: "core", toGroup: true, label: "runs the core and sync", style: "control", key: true },
  { id: "cli-templates", from: "cli", to: "templates", label: "refactored", style: "build", key: true },
  { id: "cli-stock", from: "cli", to: "stock", label: "generated", style: "build", key: true },
  { id: "components-drawings", from: "components", to: "drawings", toGroup: true, label: "components", style: "build", key: true },
  { id: "components-tokens", from: "components", to: "tokens", label: "resolved", style: "build", key: true },
  { id: "view-axclient", from: "view", to: "axclient", label: "snapshot JSON", style: "data" },
  { id: "axclient-templates", from: "axclient", to: "templates", label: "action JSON", style: "control" },
  { id: "saved-zero", from: "saved", to: "zero", label: "mutations · rows", style: "sync", direction: "both", key: true },
  { id: "zero-cache", from: "zero", to: "cache", label: "WebSocket", style: "sync", direction: "both", key: true },
  { id: "postgres-cache", from: "postgres", to: "cache", label: "replication", style: "sync", key: true },
  { id: "templates-view", from: "templates", to: "view", label: "view()", style: "data" },
  { id: "templates-saved", from: "templates", to: "saved", label: "mutations", style: "control" },
  { id: "tokens-axclient", from: "tokens", to: "axclient", label: "theme JSON", style: "data" },
  { id: "axclient-swiftui", from: "axclient", to: "swiftui", label: "snapshot JSON", style: "data" },
  { id: "swiftui-axclient", from: "swiftui", to: "axclient", label: "action JSON", style: "control", quiet: true },
  { id: "axclient-webviews", from: "axclient", to: "webviews", label: "snapshot JSON", style: "data" },
  { id: "webviews-axclient", from: "webviews", to: "axclient", label: "action JSON", style: "control", quiet: true },
  { id: "webviews-jsx", from: "webviews", to: "jsx", label: "receive()", style: "data" },
  { id: "jsx-webviews", from: "jsx", to: "webviews", label: "postMessage", style: "control", quiet: true },
  { id: "webviews-own", from: "webviews", to: "own", label: "screen only", style: "data" },
  { id: "webviews-stock", from: "webviews", to: "stock", label: "template name", style: "data" },
  { id: "fixtures-swiftui", from: "fixtures", to: "swiftui", label: "decoded", style: "build" },
  { id: "replay-swiftui", from: "replay", to: "swiftui", label: "drives", style: "control" },
  { id: "replay-jsx", from: "replay", to: "jsx", label: "drives", style: "control" },
  { id: "parity-own", from: "parity", to: "own", label: "compares", style: "build" },
  { id: "parity-stock", from: "parity", to: "stock", label: "compares", style: "build" },
  { id: "saved-device", from: "saved", to: "device", label: "signed out", style: "data" },
  { id: "cache-api", from: "cache", to: "api", label: "query · mutate", style: "control" },
  { id: "api-postgres", from: "api", to: "postgres", label: "same mutations", style: "data" },
  { id: "access-api", from: "access", to: "api", label: "identity", style: "control" },
  { id: "api-zero", from: "api", to: "zero", label: "token", style: "control" },
];

const LEGEND: { style: DiagramEdgeStyle; label: string }[] = [
  { style: "data", label: "Data: snapshots, rows" },
  { style: "control", label: "Control: actions, calls" },
  { style: "sync", label: "Sync" },
  { style: "build", label: "Build and test" },
];

type ColumnLayout = "narrow" | "single";
const SINGLE = singleAreas();
const COLUMN_AREAS: Record<ColumnLayout, { boxes: Record<string, DiagramArea>; groups: Record<string, DiagramArea> }> = {
  narrow: {
    boxes: Object.fromEntries(Object.entries(BOX_AREAS).map(([id, a]) => [id, a.narrow])),
    groups: Object.fromEntries(Object.entries(GROUP_AREAS).map(([id, a]) => [id, a.narrow])),
  },
  single: SINGLE,
};

/** The edges a column arrangement draws in a state: between neighbours always, the selected box's too. */
function drawnIn(layout: ColumnLayout, sel: string | null): EdgeSpec[] {
  const { boxes } = COLUMN_AREAS[layout];
  const columns = GRIDS[layout].columns;
  return EDGES.filter((e) => e.from === sel || e.to === sel || (!e.toGroup && neighbours(columns, boxes, boxes[e.from]!, boxes[e.to]!)));
}

/** A column arrangement's routes in a state (selection), cached: the core is pure, so they never change. */
const columnCache = new Map<string, Record<string, DiagramRoute>>();
function columnRoutesFor(layout: ColumnLayout, sel: string | null): Record<string, DiagramRoute> {
  const key = `${layout}:${sel ?? ""}`;
  let routes = columnCache.get(key);
  if (!routes) {
    const { boxes, groups } = COLUMN_AREAS[layout];
    routes = columnRoutes(GRIDS[layout].columns, GRIDS[layout].gap.x, boxes, groups, drawnIn(layout, sel).map((e) => ({ ...e, toGroup: e.toGroup === true })));
    columnCache.set(key, routes);
  }
  return routes;
}

/** Each arrangement's grid, with margins wide enough for every state's outside routes (so a selection never moves the grid). */
const LAYOUTS = {
  wide: withMargins(GRIDS.wide, Object.values(WIDE_ROUTES)),
  narrow: withMargins(GRIDS.narrow, [null, ...BOXES.map((b) => b.id)].flatMap((sel) => Object.values(columnRoutesFor("narrow", sel)))),
  single: withMargins(GRIDS.single, [null, ...BOXES.map((b) => b.id)].flatMap((sel) => Object.values(columnRoutesFor("single", sel)))),
};

/** The boxes, groups and edges of the diagram, every one with its words. */
export function architectureDiagram(selected: string | null): DiagramNode {
  const box = (id: string) => BOXES.find((b) => b.id === id)!;
  const sel = selected !== null && BOXES.some((b) => b.id === selected) ? selected : null;
  const touches = (e: EdgeSpec) => sel !== null && (e.from === sel || e.to === sel);
  const linked = new Set(EDGES.filter(touches).flatMap((e) => (e.toGroup ? [e.from] : [e.from, e.to])));
  const groups: DiagramGroup[] = Object.entries(GROUP_TITLES).map(([id, title]) => ({ id, title, ...GROUP_AREAS[id]!, single: SINGLE.groups[id]! }));
  const groupTitle = (id: string) => GROUP_TITLES[id]!;
  const name = (id: string, group: boolean) => (group ? groupTitle(id) : box(id).title);
  const boxes: DiagramBox[] = BOXES.map((b) => ({
    id: b.id, title: b.title, detail: b.detail, group: b.group, shared: b.shared,
    ...BOX_AREAS[b.id]!, single: SINGLE.boxes[b.id]!,
    state: sel === null ? "normal" : b.id === sel ? "selected" : linked.has(b.id) ? "linked" : "dimmed",
    selectId: `${SELECT}:${b.id}`,
    accessibilityLabel: `${b.title}, ${groupTitle(b.group)}${b.shared ? ", shared by every platform" : ""}. ${b.detail.replace(/ · /g, ", ")}`,
    accessibilityValue: sel !== null && b.id !== sel && linked.has(b.id) ? `Connected to ${box(sel).title}` : "",
  }));
  const narrow = columnRoutesFor("narrow", sel), single = columnRoutesFor("single", sel);
  const edges: DiagramEdge[] = EDGES.map(({ key, quiet, direction, toGroup, ...e }) => ({
    ...e,
    toGroup: toGroup === true,
    direction: direction ?? "forward",
    wide: WIDE_ROUTES[e.id]!,
    // An edge not drawn in a column arrangement keeps a route of its own there (for a host that draws it anyway); it is never needed.
    narrow: narrow[e.id] ?? columnRoutesFor("narrow", e.from)[e.id]!,
    single: single[e.id] ?? columnRoutesFor("single", e.from)[e.id]!,
    drawn: { wide: true, narrow: e.id in narrow, single: e.id in single },
    state: sel === null ? "normal" : touches(e) ? "highlighted" : "dimmed",
    showLabel: quiet !== true && (sel === null ? key === true : touches(e)),
  }));
  let panel: DiagramPanel | null = null;
  let count = 0;
  if (sel !== null) {
    const b = box(sel);
    const links = EDGES.filter((e) => e.from === sel || e.to === sel).map((e) => {
      const outgoing = e.from === sel;
      const other = outgoing ? e.to : e.from;
      const way = e.direction === "both" ? "With" : outgoing ? "To" : "From";
      // A group is not selectable: its link selects the box itself again (it stays selected).
      return { text: `${way} ${name(other, outgoing && e.toGroup === true)}: ${e.label}`, selectId: `${SELECT}:${outgoing && e.toGroup ? sel : other}` };
    });
    count = links.length;
    panel = {
      id: b.id, title: b.title, detail: b.detail, group: groupTitle(b.group), about: b.about,
      filesLabel: "Files", files: b.files, factsLabel: "In numbers", facts: b.facts,
      linksLabel: "Connections", links, closeId: CLOSE, closeLabel: "Close",
    };
  }
  const connections = count === 1 ? "1 connection" : `${count} connections`;
  return {
    kind: "diagram",
    label: "How Astryx Swift works",
    note: `Boxes marked Shared are the code every platform runs: the core and sync, ${SHARED_PERCENT} of the hand-written code, and all of the logic.`,
    hint: sel === null ? "Select a box to see what it is, its files and what it connects to." : `${box(sel).title}: ${connections}. Select it again, or Close, to see everything.`,
    hintMac: sel === null ? "Select a box to see what it is, its files and what it connects to." : `${box(sel).title}: ${connections}. Select it again, or press Escape, to see everything.`,
    narrowBelow: NARROW_BELOW,
    singleBelow: SINGLE_BELOW,
    singleWhenTextIsLarge: true,
    ...LAYOUTS,
    legendLabel: "Lines",
    legend: LEGEND,
    sharedTag: "Shared",
    sharedLegend: `every platform runs it (${SHARED_PERCENT} of the code)`,
    groups,
    boxes,
    edges,
    selected: sel,
    panel,
    inspector: { label: "Inspector", emptyTitle: "No Selection", emptyText: "Select a box to see what it is, its files and what it connects to." },
  };
}

/** Whether `id` names a box of the diagram. */
export function isDiagramBox(id: string): boolean {
  return BOXES.some((b) => b.id === id);
}

/** Every box's words for the panel, by id: for tests. */
export function boxSpecs(): readonly BoxSpec[] {
  return BOXES;
}

export function architecture(s: State): Screen {
  return {
    id: "architecture",
    title: "How it works",
    subtitle: "The core, its hosts, its checks",
    toolbar: [],
    body: architectureDiagram(s.architecture.selected),
  };
}

