import { compact, grouped, hueOf, initials, money, percent, plural } from "../format.ts";
import { ACTIVITY, ORDERS, PEOPLE, WEEKLY_REVENUE, person } from "../sample.ts";
import { checks, type State } from "../state.ts";
import type { Node, Screen, Tone } from "../ui.ts";
import { badge, button, card, grid, h, text, v, wrap } from "./nodes.ts";

const PLANS = [
  { value: "solo", label: "Solo", description: "One seat, every component." },
  { value: "team", label: "Team", description: "Up to 20 seats and shared themes." },
  { value: "studio", label: "Studio", description: "Unlimited seats, SSO and audit logs." },
];

export function overview(s: State): Screen {
  const o = s.overview;
  const emailError = o.email === "" ? undefined : checks.email(o.email);
  const tones: Tone[] = ["neutral", "accent", "success", "warning", "danger", "info"];
  const body: Node = v("lg",
    ...(o.bannerOpen ? [{ kind: "banner", tone: "info", title: "One core, three hosts", text: "Every word, count and check on this page is computed in TypeScript. The web draws it with Astryx; the Mac and iPhone apps draw it with SwiftUI.", dismissId: "overview.closeBanner" } satisfies Node] : []),
    grid(300,
      card("Buttons", [
        wrap("sm", button("overview.count", `Clicked ${plural(o.count, "time")}`, "primary", "bolt"), button("overview.toast", "Show a toast", "secondary", "bell"), button("overview.reset", "Reset", "ghost", "undo"), button("overview.none", "Delete", "destructive", "trash")),
        wrap("sm", { kind: "iconButton", id: "overview.count", icon: "heart", label: "Like" }, { kind: "iconButton", id: "overview.count", icon: "star", label: "Star", selected: true }, { kind: "iconButton", id: "overview.count", icon: "flag", label: "Flag" }, button("overview.none", "Disabled", "secondary", undefined, true)),
      ]),
      card("Badges and tokens", [
        wrap("xs", ...tones.map((t) => badge(t[0]!.toUpperCase() + t.slice(1), t))),
        wrap("xs", ...o.tags.map((t): Node => ({ kind: "token", text: t, tone: "accent", removeId: `overview.untag:${t}` }))),
        o.tags.length === 0 ? text("All tokens removed. Reset brings them back.", "caption") : text(`${plural(o.tags.length, "token")}. Remove one with ×.`, "caption"),
      ]),
      card("People", [
        h("sm", ...PEOPLE.slice(0, 4).map((p, i): Node => ({ kind: "avatar", name: p.name, initials: initials(p.name), hue: hueOf(p.name), size: (["sm", "md", "lg", "md"] as const)[i]!, ...(p.status === "active" ? { status: "success" as const, statusLabel: "Online" } : p.status === "away" ? { status: "warning" as const, statusLabel: "Away" } : {}) }))),
        { kind: "avatarGroup", people: PEOPLE.slice(4, 9).map((p) => ({ initials: initials(p.name), hue: hueOf(p.name) })), more: `+${PEOPLE.length - 9}` },
        wrap("md", { kind: "statusDot", tone: "success", label: "Online" }, { kind: "statusDot", tone: "warning", label: "Away" }, { kind: "statusDot", tone: "neutral", label: "Offline" }),
      ]),
      card("Controls", [
        { kind: "switch", id: "overview.notify", label: "Notifications", description: o.notify ? "You'll hear about mentions." : "Muted until you turn them back on.", on: o.notify },
        { kind: "segmented", id: "overview.size", label: "Size", options: [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }], value: o.size },
        { kind: "slider", id: "overview.volume", label: "Volume", value: o.volume, min: 0, max: 100, step: 5, valueText: o.volume === 0 ? "Muted" : percent(o.volume / 100, 0) },
        { kind: "checkbox", id: "overview.agree", label: "I agree to the terms", checked: o.agree },
      ]),
      card("Choose a plan", [{ kind: "radio", id: "overview.plan", label: "Plan", options: PLANS, value: o.plan }, text(`${PLANS.find((p) => p.value === o.plan)?.label ?? ""} selected.`, "caption")]),
      card("Input with validation", [
        { kind: "textInput", id: "overview.email", label: "Work email", value: o.email, placeholder: "name@company.com", icon: "mail", error: emailError, hint: emailError ? undefined : o.email === "" ? "We'll check it as you type." : "Looks good." },
        h("xs", text("Search anywhere with", "caption"), { kind: "kbd", keys: ["⌘", "K"] }),
      ]),
      card("Progress", [
        { kind: "progress", label: "Storage", value: 0.72, valueText: "72 of 100 GB", tone: "accent" },
        { kind: "progress", label: "Uploads", value: 1, valueText: "Complete", tone: "success" },
        { kind: "progress", label: "Quota", value: 0.93, valueText: "93%, nearly full", tone: "danger" },
      ]),
      card("Empty state", [{ kind: "empty", icon: "sparkle", title: "Nothing here yet", text: "Empty states are nodes too, with a way forward.", action: button("navigate:dashboard", "Open the dashboard", "primary") }]),
    ),
  );
  return { id: "overview", title: "Components", subtitle: "Astryx's components, from one core", toolbar: [button("overview.reset", "Reset", "ghost", "undo")], body };
}

