/**
 * "How this was built": how the spike was made, from the Claude conversation it started in. Plain
 * data, measured from the git history and the session transcripts (times in Pacific time); nothing here is
 * computed at run time except the shares, from the line counts below. Tone: dates and numbers.
 */
import type { Node, Screen, TimelineEntry } from "../ui.ts";
import { card, grid, section as section4, text, v } from "./nodes.ts";

/** A top-level section of the page: its heading one level up. */
const section = (title: string, description: string, ...children: Node[]): Node => ({ ...(section4(title, description, ...children) as Extract<Node, { kind: "section" }>), level: 3 });

/**
 * Times are Pacific time (PT, UTC−7: every date here is in daylight time), written out as data, in
 * the readable form ("Oct 17, 9:52 am PT"). A timed entry keeps the UTC it was measured in (`utc`),
 * and core/test/architecture.test.ts converts each one and compares. Days without a time are the
 * Pacific day of the work's commits.
 */
type StoryEntry = TimelineEntry & { utc?: string };
const entries = (list: StoryEntry[]): TimelineEntry[] => list.map((e) => {
  const copy: StoryEntry = { ...e };
  delete copy.utc;
  return copy;
});

/** The tag on the eight entries that changed how quality was held, and the words before what changed. */
const TURNING_POINT = "Turning point";
export const OUTCOME_LABEL = "What changed";

/** The birth: the question that led to it, the message that started it, and the first commit. */
export const BIRTH_UTC: StoryEntry[] = [
  {
    when: "Oct 17, 7:20 am PT", utc: "2026-10-17 14:20", title: "The first question", tone: "neutral", emphasized: false,
    quote: "Please look at astryx. Should we use that as our css basis for [the family dashboard]?",
    text: "At 7:53 am the owner set the shape: \"just like my other apps, I want the core to be in shareable typescript / JavaScript, but ui be native\".",
  },
  {
    when: "Oct 17, 9:52 am PT", utc: "2026-10-17 16:52", title: "The spike begins", tone: "accent", emphasized: true,
    quote: "I want to do a spike for astryx native. Same thing where it's core logic can stay in JavaScript but ui all swift. Generate a rich set of web, Mac and native demo screens. Open source repo [and TestFlight] under me at end.",
  },
  {
    when: "Oct 17, 10:05 am PT", utc: "2026-10-17 17:05", title: "First commit", tone: "neutral", emphasized: false,
    quote: "core: ten Astryx screens as one tree of component nodes, every word worked out here",
  },
];
export const BIRTH = entries(BIRTH_UTC);

/**
 * Hand-written source lines by part, measured on the working tree these two screens were finished
 * on. Tests, scripts, generated files and the stock Astryx reference copies are left out:
 *
 *   git ls-files -co --exclude-standard -- <dirs> | grep -E '\.(ts|tsx|swift|mm|h|css)$' \
 *     | grep -vE 'generated|/stock/|\.test\.ts$' | xargs cat | wc -l
 *
 * with <dirs>: core/src; sync/src; web/src; apps/native/apple/AstryxKit/Sources;
 * apps/native/apple/Host; apps/native/js; apps/native/apple/iOS/App apps/native/apple/macOS/App;
 * server/src. core/test/architecture.test.ts checks that the parts add up.
 */
export const LINES = {
  core: 9234, sync: 634, web: 8933, kit: 19911, host: 1246, glue: 283, shells: 83, server: 569,
};
const shared = LINES.core + LINES.sync;
const apple = LINES.kit + LINES.host + LINES.glue + LINES.shells;
const total = shared + LINES.web + apple + LINES.server;
const percent = (part: number, of: number) => `${Math.round((100 * part) / of)}%`;
const grouped = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The share of all hand-written code that every platform runs: the core and sync. */
export const SHARED_SHARE = percent(shared, total);

