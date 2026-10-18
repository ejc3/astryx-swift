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
  | { kind: "code"; title: string; language: string; code: string }
  | { kind: "artifact"; label: string; title: string; caption: string };

export type ChatPart =
  | { kind: "bubble"; variant?: "ghost"; group?: "first" | "last"; width?: string; time?: Stamp; status?: "delivered"; content: BubbleContent }
  | { kind: "tools"; expanded: boolean; calls: ToolCall[] }
  | { kind: "meta"; time: Stamp; footer?: string };

export type ChatItem =
  | { kind: "divider"; text: string }
  | { kind: "status"; text: string }
  | { kind: "message"; id: string; sender: "user" | "assistant"; /** Assistant's avatar name. */ avatar?: string; files: string[]; parts: ChatPart[] };

export type ChatView = {
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
      {
        kind: "tools",
        expanded: true,
        calls: [
          { name: "read", target: "auth-service.ts", status: "complete", duration: "45ms" },
          { name: "read", target: "middleware.ts", status: "complete", duration: "38ms" },
          { name: "bash", target: 'grep -rn "refreshToken" src/', status: "complete", duration: "120ms", node: "cli:remote-server" },
        ],
      },
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
      { kind: "bubble", variant: "ghost", content: { kind: "code", title: "middleware.ts", language: "typescript", code: MIDDLEWARE_CODE } },
      {
        kind: "tools",
        expanded: false,
        calls: [{ name: "edit", target: "middleware.ts", status: "complete", duration: "85ms", additions: 8, deletions: 2 }],
      },
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
      {
        kind: "tools",
        expanded: true,
        calls: [
          { name: "read", target: "middleware.test.ts", status: "complete", duration: "32ms" },
          { name: "edit", target: "middleware.test.ts", status: "complete", duration: "110ms", additions: 24, deletions: 0 },
          { name: "bash", target: "yarn test middleware", status: "complete", duration: "3.2s", node: "cli:remote-server" },
        ],
      },
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
      { kind: "bubble", variant: "ghost", content: { kind: "code", title: "middleware.test.ts", language: "typescript", code: TEST_CODE } },
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
      { kind: "tools", expanded: false, calls: [{ name: "edit", target: "docs/token-refresh.md", status: "running", node: "cli:remote-server" }] },
      { kind: "meta", time: stamp(10, 20, 30) },
    ],
  },
];

const MODES: { id: ComposerMode; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "edit", label: "Edit" },
];

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
      versions: ["v2 (current)", "v1"],
      panelOpen: s.panelOpen,
      dialogOpen: s.dialogOpen,
    },
  }),
};
