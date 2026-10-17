import { AvatarGroup, AvatarGroupOverflow } from "@astryxdesign/core/AvatarGroup";
import { Badge, type BadgeProps } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { Kbd } from "@astryxdesign/core/Kbd";
import { StatusDot, type StatusDotProps } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Token, type TokenProps } from "@astryxdesign/core/Token";
import type { Node, Tone } from "@astryx-native/core";
import { press } from "../client.ts";
import { PersonAvatar } from "./Avatar.tsx";
import { SOFT_TONE, TEXT_TONE } from "./tone.ts";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

export function HeadingNode({ node }: { node: Of<"heading"> }) {
  return <Heading level={node.level}>{node.text}</Heading>;
}

export function TextNode({ node }: { node: Of<"text"> }) {
  const tone = node.tone ? { color: TEXT_TONE[node.tone] } : undefined;
  const body = (() => {
    switch (node.style) {
      case "body": return <Text display="block" color={tone ? "inherit" : undefined}>{node.text}</Text>;
      case "secondary": return <Text display="block" type="supporting" color={tone ? "inherit" : undefined}>{node.text}</Text>;
      case "caption": return <Text display="block" type="supporting" size="xsm" color={tone ? "inherit" : undefined}>{node.text}</Text>;
      case "emphasis": return <Text display="block" weight="semibold" color={tone ? "inherit" : undefined}>{node.text}</Text>;
      case "code": return <Text display="block" type="code" color={tone ? "inherit" : undefined}>{node.text}</Text>;
    }
  })();
  // Newlines in the core's text are line breaks (an address); empty text takes no room.
  return <span className="an-text" style={tone}>{body}</span>;
}

const BADGE: Record<Tone, BadgeProps["variant"]> = { neutral: "neutral", accent: "neutral", success: "success", warning: "warning", danger: "error", info: "info" };

/** A badge in a tone; "accent" follows the theme's accent rather than a fixed hue. */
export function ToneBadge({ text, tone }: { text: string; tone: Tone }) {
  return tone === "accent"
    ? <Badge label={text} variant="neutral" style={{ background: SOFT_TONE.accent, color: TEXT_TONE.accent }} />
    : <Badge label={text} variant={BADGE[tone]} />;
}

export function BadgeNode({ node }: { node: Of<"badge"> }) {
  return <ToneBadge text={node.text} tone={node.tone} />;
}

const TOKEN: Record<Tone, TokenProps["color"]> = { neutral: "default", accent: "default", success: "green", warning: "orange", danger: "red", info: "blue" };

export function TokenNode({ node }: { node: Of<"token"> }) {
  const removeId = node.removeId;
  return (
    <Token
      label={node.text}
      color={TOKEN[node.tone]}
      {...(node.tone === "accent" ? { style: { background: SOFT_TONE.accent, color: TEXT_TONE.accent } } : {})}
      {...(removeId ? { onRemove: () => press(removeId) } : {})}
    />
  );
}

const DOT: Record<Tone, StatusDotProps["variant"]> = { neutral: "neutral", accent: "accent", success: "success", warning: "warning", danger: "error", info: "accent" };

export function StatusDotNode({ node }: { node: Of<"statusDot"> }) {
  return (
    <span className="an-dot">
      <StatusDot variant={DOT[node.tone]} label={node.label} />
      <Text type="supporting">{node.label}</Text>
    </span>
  );
}

export function DividerNode() {
  return <Divider />;
}

export function KbdNode({ node }: { node: Of<"kbd"> }) {
  return <Kbd keys={node.keys.map((k) => (k === "+" ? "plus" : k)).join("+")} />;
}

export function AvatarNode({ node }: { node: Of<"avatar"> }) {
  return <PersonAvatar initials={node.initials} hue={node.hue} name={node.name} size={node.size} {...(node.status ? { status: node.status } : {})} {...(node.statusLabel ? { statusLabel: node.statusLabel } : {})} />;
}

export function AvatarGroupNode({ node }: { node: Of<"avatarGroup"> }) {
  return (
    <AvatarGroup size="md">
      {node.people.map((p, i) => <PersonAvatar key={i} initials={p.initials} hue={p.hue} />)}
      {node.more ? <AvatarGroupOverflow count={0}>{node.more}</AvatarGroupOverflow> : null}
    </AvatarGroup>
  );
}
