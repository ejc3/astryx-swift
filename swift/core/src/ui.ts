/**
 * The contract with the hosts. A screen is a tree of these nodes, named after the Astryx
 * component each one is drawn with. The core decides everything in them: every word, every
 * count, which row is selected, what is sorted, what is invalid. A host draws a node and
 * sends back an `Action` with the node's `id`; it never computes anything of its own.
 *
 * The web page draws each node with the Astryx React component of the same name; the Swift
 * apps draw it with the AstryxKit SwiftUI view of the same name (apps/native/apple/AstryxKit),
 * painted with the same theme tokens. Changing a node here changes both renderers: bump
 * PROTOCOL when a field changes meaning.
 */

import type { AccountEvent, AccountSnapshot } from "./account.ts";
import type { ScenariosSnapshot } from "./scenarios.ts";

export const PROTOCOL = 1;

/** The color roles Astryx's components take. */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** Named icons. Each host maps a name to its own glyph (SF Symbols on Apple's platforms). */
export const ICONS = [
  "home", "chart", "inbox", "check", "people", "gear", "cart", "calendar", "chat", "person",
  "star", "star-fill", "archive", "trash", "search", "plus", "chevron-left", "chevron-right",
  "arrow-up", "arrow-down", "bell", "lock", "mail", "sparkle", "grid", "filter", "send",
  "clock", "flag", "bolt", "heart", "info", "warning", "close", "undo", "card", "truck",
  "arrow-right", "diagram", "history",
] as const;
export type Icon = (typeof ICONS)[number];

export type Gap = "xs" | "sm" | "md" | "lg";

export type Option = { value: string; label: string; description?: string };

/** One cell of a table: text, optionally with a second line, a badge or an avatar. */
export type Cell = {
  text: string;
  secondary?: string;
  badge?: { text: string; tone: Tone };
  avatar?: { initials: string; hue: number };
  align?: "start" | "end";
};

export type Node =
  | { kind: "stack"; axis: "vertical" | "horizontal"; gap: Gap; align?: "start" | "center" | "end" | "spread"; wrap?: boolean; children: Node[] }
  | { kind: "grid"; minColumnWidth: number; gap: Gap; children: Node[] }
  | { kind: "split"; primary: Node; detail: Node; showDetailWhenNarrow: boolean; backId?: string; backLabel?: string }
  | { kind: "card"; title?: string; subtitle?: string; action?: ButtonNode; children: Node[] }
  /** `level`: the heading's level (4 when absent; 3 for a page's top-level sections). */
  | { kind: "section"; title: string; description?: string; level?: 3 | 4; children: Node[] }
  | { kind: "heading"; text: string; level: 1 | 2 | 3 }
  | { kind: "text"; text: string; style: "body" | "secondary" | "caption" | "emphasis" | "code"; tone?: Tone }
  | { kind: "badge"; text: string; tone: Tone }
  | { kind: "token"; text: string; tone: Tone; removeId?: string }
  | ButtonNode
  | { kind: "iconButton"; id: string; icon: Icon; label: string; selected?: boolean }
  | { kind: "textInput"; id: string; label: string; value: string; placeholder: string; error?: string; hint?: string; secure?: boolean; multiline?: boolean; icon?: Icon }
  | { kind: "switch"; id: string; label: string; description?: string; on: boolean }
  | { kind: "checkbox"; id: string; label: string; checked: boolean }
  | { kind: "radio"; id: string; label: string; options: Option[]; value: string }
  /** `labelHidden`: the label is for assistive technology only (the control needs no visible caption). */
  | { kind: "segmented"; id: string; label: string; options: Option[]; value: string; labelHidden?: boolean }
  | { kind: "select"; id: string; label: string; options: Option[]; value: string }
  | { kind: "slider"; id: string; label: string; value: number; min: number; max: number; step: number; valueText: string }
  | { kind: "progress"; label: string; value: number; valueText: string; tone: Tone }
  | { kind: "avatar"; name: string; initials: string; hue: number; size: "sm" | "md" | "lg"; status?: Tone; statusLabel?: string }
  | { kind: "avatarGroup"; people: { initials: string; hue: number }[]; more: string | null }
  | { kind: "statusDot"; tone: Tone; label: string }
  | { kind: "divider" }
  | { kind: "kbd"; keys: string[] }
  /** `emphasized`: the figure the section is about, drawn larger. */
  | { kind: "metric"; label: string; value: string; delta?: { text: string; tone: Tone; up: boolean }; trend?: number[]; emphasized?: boolean }
  /** One bar split into parts by their values, each part's words and value listed under it. */
  | { kind: "shares"; label: string; parts: { label: string; value: number; valueText: string; tone: Tone }[] }
  | { kind: "bars"; label: string; bars: { label: string; value: number; valueText: string; highlight: boolean }[] }
  /** `stackBelow`: the table's own width, in points or CSS pixels, below which each row stacks into a record (its first cell as the heading, the other columns as label and value lines). */
  | { kind: "table"; stackBelow: number; columns: { id: string; label: string; align: "start" | "end"; sort: "asc" | "desc" | "none" | null; sortId?: string }[]; rows: { id: string; cells: Cell[]; selected: boolean; selectId?: string }[]; empty: string }
  | { kind: "list"; items: ListItem[]; empty: string }
  | { kind: "tabs"; id: string; tabs: (Option & { count?: string })[]; value: string }
  | { kind: "stepper"; steps: { label: string; state: "done" | "current" | "upcoming"; selectId?: string }[] }
  | { kind: "banner"; tone: Tone; title: string; text: string; action?: ButtonNode; dismissId?: string }
  | { kind: "empty"; icon: Icon; title: string; text: string; action?: ButtonNode }
  | { kind: "metadata"; items: { label: string; value: string }[] }
  | { kind: "pagination"; label: string; previousLabel: string; nextLabel: string; previousId?: string; nextId?: string }
  | { kind: "calendar"; title: string; weekdays: string[]; weeks: CalendarDay[][]; previousId: string; nextId: string; previousLabel: string; nextLabel: string }
  | { kind: "chat"; messages: ChatMessage[]; composer: { id: string; value: string; placeholder: string; sendId: string; sendLabel: string; canSend: boolean } }
  /** `stackBelow`: the board's own width, in points or CSS pixels, below which the columns stack one above the other. */
  | { kind: "board"; columns: BoardColumn[]; stackBelow: number }
  /** A refactored stock Astryx template: drawn by its own renderer from `view` (core/src/templates). */
  | { kind: "template"; template: string; view: unknown }
  /** Dated entries in order, on a rail; an `emphasized` entry is the one the rest lead to or follow from. */
  /** `outcomeLabel`: the words before an entry's `outcome` ("What changed"). */
  | { kind: "timeline"; label: string; outcomeLabel?: string; entries: TimelineEntry[] }
  | DiagramNode;

export type TimelineEntry = {
  /** The date (and time, with its zone) as words. */
  when: string;
  title: string;
  /** Someone's words, exactly; drawn as a quotation. */
  quote?: string;
  text?: string;
  /** What changed because of it, drawn after the node's `outcomeLabel`. */
  outcome?: string;
  /** A short tag that sets the entry apart ("Turning point"), in its tone. */
  badge?: string;
  tone: Tone;
  emphasized: boolean;
};

/**
 * A diagram of boxes in titled groups, joined by edges, on a grid the core lays out twice: `wide`,
 * and `narrow` for a diagram narrower than `narrowBelow` (its own width, in points or CSS pixels).
 * A host draws the grid with columns of equal width and rows as tall as their tallest box (a
 * group's first row holds only its title), then draws each edge between its boxes' measured frames
 * by `routeEdge` (core/src/diagram.ts: the web calls it, Swift ports it), and the label of an edge
 * whose `showLabel` is true at the middle of its longest segment. Pressing a box sends `press` with
 * its `selectId`; the core then highlights it and its edges, dims the rest and fills `panel`.
 */
export type DiagramNode = {
  kind: "diagram";
  /** The figure's accessible name. */
  label: string;
  /** A line about the whole figure, drawn above it: what the boxes marked `shared` are. */
  note: string;
  /** What selecting does, or what is selected: a polite live region on the web, announced on Apple platforms. */
  hint: string;
  /** The same for the Mac, which has no Close button in its inspector (Escape instead). */
  hintMac: string;
  /**
   * Which arrangement to draw, by the diagram's own width (points or CSS pixels): `single` below
   * `singleBelow`, `narrow` below `narrowBelow`, else `wide`. Apple hosts also draw `single` at the
   * accessibility text sizes when `singleWhenTextIsLarge` is true.
   */
  narrowBelow: number;
  singleBelow: number;
  singleWhenTextIsLarge: boolean;
  wide: DiagramGrid;
  narrow: DiagramGrid;
  single: DiagramGrid;
  legendLabel: string;
  legend: { style: DiagramEdgeStyle; label: string }[];
  /** The tag on a shared box, and the legend's words for it. */
  sharedTag: string;
  sharedLegend: string;
  /** In reading order: the flow from upstream to proof. */
  groups: DiagramGroup[];
  /** In reading order (VoiceOver and the keyboard follow it): the flow, group by group. */
  boxes: DiagramBox[];
  edges: DiagramEdge[];
  selected: string | null;
  /** The selected box's detail: the inspector (Mac, iPad), a sheet (iPhone), a side panel or bottom sheet (web). */
  panel: DiagramPanel | null;
  /** The inspector's name (its toolbar button and menu command) and what it says with nothing selected. */
  inspector: { label: string; emptyTitle: string; emptyText: string };
};

export type DiagramLayoutName = "wide" | "narrow" | "single";
/**
 * An arrangement's grid. `gap`: between columns and rows, each a step of Astryx's spacing scale;
 * `margin`: room above, left and right of the grid for routes that run outside it and the groups'
 * padding; `pad`: how far a group's ground reaches beyond its cells (points or CSS pixels).
 * `labels`: whether edge labels are drawn in it (the panel says each edge in words either way).
 */
export type DiagramGrid = { columns: number; rows: number; gap: { x: number; y: number }; margin: { top: number; left: number; right: number }; pad: number; labels: boolean };
/** A rectangle of grid cells, from column and row 0. */
export type DiagramArea = { col: number; row: number; cols: number; rows: number };
export type DiagramSide = "top" | "right" | "bottom" | "left";
/** Data (snapshots, rows), control (actions, calls), sync (replication between stores), build (made at build or test time). */
export type DiagramEdgeStyle = "data" | "control" | "sync" | "build";
/**
 * How an edge leaves and enters its boxes (core/src/diagram.ts, `routeEdge`). `at` is 0 to 1 along a
 * side, left to right or top to bottom (0.5 when absent); `bend` is where a three-segment route
 * turns, 0 to 1 of the way (0.5 when absent); `lane` is how far out a same-side route runs (1 when
 * absent), counted from the grid's own edge when `outside` is true, else from the boxes' sides.
 */
export type DiagramRoute = { from: DiagramSide; to: DiagramSide; fromAt?: number; toAt?: number; bend?: number; lane?: number; outside?: boolean };
export type DiagramState = "normal" | "selected" | "linked" | "dimmed";

export type DiagramGroup = { id: string; title: string; wide: DiagramArea; narrow: DiagramArea; single: DiagramArea };

export type DiagramBox = {
  id: string;
  title: string;
  /** One short line under the title. */
  detail: string;
  group: string;
  /** Part of the code every platform runs (the core and sync): drawn with `sharedTag`. */
  shared: boolean;
  /** One row high, `cols` columns wide. */
  wide: DiagramArea;
  narrow: DiagramArea;
  single: DiagramArea;
  state: DiagramState;
  selectId: string;
  /** What a screen reader says for the box: its title, its group, whether it is shared, and its line. */
  accessibilityLabel: string;
  /** Its state in words for a screen reader ("Connected to AXClient"), or empty. */
  accessibilityValue: string;
};

export type DiagramEdge = {
  id: string;
  from: string;
  /** A box's id, or a group's when `toGroup` (the edge ends at the group's ground). */
  to: string;
  toGroup: boolean;
  label: string;
  style: DiagramEdgeStyle;
  /** "both": an arrowhead at each end. */
  direction: "forward" | "both";
  wide: DiagramRoute;
  narrow: DiagramRoute;
  single: DiagramRoute;
  /** Whether it is drawn now, per arrangement: the wide one draws every edge; the narrow and single ones draw the edges between neighbouring boxes, and every edge of the selected box. */
  drawn: { wide: boolean; narrow: boolean; single: boolean };
  state: "normal" | "highlighted" | "dimmed";
  /** Whether its label is drawn now (in an arrangement that draws labels); placed by `placeLabels`, in the edges' order. */
  showLabel: boolean;
};

export type DiagramPanel = {
  id: string;
  title: string;
  detail: string;
  group: string;
  about: string;
  filesLabel: string;
  files: string[];
  factsLabel: string;
  facts: { label: string; value: string }[];
  linksLabel: string;
  /** Each edge of the box in words; pressing one selects the box at its other end. */
  links: { text: string; selectId: string }[];
  closeId: string;
  closeLabel: string;
};

export type ButtonNode = {
  kind: "button";
  id: string;
  label: string;
  variant: "primary" | "secondary" | "ghost" | "destructive";
  icon?: Icon;
  disabled?: boolean;
};

export type ListItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: { avatar: { initials: string; hue: number } } | { icon: Icon; tone: Tone };
  trailing?: { text: string; tone: Tone };
  emphasized: boolean;
  selected: boolean;
  selectId?: string;
};

