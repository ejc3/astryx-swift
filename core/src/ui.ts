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
  | { kind: "section"; title: string; description?: string; children: Node[] }
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
  | { kind: "segmented"; id: string; label: string; options: Option[]; value: string }
  | { kind: "select"; id: string; label: string; options: Option[]; value: string }
  | { kind: "slider"; id: string; label: string; value: number; min: number; max: number; step: number; valueText: string }
  | { kind: "progress"; label: string; value: number; valueText: string; tone: Tone }
  | { kind: "avatar"; name: string; initials: string; hue: number; size: "sm" | "md" | "lg"; status?: Tone; statusLabel?: string }
  | { kind: "avatarGroup"; people: { initials: string; hue: number }[]; more: string | null }
  | { kind: "statusDot"; tone: Tone; label: string }
  | { kind: "divider" }
  | { kind: "kbd"; keys: string[] }
  | { kind: "metric"; label: string; value: string; delta?: { text: string; tone: Tone; up: boolean }; trend?: number[] }
  | { kind: "bars"; label: string; bars: { label: string; value: number; valueText: string; highlight: boolean }[] }
  | { kind: "table"; columns: { id: string; label: string; align: "start" | "end"; sort: "asc" | "desc" | "none" | null; sortId?: string }[]; rows: { id: string; cells: Cell[]; selected: boolean; selectId?: string }[]; empty: string }
  | { kind: "list"; items: ListItem[]; empty: string }
  | { kind: "tabs"; id: string; tabs: (Option & { count?: string })[]; value: string }
  | { kind: "stepper"; steps: { label: string; state: "done" | "current" | "upcoming"; selectId?: string }[] }
  | { kind: "banner"; tone: Tone; title: string; text: string; action?: ButtonNode; dismissId?: string }
  | { kind: "empty"; icon: Icon; title: string; text: string; action?: ButtonNode }
  | { kind: "metadata"; items: { label: string; value: string }[] }
  | { kind: "pagination"; label: string; previousId?: string; nextId?: string }
  | { kind: "calendar"; title: string; weekdays: string[]; weeks: CalendarDay[][]; previousId: string; nextId: string; previousLabel: string; nextLabel: string }
  | { kind: "chat"; messages: ChatMessage[]; composer: { id: string; value: string; placeholder: string; sendId: string; sendLabel: string; canSend: boolean } }
  | { kind: "board"; columns: BoardColumn[] }
  /** A refactored stock Astryx template: drawn by its own renderer from `view` (core/src/templates). */
  | { kind: "template"; template: string; view: unknown };

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
export const SCREENS = ["overview", "dashboard", "inbox", "tasks", "people", "calendar", "chat", "checkout", "profile", "settings"] as const;
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
  | { type: "tick" };
