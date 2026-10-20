/**
 * Astryx's `ai-chat` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/chat.tsx; the stock copy is web/src/stock/templates/ai-chat.tsx.
 *
 * The stock page is a fixed conversation: the composer sends nowhere and the assistant never
 * replies, so there is no simulated reply to drive. What changes is the composer (its mode,
 * its draft), the document panel (open on a wide screen, a full-screen dialog on a narrow
 * one; the host measures its width and says which) and nothing else. Message text, tool
 * calls, code and the document are the core's; times go out as ISO instants plus a label
 * ("10:15 AM") so a native host can use either.
 */
import { clock } from "../../format.ts";
import type { TemplateModule } from "../types.ts";

export type ComposerMode = "ask" | "edit";

export type ChatState = {
  mode: ComposerMode;
  draft: string;
  /** The document panel beside the conversation (wide screens). */
  panelOpen: boolean;
  /** The document as a full-screen dialog (narrow screens). */
  dialogOpen: boolean;
};

export type Stamp = { at: string; label: string };

export type ToolCall = {
  name: string;
  target: string;
  status: "pending" | "running" | "complete" | "error";
  duration?: string;
  node?: string;
  additions?: number;
  deletions?: number;
};

export type BubbleContent =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; tokens: { value: string; label: string; variant: "blue" }[] }
  | { kind: "markdown"; text: string }
  | { kind: "code"; title: string; language: string; /** The header line: "middleware.ts — typescript". */ header: string; code: string }
  | { kind: "artifact"; label: string; title: string; caption: string };

export type ChatPart =
  | { kind: "bubble"; variant?: "ghost"; group?: "first" | "last"; width?: string; time?: Stamp; status?: "delivered"; content: BubbleContent }
  | { kind: "tools"; expanded: boolean; /** The group's header: "3 tool calls". */ label: string; calls: ToolCall[] }
  | { kind: "meta"; time: Stamp; footer?: string };

export type ChatItem =
  | { kind: "divider"; text: string }
  | { kind: "status"; text: string }
  | { kind: "message"; id: string; sender: "user" | "assistant"; /** Assistant's avatar name. */ avatar?: string; files: string[]; parts: ChatPart[] };

/** Words only the native drawing speaks or shows (VoiceOver labels and values); the web ignores them. */
export type ChatWords = {
  mention: string;
  attach: string;
  send: string;
  copy: string;
  share: string;
  closeDocument: string;
  documentActions: string;
  versions: string;
  /** Names the person's own messages for VoiceOver. */
  you: string;
  expanded: string;
  collapsed: string;
  /** What activating a tool-call group does. */
  showCalls: string;
  status: { pending: string; running: string; complete: string; error: string };
  /** After a diff count: "8 added", "2 removed". */
  added: string;
  removed: string;
  /** The word beside a delivered message's time: "Delivered". */
  delivered: string;
  /** The title of the version list in the narrow document menu: "Version". */
  version: string;
  /** The document panel's resize handle. */
  resizePanel: string;
  /** The label of the document panel's toolbar. */
  artifactActions: string;
};

/** The layout numbers both drawings read; a drawing measures its own width and compares. */
export type ChatRules = {
  /** The document opens as a dialog at or below this width, as a side panel above it. */
  dialogAtMost: number;
  /** The side panel's width in px: where it starts, and the range a drag keeps it in. */
  panel: { initial: number; min: number; max: number };
  /** The widest the document's reading column grows, in px. */
  articleWidth: number;
  /** The widest the in-message document card grows, in px. */
  cardWidth: number;
};

export type ChatView = {
  /** Controls the stock page draws but wires to nothing; a native host shows them disabled. */
  inert: ("mention" | "attach" | "versions")[];
  words: ChatWords;
  rules: ChatRules;
  items: ChatItem[];
  composer: {
    draft: string;
    placeholder: string;
    mode: ComposerMode;
    modeLabel: string;
    modes: { id: ComposerMode; label: string }[];
  };
  artifact: {
    title: string;
    subtitle: string;
    content: string;
    versions: string[];
    /** The version the menu button names: "v2" from "v2 (current)". */
    versionTag: string;
    panelOpen: boolean;
    dialogOpen: boolean;
  };
};