export type CalendarDay = {
  label: string;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  dots: Tone[];
  selectId?: string;
};

export type ChatMessage = { id: string; author: string; initials: string; hue: number; mine: boolean; text: string; time: string };

export type BoardColumn = {
  id: string;
  title: string;
  count: string;
  cards: { id: string; title: string; tags: { text: string; tone: Tone }[]; assignee: { initials: string; hue: number }; due: string; dueTone: Tone; moveBackId?: string; moveForwardId?: string; moveBackLabel: string; moveForwardLabel: string }[];
};

export type Screen = {
  id: ScreenId;
  title: string;
  subtitle: string;
  toolbar: ButtonNode[];
  body: Node;
};

/** The demos built from generic nodes. */
export const SCREENS = ["architecture", "story", "overview", "dashboard", "inbox", "tasks", "people", "calendar", "chat", "checkout", "profile", "settings"] as const;
export type DemoScreenId = (typeof SCREENS)[number];
/** A refactored template's screen: "t.<template id>". */
export type TemplateScreenId = `t.${string}`;
export type ScreenId = DemoScreenId | TemplateScreenId;

export type NavItem = {
  id: ScreenId; label: string; icon: Icon; badge?: string; section: string;
  /** What a screen reader says: the label and its section, since two sections share names. */
  accessibilityLabel: string;
};

