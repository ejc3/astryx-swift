/**
 * The demo's made-up company, Northwind Studio, and everything on its screens. Dates are
 * offsets from today so the demo is always current; nothing here is random.
 */
import type { Tone } from "./ui.ts";

export type Person = { id: string; name: string; email: string; role: Role; team: string; status: "active" | "away" | "invited"; joinedDaysAgo: number; projects: number };
export type Role = "Admin" | "Designer" | "Engineer" | "Manager" | "Writer";
export const ROLES: readonly Role[] = ["Admin", "Designer", "Engineer", "Manager", "Writer"];

export const ME = { id: "p1", name: "Maya Okafor", email: "maya@northwind.example", title: "Design Engineer", location: "Oakland, California", team: "Platform" };

export const PEOPLE: readonly Person[] = [
  { id: "p1", name: "Maya Okafor", email: "maya@northwind.example", role: "Engineer", team: "Platform", status: "active", joinedDaysAgo: 812, projects: 7 },
  { id: "p2", name: "Theo Lindqvist", email: "theo@northwind.example", role: "Designer", team: "Brand", status: "active", joinedDaysAgo: 402, projects: 4 },
  { id: "p3", name: "Priya Raman", email: "priya@northwind.example", role: "Manager", team: "Platform", status: "away", joinedDaysAgo: 1290, projects: 11 },
  { id: "p4", name: "Jonah Becker", email: "jonah@northwind.example", role: "Engineer", team: "Mobile", status: "active", joinedDaysAgo: 233, projects: 3 },
  { id: "p5", name: "Sofia Marín", email: "sofia@northwind.example", role: "Writer", team: "Content", status: "active", joinedDaysAgo: 96, projects: 2 },
  { id: "p6", name: "Kenji Watanabe", email: "kenji@northwind.example", role: "Admin", team: "Operations", status: "active", joinedDaysAgo: 1720, projects: 9 },
  { id: "p7", name: "Amara Diallo", email: "amara@northwind.example", role: "Designer", team: "Mobile", status: "invited", joinedDaysAgo: 2, projects: 0 },
  { id: "p8", name: "Lukas Novak", email: "lukas@northwind.example", role: "Engineer", team: "Data", status: "away", joinedDaysAgo: 540, projects: 5 },
  { id: "p9", name: "Grace Chen", email: "grace@northwind.example", role: "Manager", team: "Brand", status: "active", joinedDaysAgo: 960, projects: 8 },
  { id: "p10", name: "Omar Haddad", email: "omar@northwind.example", role: "Engineer", team: "Platform", status: "active", joinedDaysAgo: 150, projects: 4 },
  { id: "p11", name: "Ines Duarte", email: "ines@northwind.example", role: "Writer", team: "Content", status: "active", joinedDaysAgo: 610, projects: 6 },
  { id: "p12", name: "Felix Wagner", email: "felix@northwind.example", role: "Designer", team: "Platform", status: "away", joinedDaysAgo: 330, projects: 3 },
  { id: "p13", name: "Hana Kim", email: "hana@northwind.example", role: "Engineer", team: "Mobile", status: "active", joinedDaysAgo: 75, projects: 2 },
];

export function person(id: string): Person {
  return PEOPLE.find((p) => p.id === id) ?? PEOPLE[0]!;
}

export type Message = { id: string; from: string; subject: string; preview: string; body: string[]; minutesAgo: number; read: boolean; starred: boolean; archived: boolean; label?: { text: string; tone: Tone } };