const ARTIFACT_TITLE = "JWT Token Refresh: Design & Rollout";
const ARTIFACT_SUBTITLE = "Document · Updated just now";

const ARTIFACT_CONTENT = `## Overview

Our API gateway authenticates every request with a short-lived JWT access token. Until now, an expired token meant an immediate \`401\` — even when the user still held a valid refresh token. This document describes the silent-refresh flow we just shipped and how we're rolling it out.

## The Problem

Token validation ran **before** any refresh logic, so the middleware rejected expired tokens outright:

1. A request arrives with an expired access token
2. \`validateToken()\` throws \`TokenExpiredError\`
3. The catch block returns \`401\` — \`refreshToken()\` is never reached

The result was users getting logged out whenever an access token lapsed mid-session.

## The Fix

The middleware now catches \`TokenExpiredError\` specifically and attempts a silent refresh before rejecting. On success it reissues an access token and continues the request; on failure it falls back to \`401\`.

- **Transparent** — valid sessions never see an interruption
- **Safe** — a missing or invalid refresh token still returns \`401\`
- **Cheap** — refresh only runs on the expiry path, not on every request

## Testing

The refresh path is covered end to end:

| Scenario | Expected |
|----------|----------|
| Valid token passes through | \`200\` |
| Expired token, valid refresh | \`200\` + new access token |
| Expired token, invalid refresh | \`401\` |
| Malformed token | \`401\` |

## Rollout & Monitoring

1. Ship behind the \`silent_refresh\` flag at 5% of traffic
2. Watch the \`auth.refresh.success\` and \`auth.refresh.failure\` counters
3. Alert if the failure rate exceeds **2%** over any 5-minute window
4. Ramp to 100% once metrics hold steady for 24 hours`;

/** "2026-04-29T10:15:00" with its "10:15 AM" label. */
function stamp(hour: number, minute: number, second: number): Stamp {
  const pad = (n: number) => String(n).padStart(2, "0");
  return { at: `2026-04-29T${pad(hour)}:${pad(minute)}:${pad(second)}`, label: clock(hour * 60 + minute) };
}

const MIDDLEWARE_CODE = `async function authMiddleware(req: Request) {
  try {
    const decoded = validateToken(req.headers.authorization);
    req.user = decoded;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      // Attempt silent refresh before rejecting
      const refreshed = await refreshToken(req.cookies.refreshToken);
      if (refreshed) {
        req.user = refreshed.user;
        req.newAccessToken = refreshed.accessToken;
        return next(req);
      }
    }
    return new Response('Unauthorized', { status: 401 });
  }
  return next(req);
}`;

const TEST_CODE = `describe('authMiddleware', () => {
  it('refreshes an expired token silently', async () => {
    const expiredToken = createExpiredJWT(mockUser);
    const validRefresh = createRefreshToken(mockUser);

    const req = mockRequest({
      authorization: \`Bearer \${expiredToken}\`,
      cookies: { refreshToken: validRefresh },
    });

    const res = await authMiddleware(req);

    expect(res.status).toBe(200);
    expect(req.user.id).toBe(mockUser.id);
    expect(req.newAccessToken).toBeDefined();
  });
});`;

/** A tool-call group, with its header ("1 tool call", "3 tool calls"). */
const tools = (expanded: boolean, calls: ToolCall[]): ChatPart => ({
  kind: "tools",
  expanded,
  label: `${calls.length} tool ${calls.length === 1 ? "call" : "calls"}`,
  calls,
});

/** A code block, with the header the stock page draws: its file name and language. */
const codeBlock = (title: string, language: string, code: string): BubbleContent => ({
  kind: "code",
  title,
  language,
  header: `${title} \u2014 ${language}`,
  code,
});

