import type { Node } from "@astryx-native/core";
import { BarsNode, MetricNode } from "./charts.tsx";
import { BoardNode } from "./board.tsx";
import { CalendarNode } from "./calendar.tsx";
import { ChatNode } from "./chat.tsx";
import { ButtonView, CheckboxNode, IconButtonNode, ProgressNode, RadioNode, SegmentedNode, SelectNode, SliderNode, SwitchNode, TextInputNode } from "./controls.tsx";
import { ListNode, MetadataNode, PaginationNode, StepperNode, TabsNode, TableNode } from "./data.tsx";
import { BannerNode, EmptyNode } from "./feedback.tsx";
import { CardNode, GridNode, SectionNode, SplitNode, StackNode } from "./layout.tsx";
import { TemplateNode } from "./template.tsx";
import { AvatarGroupNode, AvatarNode, BadgeNode, DividerNode, HeadingNode, KbdNode, StatusDotNode, TextNode, TokenNode } from "./text.tsx";

/** One node, drawn with the Astryx component it is named after. */
export function Render({ node }: { node: Node }) {
  switch (node.kind) {
    case "stack": return <StackNode node={node} />;
    case "grid": return <GridNode node={node} />;
    case "split": return <SplitNode node={node} />;
    case "card": return <CardNode node={node} />;
    case "section": return <SectionNode node={node} />;
    case "heading": return <HeadingNode node={node} />;
    case "text": return <TextNode node={node} />;
    case "badge": return <BadgeNode node={node} />;
    case "token": return <TokenNode node={node} />;
    case "button": return <ButtonView node={node} />;
    case "iconButton": return <IconButtonNode node={node} />;
    case "textInput": return <TextInputNode node={node} />;
    case "switch": return <SwitchNode node={node} />;
    case "checkbox": return <CheckboxNode node={node} />;
    case "radio": return <RadioNode node={node} />;
    case "segmented": return <SegmentedNode node={node} />;
    case "select": return <SelectNode node={node} />;
    case "slider": return <SliderNode node={node} />;
    case "progress": return <ProgressNode node={node} />;
    case "avatar": return <AvatarNode node={node} />;
    case "avatarGroup": return <AvatarGroupNode node={node} />;
    case "statusDot": return <StatusDotNode node={node} />;
    case "divider": return <DividerNode />;
    case "kbd": return <KbdNode node={node} />;
    case "metric": return <MetricNode node={node} />;
    case "bars": return <BarsNode node={node} />;
    case "table": return <TableNode node={node} />;
    case "list": return <ListNode node={node} />;
    case "tabs": return <TabsNode node={node} />;
    case "stepper": return <StepperNode node={node} />;
    case "banner": return <BannerNode node={node} />;
    case "empty": return <EmptyNode node={node} />;
    case "metadata": return <MetadataNode node={node} />;
    case "pagination": return <PaginationNode node={node} />;
    case "calendar": return <CalendarNode node={node} />;
    case "chat": return <ChatNode node={node} />;
    case "board": return <BoardNode node={node} />;
    case "template": return <TemplateNode node={node} />;
    default: return assertNever(node);
  }
}

function assertNever(node: never): never {
  throw new Error(`No renderer for ${JSON.stringify(node)}`);
}

/** Siblings are keyed by position: the core's ids are not unique across a screen. */
export function Children({ nodes }: { nodes: readonly Node[] }) {
  return <>{nodes.map((n, i) => <Render key={i} node={n} />)}</>;
}
