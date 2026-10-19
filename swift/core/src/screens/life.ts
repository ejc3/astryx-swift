/** Calendar, Chat, Checkout, Profile and Settings. */
import { addDays, clock, dayNumber, daysInMonth, grouped, hueOf, initials, longDate, money, monthTitle, plural, relativeDay, sameDay, weekday, weekdayInitials, type Civil } from "../format.ts";
import { EVENTS, ME, PEOPLE, PRODUCTS, SHIPPING, SKILLS, TASKS, person } from "../sample.ts";
import { checkoutErrors, checks, type State } from "../state.ts";
import { THEME_INPUTS } from "../themes.ts";
import type { CalendarDay, Node, Screen } from "../ui.ts";
import { badge, button, card, grid, h, heading, section, spread, text, v, wrap } from "./nodes.ts";

function eventsOn(day: Civil, today: Civil) {
  const offset = dayNumber(day) - dayNumber(today);
  return EVENTS.filter((e) => e.inDays === offset).sort((a, b) => a.startMinute - b.startMinute);
}

export function calendar(s: State): Screen {
  const c = s.calendar;
  const first: Civil = { year: c.year, month: c.month, day: 1 };
  const start = addDays(first, -weekday(first));
  const total = daysInMonth(c.year, c.month);
  const rows = Math.ceil((weekday(first) + total) / 7);
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < rows; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      week.push({ label: String(day.day), inMonth: day.month === c.month, today: sameDay(day, s.today), selected: sameDay(day, c.selected), dots: eventsOn(day, s.today).slice(0, 3).map((e) => e.tone), selectId: `calendar.day:${dayNumber(day)}` });
    }
    weeks.push(week);
  }
  const events = eventsOn(c.selected, s.today);
  const thisWeek = EVENTS.filter((e) => e.inDays >= 0 && e.inDays < 7).length;
  return {
    id: "calendar", title: "Calendar", subtitle: `${plural(thisWeek, "event")} in the next seven days`,
    toolbar: [button("calendar.today", "Today", "secondary", "calendar")],
    body: grid(320,
      card(undefined, [{ kind: "calendar", title: monthTitle(c.year, c.month), weekdays: weekdayInitials(), weeks, previousId: "calendar.month:previous", nextId: "calendar.month:next", previousLabel: "Previous month", nextLabel: "Next month" }]),
      card(relativeDay(c.selected, s.today) === "Today" ? "Today" : longDate(c.selected), [
        text(relativeDay(c.selected, s.today) === "Today" ? longDate(c.selected) : events.length === 0 ? "Nothing scheduled." : plural(events.length, "event"), "secondary"),
        {
          kind: "list", empty: "A free day. Enjoy it.",
          items: events.map((e) => ({ id: e.id, title: e.title, subtitle: `${clock(e.startMinute)} - ${clock(e.startMinute + e.minutes)} · ${e.where}`, meta: e.minutes >= 60 ? `${e.minutes / 60 >= 8 ? "All day" : `${Math.round((e.minutes / 60) * 10) / 10} h`}` : `${e.minutes} min`, leading: { icon: "clock", tone: e.tone }, emphasized: e.inDays === 0 && e.startMinute + e.minutes > s.minute && e.startMinute <= s.minute, selected: false })),
        },
      ]),
    ),
  };
}

export function chat(s: State): Screen {
  const other = person("p2");
  return {
    id: "chat", title: other.name, subtitle: "Designer · Brand team · Online",
    toolbar: [],
    body: {
      kind: "chat",
      messages: s.chat.lines.map((l) => {
        const who = person(l.from);
        return { id: l.id, author: who.id === ME.id ? "You" : who.name.split(" ")[0]!, initials: initials(who.name), hue: hueOf(who.name), mine: who.id === ME.id, text: l.text, time: l.minutesAgo === 0 ? "Now" : clock(s.minute - l.minutesAgo) };
      }),
      composer: { id: "chat.draft", value: s.chat.draft, placeholder: `Message ${other.name.split(" ")[0]}`, sendId: "chat.send", sendLabel: "Send", canSend: s.chat.draft.trim() !== "" },
    },
  };
}

const STEPS = ["Cart", "Shipping", "Payment", "Review"];

