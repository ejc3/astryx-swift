/**
 * Astryx's `table-inbox` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/inbox.tsx; the stock copy is web/src/stock/templates/table-inbox.tsx.
 *
 * What lives here: the tab, which thread is open, the ticked rows, which messages of the open
 * thread are expanded, the attachment viewer, the compose sheet (recipients, Cc/Bcc, subject,
 * body) and the three measurements the web page reports about its screen (the surface, the list,
 * and whether the primary pointer can hover). Everything else the JSX shows is worked out in `view`.
 *
 * Actions (ids arrive without the "tpl.inbox." prefix):
 *   set  tab               a category: "inbox" | "escalations" | "waiting" | "resolved"
 *   press open:<id>        open a thread (a row was activated)
 *   press close            close the open thread
 *   set  selection         the ticked rows, as ids joined by ","
 *   press unselectAll
 *   set  messages          the expanded messages of the open thread, as ids joined by ","
 *   press lightbox:<message id>:<index>   open an attachment
 *   set  lightboxIndex     page the open attachment viewer
 *   press lightboxClose
 *   press compose          open the compose sheet as it was left
 *   set  composeOpen       true / false (the sheet's own open and close)
 *   press reply | replyAll start a reply to the open thread
 *   set  recipients | cc | bcc   JSON array of {id, label}
 *   set  recipientsQuery | ccQuery | bccQuery   the text typed in that field (native; the web page
 *                          searches inside its own Tokenizer and never sends it)
 *   set  subject | body
 *   press showCc | showBcc
 *   press discard          empty the draft and close the sheet
 *   set  surface | list    widths in px the web page measured (0 = not measured yet)
 *   set  touch             true when the web page's primary pointer cannot hover
 * (A drawing that lays itself out from its own width never sends these three.)
 *
 * Controls the core has no action for (Refresh, archive, move, delete, Send, the composer's
 * tools) are listed in the view's `inert`: a host draws them disabled.
 *
 * Searching recipients: `searchRecipients` is the one rule, for both drawings. A query matches a
 * person whose label contains it, ignoring case (the text is not trimmed); an empty query matches
 * everybody; people already chosen in that field (by id) are left out; at most `RECIPIENT_LIMIT`
 * come back. That is what Astryx's Tokenizer does with the stock template's source (it removes
 * the chosen ones and shows `maxMenuItems`, 10). The web page calls it inside its `SearchSource`;
 * a drawing without one reads `compose.suggestions`, the same function applied to each field's
 * query. (A drawing may choose to draw no suggestions while a field's text is empty.)
 *
 * Layout is per drawing; content is shared. Several drawings (native, web) show this one state
 * at different widths, so the measurements in `layout` are only ever one drawing's: the web
 * page's, which reports them, and which the view's `mode`, `openId`, `pane`, `rows[].actions`,
 * `hasSelection` and `receivedWidth` follow. A drawing that lays itself out from its own width
 * does not send them. It reads `mode.rules` (the breakpoints and the trailing-column widths),
 * `choice` (what the person opened or closed, which is content), `firstVisibleId`,
 * `hasSelectedRows`, each row's `actionsWide` and `actionsStacked`, and `panes` (the thread of
 * every visible row, for whichever one that drawing opens), and decides for itself.
 */
import { grouped } from "../../format.ts";
import type { TemplateAction, TemplateModule } from "../types.ts";
import { CATEGORIES, CONVERSATIONS, type Category, type Conversation, type Priority, type ThreadMessage } from "./data.ts";

// ----- State -----

export type Recipient = { id: string; label: string };

/** Three states, because "nothing chosen yet" falls through to the top of the list but "closed" must stay closed. */
export type Chosen = { kind: "none" } | { kind: "closed" } | { kind: "open"; id: string };

/** Astryx's Tokenizer shows at most this many suggestions (its `maxMenuItems`). */
export const RECIPIENT_LIMIT = 10;

/** The people a query finds in the directory, for a field that already holds `chosen`. */
export function searchRecipients<T extends Recipient>(directory: readonly T[], chosen: readonly Recipient[], query: string): T[] {
  const needle = query.toLowerCase();
  const taken = new Set(chosen.map((person) => person.id));
  return directory.filter((person) => !taken.has(person.id) && person.label.toLowerCase().includes(needle)).slice(0, RECIPIENT_LIMIT);
}

