/**
 * Signing in, as the core sees it (docs/SYNC.md, "Signing in, and signing out"). The core holds
 * no token and talks to no server: the host does the signing in and runs sync, and tells the core
 * what happened with `{type: "account", ...}` actions. The core keeps who is signed in (an email,
 * never the token), the sync status, and the words for both; and when the person presses Sign in
 * or confirms Sign out it raises a request (`request`, with a sequence number) that the host acts
 * on when it sees the number change.
 */
import type { ButtonNode, Icon, Tone } from "./ui.ts";

/** The sync layer's status (sync/src/client.ts, `SyncState`). */
export const SYNC_STATES = ["connecting", "synced", "pending", "offline", "signed-out"] as const;
export type SyncState = (typeof SYNC_STATES)[number];

export type AccountPhase = "signed-out" | "signing-in" | "signed-in";

/** What the host is asked to do; `seq` grows by one with each request. */
export type AccountRequest = { kind: "signIn" | "signOut"; seq: number };

export type AccountState = {
  /** Whether this host can sign in at all: off unless it was configured with a sync server. */
  available: boolean;
  phase: AccountPhase;
  /** The signed-in account's email, as the host read it from the token. */
  email: string;
  /** The sync layer's last status; null until the host reports one. */
  sync: { state: SyncState; pending: number } | null;
  request: AccountRequest | null;
};

/**
 * What a host tells the core (`{type: "account", event, ...}`):
 * - `available`: whether sign-in is configured here;
 * - `signedIn`: a sign-in (or a relaunch while signed in) succeeded, as this email;
 * - `signedOut`: the person signed out (`requested`), or a sign-in was cancelled or failed;
 * - `status`: the sync layer's status;
 * - `firstSignIn`: on a sign-in with work on the device, which tables were uploaded and which kept the account's data.
 */
export type AccountEvent =
  | { event: "available"; available: boolean }
  | { event: "signedIn"; email: string }
  | { event: "signedOut"; why: "requested" | "cancelled" | "failed" }
  | { event: "status"; state: SyncState; pending: number }
  | { event: "firstSignIn"; seeded: string[]; kept: string[] };

/** What the hosts draw: in the sidebar, and on the Mac in the Settings window. */
export type AccountSnapshot = {
  /** False: draw nothing of the account (sign-in is not configured). */
  available: boolean;
  state: AccountPhase;
  /** "Account": the section's or menu's name. */
  label: string;
  /** Signed out: the call to sign in; signing in: progress; signed in: the account's email. */
  title: string;
  /** Signed out: what signing in does; signed in: the sync status in words. */
  detail: string;
  /** Signed in: the sync status, its tone and icon. */
  status: { state: SyncState; text: string; tone: Tone; icon: Icon } | null;
  /** The button that signs in: signed out, or signed in when the server wants a new sign-in. */
  signIn: ButtonNode | null;
  /** Signed in: the menu item that asks to sign out (a confirmation follows). */
  signOut: ButtonNode | null;
  /** The whole account entry for a screen reader. */
  accessibilityLabel: string;
  /** The host's work: sign in, or sign out (already confirmed). */
  request: AccountRequest | null;
};

export const SIGN_IN_ID = "account.signIn";
export const SIGN_OUT_ID = "account.signOut";

export function initialAccount(available: boolean): AccountState {
  return { available, phase: "signed-out", email: "", sync: null, request: null };
}

/** The sync status in words, as the sidebar shows it. */
export function statusWords(state: SyncState, pending: number): { text: string; tone: Tone; icon: Icon } {
  switch (state) {
    case "connecting": return { text: "Connecting…", tone: "neutral", icon: "clock" };
    case "synced": return { text: "Synced", tone: "success", icon: "check" };
    case "pending": return { text: "Saving…", tone: "neutral", icon: "clock" };
    case "offline": return pending > 0 ? { text: "Offline — changes will sync", tone: "warning", icon: "warning" } : { text: "Offline", tone: "warning", icon: "warning" };
    case "signed-out": return { text: "Sign in again", tone: "danger", icon: "lock" };
  }
}

/** The toast after a sign-in with work on the device: what happened to that work. */
export function firstSignInWords(email: string, seeded: readonly string[], kept: readonly string[]): string {
  const who = email ? `Signed in as ${email}.` : "Signed in.";
  if (seeded.length > 0 && kept.length > 0) return `${who} Some of this device's work was added to your account; where your account had its own, that is shown, and this device's copy is kept for when you sign out.`;
  if (seeded.length > 0) return `${who} What you did on this device is now in your account.`;
  if (kept.length > 0) return `${who} Your account's data is shown; this device's copy is kept for when you sign out.`;
  return `${who} Your changes now sync to your other devices.`;
}

export const ACCOUNT_WORDS = {
  signedOut: "Signed out. This device shows its own copy again.",
  failed: "Couldn't sign in. Try again.",
  dialog: {
    title: "Sign out?",
    text: "Your changes stay in your account. This device goes back to what was here before you signed in.",
    confirm: "Sign out",
    cancel: "Cancel",
  },
} as const;

/** Whether a host's `account` action is well formed; anything else is ignored. */
export function isAccountEvent(a: unknown): a is AccountEvent {
  if (typeof a !== "object" || a === null) return false;
  const e = a as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
  switch (e.event) {
    case "available": return typeof e.available === "boolean";
    case "signedIn": return typeof e.email === "string";
    case "signedOut": return e.why === "requested" || e.why === "cancelled" || e.why === "failed";
    case "status": return (SYNC_STATES as readonly unknown[]).includes(e.state) && typeof e.pending === "number" && Number.isFinite(e.pending) && e.pending >= 0;
    case "firstSignIn": return strings(e.seeded) && strings(e.kept);
    default: return false;
  }
}

export function accountSnapshot(a: AccountState): AccountSnapshot {
  const signInButton = (label: string): ButtonNode => ({ kind: "button", id: SIGN_IN_ID, label, variant: "secondary", icon: "person" });
  const base = { available: a.available, state: a.phase, label: "Account", request: a.request };
  if (!a.available) return { ...base, title: "", detail: "", status: null, signIn: null, signOut: null, accessibilityLabel: "", request: null };
  if (a.phase === "signed-out") {
    const detail = "Keep your changes on all your devices.";
    return { ...base, title: "Sign in to sync", detail, status: null, signIn: signInButton("Sign in to sync"), signOut: null, accessibilityLabel: `Not signed in. ${detail}` };
  }
  if (a.phase === "signing-in") {
    return { ...base, title: "Signing in…", detail: "Finish signing in in the window that opened.", status: null, signIn: null, signOut: null, accessibilityLabel: "Signing in" };
  }
  const status = a.sync ? { state: a.sync.state, ...statusWords(a.sync.state, a.sync.pending) } : { state: "connecting" as const, ...statusWords("connecting", 0) };
  return {
    ...base,
    title: a.email,
    detail: status.text,
    status,
    signIn: status.state === "signed-out" ? signInButton("Sign in again") : null,
    signOut: { kind: "button", id: SIGN_OUT_ID, label: "Sign out…", variant: "secondary" },
    accessibilityLabel: `Signed in as ${a.email}. ${status.text}`,
  };
}
