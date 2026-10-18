/**
 * Astryx's `table-inbox` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/inbox.tsx; the stock copy is web/src/stock/templates/table-inbox.tsx.
 *
 * What lives here: the tab, which thread is open, the ticked rows, which messages of the open
 * thread are expanded, the attachment viewer, the compose sheet (recipients, Cc/Bcc, subject,
 * body) and the three measurements a host reports about its screen (the surface, the list, and
 * whether the primary pointer can hover). Everything else the JSX shows is worked out in `view`.
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
 *   set  subject | body
 *   press showCc | showBcc
 *   press discard          empty the draft and close the sheet
 *   set  surface | list    widths in px the host measured (0 = not measured yet)
 *   set  touch             true when the primary pointer cannot hover
 */
import { grouped, plural } from "../../format.ts";
import type { TemplateAction, TemplateModule } from "../types.ts";
import { CATEGORIES, CONVERSATIONS, type Category, type Conversation, type Priority, type ThreadMessage } from "./data.ts";

// ----- State -----

export type Recipient = { id: string; label: string };

/** Three states, because "nothing chosen yet" falls through to the top of the list but "closed" must stay closed. */
export type Chosen = { kind: "none" } | { kind: "closed" } | { kind: "open"; id: string };

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
  unreadStatus: "Unread",
  unreadSuffix: " unread",
  hasAttachments: "Has attachments",
  empty: { title: "Nothing here", description: "No conversations in this category.", action: "Go to Inbox" },
  columns: { conversation: "Conversation", from: "From", subject: "Subject", tags: "Tags", received: "Received" },
  pane: { label: "Conversation", resizeLabel: "Resize conversation pane", back: "Inbox", close: "Close conversation", closeTooltip: "Close", reply: "Reply", replyAll: "Reply all" },
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

const EMPTY_COMPOSE: ComposeState = { isOpen: false, recipients: [], cc: [], bcc: [], hasCc: false, hasBcc: false, subject: "", body: "", conversationId: null };

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
  /** Hover actions: all four, or archive and delete when rows are stacked. */
  actions: ActionView[];
};

export type AttachmentView = { id: string; name: string; src: string; previewAlt: string; lightboxAlt: string };

export type MessageView = {
  id: string;
  sender: string;
  senderEmail: string;
  receivedFull: string;
  body: string[];
  attachments: AttachmentView[];
  /** "2 attachments", or "" when there are none. */
  attachmentsLabel: string;
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
};

export type InboxView = {
  text: typeof TEXT;
  /** "3 unread of 9 conversations". */
  subtitle: string;
  tab: Category;
  tabs: { value: Category; label: string; badge: number | null }[];
  rows: RowView[];
  /** Every ticked row id, including ones on other tabs. */
  selectedKeys: string[];
  /** Whether the bulk-selection band replaces the tab strip. */
  hasSelection: boolean;
  /** "2 conversations selected". */
  selectionLabel: string;
  bulkActions: { id: ActionId; label: string }[];
  openId: string | null;
  mode: { isSingleSurface: boolean; isPaneFullWidth: boolean; isStacked: boolean; isTight: boolean; isTouch: boolean };
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

function view(s: InboxState): InboxView {
  const d = derive(s);
  const unreadByTab = (category: Category): number => s.conversations.filter((c) => c.isUnread && inCategory(c, category)).length;
  const selected = new Set(s.selected);
  const selectedCount = d.visible.filter((item) => selected.has(item.id)).length;
  const rowActions = d.isStacked ? NARROW_ROW_ACTIONS : ROW_ACTIONS;
  const c = s.compose;

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
  }));

  let pane: PaneView | null = null;
  const open = d.openConversation;
  if (open) {
    pane = {
      id: open.id,
      subject: open.subject,
      priority: priorityToken(open.priority),
      tags: open.tags,
      openMessages: s.thread.open,
      actions: actionViews(THREAD_ACTIONS, open.subject),
      messages: threadMessages(open).map((message) => {
        const attachments = message.attachments ?? [];
        return {
          id: message.id,
          sender: message.sender,
          senderEmail: message.senderEmail,
          receivedFull: message.receivedFull,
          body: message.body,
          attachments: attachments.map((a) => ({ id: a.id, name: a.name, src: a.src, previewAlt: `Preview of ${a.name}`, lightboxAlt: `Attachment: ${a.name}` })),
          attachmentsLabel: attachments.length === 0 ? "" : plural(attachments.length, "attachment"),
          lightboxIndex: s.lightbox && s.lightbox.id === message.id ? s.lightbox.index : null,
        };
      }),
    };
  }

  return {
    text: TEXT,
    subtitle: `${grouped(s.conversations.filter((x) => x.isUnread).length)} unread of ${plural(s.conversations.length, "conversation")}`,
    tab: s.category,
    tabs: CATEGORIES.map((option) => {
      const unread = unreadByTab(option.value);
      return { value: option.value, label: option.label, badge: unread === 0 ? null : unread };
    }),
    rows,
    selectedKeys: s.selected,
    hasSelection: selectedCount > 0 && !d.isStacked,
    selectionLabel: `${plural(selectedCount, "conversation")} selected`,
    bulkActions: THREAD_ACTIONS,
    openId: d.openId,
    mode: { isSingleSurface: d.isSingleSurface, isPaneFullWidth: d.isPaneFullWidth, isStacked: d.isStacked, isTight: d.isTight, isTouch: s.layout.touch },
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
      directory: s.conversations.map((item) => ({ id: item.senderEmail, label: item.sender })),
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