export type ComposeState = {
  isOpen: boolean;
  recipients: Recipient[];
  cc: Recipient[];
  bcc: Recipient[];
  hasCc: boolean;
  hasBcc: boolean;
  subject: string;
  body: string;
  /** The thread the draft belongs to; a reply on another thread starts a clean body. */
  conversationId: string | null;
  /** The text typed into each recipients field, for a drawing that searches through the core. */
  queries: { recipients: string; cc: string; bcc: string };
};

export type InboxState = {
  conversations: Conversation[];
  category: Category;
  chosen: Chosen;
  /** Ticked rows, in the order they were ticked; may include rows of other tabs. */
  selected: string[];
  /** Expanded messages of the open thread; `key` names the thread and layout they belong to. */
  thread: { key: string; open: string[] };
  lightbox: { id: string; index: number } | null;
  compose: ComposeState;
  /** What the host measured. 0 means not measured yet. */
  layout: { surface: number; list: number; touch: boolean };
};

// ----- Constants copied from the stock template -----

const SINGLE_SURFACE_BELOW = 900;
const STACK_ROWS_BELOW = 560;
const TIGHTEN_COLUMNS_BELOW = 900;
const LIST_MIN_WIDTH = 300;
const PANE_MIN_WIDTH = 440;
const PANE_DEFAULT_SHARE = 2 / 3;
const MESSAGE_MEASURE = 680;
const STATUS_GUTTER_WIDTH = 36;
const OUR_DOMAIN = "@support.example";

const PRIORITY_COLOR: Record<Priority, "red" | "orange" | "default"> = { urgent: "red", high: "orange", normal: "default" };
const PRIORITY_LABEL: Record<Priority, string> = { urgent: "Urgent", high: "High", normal: "Normal" };

type ActionId = "archive" | "move" | "delete" | "reply";
const ROW_ACTIONS: { id: ActionId; label: string }[] = [
  { id: "archive", label: "Archive" },
  { id: "move", label: "Move to folder" },
  { id: "delete", label: "Delete" },
  { id: "reply", label: "Reply" },
];
/** Ids of the controls whose action the core does not have, so a host shows them disabled. */
const INERT = ["refresh", "archive", "move", "delete", "send", "attach", "link", "image", "emoji"];
const THREAD_ACTIONS = ROW_ACTIONS.filter((a) => a.id !== "reply");
const NARROW_ROW_ACTIONS = ROW_ACTIONS.filter((a) => a.id === "archive" || a.id === "delete");

const TIMESTAMP_WIDTH = 76 + 16 + 4;
const CELL_INSET = 24;

function actionsWidth(count: number): number {
  return count * 28 + (count - 1) * 2;
}

function trailingWidth(actionCount: number, isSideBySide: boolean): number {
  const actions = actionsWidth(actionCount);
  return isSideBySide ? actions + 4 + TIMESTAMP_WIDTH + CELL_INSET : Math.max(actions, TIMESTAMP_WIDTH) + CELL_INSET;
}

// ----- Fixed words -----

const TEXT = {
  title: "Inbox",
  refresh: "Refresh",
  compose: "Compose",
  unselectAll: "Unselect All",
  bullet: "•",
  /** Between a row's subject and the start of its preview ("Subject — preview"). */
  previewSeparator: "—",
  /** Before the count of tags that do not fit in a row ("+2"). */
  overflowMark: "+",
  unreadStatus: "Unread",
  unreadSuffix: " unread",
  hasAttachments: "Has attachments",
  /** Spoken state of a row's tick box. */
  selected: "selected",
  notSelected: "not selected",
  empty: { title: "Nothing here", description: "No conversations in this category.", action: "Go to Inbox" },
  columns: { conversation: "Conversation", from: "From", subject: "Subject", tags: "Tags", received: "Received" },
  pane: {
    label: "Conversation",
    resizeLabel: "Resize conversation pane",
    /** The unit the resize handle's value is spoken in ("440 points"). */
    resizeUnit: "points",
    back: "Inbox",
    close: "Close conversation",
    closeTooltip: "Close",
    reply: "Reply",
    replyAll: "Reply all",
    previous: "Previous",
    next: "Next",
    expanded: "expanded",
    collapsed: "collapsed",
    expandHint: "Expands the message",
    collapseHint: "Collapses the message",
  },
  composer: {
    sheetLabel: "New message",
    toolbarLabel: "Message",
    heading: "New message",
    close: "Close composer",
    closeTooltip: "Close",
    recipient: "Recipient",
    cc: "Cc",
    bcc: "Bcc",
    subject: "Subject",
    body: "Message",
    bodyPlaceholder: "Write your message…",
    actionsLabel: "Message actions",
    send: "Send",
    discard: "Discard draft",
    cancel: "Cancel",
    /** The sheet that asks what to do with a draft that has typed content, when it is cancelled. */
    discardTitle: "Discard this draft?",
    discardAction: "Discard Draft",
    saveDraft: "Save Draft",
    keepEditing: "Keep Editing",
    /** Spoken before a recipient's name on its remove control ("Remove Priya Raman"). */
    remove: "Remove",
    tools: [
      { id: "attach", label: "Attach files" },
      { id: "link", label: "Insert link" },
      { id: "image", label: "Insert image" },
      { id: "emoji", label: "Insert emoji" },
    ],
  },
};

