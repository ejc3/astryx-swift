import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useRef, useState, useLayoutEffect } from "react";
import type { Node } from "@astryx-native/core";
import { press } from "../client.ts";
import { Ic } from "../icons.tsx";
import { ButtonView } from "./controls.tsx";
import { Children, Render } from "./Render.tsx";
import { GAP } from "./tone.ts";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

/** Kinds that should keep their own width in a column instead of stretching across it. */
const HUG = new Set<Node["kind"]>(["badge", "token", "button", "iconButton", "avatar", "avatarGroup", "statusDot", "kbd"]);

/** Children of a column: stretched, except the ones that hug their content. */
export function Column({ nodes }: { nodes: readonly Node[] }) {
  return (
    <>
      {nodes.map((n, i) => HUG.has(n.kind)
        ? <StackItem key={i} crossAlignSelf="start"><Render node={n} /></StackItem>
        : <Render key={i} node={n} />)}
    </>
  );
}

export function StackNode({ node }: { node: Of<"stack"> }) {
  const gap = GAP[node.gap];
  if (node.axis === "vertical") {
    const align = node.align === "spread" || node.align === undefined ? undefined : node.align;
    return <VStack gap={gap} {...(align ? { align } : {})}>{align ? <Children nodes={node.children} /> : <Column nodes={node.children} />}</VStack>;
  }
  // Horizontal: `align` is the cross axis, except "spread", which pushes the ends apart.
  const spread = node.align === "spread";
  const cross = node.align === "spread" || node.align === undefined ? "center" : node.align;
  return (
    <HStack gap={gap} wrap="wrap" align={cross} {...(spread ? { justify: "between" as const } : {})}>
      <Children nodes={node.children} />
    </HStack>
  );
}

export function GridNode({ node }: { node: Of<"grid"> }) {
  return (
    // `max` is only the way to ask Astryx for a track floor of min(100%, minWidth): a column never
    // outgrows its container, and no count of columns is ever reached that it would cap.
    <Grid columns={{ minWidth: node.minColumnWidth, max: 99, repeat: "fit" }} gap={GAP[node.gap]} align="start">
      <Children nodes={node.children} />
    </Grid>
  );
}

export function CardNode({ node }: { node: Of<"card"> }) {
  const head = node.title !== undefined || node.subtitle !== undefined || node.action !== undefined;
  return (
    <Card padding={5}>
      <VStack gap={4}>
        {head ? (
          <HStack gap={2} align="center">
            <StackItem size="fill">
              <VStack gap={0.5}>
                {node.title !== undefined ? <Heading level={3}>{node.title}</Heading> : null}
                {node.subtitle !== undefined ? <Text type="supporting">{node.subtitle}</Text> : null}
              </VStack>
            </StackItem>
            {node.action ? <ButtonView node={node.action} size="sm" /> : null}
          </HStack>
        ) : null}
        <Column nodes={node.children} />
      </VStack>
    </Card>
  );
}

export function SectionNode({ node }: { node: Of<"section"> }) {
  return (
    <VStack gap={2}>
      <VStack gap={0.5}>
        <Heading level={4}>{node.title}</Heading>
        {node.description ? <Text type="supporting">{node.description}</Text> : null}
      </VStack>
      <Children nodes={node.children} />
    </VStack>
  );
}

/** The width of the box the split sits in: it asks the box, not the window. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const SPLIT_WIDE = 720;

export function SplitNode({ node }: { node: Of<"split"> }) {
  const [ref, width] = useWidth();
  const wide = width !== null && width >= SPLIT_WIDE;
  return (
    <div ref={ref} className="an-split" data-wide={wide ? "" : undefined}>
      {width === null ? null : wide ? (
        <>
          <div className="an-split-primary"><Render1 node={node.primary} /></div>
          <div className="an-split-detail"><Render1 node={node.detail} /></div>
        </>
      ) : node.showDetailWhenNarrow ? (
        <VStack gap={3}>
          {node.backId ? (
            <HStack>
              <Button variant="ghost" size="sm" label={node.backLabel ?? ""} icon={<Ic name="chevron-left" />} onClick={() => press(node.backId!)} />
            </HStack>
          ) : null}
          <Render1 node={node.detail} />
        </VStack>
      ) : (
        <Render1 node={node.primary} />
      )}
    </div>
  );
}

function Render1({ node }: { node: Node }) {
  return <Children nodes={[node]} />;
}
