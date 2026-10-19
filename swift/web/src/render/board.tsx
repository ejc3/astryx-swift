import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Badge } from "@astryxdesign/core/Badge";
import { useLayoutEffect, useRef, useState } from "react";
import type { BoardColumn, Node } from "@astryx-native/core";
import { press } from "../client.ts";
import { Ic } from "../icons.tsx";
import { PersonAvatar } from "./Avatar.tsx";
import { ToneBadge } from "./text.tsx";
import { TEXT_TONE } from "./tone.ts";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

function BoardCard({ card }: { card: BoardColumn["cards"][number] }) {
  return (
    <Card padding={3} elevation="low">
      <VStack gap={2}>
        <Text weight="medium">{card.title}</Text>
        {card.tags.length > 0 ? (
          <HStack gap={1} wrap="wrap">{card.tags.map((t, i) => <ToneBadge key={i} text={t.text} tone={t.tone} />)}</HStack>
        ) : null}
        <HStack gap={2} align="center">
          <PersonAvatar initials={card.assignee.initials} hue={card.assignee.hue} size="sm" />
          <StackItem size="fill">
            <span style={{ color: TEXT_TONE[card.dueTone] }}><Text type="supporting" size="xsm" color="inherit">{card.due}</Text></span>
          </StackItem>
          {card.moveBackId ? (
            <IconButton size="sm" variant="ghost" label={card.moveBackLabel} tooltip={card.moveBackLabel} icon={<Ic name="chevron-left" />} onClick={() => press(card.moveBackId!)} />
          ) : null}
          {card.moveForwardId ? (
            <IconButton size="sm" variant="ghost" label={card.moveForwardLabel} tooltip={card.moveForwardLabel} icon={<Ic name="chevron-right" />} onClick={() => press(card.moveForwardId!)} />
          ) : null}
        </HStack>
      </VStack>
    </Card>
  );
}

/** Astryx has no board: columns of Cards over its tokens, side by side and scrolling on a phone. */
export function BoardNode({ node }: { node: Of<"board"> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  // The core names the width below which the columns stack; the board's own width decides.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setStacked(el.clientWidth < node.stackBelow);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [node.stackBelow]);
  return (
    <div ref={wrap} className="an-board-wrap">
    <div className="an-board" {...(stacked ? { "data-stacked": "" } : {})}>
      {node.columns.map((col) => (
        <section key={col.id} className="an-column" aria-label={col.title}>
          <HStack gap={2} align="center">
            <Heading level={4}>{col.title}</Heading>
            <Badge label={col.count} />
          </HStack>
          <VStack gap={2}>
            {col.cards.map((c) => <BoardCard key={c.id} card={c} />)}
          </VStack>
        </section>
      ))}
    </div>
    </div>
  );
}