export function checkout(s: State): Screen {
  const c = s.checkout;
  const lines = PRODUCTS.map((p) => ({ p, q: c.quantities[p.id] ?? 0 }));
  const subtotal = lines.reduce((sum, l) => sum + l.p.cents * l.q, 0);
  const ship = SHIPPING.find((x) => x.value === c.shipping) ?? SHIPPING[0]!;
  const tax = Math.round(subtotal * 0.0925);
  const total = subtotal + ship.cents + tax;
  const errors = c.attempted === c.step ? checkoutErrors(s, c.step) : {};
  const items = lines.reduce((n, l) => n + l.q, 0);

  const summary = card("Order summary", [
    { kind: "metadata", items: [{ label: `Subtotal (${plural(items, "item")})`, value: money(subtotal) }, { label: `Shipping, ${ship.label.toLowerCase()}`, value: ship.cents === 0 ? "Free" : money(ship.cents) }, { label: "Tax (9.25%)", value: money(tax) }] },
    { kind: "divider" },
    spread(text("Total", "emphasis"), text(money(total), "emphasis")),
    ...(subtotal >= 30000 ? [badge("Free returns on orders over $300", "success")] : []),
  ]);

  if (c.placed) {
    return {
      id: "checkout", title: "Checkout", subtitle: "Order confirmed", toolbar: [],
      body: grid(320, card(undefined, [{ kind: "empty", icon: "check", title: "Thank you, your order is placed", text: `${plural(items, "item")} on the way to ${c.city}. Arrives in ${ship.days.toLowerCase()}.`, action: button("checkout.restart", "Start a new order", "secondary", "undo") }]), summary),
    };
  }

  let form: Node[];
  if (c.step === 0) {
    form = [
      ...lines.map((l): Node => spread(h("sm", { kind: "avatar", name: l.p.name, initials: initials(l.p.name), hue: l.p.hue, size: "md" }, v("xs", text(l.p.name, "emphasis"), text(`${l.p.detail} · ${money(l.p.cents)}`, "caption"))), { kind: "select", id: `checkout.qty:${l.p.id}`, label: "Quantity", value: String(l.q), options: Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: i === 0 ? "Remove" : String(i) })) })),
      ...(errors.cart ? [{ kind: "banner", tone: "danger", title: "Nothing to check out", text: errors.cart } satisfies Node] : []),
    ];
  } else if (c.step === 1) {
    form = [
      { kind: "textInput", id: "checkout.name", label: "Full name", value: c.name, placeholder: "Maya Okafor", error: errors.name },
      { kind: "textInput", id: "checkout.address", label: "Street address", value: c.address, placeholder: "1200 Broadway", error: errors.address },
      grid(160, { kind: "textInput", id: "checkout.city", label: "City", value: c.city, placeholder: "Oakland", error: errors.city }, { kind: "textInput", id: "checkout.zip", label: "ZIP code", value: c.zip, placeholder: "94612", error: errors.zip }),
      { kind: "radio", id: "checkout.shipping", label: "Delivery", value: c.shipping, options: SHIPPING.map((x) => ({ value: x.value, label: `${x.label} · ${x.cents === 0 ? "Free" : money(x.cents)}`, description: x.days })) },
    ];
  } else if (c.step === 2) {
    form = [
      { kind: "textInput", id: "checkout.card", label: "Card number", value: c.card, placeholder: "4242 4242 4242 4242", icon: "card", error: errors.card, hint: errors.card ? undefined : "Any test card that passes the Luhn check works." },
      grid(140, { kind: "textInput", id: "checkout.expiry", label: "Expiry", value: c.expiry, placeholder: "MM/YY", error: errors.expiry }, { kind: "textInput", id: "checkout.cvc", label: "Security code", value: c.cvc, placeholder: "123", secure: true, error: errors.cvc }),
      { kind: "banner", tone: "info", title: "This is a demo", text: "No card is charged and nothing leaves the device." },
    ];
  } else {
    form = [
      section("Ship to", undefined, text(`${c.name}\n${c.address}\n${c.city} ${c.zip}`), button("checkout.goto:1", "Change", "ghost")),
      section("Pay with", undefined, text(`Card ending ${c.card.replace(/\s/g, "").slice(-4)}, expires ${c.expiry}`), button("checkout.goto:2", "Change", "ghost")),
      section("Items", undefined, ...lines.filter((l) => l.q > 0).map((l) => spread(text(`${l.q} × ${l.p.name}`), text(money(l.p.cents * l.q))))),
    ];
  }

  return {
    id: "checkout", title: "Checkout", subtitle: `Step ${c.step + 1} of ${STEPS.length}: ${STEPS[c.step]}`,
    toolbar: [button("checkout.fill", "Fill with test data", "ghost", "sparkle")],
    body: v("lg",
      { kind: "stepper", steps: STEPS.map((label, i) => ({ label, state: i < c.step ? "done" : i === c.step ? "current" : "upcoming", ...(i < c.step ? { selectId: `checkout.goto:${i}` } : {}) })) },
      grid(320,
        card(STEPS[c.step], [...form, spread(c.step > 0 ? button("checkout.back", "Back", "secondary", "chevron-left") : text("", "caption"), c.step < 3 ? button("checkout.next", c.step === 2 ? "Review order" : "Continue", "primary", "chevron-right") : button("checkout.place", `Pay ${money(total)}`, "primary", "lock"))]),
        summary,
      ),
    ),
  };
}

