/**
 * Saved data for the inbox template (core/src/templates/inbox; docs/SYNC.md).
 *
 * `inbox_thread` has one row per conversation the person changed or made. A sample conversation's
 * row holds only what changed (`unread`, `folder`, `archived`, `deleted`); a conversation the
 * person started with Compose has its recipients, subject, text and send time as well.
 * `inbox_message` holds the replies the person sent, each in its thread (`thread`).
 *
 * Times are epoch milliseconds. Recipients are saved as JSON text, `[{"id": "<address>", "label":
 * "<name>"}]`, because a saved column holds one scalar.
 */
import { define, fields, isId, isInstant, isText, oneOf, put } from "../check.ts";

export const INBOX_FOLDERS = ["inbox", "escalations", "waiting", "resolved"] as const;

export const MAX_SUBJECT = 200;
export const MAX_BODY = 20_000;
export const MAX_PEOPLE = 20;

export const tables = {
  inbox_thread: { unread: "boolean", folder: "string", archived: "boolean", deleted: "boolean", subject: "string", to: "string", cc: "string", bcc: "string", text: "string", sentAt: "number" },
  inbox_message: { thread: "string", to: "string", cc: "string", bcc: "string", text: "string", sentAt: "number" },
} as const;

export type Person = { id: string; label: string };

/** Recipients as saved: `null` when the text is not a list of at most `MAX_PEOPLE` people with an address and a name. */
export function readPeople(text: unknown): Person[] | null {
  if (typeof text !== "string" || text.length > 8000) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length > MAX_PEOPLE) return null;
    const people: Person[] = [];
    for (const p of parsed as unknown[]) {
      if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
      const { id, label, ...rest } = p as Record<string, unknown>;
      if (Object.keys(rest).length > 0 || typeof id !== "string" || typeof label !== "string" || id === "" || id.length > 254 || label.length > 120) return null;
      people.push({ id, label });
    }
    return people;
  } catch {
    return null;
  }
}

/** Recipients as the text to save. */
export const writePeople = (people: readonly Person[]): string => JSON.stringify(people.map(({ id, label }) => ({ id, label })));

const people = (min: number) => (v: unknown): boolean => {
  const list = readPeople(v);
  return list !== null && list.length >= min;
};
const body = (v: unknown): boolean => typeof v === "string" && v.trim() !== "" && v.length <= MAX_BODY;

const inboxRead = define<{ id: string }>({
  check: (a) => fields(a, { id: isId }),
  writes: (a) => [put("inbox_thread", a.id, { unread: false })],
});

/** Archive hides the conversation from every tab; the row stays (`archived`), nothing is lost. */
const inboxArchive = define<{ id: string }>({
  check: (a) => fields(a, { id: isId }),
  writes: (a) => [put("inbox_thread", a.id, { archived: true })],
});

const inboxDelete = define<{ id: string }>({
  check: (a) => fields(a, { id: isId }),
  writes: (a) => [put("inbox_thread", a.id, { deleted: true })],
});

const inboxMove = define<{ id: string; folder: string }>({
  check: (a) => fields(a, { id: isId, folder: oneOf(INBOX_FOLDERS) }),
  writes: (a) => [put("inbox_thread", a.id, { folder: a.folder })],
});

/** A reply appended to its thread. `id` is the new message's. */
const inboxReply = define<{ id: string; thread: string; at: number; to: string; cc: string; bcc: string; body: string }>({
  check: (a) => fields(a, { id: isId, thread: isId, at: isInstant, to: people(1), cc: people(0), bcc: people(0), body }),
  writes: (a) => [put("inbox_message", a.id, { thread: a.thread, to: a.to, cc: a.cc, bcc: a.bcc, text: a.body.trim(), sentAt: a.at })],
});

/** A new message, which is a new conversation. `id` is the new conversation's. */
const inboxCompose = define<{ id: string; at: number; to: string; cc: string; bcc: string; subject: string; body: string }>({
  check: (a) => fields(a, { id: isId, at: isInstant, to: people(1), cc: people(0), bcc: people(0), subject: isText(MAX_SUBJECT), body }),
  writes: (a) => [put("inbox_thread", a.id, { subject: a.subject.trim(), to: a.to, cc: a.cc, bcc: a.bcc, text: a.body.trim(), sentAt: a.at, folder: "inbox", unread: false })],
});

export const mutations = {
  "inbox.read": inboxRead,
  "inbox.archive": inboxArchive,
  "inbox.delete": inboxDelete,
  "inbox.move": inboxMove,
  "inbox.reply": inboxReply,
  "inbox.compose": inboxCompose,
};
