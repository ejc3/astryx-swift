import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Node } from "@astryx-native/core";
import { Ic } from "../icons.tsx";
import { ACCENT_SOFT, FILL_TONE, TEXT_TONE } from "./tone.ts";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

/** A trend as a line, from points the core already scaled to 0..1. */
function Sparkline({ points }: { points: number[] }) {
  const w = 100, h = 32, pad = 2;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const xy = points.map((p, i) => [i * step, h - pad - p * (h - 2 * pad)] as const);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return (
    <svg className="an-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className="an-spark-area" />
      <path d={line} className="an-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MetricNode({ node }: { node: Of<"metric"> }) {
  return (
    <Card padding={4}>
      <VStack gap={1}>
        <Text type="supporting">{node.label}</Text>
        {node.emphasized ? <Text size="4xl" weight="semibold">{node.value}</Text> : <Heading level={2}>{node.value}</Heading>}
        {node.delta ? (
          <span className="an-delta" style={{ color: TEXT_TONE[node.delta.tone] }}>
            <Ic name={node.delta.up ? "arrow-up" : "arrow-down"} size="xsm" color="inherit" />
            <Text type="supporting" size="xsm" color="inherit">{node.delta.text}</Text>
          </span>
        ) : null}
        {node.trend && node.trend.length > 1 ? <Sparkline points={node.trend} /> : null}
      </VStack>
    </Card>
  );
}

export function BarsNode({ node }: { node: Of<"bars"> }) {
  return (
    <figure className="an-bars" aria-label={node.label}>
      <div className="an-bars-plot">
        {node.bars.map((b, i) => (
          <div key={i} className="an-bar" data-highlight={b.highlight ? "" : undefined} title={`${b.label}: ${b.valueText}`}>
            <span className="an-bar-value">{b.highlight ? b.valueText : ""}</span>
            <span className="an-bar-track">
              <span className="an-bar-fill" style={{ height: `${Math.max(2, b.value * 100)}%`, background: b.highlight ? FILL_TONE.accent : ACCENT_SOFT }} />
            </span>
            <span className="an-bar-label">{b.label}</span>
          </div>
        ))}
      </div>
      <figcaption><Text type="supporting" size="xsm">{node.label}</Text></figcaption>
    </figure>
  );
}

/** `shares`: one bar split into parts by their values (the first in the accent), each listed with its value. */
export function SharesNode({ node }: { node: Of<"shares"> }) {
  const total = node.parts.reduce((sum, p) => sum + p.value, 0) || 1;
  const fill = (tone: Of<"shares">["parts"][number]["tone"], i: number) => (tone === "neutral" ? `color-mix(in srgb, var(--color-icon-secondary) ${70 - i * 15}%, transparent)` : FILL_TONE[tone]);
  return (
    <figure className="an-shares" aria-label={node.label} style={{ margin: 0 }}>
      <Text type="supporting" weight="semibold">{node.label}</Text>
      <div className="an-shares-bar" aria-hidden="true">
        {node.parts.map((p, i) => <span key={i} className="an-shares-part" style={{ flexGrow: p.value / total, background: fill(p.tone, i) }} />)}
      </div>
      <div className="an-shares-legend">
        {node.parts.map((p, i) => (
          <div key={i} style={{ display: "contents" }}>
            <span className="an-shares-swatch" style={{ background: fill(p.tone, i) }} aria-hidden="true" />
            <Text>{p.label}</Text>
            <Text weight="semibold">{p.valueText}</Text>
          </div>
        ))}
      </div>
    </figure>
  );
}
