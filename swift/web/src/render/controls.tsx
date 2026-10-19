import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Field } from "@astryxdesign/core/Field";
import { IconButton } from "@astryxdesign/core/IconButton";
import { ProgressBar, type ProgressBarProps } from "@astryxdesign/core/ProgressBar";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Slider, type SliderSingleProps } from "@astryxdesign/core/Slider";
import { Switch } from "@astryxdesign/core/Switch";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import type { ButtonNode, Node, Tone } from "@astryx-native/core";
import { useId } from "react";
import { press, set } from "../client.ts";
import { iconComponent, Ic } from "../icons.tsx";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

export function ButtonView({ node, size }: { node: ButtonNode; size?: "sm" | "md" | "lg" }) {
  return (
    <Button
      label={node.label}
      variant={node.variant}
      isDisabled={node.disabled ?? false}
      onClick={() => press(node.id)}
      {...(size ? { size } : {})}
      {...(node.icon ? { icon: <Ic name={node.icon} /> } : {})}
    />
  );
}

export function IconButtonNode({ node }: { node: Of<"iconButton"> }) {
  return node.selected !== undefined ? (
    <ToggleButton isIconOnly label={node.label} tooltip={node.label} isPressed={node.selected} icon={<Ic name={node.icon} />} onPressedChange={() => press(node.id)} />
  ) : (
    <IconButton label={node.label} tooltip={node.label} variant="ghost" icon={<Ic name={node.icon} />} onClick={() => press(node.id)} />
  );
}

export function TextInputNode({ node }: { node: Of<"textInput"> }) {
  const common = {
    label: node.label,
    value: node.value,
    placeholder: node.placeholder,
    ...(node.hint ? { description: node.hint } : {}),
    ...(node.error ? { status: { type: "error" as const, message: node.error } } : {}),
    ...(node.icon ? { startIcon: iconComponent(node.icon) } : {}),
    onChange: (v: string) => set(node.id, v),
  };
  return node.multiline ? <TextArea {...common} rows={3} width="100%" /> : <TextInput {...common} type={node.secure ? "password" : "text"} />;
}

export function SwitchNode({ node }: { node: Of<"switch"> }) {
  return <Switch label={node.label} value={node.on} onChange={(on) => set(node.id, on)} labelPosition="start" labelSpacing="spread" width="100%" {...(node.description ? { description: node.description } : {})} />;
}

export function CheckboxNode({ node }: { node: Of<"checkbox"> }) {
  return <CheckboxInput label={node.label} value={node.checked} onChange={(on) => set(node.id, on)} />;
}

export function RadioNode({ node }: { node: Of<"radio"> }) {
  return (
    <RadioList label={node.label} value={node.value} onChange={(v) => set(node.id, v)}>
      {node.options.map((o) => <RadioListItem key={o.value} value={o.value} label={o.label} {...(o.description ? { description: o.description } : {})} />)}
    </RadioList>
  );
}

export function SegmentedNode({ node }: { node: Of<"segmented"> }) {
  const id = useId();
  const control = (
    <SegmentedControl label={node.label} value={node.value} onChange={(v) => set(node.id, v)}>
      {node.options.map((o) => <SegmentedControlItem key={o.value} value={o.value} label={o.label} />)}
    </SegmentedControl>
  );
  // Astryx's SegmentedControl keeps its label for assistive technology only; a visible caption is a Field's.
  if (node.labelHidden) return control;
  return <Field label={node.label} inputID={id} labelID={`${id}-label`} isGroupLabel>{control}</Field>;
}

export function SelectNode({ node }: { node: Of<"select"> }) {
  return (
    <Selector
      label={node.label}
      value={node.value}
      options={node.options.map((o) => ({ value: o.value, label: o.label, ...(o.description ? { description: o.description } : {}) }))}
      onChange={(v) => set(node.id, v)}
    />
  );
}

export function SliderNode({ node }: { node: Of<"slider"> }) {
  const props: SliderSingleProps = {
    label: node.label,
    value: node.value,
    min: node.min,
    max: node.max,
    step: node.step,
    valueDisplay: "text",
    formatValue: () => node.valueText,
    onChange: (v) => set(node.id, v),
  };
  return <Slider {...props} />;
}

const PROGRESS: Record<Tone, ProgressBarProps["variant"]> = { neutral: "neutral", accent: "accent", success: "success", warning: "warning", danger: "error", info: "accent" };

export function ProgressNode({ node }: { node: Of<"progress"> }) {
  return <ProgressBar label={node.label} value={node.value} max={1} variant={PROGRESS[node.tone]} hasValueLabel formatValueLabel={() => node.valueText} />;
}
