import { Banner, type BannerProps } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { Node, Tone } from "@astryx-native/core";
import { press } from "../client.ts";
import { Ic } from "../icons.tsx";
import { ButtonView } from "./controls.tsx";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

const STATUS: Record<Tone, BannerProps["status"]> = { neutral: "info", accent: "info", info: "info", success: "success", warning: "warning", danger: "error" };

export function BannerNode({ node }: { node: Of<"banner"> }) {
  const dismissId = node.dismissId;
  return (
    <Banner
      status={STATUS[node.tone]}
      title={node.title}
      description={node.text}
      collapsible={false}
      {...(node.action ? { endContent: <ButtonView node={node.action} size="sm" /> } : {})}
      {...(dismissId ? { isDismissable: true, onDismiss: () => press(dismissId) } : {})}
    />
  );
}

export function EmptyNode({ node }: { node: Of<"empty"> }) {
  return (
    <EmptyState
      title={node.title}
      description={node.text}
      icon={<Ic name={node.icon} size="lg" />}
      {...(node.action ? { actions: <ButtonView node={node.action} /> } : {})}
    />
  );
}
