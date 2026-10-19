/**
 * Astryx's `dashboard` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/dashboard.tsx; the stock copy is web/src/stock/templates/dashboard.tsx.
 *
 * The page is a report: nothing in it changes state. The one button that does something
 * (Reload) is an action the core accepts and, for sample data, ignores. Chart data goes out
 * as plain numbers and labels; colors go out as names of the data palette ("blue"), which
 * each host maps to its own token.
 */
import { grouped } from "../../format.ts";
import type { TemplateModule } from "../types.ts";

/** The data palette's names, in the order Astryx assigns them. */
export type DataColor = "blue" | "orange" | "green" | "purple" | "neutral";

type Metric = { label: string; value: string; change: string; positive: boolean };
type Segment = { label: string; value: number; color: DataColor };
type PageRow = { id: string; page: string; views: number; newUsers: string; avgTime: string; exits: string };
type EventRow = { id: string; event: string; count: number; users: number; newUsers: number };

// Active users: 96 points over 24h at 15-minute steps (Apr 1 14:00 to Apr 2 14:00). The
// index is the x position. Rows are [label, all users, desktop, mobile].
const POINTS: readonly (readonly [string, number, number, number])[] = [
  ["Apr 1 14:00", 116, 79, 37],
  ["Apr 1 14:15", 118, 80, 38],
  ["Apr 1 14:30", 117, 79, 38],
  ["Apr 1 14:45", 119, 81, 38],
  ["Apr 1 15:00", 116, 79, 37],
  ["Apr 1 15:15", 113, 76, 37],
  ["Apr 1 15:30", 109, 72, 37],
  ["Apr 1 15:45", 111, 74, 37],
  ["Apr 1 16:00", 110, 72, 38],
  ["Apr 1 16:15", 107, 69, 38],
  ["Apr 1 16:30", 104, 66, 38],
  ["Apr 1 16:45", 101, 62, 39],
  ["Apr 1 17:00", 100, 57, 43],
  ["Apr 1 17:15", 99, 54, 45],
  ["Apr 1 17:30", 97, 50, 47],
  ["Apr 1 17:45", 95, 46, 49],
  ["Apr 1 18:00", 93, 41, 52],
  ["Apr 1 18:15", 91, 39, 52],
  ["Apr 1 18:30", 89, 37, 52],
  ["Apr 1 18:45", 87, 36, 51],
  ["Apr 1 19:00", 85, 34, 51],
  ["Apr 1 19:15", 83, 32, 51],
  ["Apr 1 19:30", 80, 30, 50],
  ["Apr 1 19:45", 77, 28, 49],
  ["Apr 1 20:00", 75, 26, 49],
  ["Apr 1 20:15", 76, 26, 50],
  ["Apr 1 20:30", 76, 27, 49],
  ["Apr 1 20:45", 75, 27, 48],
  ["Apr 1 21:00", 73, 27, 46],
  ["Apr 1 21:15", 71, 27, 44],
  ["Apr 1 21:30", 69, 27, 42],
  ["Apr 1 21:45", 67, 28, 39],
  ["Apr 1 22:00", 65, 29, 36],
  ["Apr 1 22:15", 63, 29, 34],
  ["Apr 1 22:30", 61, 30, 31],
  ["Apr 1 22:45", 60, 31, 29],
  ["Apr 1 23:00", 59, 33, 26],
  ["Apr 1 23:15", 58, 34, 24],
  ["Apr 1 23:30", 57, 35, 22],
  ["Apr 1 23:45", 56, 36, 20],
  ["Apr 2 00:00", 56, 38, 18],
  ["Apr 2 00:15", 56, 39, 17],
  ["Apr 2 00:30", 57, 40, 17],
  ["Apr 2 00:45", 56, 40, 16],
  ["Apr 2 01:00", 56, 41, 15],
  ["Apr 2 01:15", 55, 41, 14],
  ["Apr 2 01:30", 55, 41, 14],
  ["Apr 2 01:45", 54, 40, 14],
  ["Apr 2 02:00", 54, 40, 14],
  ["Apr 2 02:15", 53, 39, 14],
  ["Apr 2 02:30", 53, 39, 14],
  ["Apr 2 02:45", 52, 38, 14],
  ["Apr 2 03:00", 51, 37, 14],
  ["Apr 2 03:15", 50, 36, 14],
  ["Apr 2 03:30", 49, 35, 14],
  ["Apr 2 03:45", 49, 35, 14],
  ["Apr 2 04:00", 48, 34, 14],
  ["Apr 2 04:15", 48, 33, 15],
  ["Apr 2 04:30", 49, 33, 16],
  ["Apr 2 04:45", 49, 32, 17],
  ["Apr 2 05:00", 50, 31, 19],
  ["Apr 2 05:15", 51, 30, 21],
  ["Apr 2 05:30", 52, 29, 23],
  ["Apr 2 05:45", 54, 28, 26],
  ["Apr 2 06:00", 56, 27, 29],
  ["Apr 2 06:15", 58, 26, 32],
  ["Apr 2 06:30", 61, 26, 35],
  ["Apr 2 06:45", 64, 27, 37],
  ["Apr 2 07:00", 67, 28, 39],
  ["Apr 2 07:15", 70, 30, 40],
  ["Apr 2 07:30", 73, 33, 40],
  ["Apr 2 07:45", 76, 37, 39],
  ["Apr 2 08:00", 80, 43, 37],
  ["Apr 2 08:15", 85, 49, 36],
  ["Apr 2 08:30", 90, 55, 35],
  ["Apr 2 08:45", 95, 61, 34],
  ["Apr 2 09:00", 99, 66, 33],
  ["Apr 2 09:15", 102, 69, 33],
  ["Apr 2 09:30", 104, 72, 32],
  ["Apr 2 09:45", 104, 72, 32],
  ["Apr 2 10:00", 106, 74, 32],
  ["Apr 2 10:15", 109, 76, 33],
  ["Apr 2 10:30", 112, 78, 34],
  ["Apr 2 10:45", 114, 80, 34],
  ["Apr 2 11:00", 116, 81, 35],
  ["Apr 2 11:15", 117, 81, 36],
  ["Apr 2 11:30", 119, 83, 36],
  ["Apr 2 11:45", 119, 82, 37],
  ["Apr 2 12:00", 120, 83, 37],
  ["Apr 2 12:15", 115, 78, 37],
  ["Apr 2 12:30", 111, 74, 37],
  ["Apr 2 12:45", 110, 73, 37],
  ["Apr 2 13:00", 113, 76, 37],
  ["Apr 2 13:15", 116, 79, 37],
  ["Apr 2 13:30", 118, 81, 37],
  ["Apr 2 14:00", 120, 83, 37],
];

