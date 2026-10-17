import type { ComponentProps, ComponentType, ReactElement, SVGProps } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import type { Icon as IconName } from "@astryx-native/core";

type Svg = ComponentType<SVGProps<SVGSVGElement>>;

/** A 24-unit outline glyph: one path string, or a few shapes. */
function glyph(draw: ReactElement, filled = false): Svg {
  return function Glyph(props) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {draw}
      </svg>
    );
  };
}

const path = (d: string) => <path d={d} />;
const STAR = path("M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z");

// Astryx draws a handful of icons itself (by semantic name); the rest are small SVGs here.
const OWN: Record<IconName, Svg> = {
  home: glyph(path("M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5")),
  chart: glyph(path("M3 20h18M7 20v-7M12 20V5M17 20v-10")),
  inbox: glyph(path("M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5")),
  people: glyph(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.3c2.5.6 4 2.6 4 5.7" />
    </>,
  ),
  gear: glyph(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>,
  ),
  cart: glyph(
    <>
      <path d="M3 4h2.5l2 11h10.5l2-8H6.5" />
      <circle cx="9" cy="19.5" r="1.2" />
      <circle cx="17" cy="19.5" r="1.2" />
    </>,
  ),
  chat: glyph(path("M4 4.5h16v12H9.5L5 20.5v-4H4z")),
  person: glyph(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </>,
  ),
  star: glyph(STAR),
  "star-fill": glyph(STAR, true),
  archive: glyph(path("M3.5 4.5h17v4h-17zM5 8.5v11h14v-11M10 12.5h4")),
  trash: glyph(path("M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6")),
  plus: glyph(path("M12 5v14M5 12h14")),
  bell: glyph(path("M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0")),
  lock: glyph(
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>,
  ),
  mail: glyph(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>,
  ),
  sparkle: glyph(path("M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z")),
  grid: glyph(
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>,
  ),
  send: glyph(path("M21 3L10 14M21 3l-7 18-4-7-7-4z")),
  flag: glyph(path("M5 21V4M5 4h11l-2 4 2 4H5")),
  bolt: glyph(path("M13 2.5L5 13.5h6l-1 8 8-11h-6z")),
  heart: glyph(path("M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z")),
  undo: glyph(path("M9 6l-5 5 5 5M4 11h10a5.5 5.5 0 0 1 0 11h-3")),
  card: glyph(
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>,
  ),
  check: glyph(path("M5 12.5l4.5 4.5L19 7.5")),
  calendar: glyph(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>,
  ),
  search: glyph(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>,
  ),
  "chevron-left": glyph(path("M14.5 5l-7 7 7 7")),
  "chevron-right": glyph(path("M9.5 5l7 7-7 7")),
  "arrow-up": glyph(path("M12 19V5M6 11l6-6 6 6")),
  "arrow-down": glyph(path("M12 5v14M6 13l6 6 6-6")),
  filter: glyph(path("M3.5 5h17l-6.5 8v6l-4-2v-4z")),
  clock: glyph(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  info: glyph(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>,
  ),
  warning: glyph(path("M12 4L2.5 20h19zM12 10v4.5M12 17.5h.01")),
  close: glyph(path("M6 6l12 12M18 6L6 18")),
  truck: glyph(
    <>
      <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.5h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>,
  ),
};

/** Names Astryx already has, so the theme can restyle them. */
type Named = Exclude<ComponentProps<typeof Icon>["icon"], Svg>;
const ASTRYX: Partial<Record<IconName, Named>> = {
  check: "check",
  calendar: "calendar",
  search: "search",
  "chevron-left": "chevronLeft",
  "chevron-right": "chevronRight",
  "arrow-up": "arrowUp",
  "arrow-down": "arrowDown",
  filter: "funnel",
  clock: "clock",
  info: "info",
  warning: "warning",
  close: "close",
};

export function iconType(name: IconName): Svg | Named {
  return ASTRYX[name] ?? OWN[name];
}

/** The same glyph as a component, for props that take one (a text input's start icon). */
export function iconComponent(name: IconName): Svg {
  return OWN[name];
}

/** The Astryx Icon for a node's icon name; size and color come from the parent. */
export function Ic({ name, size, color }: { name: IconName; size?: "xsm" | "sm" | "md" | "lg"; color?: "primary" | "secondary" | "accent" | "success" | "error" | "warning" | "inherit" }) {
  return <Icon icon={iconType(name)} {...(size ? { size } : {})} {...(color ? { color } : {})} />;
}