export const SHARED = {
  note: "Hand-written source lines: tests, scripts, generated files and the stock Astryx reference copies are left out.",
  headline: { label: "Of all the code, shared by every platform: all of the logic", value: SHARED_SHARE },
  metrics: [
    { label: "Of the iPhone and Mac apps' code, shared", value: percent(shared, shared + apple) },
    { label: "Of the web page's code, shared", value: percent(shared, shared + LINES.web) },
  ],
  summary: "The shared part is every state, rule, word, layout threshold, search and mutation. The rest draws.",
  splitLabel: "Hand-written lines, by part",
  split: [
    { label: "Shared: the core and sync", value: shared, valueText: `${grouped(shared)} lines`, tone: "accent" as const },
    { label: "The web drawing", value: LINES.web, valueText: `${grouped(LINES.web)} lines`, tone: "neutral" as const },
    { label: "The Apple drawing and host", value: apple, valueText: `${grouped(apple)} lines`, tone: "neutral" as const },
    { label: "The server", value: LINES.server, valueText: `${grouped(LINES.server)} lines`, tone: "neutral" as const },
  ],
  parts: [
    { label: "Core", value: grouped(LINES.core) },
    { label: "Sync", value: grouped(LINES.sync) },
    { label: "Web", value: grouped(LINES.web) },
    { label: "SwiftUI kit", value: grouped(LINES.kit) },
    { label: "Apple host", value: `${grouped(LINES.host)} Swift, ${grouped(LINES.glue)} JavaScript` },
    { label: "App shells", value: grouped(LINES.shells) },
    { label: "Server", value: grouped(LINES.server) },
  ],
};

/** What followed, in order: the work, the design councils, the polish, and the eight turning points (each once). */
export const FOLLOWED_UTC: StoryEntry[] = [
  {
    when: "Oct 17, 10:40 to 11:10 am PT", utc: "2026-10-17 17:40", title: "The bar, in four messages", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "Five requirements: stock and refactored web pixel-perfect; web on Hermes passes the same tests; scenarios that drive native from web and web from native, shipped in the app; a fourth drawing, pure web on its own core; and iOS too.",
    outcome: "From then on \"looks right\" was never the test; a machine comparison at threshold 0 was.",
  },
  { when: "Oct 17", title: "The core and four drawings", tone: "neutral", emphasized: false, text: "Native and web on Hermes on one state, web on its own core, and stock Astryx." },
  {
    when: "Oct 17", title: "Why the charts never matched", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "The dashboard agent found that Recharts animates in JavaScript, so waiting for CSS to settle does nothing, and a full-page screenshot resizes the viewport, which restarts the animation. It asked the coordinating session to change the shared harness, which also grew the viewport to the page before each capture and rasterized on one thread.",
    outcome: "The fix went into the shared harness, for every template, not into the dashboard.",
  },
  { when: "Oct 18, 6:23 am PT", utc: "2026-10-18 13:23", title: "Ten templates on the core", tone: "neutral", emphasized: false, text: "Ten stock templates refactored onto the core, and parity at 1216 of 1216 identical. AstryxKit draws all ten in SwiftUI. First TestFlight builds; the open-source fork." },
  { when: "Oct 18, 11:10 am PT", utc: "2026-10-18 18:10", title: "Council: Human Interface Guidelines", tone: "neutral", emphasized: false, text: "Five reviewers in parallel with apple-hig-review: the Mac app; iPhone and iPad chrome; data templates; form templates; accessibility. Every finding ruled, then four fix batches (2:27 pm)." },
  {
    when: "Oct 18", title: "\"Black on blue?\"", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "The owner opened the Mac app and asked \"black on blue?\" and \"How did that make it through our design reviewer?\" The HIG council had reviewed screens one at a time. The sidebar row was fixed the same hour, with a developer banner that showed in a Release build.",
    outcome: "Native and web reviewed side by side, every screen, every difference ruled: the Mac and iPhone councils.",
  },
  { when: "Oct 18, 6:56 pm PT", utc: "2026-10-19 01:56", title: "Council: Mac, native against web", tone: "neutral", emphasized: false, text: "Five reviewers compared every screen side by side. About 410 differences listed: 45 kept as Mac conventions, each with its HIG citation; about 328 fixed (about 320 native, 8 web or core) by four fix agents (7:21 pm); the rest duplicates of another row or questions ruled." },
  {
    when: "Oct 18", title: "One cause behind many rows", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "A reviewer traced many colour differences to one cause: native painted the page with the body colour (#F1F4F7) where the web uses the surface (#FFFFFF), and Astryx's translucent fills came out darker on grey.",
    outcome: "One fix closed every row citing it.",
  },
  {
    when: "Oct 18", title: "The reviewers checked too", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "Two rulings were wrong: field outlines are Astryx's emphasized border, not its default; field labels are medium weight, not regular.",
    outcome: "Both found by reading the computed styles and Astryx's source instead of trusting screenshots.",
  },
  { when: "Oct 18, 9:23 pm PT", utc: "2026-10-19 04:23", title: "Council: iPhone, native against web", tone: "neutral", emphasized: false, text: "Four reviewers. About 270 differences listed: 99 kept as iOS conventions; about 143 fixed (137 native, 6 web or core) by four fix agents (9:52 pm); the rest duplicates of another row or questions ruled." },
  { when: "Oct 18 to Oct 19", title: "Polish: layout, text sizes, chart labels", tone: "neutral", emphasized: false, text: "Inbox layout moved out of shared state; accessibility text sizes (AX5) for buttons and the kanban toolbar; the dashboard's time labels placed exactly as Recharts places them." },
  { when: "Oct 19", title: "Performance, and the issue", tone: "neutral", emphasized: false, text: "A hill climb with a frame meter on device and Instruments' hitches and time profiler: 105 fps mean (120 Hz display) on the Mac during scenarios, 57.9 to 59.9 fps on an iPhone 13. The issue draft for the Astryx maintainers." },
  {
    when: "Oct 19, 6:45 pm PT", utc: "2026-10-20 01:45", title: "Words and rules into the core", tone: "warning", emphasized: false, badge: TURNING_POINT,
    quote: "Is there more to push down in the JSX to prevent duplication?",
    text: "Four agents moved every word, layout threshold and search into the core: the JSX holds no English and no breakpoint of its own.",
    outcome: "Moving the kanban card's words fixed four parity differences on the way.",
  },
  {
    when: "Oct 22", title: "Saved data without breaking parity", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "Three agents moved the templates onto saved data. Stock mode (?stock=1) keeps the harness comparing like with like.",
    outcome: "It caught that a moved kanban card must keep stock's \"Edited 2h ago\" and its place in board order.",
  },
  { when: "Oct 22", title: "Saved work and sign-in", tone: "neutral", emphasized: false, text: "One mutation definition run by the core, Zero's client and the server. Zero in Hermes, with SQLite on the device. Optional sign-in through Cloudflare Access. Its own AWS account and Terraform repository." },
  { when: "Oct 22", title: "Polish: sign-in lasts until sign-out", tone: "neutral", emphasized: false, text: "Rotating refresh tokens; reusing a replaced one after two minutes ends the session." },
  {
    when: "Oct 22", title: "A font, not the code", tone: "warning", emphasized: false, badge: TURNING_POINT,
    text: "After the build container was rebuilt, the chat replay failed by 71,955 pixels on every step, while stock and ours still matched each other.",
    outcome: "The cause was a missing font (DejaVu Sans Mono), not the code.",
  },
];
export const FOLLOWED = entries(FOLLOWED_UTC);

