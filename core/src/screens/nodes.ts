/** Short constructors for nodes, so a screen reads like its layout. */
import type { ButtonNode, Gap, Icon, Node, Tone } from "../ui.ts";

export const v = (gap: Gap, ...children: Node[]): Node => ({ kind: "stack", axis: "vertical", gap, children });
export const h = (gap: Gap, ...children: Node[]): Node => ({ kind: "stack", axis: "horizontal", gap, align: "center", children });
export const spread = (...children: Node[]): Node => ({ kind: "stack", axis: "horizontal", gap: "sm", align: "spread", children });
export const wrap = (gap: Gap, ...children: Node[]): Node => ({ kind: "stack", axis: "horizontal", gap, wrap: true, align: "start", children });
export const grid = (minColumnWidth: number, ...children: Node[]): Node => ({ kind: "grid", minColumnWidth, gap: "md", children });
export const card = (title: string | undefined, children: Node[], extra: { subtitle?: string; action?: ButtonNode } = {}): Node => ({ kind: "card", title, children, ...extra });
export const section = (title: string, description: string | undefined, ...children: Node[]): Node => ({ kind: "section", title, description, children });
export const heading = (text: string, level: 1 | 2 | 3 = 2): Node => ({ kind: "heading", text, level });
export const text = (t: string, style: "body" | "secondary" | "caption" | "emphasis" | "code" = "body", tone?: Tone): Node => ({ kind: "text", text: t, style, ...(tone ? { tone } : {}) });
export const badge = (t: string, tone: Tone = "neutral"): Node => ({ kind: "badge", text: t, tone });
export const divider: Node = { kind: "divider" };

export function button(id: string, label: string, variant: ButtonNode["variant"] = "secondary", icon?: Icon, disabled?: boolean): ButtonNode {
  return { kind: "button", id, label, variant, ...(icon ? { icon } : {}), ...(disabled ? { disabled } : {}) };
}