const METRICS: readonly Metric[] = [
  { label: "Monthly Visitors", value: "27.3 k", change: "+18.2%", positive: true },
  { label: "Monthly Page Views", value: "48.2 k", change: "+12.5%", positive: true },
  { label: "Avg. Session", value: "4.5 min", change: "-14.3%", positive: false },
  { label: "Bounce Rate", value: "42.3%", change: "-8.7%", positive: false },
];

const SPARKLINES: readonly (readonly number[])[] = [
  [48, 46, 44, 42, 40, 18, 16, 38, 36, 34, 32, 30, 12, 10, 28, 26, 28, 32, 36, 14, 12, 40, 44, 48, 52, 56, 28, 24, 58, 62],
  [36, 38, 35, 37, 36, 14, 12, 38, 36, 34, 37, 35, 12, 10, 36, 34, 36, 35, 38, 14, 12, 40, 44, 50, 54, 56, 26, 22, 58, 60],
  [58, 56, 60, 58, 62, 30, 26, 60, 58, 62, 60, 58, 28, 24, 56, 54, 50, 46, 42, 18, 14, 38, 36, 34, 32, 30, 10, 8, 28, 26],
  [52, 56, 50, 54, 58, 62, 60, 54, 52, 56, 50, 54, 60, 58, 50, 48, 46, 44, 40, 46, 44, 38, 36, 34, 36, 32, 38, 36, 30, 28],
];

const REGIONS: readonly Segment[] = [
  { label: "NORAM", value: 38, color: "blue" },
  { label: "EMEA", value: 28, color: "orange" },
  { label: "APAC", value: 22, color: "green" },
  { label: "LATAM", value: 8, color: "purple" },
  { label: "Other", value: 4, color: "neutral" },
];

const ROLES: readonly Segment[] = [
  { label: "Engineer", value: 45, color: "blue" },
  { label: "Manager", value: 20, color: "orange" },
  { label: "Designer", value: 15, color: "green" },
  { label: "Data Scientist", value: 12, color: "purple" },
  { label: "Other", value: 8, color: "neutral" },
];