export function profile(s: State): Screen {
  const me = person(ME.id);
  const mine = TASKS.filter((t) => t.assignee === ME.id);
  const teammates = PEOPLE.filter((p) => p.team === ME.team && p.id !== ME.id);
  return {
    id: "profile", title: "Profile", subtitle: ME.title,
    toolbar: [button("profile.follow", s.profile.following ? "Following" : "Follow", s.profile.following ? "secondary" : "primary", s.profile.following ? "check" : "plus")],
    body: v("lg",
      card(undefined, [
        h("md", { kind: "avatar", name: me.name, initials: initials(me.name), hue: hueOf(me.name), size: "lg", status: "success", statusLabel: "Online" }, v("xs", heading(me.name, 1), text(`${ME.title} · ${ME.team}`, "secondary"), text(ME.location, "caption"))),
        text(s.settings.bio),
        wrap("xs", ...SKILLS.map((k): Node => ({ kind: "token", text: k, tone: "neutral" }))),
      ]),
      grid(200,
        { kind: "metric", label: "Projects", value: grouped(me.projects) },
        { kind: "metric", label: "Open tasks", value: grouped(mine.filter((t) => t.column !== "done").length) },
        { kind: "metric", label: "Followers", value: grouped(s.profile.following ? 129 : 128) },
        { kind: "metric", label: "With the team", value: `${Math.floor(me.joinedDaysAgo / 365)} years` },
      ),
      { kind: "tabs", id: "profile.tab", value: s.profile.tab, tabs: [{ value: "activity", label: "Activity" }, { value: "team", label: "Team", count: grouped(teammates.length) }, { value: "about", label: "About" }] },
      s.profile.tab === "team"
        ? card(undefined, [{ kind: "list", empty: "No teammates.", items: teammates.map((p) => ({ id: p.id, title: p.name, subtitle: `${p.role} · ${p.email}`, leading: { avatar: { initials: initials(p.name), hue: hueOf(p.name) } }, trailing: { text: p.status === "away" ? "Away" : p.status === "invited" ? "Invited" : "Active", tone: p.status === "away" ? "warning" : p.status === "invited" ? "info" : "success" }, emphasized: false, selected: false })) }])
        : s.profile.tab === "about"
          ? card(undefined, [{ kind: "metadata", items: [{ label: "Email", value: s.settings.email }, { label: "Team", value: ME.team }, { label: "Location", value: ME.location }, { label: "Local time", value: clock(s.minute) }, { label: "Joined", value: relativeDay(addDays(s.today, -me.joinedDaysAgo), s.today) }] }])
          : card(undefined, [{ kind: "list", empty: "Nothing yet.", items: mine.map((t) => ({ id: t.id, title: t.title, subtitle: t.column === "done" ? "Completed" : t.column === "doing" ? "In progress" : "Not started", leading: { icon: t.column === "done" ? "check" : "clock", tone: t.column === "done" ? "success" : "accent" }, ...(t.tags[0] ? { trailing: t.tags[0] } : {}), emphasized: false, selected: false })) }]),
    ),
  };
}

export function settings(s: State): Screen {
  const st = s.settings;
  const nameError = checks.required(st.name, "your name");
  const emailError = checks.email(st.email);
  return {
    id: "settings", title: "Settings", subtitle: "Your account and how the app looks",
    toolbar: [button("settings.save", "Save", "primary", "check")],
    body: v("lg",
      ...(st.deleted ? [{ kind: "banner", tone: "danger", title: "Account scheduled for deletion", text: "It will be deleted in 30 days unless you cancel.", action: button("settings.restore", "Cancel deletion", "secondary", "undo") } satisfies Node] : []),
      card("Profile", [
        grid(220, { kind: "textInput", id: "settings.name", label: "Name", value: st.name, placeholder: "Your name", error: nameError }, { kind: "textInput", id: "settings.email", label: "Email", value: st.email, placeholder: "name@company.com", icon: "mail", error: emailError }),
        { kind: "textInput", id: "settings.bio", label: "Bio", value: st.bio, placeholder: "A sentence about you", multiline: true, hint: `${grouped(160 - st.bio.length)} characters left` },
      ]),
      card("Notifications", [
        { kind: "switch", id: "settings.emailNotes", label: "Email", description: "Mentions, replies and invitations.", on: st.emailNotes },
        { kind: "switch", id: "settings.pushNotes", label: "Push notifications", description: st.pushNotes ? "Sent to this device." : "Off on every device.", on: st.pushNotes },
        { kind: "select", id: "settings.digest", label: "Summary email", value: st.digest, options: [{ value: "daily", label: "Every day" }, { value: "weekly", label: "Every week" }, { value: "never", label: "Never" }] },
      ]),
      card("Appearance", [
        { kind: "radio", id: "settings.theme", label: "Theme", value: s.theme, options: THEME_INPUTS.map((t) => ({ value: t.id, label: t.label, description: t.id === "astryx" ? "Astryx's own default." : `Astryx, with a ${t.label.toLowerCase()} accent and its own corners.` })) },
        { kind: "segmented", id: "settings.density", label: "Density", value: st.density, options: [{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }] },
        { kind: "switch", id: "settings.reduceMotion", label: "Reduce motion", description: "Fewer animations everywhere.", on: st.reduceMotion },
      ]),
      card("Danger zone", [spread(v("xs", text("Delete account", "emphasis"), text("Removes your profile and everything you made.", "caption")), button("settings.delete", "Delete account", "destructive", "trash", st.deleted))]),
      text(`Signed in as ${st.email} · Demo account`, "caption"),
    ),
  };
}
