import { Blockquote } from "@astryxdesign/core/Blockquote";
import { Card } from "@astryxdesign/core/Card";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Node, TimelineEntry } from "@astryx-native/core";
import { FILL_TONE } from "./tone.ts";
import { ToneBadge } from "./text.tsx";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

/**
 * `timeline`: dated entries in order on a rail. Ordinary entries: the date, the title in weight, a
 * quotation and words at body size. The emphasized entry sits on an Astryx Card in the soft accent
 * with its quotation larger; "what changed" is a muted Card.
 */
export function TimelineNode({ node }: { node: Of<"timeline"> }) {
  return (
    <ol className="an-timeline" aria-label={node.label}>
      {node.entries.map((e, i) => (
        <li key={i} className="an-timeline-entry">
          <span className="an-timeline-dot" style={{ background: FILL_TONE[e.tone] }} aria-hidden="true" />
          <div className="an-timeline-body">
            {e.emphasized ? (
              <div className="an-timeline-measure"><Card className="an-timeline-emph"><Entry entry={e} outcomeLabel={node.outcomeLabel} /></Card></div>
            ) : <Entry entry={e} outcomeLabel={node.outcomeLabel} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Entry({ entry: e, outcomeLabel }: { entry: TimelineEntry; outcomeLabel: string | undefined }) {
  return (
    <VStack gap={1}>
      <div className="an-timeline-when">
        <Text type="supporting"><time>{e.when}</time></Text>
        {e.badge !== undefined ? <ToneBadge text={e.badge} tone={e.tone} /> : null}
      </div>
      <Text weight="semibold" {...(e.emphasized ? { size: "lg" as const } : {})}>{e.title}</Text>
      {e.quote !== undefined ? (
        <div className="an-timeline-text"><Blockquote><Text {...(e.emphasized ? { size: "lg" as const } : {})} color="secondary">{e.quote}</Text></Blockquote></div>
      ) : null}
      {e.text !== undefined ? <div className="an-timeline-text"><Text color="secondary">{e.text}</Text></div> : null}
      {e.outcome !== undefined ? (
        <div className="an-timeline-measure"><Card variant="muted" padding={3}>
          <VStack gap={0.5}>
            {outcomeLabel !== undefined ? <Text weight="semibold">{outcomeLabel}</Text> : null}
            <Text>{e.outcome}</Text>
          </VStack>
        </Card></div>
      ) : null}
    </VStack>
  );
}
