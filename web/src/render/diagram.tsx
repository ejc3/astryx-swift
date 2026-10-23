import { Badge } from "@astryxdesign/core/Badge";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { placeLabels, routeEdge, type DiagramArea, type DiagramEdgeStyle, type DiagramLayoutName, type DiagramNode, type DiagramPanel, type Point, type Rect } from "@astryx-native/core";
import { press } from "../client.ts";
import { Ic } from "../icons.tsx";

/** The side panel's width: Astryx's detail panels use 320. The space before it is the spacing-4 step, read from the theme. */
const PANEL = 320;
const spacing4 = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spacing-4")) || 16;

/** Each line style's dash pattern: data solid, control dashed, sync dash-dot, build dotted. Shared with AstryxKit. */
export const DASH: Record<DiagramEdgeStyle, string | undefined> = { data: undefined, control: "7 5", sync: "12 4 3 4", build: "0.5 5" };

const area = (a: DiagramArea): CSSProperties => ({ gridColumn: `${a.col + 1} / span ${a.cols}`, gridRow: `${a.row + 1} / span ${a.rows}` });

/** The width of an element, kept up to date. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** The words as given, with a line break allowed after each "/" (package names and paths) and nowhere inside a word. */
function Breakable({ text }: { text: string }) {
  const parts = text.split("/");
  return <>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 ? <>/<wbr /></> : null}</span>)}</>;
}

/**
 * `diagram`: the core's grid as a CSS grid (equal columns, rows as tall as their tallest box), the
 * edges as an SVG over it routed by the core's `routeEdge`, and labels placed by its `placeLabels`.
 * Where the wide arrangement fits beside Astryx's side panel, the panel is always there (empty
 * until a box is selected), so selecting never moves anything; below that the diagram takes its
 * narrow (or single-column) arrangement and the panel is a bottom sheet.
 */
export function DiagramNodeView({ node }: { node: DiagramNode }) {
  const [outer, width] = useWidth<HTMLDivElement>();
  // The panel sits beside the wide diagram where both fit; it stays there, empty or not, so
  // selecting never moves anything. Below that the panel is a bottom sheet and the diagram has the width.
  const beside = width >= node.narrowBelow + PANEL + spacing4();
  const layout: DiagramLayoutName = beside || width === 0 || width >= node.narrowBelow ? "wide" : width < node.singleBelow ? "single" : "narrow";
  // Focus: a box chosen with the keyboard sends focus to the panel's title; closing returns it to the box.
  const focusPanel = useRef(false);
  const returnTo = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (node.panel && focusPanel.current) heading.current?.focus();
    focusPanel.current = false;
    // In the sheet's case, bring the selected box into view above the sheet, as on iPhone.
    if (node.selected && !beside) {
      const el = outer.current?.querySelector<HTMLElement>(`[data-box="${node.selected}"]`);
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - window.innerHeight * 0.2, behavior: "smooth" });
    }
    if (!node.selected && returnTo.current) {
      outer.current?.querySelector<HTMLElement>(`[data-box="${returnTo.current}"]`)?.focus();
      returnTo.current = null;
    }
  }, [node.panel, node.selected, outer, beside]);
  const close = () => {
    if (!node.panel) return;
    returnTo.current = node.panel.id;
    press(node.panel.closeId);
  };
  const choose = (selectId: string, e: MouseEvent) => {
    focusPanel.current = e.detail === 0; // a keyboard press clicks with no detail
    press(selectId);
  };
  const main = (
    <div className="an-diagram-main">
      <Text weight="semibold">{node.note}</Text>
      <div aria-live="polite"><Text type="supporting">{node.hint}</Text></div>
      <Legend node={node} />
      <Grid node={node} layout={layout} choose={choose} />
    </div>
  );
  return (
    <div
      ref={outer}
      className="an-diagram"
      data-layout={layout}
      onKeyDown={(e) => {
        // Escape inside the bottom sheet is the sheet's own; here only on the page.
        if (e.key === "Escape" && node.panel && !e.defaultPrevented && e.currentTarget.contains(e.target as Element)) close();
      }}
    >
      {beside ? (
        <Layout
          height="auto"
          padding={0}
          content={<div className="an-diagram-beside">{main}</div>}
          end={
            <LayoutPanel width={PANEL} hasDivider isScrollable padding={4} label={node.panel?.title ?? node.inspector.label} role="complementary">
              {node.panel ? <Panel panel={node.panel} heading={heading} close={close} /> : <Empty node={node} />}
            </LayoutPanel>
          }
        />
      ) : (
        <>
          {main}
          {/* Without a scrim the sheet does not block the page: the diagram stays readable and selectable above it. */}
          <BottomSheet hasScrim={false} style={{ maxWidth: "none", width: "calc(100dvw - var(--spacing-4))" }} label={node.panel?.title ?? node.inspector.label} isOpen={node.panel !== null} onOpenChange={(open) => { if (!open) close(); }}>
            {node.panel ? <Panel panel={node.panel} heading={heading} close={close} /> : <span />}
          </BottomSheet>
        </>
      )}
    </div>
  );
}