/** How it was built, from the transcripts: Oct 17, 7:20 am PT to Oct 22. Approximate where it says "about". */
export const BUILT = {
  metrics: [
    { label: "Conversation with Claude Code", value: "1" },
    { label: "Agents launched, one task each", value: "57" },
    { label: "Model calls", value: "5,738" },
    { label: "Tokens processed", value: "About 1.37 billion" },
    { label: "Read from the prompt cache", value: "About 95%" },
    { label: "Tokens written", value: "About 1.46 million" },
  ],
  person: "The person's part: direction and judgement in short messages (what to build, the bar to meet, approving outward-facing steps such as TestFlight testers and the AWS account), and reviews of what came back. Not code.",
  agentsLabel: "57 agents, by kind",
  agents: [
    { label: "Builders", value: "12: web host, SwiftUI kit, six template refactors, three native-view agents, scenario recorder" },
    { label: "Reviewers", value: "14: HIG council 5, Mac compare 5, iPhone compare 4" },
    { label: "Fixers", value: "14: HIG fix batches 4, inbox layout 1, accessibility sizes 1, Mac fixes 4, iPhone fixes 4" },
    { label: "Pushdown into the core", value: "4" },
    { label: "Saved data and sync", value: "8" },
    { label: "Skill review", value: "4, on the house-style skill's pull request" },
    { label: "These two screens", value: "1, and three more for their own council" },
  ],
  models: [
    { label: "Claude Opus", value: "Planning, review, anything touching credentials or infrastructure: about 56% of tokens" },
    { label: "Claude Sonnet", value: "Well-scoped engineering: about 44% of tokens" },
  ],
  skills: [
    { label: "app-house-style", value: "Written at the start (Oct 17, 7:56 am PT) from the owner's rule: the core in shareable TypeScript, the UI native. Every agent building the spike read it." },
    { label: "apple-hig-review", value: "The owner's Human Interface Guidelines review; the councils used it (read 38 times by the reviewers)." },
    { label: "drive-mac", value: "Building, signing and screenshots on the owner's Mac from the remote session; TestFlight uploads." },
    { label: "swift-perf-hill-climb", value: "Written on Oct 18 for the frame meter and Instruments runs, so the performance work can be repeated." },
    { label: "code-review, simplify", value: "On the house-style skill's own pull request, before work began." },
    { label: "skill-creator", value: "To write the two skills above." },
  ],
  insightfulLabel: "Found without being asked",
  insightful: [
    { label: "Dashboard refactor", value: "Recharts animates in JavaScript, and a full-page screenshot restarts it: the two causes behind the charts' differences." },
    { label: "Compare reviewer, templates B", value: "The single page-colour cause behind many rows." },
    { label: "Performance hill climb", value: "On the Mac every long frame gap (290 to 450 ms) followed a sheet opening or closing, because AppKit animates sheets on the main thread; on iPhone, sheets did not stop frames." },
    { label: "Sync builder", value: "Its end-to-end test found a lock key with a NUL byte, which Postgres text cannot hold; it replaced read-then-write with one upsert, so two devices creating the same row never collide." },
    { label: "Settings and demo screens", value: "After a relaunch, new record ids restarted at 1 and could overwrite saved rows; minting now skips ids already saved, with a test." },
    { label: "Checkout", value: "Order totals in integer cents, checked against the dollar figures the page shows for 270 cart combinations." },
    { label: "Apple sync", value: "Zero needed three things Hermes lacks (Symbol.asyncIterator, TextDecoder, a URL that keeps Zero's paths); it wrote a UTF-8 decoder to the standard and fuzzed it against Node's: 30,000 cases, no mismatches." },
    { label: "Infrastructure", value: "The account's apply role would have exceeded an IAM policy size limit as a new policy; it added statements to the existing one, as the newest account had." },
  ],
};