export const MESSAGES: readonly Message[] = [
  { id: "m1", from: "p3", subject: "Q4 roadmap review moved to Thursday", preview: "Quick heads up: the review is now Thursday at 2.", body: ["Quick heads up: the review is now Thursday at 2 PM so that Kenji can join.", "Please bring one slide on what shipped this quarter and one on what slipped. Keep it short, we have eight teams to get through."], minutesAgo: 12, read: false, starred: true, archived: false, label: { text: "Planning", tone: "accent" } },
  { id: "m2", from: "p2", subject: "New icon set is ready for review", preview: "I've finished the 24px set. The 16px set needs another pass.", body: ["I've finished the 24px set and dropped it in the shared library.", "The 16px set needs another pass: the stroke weight falls apart at that size. Can you look at the navigation icons first?"], minutesAgo: 48, read: false, starred: false, archived: false, label: { text: "Design", tone: "info" } },
  { id: "m3", from: "p6", subject: "Invoice #4021 paid", preview: "Payment of $12,480.00 was received from Contoso.", body: ["Payment of $12,480.00 was received from Contoso for invoice #4021.", "No action needed. The receipt is attached to the account."], minutesAgo: 190, read: true, starred: false, archived: false, label: { text: "Billing", tone: "success" } },
  { id: "m4", from: "p4", subject: "Crash on launch in 3.2 beta", preview: "TestFlight users on iOS 26 see a crash when the cache is empty.", body: ["TestFlight users on iOS 26 see a crash at launch when the cache is empty.", "I have a fix and a test that fails without it. Can someone review it before the evening build?"], minutesAgo: 260, read: false, starred: true, archived: false, label: { text: "Urgent", tone: "danger" } },
  { id: "m5", from: "p5", subject: "Draft: launch blog post", preview: "Here is the first draft. I kept it under 600 words.", body: ["Here is the first draft of the launch post. I kept it under 600 words.", "The second section needs a screenshot. Any of the dashboard ones would work."], minutesAgo: 1600, read: true, starred: false, archived: false },
  { id: "m6", from: "p9", subject: "Offsite: pick your sessions", preview: "Sign-ups close Friday. There are still seats in the workshop.", body: ["Sign-ups close Friday. There are still seats in the accessibility workshop.", "Lunch is on the roof if the weather holds."], minutesAgo: 2900, read: true, starred: false, archived: false, label: { text: "Team", tone: "warning" } },
  { id: "m7", from: "p8", subject: "Dashboard numbers look off", preview: "The weekly active count doubled overnight. I think it's the backfill.", body: ["The weekly active count doubled overnight. I think the backfill counted every device twice.", "I've paused the job. The numbers will be right again after tonight's run."], minutesAgo: 4300, read: true, starred: false, archived: false },
];

export type Column = "todo" | "doing" | "done";
export const COLUMNS: readonly { id: Column; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "In progress" },
  { id: "done", title: "Done" },
];
export type Task = { id: string; title: string; column: Column; assignee: string; dueInDays: number; tags: { text: string; tone: Tone }[] };

export const TASKS: readonly Task[] = [
  { id: "t1", title: "Audit color contrast on the settings screen", column: "todo", assignee: "p2", dueInDays: 3, tags: [{ text: "Accessibility", tone: "info" }] },
  { id: "t2", title: "Ship the onboarding checklist", column: "doing", assignee: "p1", dueInDays: 1, tags: [{ text: "Feature", tone: "accent" }] },
  { id: "t3", title: "Fix the crash on empty cache", column: "doing", assignee: "p4", dueInDays: 0, tags: [{ text: "Bug", tone: "danger" }] },
  { id: "t4", title: "Write release notes for 3.2", column: "todo", assignee: "p5", dueInDays: 5, tags: [{ text: "Docs", tone: "neutral" }] },
  { id: "t5", title: "Migrate billing to the new API", column: "todo", assignee: "p1", dueInDays: 9, tags: [{ text: "Platform", tone: "warning" }, { text: "Backend", tone: "neutral" }] },
  { id: "t6", title: "Design the empty states", column: "done", assignee: "p12", dueInDays: -2, tags: [{ text: "Design", tone: "info" }] },
  { id: "t7", title: "Set up the staging environment", column: "done", assignee: "p6", dueInDays: -5, tags: [{ text: "Platform", tone: "warning" }] },
  { id: "t8", title: "Interview two candidates", column: "todo", assignee: "p3", dueInDays: 2, tags: [{ text: "Hiring", tone: "success" }] },
  { id: "t9", title: "Prototype the command palette", column: "doing", assignee: "p10", dueInDays: 4, tags: [{ text: "Feature", tone: "accent" }] },
];

export type CalendarEvent = { id: string; title: string; inDays: number; startMinute: number; minutes: number; tone: Tone; where: string };

export const EVENTS: readonly CalendarEvent[] = [
  { id: "e1", title: "Design critique", inDays: 0, startMinute: 600, minutes: 45, tone: "info", where: "Studio B" },
  { id: "e2", title: "1:1 with Priya", inDays: 0, startMinute: 840, minutes: 30, tone: "accent", where: "Video call" },
  { id: "e3", title: "Roadmap review", inDays: 2, startMinute: 840, minutes: 90, tone: "warning", where: "Main room" },
  { id: "e4", title: "Release 3.2", inDays: 3, startMinute: 540, minutes: 60, tone: "success", where: "Everywhere" },
  { id: "e5", title: "Team lunch", inDays: 3, startMinute: 720, minutes: 60, tone: "neutral", where: "The roof" },
  { id: "e6", title: "Offsite", inDays: 9, startMinute: 540, minutes: 480, tone: "accent", where: "Sausalito" },
  { id: "e7", title: "Dentist", inDays: 6, startMinute: 990, minutes: 60, tone: "danger", where: "Downtown" },
  { id: "e8", title: "Accessibility workshop", inDays: -3, startMinute: 600, minutes: 120, tone: "info", where: "Studio A" },
  { id: "e9", title: "Sprint planning", inDays: 7, startMinute: 570, minutes: 60, tone: "warning", where: "Main room" },
  { id: "e10", title: "Quarterly all-hands", inDays: 16, startMinute: 960, minutes: 60, tone: "accent", where: "Auditorium" },
  { id: "e11", title: "Interview: staff engineer", inDays: 1, startMinute: 660, minutes: 60, tone: "success", where: "Room 4" },
];