function Empty({ node }: { node: DiagramNode }) {
  return (
    <VStack gap={2}>
      <Heading level={2}>{node.inspector.emptyTitle}</Heading>
      <Text type="supporting">{node.inspector.emptyText}</Text>
    </VStack>
  );
}

function Legend({ node }: { node: DiagramNode }) {
  return (
    <div className="an-diagram-legend" role="list" aria-label={node.legendLabel}>
      {node.legend.map((l) => (
        <span key={l.style} className="an-diagram-legend-item" role="listitem">
          <svg width="40" height="12" aria-hidden="true"><line x1="2" y1="6" x2="38" y2="6" className="an-edge" strokeDasharray={DASH[l.style]} strokeLinecap={l.style === "build" ? "round" : "butt"} data-style={l.style} /></svg>
          <Text size="sm">{l.label}</Text>
        </span>
      ))}
      <span className="an-diagram-legend-item" role="listitem">
        <Badge label={node.sharedTag} variant="neutral" />
        <Text size="sm">{node.sharedLegend}</Text>
      </span>
    </div>
  );
}

type Drawn = { id: string; d: string; heads: string[]; style: DiagramEdgeStyle; state: string };
type Placed = { id: string; text: string; state: string; x: number; y: number };

function Grid({ node, layout, choose }: { node: DiagramNode; layout: DiagramLayoutName; choose: (selectId: string, e: MouseEvent) => void }) {
  const grid = node[layout];
  const pad = grid.pad;
  const wrap = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<{ edges: Drawn[]; labels: Placed[]; width: number; height: number }>({ edges: [], labels: [], width: 0, height: 0 });
  const shown = node.edges.filter((e) => e.drawn[layout]);
  const labelled = grid.labels ? shown.filter((e) => e.showLabel) : [];

  // Measure the boxes, titles and labels after layout, and again whenever any of them changes size.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const rel = (r: DOMRect): Rect => ({ x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height });
      const frames = new Map<string, Rect>();
      for (const b of el.querySelectorAll<HTMLElement>("[data-box]")) frames.set(b.dataset.box!, rel(b.getBoundingClientRect()));
      const groupFrames = new Map<string, Rect>();
      for (const g of el.querySelectorAll<HTMLElement>("[data-group]")) groupFrames.set(g.dataset.group!, rel(g.getBoundingClientRect()));
      const gridRect: Rect = { x: 0, y: 0, width: base.width, height: base.height };
      const titles = [...el.querySelectorAll<HTMLElement>("[data-group-title] > span")].map((t) => rel(t.getBoundingClientRect()));
      const sizes = new Map([...el.querySelectorAll<HTMLElement>("[data-label]")].map((l) => [l.dataset.label!, { width: l.offsetWidth, height: l.offsetHeight }]));
      const routes: { id: string; points: Point[] }[] = [];
      const edges: Drawn[] = [];
      for (const e of shown) {
        const from = frames.get(e.from), to = e.toGroup ? groupFrames.get(e.to) : frames.get(e.to);
        if (!from || !to) continue;
        const pts = routeEdge(from, to, e[layout], gridRect);
        routes.push({ id: e.id, points: pts });
        const heads = [arrow(pts[pts.length - 2]!, pts[pts.length - 1]!)];
        if (e.direction === "both") heads.push(arrow(pts[1]!, pts[0]!));
        edges.push({ id: e.id, d: pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "), heads, style: e.style, state: e.state });
      }
      const bounds = { x: -grid.margin.left, y: -grid.margin.top, width: base.width + grid.margin.left + grid.margin.right, height: base.height + grid.margin.top + pad };
      const wanted = labelled.flatMap((e) => (sizes.has(e.id) ? [{ id: e.id, ...sizes.get(e.id)! }] : []));
      const placed = placeLabels(routes, wanted, [...frames.values(), ...titles], bounds);
      // A label with no clear place is not drawn: the panel says the edge in words.
      const labels = placed.filter((l) => l.fits).map((l) => {
        const e = node.edges.find((x) => x.id === l.id)!;
        return { id: l.id, text: e.label, state: e.state, x: l.x, y: l.y };
      });
      setDrawn({ edges, labels, width: base.width, height: base.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const b of el.querySelectorAll("[data-box], [data-label]")) ro.observe(b);
    return () => ro.disconnect();
  }, [node, layout]);

  const placed = new Map(drawn.labels.map((l) => [l.id, l]));
  return (
    <div className="an-diagram-canvas" style={{ paddingInlineStart: grid.margin.left, paddingInlineEnd: grid.margin.right, paddingBlockStart: grid.margin.top, paddingBlockEnd: pad }}>
      <div
        ref={wrap}
        className="an-diagram-grid"
        role="group"
        aria-label={node.label}
        style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${grid.rows}, auto)`, columnGap: grid.gap.x, rowGap: grid.gap.y, ["--an-group-pad" as string]: `${pad}px` }}
      >
        {node.groups.map((g) => <div key={g.id} data-group={g.id} className="an-diagram-group" style={area(g[layout])} aria-hidden="true" />)}
        {node.groups.map((g) => (
          <div key={`${g.id}-title`} className="an-diagram-group-title" data-group-title="" style={area({ ...g[layout], rows: 1 })} aria-hidden="true">
            <span><Text type="supporting" weight="semibold">{g.title}</Text></span>
          </div>
        ))}
        {node.boxes.map((b) => (
          <button
            key={b.id}
            type="button"
            data-box={b.id}
            data-state={b.state}
            className="an-diagram-box"
            style={area(b[layout])}
            aria-label={b.accessibilityLabel}
            aria-pressed={b.state === "selected"}
            aria-description={b.accessibilityValue || undefined}
            onClick={(e) => choose(b.selectId, e)}
          >
            <Text weight="semibold" {...(b.state === "dimmed" ? { color: "secondary" as const } : {})}><Breakable text={b.title} /></Text>
            {/* The Shared tag flows after the line's last word, on its own line only when there is no room. */}
            <span className="an-diagram-box-detail">
              <Text type="supporting" display="inline"><Breakable text={b.detail} /></Text>
              {b.shared ? <> <span className="an-diagram-box-tag"><Badge label={node.sharedTag} variant="neutral" /></span></> : null}
            </span>
          </button>
        ))}
        <svg className="an-diagram-edges" width={drawn.width} height={drawn.height} aria-hidden="true">
          {drawn.edges.map((e) => (
            <g key={e.id} data-state={e.state} data-style={e.style} className="an-edge-group">
              <path d={e.d} className="an-edge" strokeDasharray={DASH[e.style]} strokeLinecap={e.style === "build" ? "round" : "butt"} />
              {e.heads.map((h, i) => <path key={i} d={h} className="an-edge-head" />)}
            </g>
          ))}
        </svg>
        {labelled.map((e) => {
          const at = placed.get(e.id);
          return (
            <span key={e.id} data-label={e.id} className="an-diagram-label" data-state={e.state} aria-hidden="true"
              style={at ? { left: at.x, top: at.y } : { left: 0, top: 0, visibility: "hidden" }}>
              {e.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A filled arrowhead at `q`, pointing along p→q. Shared geometry with AstryxKit. */
function arrow(p: Point, q: Point): string {
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
  const s = 8, w = 4.5;
  const bx = q.x - ux * s, by = q.y - uy * s;
  return `M${q.x.toFixed(1)} ${q.y.toFixed(1)} L${(bx - uy * w).toFixed(1)} ${(by + ux * w).toFixed(1)} L${(bx + uy * w).toFixed(1)} ${(by - ux * w).toFixed(1)} Z`;
}

function Panel({ panel, heading, close }: { panel: DiagramPanel; heading: React.RefObject<HTMLHeadingElement | null>; close: () => void }) {
  return (
    <VStack gap={4}>
      <div className="an-diagram-panel-head">
        <VStack gap={0.5}>
          <Text type="supporting">{panel.group}</Text>
          <Heading level={2} ref={heading} tabIndex={-1} className="an-diagram-panel-title">{panel.title}</Heading>
          <Text type="supporting">{panel.detail}</Text>
        </VStack>
        <IconButton variant="ghost" label={panel.closeLabel} tooltip={panel.closeLabel} icon={<Ic name="close" />} onClick={close} />
      </div>
      <Text>{panel.about}</Text>
      {panel.facts.length > 0 ? (
        <VStack gap={2}>
          <Heading level={3}>{panel.factsLabel}</Heading>
          <MetadataList>{panel.facts.map((f, i) => <MetadataListItem key={i} label={f.label}>{f.value}</MetadataListItem>)}</MetadataList>
        </VStack>
      ) : null}
      <VStack gap={2}>
        <Heading level={3}>{panel.linksLabel}</Heading>
        <VStack gap={1}>
          {panel.links.map((l, i) => (
            <span key={i} className="an-diagram-link">
              <Ic name="arrow-right" size="sm" color="secondary" />
              <Link isStandalone onClick={() => press(l.selectId)}>{l.text}</Link>
            </span>
          ))}
        </VStack>
      </VStack>
      <VStack gap={2}>
        <Heading level={3}>{panel.filesLabel}</Heading>
        <VStack gap={1}>{panel.files.map((f) => <code key={f} className="an-diagram-file"><Breakable text={f} /></code>)}</VStack>
      </VStack>
    </VStack>
  );
}