/** The repository: 43 commits at 66ea1ef, before these two screens; the test counts with them. */
export const RESULT = {
  basis: "43 commits at 66ea1ef, before these two screens; tests counted with them",
  tests: [
    { label: "Core", value: "260" },
    { label: "Swift", value: "106" },
    { label: "Sync", value: "20" },
    { label: "Server", value: "20" },
    { label: "Sync end to end", value: "37 checks" },
    { label: "Parity", value: "1216 of 1216 identical" },
  ],
  shipped: [
    { label: "TestFlight", value: "iPhone and Mac, internal and external testers" },
    { label: "Open source", value: "the fork ejc3/astryx-swift" },
    { label: "Infrastructure", value: "a private repository" },
  ],
};

export function story(): Screen {
  const body: Node = v("lg",
    section("Born in a Claude conversation", "Oct 17, times in Pacific time (PT)", { kind: "timeline", label: "Born in a Claude conversation", outcomeLabel: OUTCOME_LABEL, entries: BIRTH }),
    section("Code shared by every platform", SHARED.note,
      grid(220,
        { kind: "metric", label: SHARED.headline.label, value: SHARED.headline.value, emphasized: true },
        ...SHARED.metrics.map((m): Node => ({ kind: "metric", label: m.label, value: m.value })),
      ),
      text(SHARED.summary),
      { kind: "shares", label: SHARED.splitLabel, parts: SHARED.split },
      card("Lines, by part", [{ kind: "metadata", items: SHARED.parts }]),
    ),
    section("How it was built", "From the transcripts, Oct 17, 7:20 am PT to Oct 22; approximate where it says about",
      grid(280, ...BUILT.metrics.map((m): Node => ({ kind: "metric", label: m.label, value: m.value }))),
      text(BUILT.person, "secondary"),
      grid(340,
        card(BUILT.agentsLabel, [{ kind: "metadata", items: BUILT.agents }]),
        card("Two models", [{ kind: "metadata", items: BUILT.models }]),
      ),
      card("Skills", [{ kind: "metadata", items: BUILT.skills }]),
    ),
    section("What followed", "The work, the design councils, the polish and the eight turning points for quality; times in Pacific time (PT)", { kind: "timeline", label: "What followed", outcomeLabel: OUTCOME_LABEL, entries: FOLLOWED }),
    section(BUILT.insightfulLabel, "What the most insightful agents found", { kind: "metadata", items: BUILT.insightful }),
    section("The result, in numbers", RESULT.basis,
      grid(300,
        card("Tests", [{ kind: "metadata", items: RESULT.tests }]),
        card("Shipped", [{ kind: "metadata", items: RESULT.shipped }]),
      ),
    ),
  );
  return { id: "story", title: "How this was built", subtitle: "57 agents, Oct 17 to 22", toolbar: [], body };
}