// ----- Derivation -----

function inCategory(item: Conversation, category: Category): boolean {
  return category === "inbox" || item.category === category;
}

type Derived = {
  visible: Conversation[];
  isMeasured: boolean;
  isSingleSurface: boolean;
  openId: string | null;
  openConversation: Conversation | null;
  isPaneFullWidth: boolean;
  isListMeasured: boolean;
  isStacked: boolean;
  isTight: boolean;
};

function derive(s: InboxState): Derived {
  const visible = s.conversations.filter((item) => inCategory(item, s.category));
  const isMeasured = s.layout.surface > 0;
  const isSingleSurface = isMeasured && s.layout.surface < SINGLE_SURFACE_BELOW;
  const defaultOpenId = isSingleSurface ? null : (visible[0]?.id ?? null);
  const chosen = s.chosen;
  const openId = chosen.kind === "closed" ? null : chosen.kind === "open" && visible.some((item) => item.id === chosen.id) ? chosen.id : defaultOpenId;
  const openConversation = visible.find((item) => item.id === openId) ?? null;
  const isListMeasured = s.layout.list > 0;
  return {
    visible,
    isMeasured,
    isSingleSurface,
    openId,
    openConversation,
    isPaneFullWidth: isSingleSurface && openId != null,
    isListMeasured,
    isStacked: isListMeasured && s.layout.list < STACK_ROWS_BELOW,
    isTight: isListMeasured && s.layout.list < TIGHTEN_COLUMNS_BELOW,
  };
}

/** The thread's messages, oldest first, the conversation's own last. */
function threadMessages(conversation: Conversation): ThreadMessage[] {
  return [
    ...(conversation.replies ?? []),
    {
      id: conversation.id,
      sender: conversation.sender,
      senderEmail: conversation.senderEmail,
      receivedFull: conversation.receivedFull,
      body: conversation.body,
      attachments: conversation.attachments,
    },
  ];
}

/** Reply goes to the newest sender; Reply all adds everyone else outside the team who wrote in the thread. */
function replyDraft(conversation: Conversation, isReplyAll: boolean): { conversationId: string; recipients: Recipient[]; subject: string } {
  const author: Recipient = { id: conversation.senderEmail, label: conversation.sender };
  const others = (conversation.replies ?? [])
    .filter((message) => !message.senderEmail.endsWith(OUR_DOMAIN) && message.senderEmail !== conversation.senderEmail)
    .filter((message, index, all) => all.findIndex((other) => other.senderEmail === message.senderEmail) === index)
    .map((message) => ({ id: message.senderEmail, label: message.sender }));
  return {
    conversationId: conversation.id,
    recipients: isReplyAll ? [author, ...others] : [author],
    subject: conversation.subject.startsWith("Re:") ? conversation.subject : `Re: ${conversation.subject}`,
  };
}

/** The key a thread's expanded set belongs to: a different thread or layout is a different disclosure group. */
function threadKey(d: Derived): string {
  return d.openId === null ? "" : `${d.openId}|${d.isPaneFullWidth ? "full" : "side"}`;
}

/** Remounts the disclosure group (as the stock template does with a React key) when the thread or layout changes. */
function settle(s: InboxState): InboxState {
  const d = derive(s);
  const key = threadKey(d);
  if (s.thread.key === key) return s;
  return { ...s, thread: { key, open: d.openId === null ? [] : [d.openId] } };
}