export type Toast = {
  id: number; tone: Tone; text: string; action?: { id: string; label: string };
  /** The tone in a word for a screen reader (absent for a neutral toast), and the close button's label. */
  toneLabel?: string; dismissLabel: string;
};

export type Dialog = { title: string; text: string; confirm: ButtonNode; cancel: ButtonNode };

/** What the "app" store's snapshot holds: everything a host draws, for the current screen. */
export type AppSnapshot = {
  protocol: number;
  appName: string;
  nav: NavItem[];
  current: ScreenId;
  screen: Screen;
  toast: Toast | null;
  dialog: Dialog | null;
  /** Which theme to paint with, and the choices; the tokens themselves are the "theme" store. */
  theme: { id: string; label: string; setId: string; options: Option[] };
  /**
   * Which drawings of the screens a native app shows:
   * - "native": its own SwiftUI views (AstryxKit), on this core (in Hermes);
   * - "web": the refactored Astryx web page, in a web view, on this same core;
   * - "webOwn": the same refactored page on a core of its own, in the web view's JavaScript,
   *   with no Hermes; its state is its own (it follows the current screen, nothing else);
   * - "stock": Astryx as it is today, its own templates with their own React state (it shows
   *   `stockTemplate` for the current screen, and nothing else is shared);
   * - "compare": native and web side by side; "all": all four, as a 2 by 2 grid.
   * A web page ignores it. A host too small for a side-by-side choice shows "native".
   */
  surface: {
    id: string; label: string; value: Surface; options: Option[];
    /** The options in two groups: which drawing, and how many at once (the side-by-side choices). */
    groups: { label: string; values: Surface[] }[];
    /** Why a side-by-side choice is dimmed when the window is too small for it. */
    unavailable: string;
    stockTemplate: string; stockLabel: string;
  };
  /** The shipped scenarios and the one playing (core/src/scenarios.ts). */
  scenarios: ScenariosSnapshot;
  /** Signing in to sync (core/src/account.ts): drawn in the sidebar when `available`. */
  account: AccountSnapshot;
};

export const SURFACES = ["native", "web", "webOwn", "stock", "compare", "all"] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * What a host sends. `id` is the node's id, exactly as the snapshot gave it.
 *
 * - A button, icon button, list item, calendar day, sortable column header, pagination
 *   control, token's remove, banner's dismiss and toast's action: `press`.
 * - A text input, switch, checkbox, radio, segmented control, select, slider, tab list
 *   and a table row's checkbox (`selectId`, with the new checked state): `set`.
 * - A nav item: `navigate`.
 * - `tick`: the host's clock moved (once a minute), so times like "12m" stay true.
 */
export type Action =
  | { type: "navigate"; screen: ScreenId }
  | { type: "press"; id: string }
  | { type: "set"; id: string; value: string | number | boolean }
  | { type: "dismissToast" }
  | { type: "tick" }
  /** A sync source's copy of one saved table (Zero's live query); it replaces the core's copy. */
  | { type: "rows"; table: string; rows: unknown[] }
  /** The whole saved doc from the host, replacing the core's (signing out: the device's own copy again). Checked, never trusted. */
  | { type: "doc"; doc: unknown }
  /** The host's word on signing in and sync (core/src/account.ts). */
  | ({ type: "account" } & AccountEvent);