/** The conversation, in order. Ids are the position, so a host can key on them. */
const ITEMS: ChatItem[] = [
  { kind: "divider", text: "Today" },

  // User message: mention + file attachments
  {
    kind: "message",
    id: "m1",
    sender: "user",
    files: ["auth-service.ts", "middleware.ts"],
    parts: [
      {
        kind: "bubble",
        time: stamp(10, 15, 0),
        content: {
          kind: "mention",
          text: "@agent Can you review these auth files? The JWT refresh logic seems broken — tokens expire but the middleware doesn't catch it.",
          tokens: [{ value: "@agent", label: "@Agent", variant: "blue" }],
        },
      },
    ],
  },

  // Assistant message: tool calls, markdown, code block
  {
    kind: "message",
    id: "m2",
    sender: "assistant",
    avatar: "Agent",
    files: [],
    parts: [
      { kind: "bubble", variant: "ghost", content: { kind: "text", text: "Looking into the auth files now. Let me read through the code and trace the token refresh flow." } },
      tools(true, [
        { name: "read", target: "auth-service.ts", status: "complete", duration: "45ms" },
        { name: "read", target: "middleware.ts", status: "complete", duration: "38ms" },
        { name: "bash", target: 'grep -rn "refreshToken" src/', status: "complete", duration: "120ms", node: "cli:remote-server" },
      ]),
      {
        kind: "bubble",
        variant: "ghost",
        content: {
          kind: "markdown",
          text: `Found the issue. In \`middleware.ts\`, the token validation runs **before** the refresh check. When a token expires, the middleware rejects the request immediately instead of attempting a refresh.

Here's the problematic sequence:

1. Request arrives with an expired access token
2. \`validateToken()\` throws \`TokenExpiredError\`
3. The catch block returns \`401\` — never reaching \`refreshToken()\`

The fix is to catch \`TokenExpiredError\` specifically and attempt a refresh before rejecting:`,
        },
      },
      { kind: "bubble", variant: "ghost", content: codeBlock("middleware.ts", "typescript", MIDDLEWARE_CODE) },
      tools(false, [{ name: "edit", target: "middleware.ts", status: "complete", duration: "85ms", additions: 8, deletions: 2 }]),
      { kind: "meta", time: stamp(10, 15, 30), footer: "Agent" },
    ],
  },

  // User message: multi-bubble grouping
  {
    kind: "message",
    id: "m3",
    sender: "user",
    files: [],
    parts: [
      { kind: "bubble", group: "first", content: { kind: "text", text: "Nice catch, that makes sense" } },
      { kind: "bubble", group: "last", time: stamp(10, 16, 0), status: "delivered", content: { kind: "text", text: "Can you also add a test for the refresh path?" } },
    ],
  },

  // Assistant message: test results table + code block
  {
    kind: "message",
    id: "m4",
    sender: "assistant",
    avatar: "Agent",
    files: [],
    parts: [
      tools(true, [
        { name: "read", target: "middleware.test.ts", status: "complete", duration: "32ms" },
        { name: "edit", target: "middleware.test.ts", status: "complete", duration: "110ms", additions: 24, deletions: 0 },
        { name: "bash", target: "yarn test middleware", status: "complete", duration: "3.2s", node: "cli:remote-server" },
      ]),
      {
        kind: "bubble",
        variant: "ghost",
        content: {
          kind: "markdown",
          text: `Added a test for the refresh flow. All **4 tests** pass:

| Test | Status |
|------|--------|
| Valid token passes through | ✅ |
| Expired token triggers refresh | ✅ |
| Expired token with invalid refresh returns 401 | ✅ |
| Malformed token returns 401 immediately | ✅ |`,
        },
      },
      { kind: "bubble", variant: "ghost", content: codeBlock("middleware.test.ts", "typescript", TEST_CODE) },
      { kind: "meta", time: stamp(10, 16, 45) },
    ],
  },

  { kind: "status", text: "Changes saved to workspace" },

  // User message: requests a document artifact
  {
    kind: "message",
    id: "m5",
    sender: "user",
    files: [],
    parts: [
      {
        kind: "bubble",
        time: stamp(10, 18, 0),
        content: { kind: "text", text: "Looks solid. Before I open the PR, can you write up a short design doc explaining the token-refresh flow for the team?" },
      },
    ],
  },

  // Assistant message: artifact card
  {
    kind: "message",
    id: "m6",
    sender: "assistant",
    avatar: "Agent",
    files: [],
    parts: [
      {
        kind: "bubble",
        variant: "ghost",
        content: {
          kind: "markdown",
          text: `I've drafted a design doc covering the problem, the fix, and the test matrix — pulling straight from the changes we just made.\n\nOpen the document below to review it. Want me to expand any section?`,
        },
      },
      {
        kind: "bubble",
        variant: "ghost",
        width: "100%",
        time: stamp(10, 18, 40),
        content: { kind: "artifact", label: `Open ${ARTIFACT_TITLE}`, title: ARTIFACT_TITLE, caption: "Document" },
      },
    ],
  },

  // User follow-up
  {
    kind: "message",
    id: "m7",
    sender: "user",
    files: [],
    parts: [
      {
        kind: "bubble",
        time: stamp(10, 20, 0),
        status: "delivered",
        content: { kind: "text", text: "This is great. Can you add a section on rollout and monitoring at the end?" },
      },
    ],
  },

  // Assistant message: in-progress tool call
  {
    kind: "message",
    id: "m8",
    sender: "assistant",
    avatar: "Agent",
    files: [],
    parts: [
      {
        kind: "bubble",
        variant: "ghost",
        content: {
          kind: "markdown",
          text: `On it — adding a **Rollout & Monitoring** section with a staged flag ramp and the alert thresholds. Updating the document now.`,
        },
      },
      tools(false, [{ name: "edit", target: "docs/token-refresh.md", status: "running", node: "cli:remote-server" }]),
      { kind: "meta", time: stamp(10, 20, 30) },
    ],
  },
];