// ----- Reducer -----

const asString = (v: string | number | boolean): string => String(v);
const asBool = (v: string | number | boolean): boolean => v === true || v === "true";
const asNumber = (v: string | number | boolean): number => (typeof v === "number" ? v : Number(v));

function ids(value: string | number | boolean): string[] {
  const text = asString(value);
  return text === "" ? [] : text.split(",");
}

function recipients(value: string | number | boolean): Recipient[] | null {
  try {
    const parsed: unknown = JSON.parse(asString(value));
    if (!Array.isArray(parsed)) return null;
    const out: Recipient[] = [];
    for (const item of parsed as unknown[]) {
      if (typeof item !== "object" || item === null) return null;
      const { id, label } = item as { id?: unknown; label?: unknown };
      if (typeof id !== "string" || typeof label !== "string") return null;
      out.push({ id, label });
    }
    return out;
  } catch {
    return null;
  }
}

const EMPTY_COMPOSE: ComposeState = { isOpen: false, recipients: [], cc: [], bcc: [], hasCc: false, hasBcc: false, subject: "", body: "", conversationId: null, queries: { recipients: "", cc: "", bcc: "" } };

function startReply(s: InboxState, isReplyAll: boolean): InboxState {
  const conversation = derive(s).openConversation;
  if (!conversation) return s;
  const draft = replyDraft(conversation, isReplyAll);
  const c = s.compose;
  const sameThread = c.conversationId === draft.conversationId;
  return {
    ...s,
    compose: {
      ...c,
      isOpen: true,
      recipients: draft.recipients,
      subject: draft.subject,
      conversationId: draft.conversationId,
      ...(sameThread ? {} : { cc: [], bcc: [], hasCc: false, hasBcc: false, body: "" }),
    },
  };
}

function press(s: InboxState, id: string): InboxState {
  const at = id.indexOf(":");
  const key = at < 0 ? id : id.slice(0, at);
  const arg = at < 0 ? "" : id.slice(at + 1);
  switch (key) {
    case "open":
      return { ...s, chosen: { kind: "open", id: arg } };
    case "close":
      return { ...s, chosen: { kind: "closed" } };
    case "unselectAll":
      return { ...s, selected: [] };
    case "lightbox": {
      const cut = arg.lastIndexOf(":");
      const index = Number(arg.slice(cut + 1));
      return cut < 0 || !Number.isFinite(index) ? s : { ...s, lightbox: { id: arg.slice(0, cut), index } };
    }
    case "lightboxClose":
      return { ...s, lightbox: null };
    case "compose":
      return { ...s, compose: { ...s.compose, isOpen: true } };
    case "reply":
      return startReply(s, false);
    case "replyAll":
      return startReply(s, true);
    case "showCc":
      return { ...s, compose: { ...s.compose, hasCc: true } };
    case "showBcc":
      return { ...s, compose: { ...s.compose, hasBcc: true } };
    case "discard":
      return { ...s, compose: { ...EMPTY_COMPOSE } };
    default:
      return s;
  }
}

function set(s: InboxState, id: string, value: string | number | boolean): InboxState {
  const c = s.compose;
  switch (id) {
    case "tab": {
      const category = asString(value);
      return CATEGORIES.some((x) => x.value === category) ? { ...s, category: category as Category } : s;
    }
    case "selection":
      return { ...s, selected: ids(value) };
    case "messages":
      return { ...s, thread: { ...s.thread, open: ids(value) } };
    case "lightboxIndex": {
      const index = asNumber(value);
      return s.lightbox && Number.isFinite(index) ? { ...s, lightbox: { ...s.lightbox, index } } : s;
    }
    case "composeOpen":
      return { ...s, compose: { ...c, isOpen: asBool(value) } };
    case "recipients":
    case "cc":
    case "bcc": {
      const items = recipients(value);
      return items ? { ...s, compose: { ...c, [id]: items } } : s;
    }
    case "recipientsQuery":
    case "ccQuery":
    case "bccQuery": {
      const field = id.slice(0, id.length - "Query".length) as keyof ComposeState["queries"];
      return { ...s, compose: { ...c, queries: { ...c.queries, [field]: asString(value) } } };
    }
    case "subject":
      return { ...s, compose: { ...c, subject: asString(value) } };
    case "body":
      return { ...s, compose: { ...c, body: asString(value) } };
    case "surface":
    case "list": {
      const width = Math.max(0, asNumber(value));
      if (!Number.isFinite(width) || s.layout[id] === width) return s;
      return { ...s, layout: { ...s.layout, [id]: width } };
    }
    case "touch": {
      const touch = asBool(value);
      return s.layout.touch === touch ? s : { ...s, layout: { ...s.layout, touch } };
    }
    default:
      return s;
  }
}