const PAGES: readonly PageRow[] = [
  { id: "1", page: "/home", views: 8420, newUsers: "62.3%", avgTime: "3:42", exits: "18.5%" },
  { id: "2", page: "/products", views: 6150, newUsers: "45.1%", avgTime: "4:15", exits: "22.8%" },
  { id: "3", page: "/pricing", views: 4830, newUsers: "38.7%", avgTime: "2:58", exits: "35.2%" },
  { id: "4", page: "/blog", views: 3920, newUsers: "71.4%", avgTime: "5:30", exits: "12.1%" },
  { id: "5", page: "/docs", views: 3410, newUsers: "29.8%", avgTime: "6:12", exits: "8.4%" },
  { id: "6", page: "/about", views: 2980, newUsers: "55.6%", avgTime: "2:15", exits: "28.3%" },
  { id: "7", page: "/contact", views: 2540, newUsers: "48.2%", avgTime: "1:48", exits: "41.7%" },
  { id: "8", page: "/changelog", views: 2210, newUsers: "22.1%", avgTime: "4:55", exits: "15.6%" },
  { id: "9", page: "/support", views: 1870, newUsers: "59.3%", avgTime: "3:22", exits: "30.9%" },
  { id: "10", page: "/careers", views: 1520, newUsers: "83.1%", avgTime: "2:34", exits: "45.2%" },
];

const EVENTS: readonly EventRow[] = [
  { id: "1", event: "page_view", count: 18420, users: 12300, newUsers: 4920 },
  { id: "2", event: "session_start", count: 14850, users: 9870, newUsers: 3950 },
  { id: "3", event: "first_visit", count: 8230, users: 8230, newUsers: 8230 },
  { id: "4", event: "user_engagement", count: 6120, users: 4510, newUsers: 1580 },
  { id: "5", event: "click", count: 3540, users: 2680, newUsers: 940 },
  { id: "6", event: "scroll", count: 2910, users: 2140, newUsers: 750 },
  { id: "7", event: "form_submit", count: 1870, users: 1350, newUsers: 540 },
  { id: "8", event: "video_play", count: 1240, users: 980, newUsers: 390 },
  { id: "9", event: "search", count: 960, users: 720, newUsers: 290 },
  { id: "10", event: "share", count: 580, users: 410, newUsers: 160 },
];


export type DashboardState = {
  points: readonly (readonly [string, number, number, number])[];
  metrics: readonly Metric[];
  sparklines: readonly (readonly number[])[];
  regions: readonly Segment[];
  roles: readonly Segment[];
  pages: readonly PageRow[];
  events: readonly EventRow[];
};

/** Words only assistive technology reads: chart summaries, axis titles and the change's meaning. */
export type DashboardWords = {
  timeTitle: string;
  usersTitle: string;
  trendTitle: string;
  trendAxisX: string;
  trendAxisY: string;
  shareTitle: string;
  shareAxisX: string;
  up: string;
  down: string;
  favorable: string;
  unfavorable: string;
};

const WORDS: DashboardWords = {
  timeTitle: "Time",
  usersTitle: "Active users",
  trendTitle: "Trend",
  trendAxisX: "Day",
  trendAxisY: "Value",
  shareTitle: "Share",
  shareAxisX: "Group",
  up: "up",
  down: "down",
  favorable: "better",
  unfavorable: "worse",
};

/** Ids of the controls with no action behind them (a host draws them disabled). */
const INERT = ["viewMore", "tableLink"];

/** A metric where a fall is the good news. */
const LOWER_IS_BETTER: readonly string[] = ["Bounce Rate"];

function describeSeries(name: string, values: readonly number[]): string {
  const first = values[0]!;
  const last = values[values.length - 1]!;
  return `${name} starts at ${first}, ranges from ${Math.min(...values)} to ${Math.max(...values)} and ends at ${last}`;
}

export type DashboardView = {
  words: DashboardWords;
  /** Ids of the controls the core has no action for; hosts draw these disabled. */
  inert: string[];
  activeUsers: {
    title: string;
    /** What the chart says, in words: for the audio graph and for VoiceOver. */
    summary: string;
    reloadLabel: string;
    points: { hour: number; label: string; allUsers: number; desktop: number; mobile: number }[];
    series: { key: "allUsers" | "desktop" | "mobile"; name: string; color: DataColor }[];
    /** The x axis shows hours 0 to 23 of the 96 points, as the stock page does. */
    xDomain: [number, number];
    xTicks: { at: number; label: string }[];
    yDomain: [number, number];
    yTicks: number[];
  };
  /** Four cards; the page lays them out two to a row. */
  metrics: {
    label: string;
    value: string;
    change: string;
    positive: boolean;
    caption: string;
    sparkline: number[];
    /** Which way the figure moved. `positive` is the web's color; `favorable` is whether that move is good news. */
    direction: "up" | "down";
    favorable: boolean;
    /** The change, spoken: "down 8.7%, better". */
    changeSpoken: string;
    /** The sparkline, in words. */
    trend: string;
  }[];
  demographics: {
    title: string;
    moreLabel: string;
    cards: { title: string; summary: string; segments: { label: string; value: number; color: DataColor; /** Its share of the bar, to two decimals, without the percent sign: "38.00". */ share: string }[] }[];
  };
  engagement: {
    title: string;
    moreLabel: string;
    pages: PagesTable;
    events: EventsTable;
  };
};

