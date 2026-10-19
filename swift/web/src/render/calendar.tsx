import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { StackItem } from "@astryxdesign/core/Stack";
import { VStack } from "@astryxdesign/core/VStack";
import type { Node } from "@astryx-native/core";
import { press } from "../client.ts";
import { Ic } from "../icons.tsx";
import { FILL_TONE } from "./tone.ts";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

/**
 * Astryx's Calendar chooses its own month, weekday names and selection; the core has already
 * laid out the weeks (with event dots and the ids to press), so this draws that grid with
 * Astryx's tokens and controls instead.
 */
export function CalendarNode({ node }: { node: Of<"calendar"> }) {
  return (
    <VStack gap={3}>
      <HStack gap={2} align="center">
        <StackItem size="fill"><Heading level={3}>{node.title}</Heading></StackItem>
        <IconButton variant="ghost" label={node.previousLabel} tooltip={node.previousLabel} icon={<Ic name="chevron-left" />} onClick={() => press(node.previousId)} />
        <IconButton variant="ghost" label={node.nextLabel} tooltip={node.nextLabel} icon={<Ic name="chevron-right" />} onClick={() => press(node.nextId)} />
      </HStack>
      <div className="an-cal" role="grid" aria-label={node.title}>
        <div className="an-cal-row an-cal-head" role="row">
          {node.weekdays.map((d, i) => <span key={i} role="columnheader">{d}</span>)}
        </div>
        {node.weeks.map((week, wi) => (
          <div key={wi} className="an-cal-row" role="row">
            {week.map((day, di) => (
              <button
                key={di}
                type="button"
                role="gridcell"
                className="an-day"
                data-out={day.inMonth ? undefined : ""}
                data-today={day.today ? "" : undefined}
                data-selected={day.selected ? "" : undefined}
                aria-selected={day.selected}
                {...(day.today ? { "aria-current": "date" as const } : {})}
                disabled={day.selectId === undefined}
                onClick={() => day.selectId && press(day.selectId)}
              >
                <span className="an-day-num">{day.label}</span>
                <span className="an-day-dots" aria-hidden="true">
                  {day.dots.map((tone, k) => <i key={k} style={{ background: FILL_TONE[tone] }} />)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </VStack>
  );
}