export function dashboard(s: State): Screen {
  const weeks = WEEKLY_REVENUE;
  const last = weeks[weeks.length - 1]!, prev = weeks[weeks.length - 2]!;
  const max = Math.max(...weeks);
  const change = (last - prev) / prev;
  const unread = s.inbox.messages.filter((m) => !m.read && !m.archived).length;
  const open = s.tasks.tasks.filter((t) => t.column !== "done").length;
  const done = s.tasks.tasks.length - open;
  const statusTone: Record<string, Tone> = { Paid: "success", Pending: "warning", Refunded: "neutral" };
  const body = v("lg",
    grid(220,
      { kind: "metric", label: "Revenue this week", value: money(last * 100).replace(/\.00$/, ""), delta: { text: `${percent(Math.abs(change))} vs last week`, tone: change >= 0 ? "success" : "danger", up: change >= 0 }, trend: weeks.map((w) => w / max) },
      { kind: "metric", label: "Active customers", value: grouped(1284), delta: { text: "36 new this week", tone: "success", up: true }, trend: [0.6, 0.62, 0.61, 0.66, 0.7, 0.72, 0.75, 0.78, 0.8, 0.83, 0.86, 0.9] },
      { kind: "metric", label: "Open tasks", value: grouped(open), delta: { text: `${plural(done, "task")} done`, tone: "neutral", up: true } },
      { kind: "metric", label: "Unread messages", value: grouped(unread), delta: { text: unread === 0 ? "Inbox zero" : "Oldest from today", tone: unread === 0 ? "success" : "warning", up: false } },
    ),
    grid(360,
      card("Weekly revenue", [{ kind: "bars", label: "Revenue, last twelve weeks", bars: weeks.map((w, i) => ({ label: `W${i + 1}`, value: w / max, valueText: `$${compact(w)}`, highlight: i === weeks.length - 1 })) }], { subtitle: `Up ${percent((last - weeks[0]!) / weeks[0]!, 0)} since week 1` }),
      card("Recent activity", [{ kind: "list", empty: "No activity yet.", items: ACTIVITY.map((a, i) => ({ id: `a${i}`, title: `${person(a.who).name.split(" ")[0]} ${a.did}`, meta: a.minutesAgo < 60 ? `${a.minutesAgo}m ago` : `${Math.floor(a.minutesAgo / 60)}h ago`, leading: { icon: a.icon, tone: a.tone }, emphasized: false, selected: false })) }]),
    ),
    card("Latest orders", [{
      kind: "table", stackBelow: 600, empty: "No orders.",
      columns: [{ id: "id", label: "Order", align: "start", sort: null }, { id: "customer", label: "Customer", align: "start", sort: null }, { id: "status", label: "Status", align: "start", sort: null }, { id: "total", label: "Total", align: "end", sort: null }],
      rows: ORDERS.map((o) => ({ id: o.id, selected: false, cells: [{ text: o.id }, { text: o.customer, secondary: o.daysAgo === 0 ? "Today" : o.daysAgo === 1 ? "Yesterday" : `${o.daysAgo} days ago` }, { text: o.status, badge: { text: o.status, tone: statusTone[o.status]! } }, { text: money(o.cents), align: "end" }] })),
    }], { action: button("navigate:people", "View customers", "ghost", "chevron-right") }),
  );
  return { id: "dashboard", title: "Dashboard", subtitle: "Northwind Studio at a glance", toolbar: [button("navigate:inbox", unread === 0 ? "Inbox" : `Inbox (${unread})`, "secondary", "inbox")], body };
}