const MODES: { id: ComposerMode; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "edit", label: "Edit" },
];

const WORDS: ChatWords = {
  mention: "Mention",
  attach: "Attach",
  send: "Send",
  copy: "Copy",
  share: "Share",
  closeDocument: "Close document",
  documentActions: "Document actions",
  versions: "Versions",
  you: "You",
  expanded: "Expanded",
  collapsed: "Collapsed",
  showCalls: "Shows or hides the calls",
  status: { pending: "Pending", running: "Running", complete: "Complete", error: "Failed" },
  added: "added",
  removed: "removed",
  delivered: "Delivered",
  version: "Version",
  resizePanel: "Resize artifact panel",
  artifactActions: "Artifact actions",
};

const RULES: ChatRules = {
  dialogAtMost: 767,
  panel: { initial: 640, min: 480, max: 960 },
  articleWidth: 720,
  cardWidth: 360,
};

const VERSIONS = ["v2 (current)", "v1"];

const isMode = (v: unknown): v is ComposerMode => v === "ask" || v === "edit";

export const chat: TemplateModule<ChatState, ChatView> = {
  id: "chat",
  astryx: "ai-chat",
  title: "AI chat",
  initial: () => ({ mode: "ask", draft: "", panelOpen: true, dialogOpen: false }),
  reduce: (s, action) => {
    if (action.type === "set") {
      switch (action.id) {
        case "mode": return isMode(action.value) && action.value !== s.mode ? { ...s, mode: action.value } : s;
        case "draft": {
          const draft = String(action.value);
          return draft === s.draft ? s : { ...s, draft };
        }
        case "dialog": {
          const open = action.value === true || action.value === "true";
          return open === s.dialogOpen ? s : { ...s, dialogOpen: open };
        }
        default: return s;
      }
    }
    switch (action.id) {
      // The composer submits; the sample conversation sends nowhere and nobody replies, so
      // the message is dropped (the composer empties its own draft with a `set`).
      case "send": return s;
      // "Open the document": the host measures its width and says which surface to use.
      case "openArtifact:panel": return s.panelOpen ? s : { ...s, panelOpen: true };
      case "openArtifact:dialog": return s.dialogOpen ? s : { ...s, dialogOpen: true };
      case "closeArtifact": return s.panelOpen ? { ...s, panelOpen: false } : s;
      default: return s;
    }
  },
  view: (s) => ({
    inert: ["mention", "attach", "versions"],
    words: WORDS,
    rules: RULES,
    items: ITEMS,
    composer: {
      draft: s.draft,
      placeholder: s.mode === "ask" ? "Ask anything..." : "Describe your edit...",
      mode: s.mode,
      modeLabel: s.mode === "ask" ? "Ask" : "Edit",
      modes: MODES,
    },
    artifact: {
      title: ARTIFACT_TITLE,
      subtitle: ARTIFACT_SUBTITLE,
      content: ARTIFACT_CONTENT,
      versions: VERSIONS,
      versionTag: VERSIONS[0]!.split(" ")[0]!,
      panelOpen: s.panelOpen,
      dialogOpen: s.dialogOpen,
    },
  }),
};