function initial(): InboxState {
  return settle({
    conversations: CONVERSATIONS.map((c) => ({ ...c })),
    category: "inbox",
    chosen: { kind: "none" },
    selected: [],
    thread: { key: "", open: [] },
    lightbox: null,
    compose: { ...EMPTY_COMPOSE },
    layout: { surface: 0, list: 0, touch: false },
  });
}

function reduce(s: InboxState, action: TemplateAction): InboxState {
  const next = action.type === "set" ? set(s, action.id, action.value) : press(s, action.id);
  return next === s ? s : settle(next);
}

// ----- View -----

export type ActionView = { id: ActionId; label: string; ariaLabel: string };
export type TokenView = { label: string; color: "red" | "orange" | "default" };

export type RowView = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  receivedAt: string;
  isUnread: boolean;
  hasAttachments: boolean;
  isOpen: boolean;
  /** The unread status gutter's label, or null for a read thread. */
  status: string | null;
  selectionLabel: string;
  priority: TokenView | null;
  tags: string[];
  /** Hover actions in the layout the reported measurements give: all four, or archive and delete when rows are stacked. */
  actions: ActionView[];
  /** The hover actions of a wide row (all four), whatever was measured. */
  actionsWide: ActionView[];
  /** The hover actions of a stacked row (archive and delete), whatever was measured. */
  actionsStacked: ActionView[];
};

export type AttachmentView = { id: string; name: string; src: string; previewAlt: string; lightboxAlt: string };

export type MessageView = {
  id: string;
  sender: string;
  senderEmail: string;
  receivedFull: string;
  body: string[];
  attachments: AttachmentView[];
  /** "2 attachments" as separate text nodes (the stock template draws them so), or [] when there are none. */
  attachmentsLabel: string[];
  /** The open attachment's index when this message's viewer is open, else null. */
  lightboxIndex: number | null;
};

export type PaneView = {
  id: string;
  subject: string;
  priority: TokenView | null;
  tags: string[];
  messages: MessageView[];
  /** Expanded message ids. */
  openMessages: string[];
  actions: ActionView[];
};

/** What the person chose, apart from any layout: the content a drawing opens its thread from. */
export type ChoiceView = {
  /** The thread the person opened, when it is on this tab; otherwise null. */
  openIdExplicit: string | null;
  /** The person closed the thread, and it stays closed. Distinguishes "closed" from "never chosen". */
  isClosed: boolean;
  /** The top thread of this tab: what a drawing with room opens when nothing was chosen. */
  firstVisibleId: string | null;
};

/** The trailing "Received" column's width, for each kind of row and pointer. */
export type ReceivedWidths = { wide: { pointer: number; touch: number }; stacked: { pointer: number; touch: number } };

export type ComposeView = {
  isOpen: boolean;
  recipients: Recipient[];
  cc: Recipient[];
  bcc: Recipient[];
  hasCc: boolean;
  hasBcc: boolean;
  subject: string;
  body: string;
  /** Everybody the inbox has heard from, offered as recipients. */
  directory: Recipient[];
  /** The text typed in each field (see `set recipientsQuery`). */
  queries: { recipients: string; cc: string; bcc: string };
  /** What each field's text finds in the directory: `searchRecipients` (all of the unchosen when the text is empty). */
  suggestions: { recipients: Recipient[]; cc: Recipient[]; bcc: Recipient[] };
  /** Whether the draft holds typed content that cancelling would lose. */
  isDirty: boolean;
};