export type ChatLine = { id: string; from: string; text: string; minutesAgo: number };

export const CHAT: readonly ChatLine[] = [
  { id: "c1", from: "p2", text: "Morning! Did you get a chance to look at the icons?", minutesAgo: 95 },
  { id: "c2", from: "p1", text: "Just now. The 24px set is lovely. The gear feels a little heavy next to the others.", minutesAgo: 90 },
  { id: "c3", from: "p2", text: "Agreed, I'll thin the teeth. Anything else?", minutesAgo: 88 },
  { id: "c4", from: "p1", text: "The inbox icon reads as a tray at 16px. Maybe try the envelope?", minutesAgo: 80 },
  { id: "c5", from: "p2", text: "Good call. I'll send both versions before lunch.", minutesAgo: 78 },
];

/** What the other side of the chat says back, in turn. */
export const REPLIES: readonly string[] = [
  "On it. Give me ten minutes.",
  "That makes sense to me.",
  "Can we pair on it after standup?",
  "Sending a screenshot shortly.",
  "Nice, that's much better.",
];

export type Product = { id: string; name: string; detail: string; cents: number; hue: number };

export const PRODUCTS: readonly Product[] = [
  { id: "k1", name: "Studio Headphones", detail: "Graphite, wireless", cents: 24900, hue: 210 },
  { id: "k2", name: "Desk Lamp", detail: "Warm white, dimmable", cents: 8900, hue: 40 },
  { id: "k3", name: "Notebook Set", detail: "Dot grid, three pack", cents: 2400, hue: 140 },
];

/** What the cart holds before anyone changes it: quantity by product id. */
export const CART_QUANTITIES: Readonly<Record<string, number>> = { k1: 1, k2: 2, k3: 1 };

export const SHIPPING: readonly { value: string; label: string; days: string; cents: number }[] = [
  { value: "standard", label: "Standard", days: "5-7 business days", cents: 0 },
  { value: "express", label: "Express", days: "2-3 business days", cents: 1500 },
  { value: "overnight", label: "Overnight", days: "Next business day", cents: 3500 },
];

/** Revenue for the last twelve weeks, in dollars. */
export const WEEKLY_REVENUE: readonly number[] = [18200, 19400, 17800, 21000, 22600, 21900, 24100, 25800, 24900, 27300, 28800, 31200];

export const ORDERS: readonly { id: string; customer: string; cents: number; status: "Paid" | "Pending" | "Refunded"; daysAgo: number }[] = [
  { id: "#4027", customer: "Contoso", cents: 1248000, status: "Paid", daysAgo: 0 },
  { id: "#4026", customer: "Fabrikam", cents: 382000, status: "Pending", daysAgo: 0 },
  { id: "#4025", customer: "Litware", cents: 96000, status: "Paid", daysAgo: 1 },
  { id: "#4024", customer: "Tailspin", cents: 214500, status: "Refunded", daysAgo: 2 },
  { id: "#4023", customer: "Woodgrove", cents: 610000, status: "Paid", daysAgo: 3 },
];

export const ACTIVITY: readonly { who: string; did: string; minutesAgo: number; icon: "check" | "plus" | "chat" | "flag"; tone: Tone }[] = [
  { who: "p4", did: "fixed the crash on empty cache", minutesAgo: 20, icon: "check", tone: "success" },
  { who: "p2", did: "uploaded 48 new icons", minutesAgo: 75, icon: "plus", tone: "info" },
  { who: "p9", did: "commented on the offsite plan", minutesAgo: 140, icon: "chat", tone: "neutral" },
  { who: "p8", did: "flagged the weekly active count", minutesAgo: 400, icon: "flag", tone: "warning" },
];

export const SKILLS: readonly string[] = ["SwiftUI", "TypeScript", "Design systems", "Accessibility", "Motion", "Prototyping"];

/** The demo account's Settings screen before anyone changes it (the Profile screen reads the same values). */
export const PROFILE_DEFAULTS = { name: "Maya Okafor", email: "maya@northwind.example", bio: "Design engineer. I make the components and the tools that check them.", emailNotes: true, pushNotes: false, digest: "weekly", density: "comfortable", reduceMotion: false, following: false } as const;