export type PagesTable = {
  title: string;
  linkLabel: string;
  linkHref: string;
  headers: { page: string; views: string; newUsers: string; avgTime: string };
  rows: { id: string; page: string; views: number; max: number; barLabel: string; viewsLabel: string; newUsers: string; avgTime: string }[];
};

export type EventsTable = {
  title: string;
  linkLabel: string;
  linkHref: string;
  headers: { event: string; count: string; users: string; newUsers: string };
  rows: { id: string; event: string; count: number; max: number; barLabel: string; countLabel: string; usersLabel: string; newUsersLabel: string }[];
};

const X_TICKS = [0, 32, 64, 95];

function segmentCard(title: string, data: readonly Segment[]): DashboardView["demographics"]["cards"][number] {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return {
    title,
    summary: `${title}: ${data.map((d) => `${d.label} ${((d.value / total) * 100).toFixed(2)}%`).join(", ")}`,
    segments: data.map((d) => ({ label: d.label, value: d.value, color: d.color, share: ((d.value / total) * 100).toFixed(2) })),
  };
}

export const dashboard: TemplateModule<DashboardState, DashboardView> = {
  id: "dashboard",
  astryx: "dashboard",
  title: "Dashboard",
  initial: () => ({ points: POINTS, metrics: METRICS, sparklines: SPARKLINES, regions: REGIONS, roles: ROLES, pages: PAGES, events: EVENTS }),
  reduce: (s) => s,
  view: (s) => {
    const maxViews = Math.max(...s.pages.map((d) => d.views));
    const maxCount = Math.max(...s.events.map((d) => d.count));
    return {
      words: WORDS,
      inert: INERT,
      activeUsers: {
        title: "Active users",
        summary: [
          describeSeries("All Users", s.points.map((p) => p[1])),
          describeSeries("Desktop", s.points.map((p) => p[2])),
          describeSeries("Mobile", s.points.map((p) => p[3])),
        ].join(". "),
        reloadLabel: "Reload",
        points: s.points.map((p, hour) => ({ hour, label: p[0], allUsers: p[1], desktop: p[2], mobile: p[3] })),
        series: [
          { key: "allUsers", name: "All Users", color: "blue" },
          { key: "desktop", name: "Desktop", color: "orange" },
          { key: "mobile", name: "Mobile", color: "purple" },
        ],
        xDomain: [0, 23],
        xTicks: X_TICKS.map((at) => ({ at, label: s.points[at]![0] })),
        yDomain: [0, 120],
        yTicks: [0, 20, 40, 60, 80, 100, 120],
      },
      metrics: s.metrics.map((m, i) => {
        const direction = m.change.startsWith("-") ? "down" : "up";
        const favorable = LOWER_IS_BETTER.includes(m.label) ? direction === "down" : direction === "up";
        const spark = s.sparklines[i]!;
        return {
          ...m,
          caption: "Last 30 days vs. Previous",
          sparkline: [...spark],
          direction,
          favorable,
          changeSpoken: `${WORDS[direction]} ${m.change.replace(/^[-+]/, "")}, ${favorable ? WORDS.favorable : WORDS.unfavorable}`,
          trend: `${describeSeries(WORDS.trendTitle, spark)} over ${spark.length} days`,
        };
      }),
      demographics: {
        title: "Demographics",
        moreLabel: "View more",
        cards: [segmentCard("Region", s.regions), segmentCard("Role", s.roles)],
      },
      engagement: {
        title: "Engagement",
        moreLabel: "View more",
        pages: {
          title: "Top pages",
          linkLabel: "All pages",
          linkHref: "#",
          headers: { page: "Page", views: "Views", newUsers: "New Users", avgTime: "Avg. Time" },
          rows: s.pages.map((r) => ({
            id: r.id,
            page: r.page,
            views: r.views,
            max: maxViews,
            barLabel: `${r.page} views`,
            viewsLabel: `${grouped(r.views)} views`,
            newUsers: r.newUsers,
            avgTime: r.avgTime,
          })),
        },
        events: {
          title: "Top events",
          linkLabel: "All events",
          linkHref: "#",
          headers: { event: "Event", count: "Count", users: "Users", newUsers: "New Users" },
          rows: s.events.map((r) => ({
            id: r.id,
            event: r.event,
            count: r.count,
            max: maxCount,
            barLabel: `${r.count}`,
            countLabel: grouped(r.count),
            usersLabel: grouped(r.users),
            newUsersLabel: grouped(r.newUsers),
          })),
        },
      },
    };
  },
};