export type InboxView = {
  text: typeof TEXT;
  /** "3 unread of 9 conversations", as the separate text nodes the stock template draws. */
  subtitle: string[];
  tab: Category;
  tabs: { value: Category; label: string; badge: number | null }[];
  rows: RowView[];
  /** Every ticked row id, including ones on other tabs. */
  selectedKeys: string[];
  /** Whether the bulk-selection band replaces the tab strip. */
  hasSelection: boolean;
  /** "2 conversations selected", as the separate text nodes the stock template draws. */
  selectionLabel: string[];
  bulkActions: { id: ActionId; label: string }[];
  openId: string | null;
  mode: {
    isSingleSurface: boolean;
    isPaneFullWidth: boolean;
    isStacked: boolean;
    isTight: boolean;
    isTouch: boolean;
    /** The widths the core holds (0 = not measured): the web page's. A drawing that lays itself out does not use them. */
    measured: { surface: number; list: number };
    /** The breakpoints, for a drawing that measures its own width. */
    rules: {
      /** The surface is single (list and thread one at a time) below this width. */
      singleSurfaceBelow: number;
      /** Rows stack below this list width. */
      stackRowsBelow: number;
      /** The tags column goes below this list width. */
      tightenColumnsBelow: number;
      receivedWidth: ReceivedWidths;
      /** The list is never narrower than this (px); the pane's handle stops here. */
      listMin: number;
      /** The pane is never narrower than this (px). */
      paneMin: number;
      /** The pane's share of the surface until the handle moves it. */
      paneDefaultShare: number;
      /** A message's text is at most this wide (px). */
      messageMeasure: number;
      /** The status gutter's column width (px). */
      statusGutterWidth: number;
    };
  };
  /** What was opened or closed; a drawing combines it with its own width to pick its open thread. */
  choice: ChoiceView;
  /** Whether any visible row is ticked. The bulk band replaces the tabs when this holds and rows are not stacked. */
  hasSelectedRows: boolean;
  /** The thread of every visible row, for a drawing that opens a different one than `pane`. */
  panes: PaneView[];
  /** Ids of the controls with no action behind them; hosts draw these disabled. */
  inert: string[];
  /** Pixel width of the trailing "Received" column. */
  receivedWidth: number;
  pane: PaneView | null;
  compose: ComposeView;
};

export type View = InboxView;

function priorityToken(priority: Priority): TokenView | null {
  return priority === "normal" ? null : { label: PRIORITY_LABEL[priority], color: PRIORITY_COLOR[priority] };
}

function actionViews(actions: { id: ActionId; label: string }[], subject: string): ActionView[] {
  return actions.map((a) => ({ id: a.id, label: a.label, ariaLabel: `${a.label} — ${subject}` }));
}

/** A reply opens with its recipients and subject filled in; only what was typed since counts. */
function isDirty(c: ComposeState): boolean {
  if (c.body.trim() !== "" || c.cc.length > 0 || c.bcc.length > 0) return true;
  return c.conversationId === null && (c.recipients.length > 0 || c.subject.trim() !== "");
}

function view(s: InboxState): InboxView {
  const d = derive(s);
  const unreadByTab = (category: Category): number => s.conversations.filter((c) => c.isUnread && inCategory(c, category)).length;
  const selected = new Set(s.selected);
  const selectedCount = d.visible.filter((item) => selected.has(item.id)).length;
  const rowActions = d.isStacked ? NARROW_ROW_ACTIONS : ROW_ACTIONS;
  const c = s.compose;
  const directory: Recipient[] = s.conversations.map((item) => ({ id: item.senderEmail, label: item.sender }));

  const rows: RowView[] = d.visible.map((item) => ({
    id: item.id,
    sender: item.sender,
    subject: item.subject,
    preview: item.preview,
    receivedAt: item.receivedAt,
    isUnread: item.isUnread,
    hasAttachments: item.attachments.length > 0,
    isOpen: item.id === d.openId,
    status: item.isUnread ? TEXT.unreadStatus : null,
    selectionLabel: `conversation from ${item.sender}`,
    priority: priorityToken(item.priority),
    tags: item.tags,
    actions: actionViews(rowActions, item.subject),
    actionsWide: actionViews(ROW_ACTIONS, item.subject),
    actionsStacked: actionViews(NARROW_ROW_ACTIONS, item.subject),
  }));

  const paneOf = (conversation: Conversation, openMessages: string[]): PaneView => ({
    id: conversation.id,
    subject: conversation.subject,
    priority: priorityToken(conversation.priority),
    tags: conversation.tags,
    openMessages,
    actions: actionViews(THREAD_ACTIONS, conversation.subject),
    messages: threadMessages(conversation).map((message) => {
      const attachments = message.attachments ?? [];
      return {
        id: message.id,
        sender: message.sender,
        senderEmail: message.senderEmail,
        receivedFull: message.receivedFull,
        body: message.body,
        attachments: attachments.map((a) => ({ id: a.id, name: a.name, src: a.src, previewAlt: `Preview of ${a.name}`, lightboxAlt: `Attachment: ${a.name}` })),
        attachmentsLabel: attachments.length === 0 ? [] : [String(attachments.length), " attachment", attachments.length === 1 ? "" : "s"],
        lightboxIndex: s.lightbox && s.lightbox.id === message.id ? s.lightbox.index : null,
      };
    }),
  });
  const open = d.openConversation;
  const pane = open ? paneOf(open, s.thread.open) : null;
  // A thread the web page does not have open starts with its newest message expanded, as `settle` would give it.
  const panes = d.visible.map((item) => (item.id === d.openId && pane ? pane : paneOf(item, [item.id])));
  const chosen = s.chosen;
  const choice: ChoiceView = {
    openIdExplicit: chosen.kind === "open" && d.visible.some((item) => item.id === chosen.id) ? chosen.id : null,
    isClosed: chosen.kind === "closed",
    firstVisibleId: d.visible[0]?.id ?? null,
  };

  return {
    text: TEXT,
    subtitle: [grouped(s.conversations.filter((x) => x.isUnread).length), " unread of ", grouped(s.conversations.length), " ", "conversations"],
    tab: s.category,
    tabs: CATEGORIES.map((option) => {
      const unread = unreadByTab(option.value);
      return { value: option.value, label: option.label, badge: unread === 0 ? null : unread };
    }),
    rows,
    selectedKeys: s.selected,
    hasSelection: selectedCount > 0 && !d.isStacked,
    selectionLabel: [String(selectedCount), " ", selectedCount === 1 ? "conversation" : "conversations", " ", "selected"],
    bulkActions: THREAD_ACTIONS,
    openId: d.openId,
    mode: {
      isSingleSurface: d.isSingleSurface,
      isPaneFullWidth: d.isPaneFullWidth,
      isStacked: d.isStacked,
      isTight: d.isTight,
      isTouch: s.layout.touch,
      measured: { surface: s.layout.surface, list: s.layout.list },
      rules: {
        singleSurfaceBelow: SINGLE_SURFACE_BELOW,
        stackRowsBelow: STACK_ROWS_BELOW,
        tightenColumnsBelow: TIGHTEN_COLUMNS_BELOW,
        listMin: LIST_MIN_WIDTH,
        paneMin: PANE_MIN_WIDTH,
        paneDefaultShare: PANE_DEFAULT_SHARE,
        messageMeasure: MESSAGE_MEASURE,
        statusGutterWidth: STATUS_GUTTER_WIDTH,
        receivedWidth: {
          wide: { pointer: trailingWidth(ROW_ACTIONS.length, false), touch: trailingWidth(ROW_ACTIONS.length, true) },
          stacked: { pointer: trailingWidth(NARROW_ROW_ACTIONS.length, false), touch: trailingWidth(NARROW_ROW_ACTIONS.length, true) },
        },
      },
    },
    choice,
    hasSelectedRows: selectedCount > 0,
    panes,
    inert: INERT,
    receivedWidth: trailingWidth(rowActions.length, s.layout.touch),
    pane,
    compose: {
      isOpen: c.isOpen,
      recipients: c.recipients,
      cc: c.cc,
      bcc: c.bcc,
      hasCc: c.hasCc,
      hasBcc: c.hasBcc,
      subject: c.subject,
      body: c.body,
      directory,
      queries: c.queries,
      suggestions: {
        recipients: searchRecipients(directory, c.recipients, c.queries.recipients),
        cc: searchRecipients(directory, c.cc, c.queries.cc),
        bcc: searchRecipients(directory, c.bcc, c.queries.bcc),
      },
      isDirty: isDirty(c),
    },
  };
}

export const inbox: TemplateModule<InboxState, InboxView> = {
  id: "inbox",
  astryx: "table-inbox",
  title: "Inbox",
  initial: () => initial(),
  reduce: (s, action) => reduce(s, action),
  view: (s) => view(s),
};
