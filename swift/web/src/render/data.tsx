import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useLayoutEffect, useRef, useState } from "react";
import type { Cell, ListItem as ListItemNode, Node } from "@astryx-native/core";
import { press, set } from "../client.ts";
import { Ic } from "../icons.tsx";
import { PersonAvatar } from "./Avatar.tsx";
import { ACCENT_SOFT, FILL_TONE, SOFT_TONE } from "./tone.ts";
import { ToneBadge } from "./text.tsx";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

function CellView({ cell }: { cell: Cell }) {
  const lines = (
    <VStack gap={0}>
      <Text weight={cell.secondary || cell.avatar ? "medium" : undefined}>{cell.text}</Text>
      {cell.secondary ? <Text type="supporting" size="xsm" className="an-cell-secondary">{cell.secondary}</Text> : null}
    </VStack>
  );
  return (
    <HStack gap={2} align="center" {...(cell.align === "end" ? { justify: "end" as const } : {})}>
      {cell.avatar ? <PersonAvatar initials={cell.avatar.initials} hue={cell.avatar.hue} size="sm" /> : null}
      {cell.badge ? <ToneBadge text={cell.badge.text} tone={cell.badge.tone} /> : lines}
    </HStack>
  );
}

/** The narrowest a table's first column (a name and its second line) and each other column may be: six of them and a checkbox fit a 690 px card. */
const COL_FIRST = 150, COL_REST = 88;
/** From this many columns a table uses tight cell padding. */
const DENSE_FROM = 6;

/** Sort buttons for a column header, the same in the table and in the stacked records. */
function SortLabel({ c }: { c: Of<"table">["columns"][number] }) {
  if (!c.sortId) return <Text weight="semibold">{c.label}</Text>;
  return (
    <Button
      variant="ghost"
      size="sm"
      label={c.label}
      onClick={() => press(c.sortId!)}
      endContent={c.sort === "none" ? <Icon icon="arrowsUpDown" color="secondary" /> : <Ic name={c.sort === "desc" ? "arrow-down" : "arrow-up"} color="accent" />}
    />
  );
}

/**
 * Below the core's `stackBelow` width each row is a record: its first cell is the heading, the
 * other columns are label and value lines. The sortable headers become a row of buttons above.
 */
function StackedTable({ node }: { node: Of<"table"> }) {
  const selectable = node.rows.some((r) => r.selectId !== undefined);
  const sortable = node.columns.filter((c) => c.sortId);
  return (
    <VStack gap={3}>
      {sortable.length > 0 ? (
        <HStack gap={1} align="center" wrap="wrap" role="group" aria-label="Sort by">
          <Text type="supporting" size="xsm">Sort by</Text>
          {sortable.map((c) => <SortLabel key={c.id} c={c} />)}
        </HStack>
      ) : null}
      <VStack gap={0}>
        {node.rows.map((row) => (
          <div key={row.id} className="an-record" {...(row.selected ? { style: { background: ACCENT_SOFT } } : {})}>
            <HStack gap={2} align="start">
              {selectable && row.selectId ? (
                <CheckboxInput isLabelHidden label={row.cells[0]?.text ?? row.id} value={row.selected} onChange={(on) => set(row.selectId!, on)} />
              ) : null}
              <div className="an-record-body">
                <VStack gap={2}>
                  {row.cells[0] ? <CellView cell={row.cells[0]} /> : null}
                  <MetadataList>
                    {row.cells.slice(1).map((cell, i) => (
                      <MetadataListItem key={i} label={node.columns[i + 1]?.label ?? ""}><CellView cell={{ ...cell, align: "end" }} /></MetadataListItem>
                    ))}
                  </MetadataList>
                </VStack>
              </div>
            </HStack>
          </div>
        ))}
      </VStack>
      {node.rows.length === 0 ? <div className="an-table-empty"><Text type="supporting">{node.empty}</Text></div> : null}
    </VStack>
  );
}

export function TableNode({ node }: { node: Of<"table"> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  // The core names the width below which rows stack; the table's own width decides.
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
    <div ref={wrap} className="an-table-wrap">
      {stacked ? <StackedTable node={node} /> : <WideTable node={node} />}
    </div>
  );
}

function WideTable({ node }: { node: Of<"table"> }) {
  const selectable = node.rows.some((r) => r.selectId !== undefined);
  return (
    <div className="an-table" {...(node.columns.length >= DENSE_FROM ? { "data-dense": "" } : {})}>
      <div className="an-table-inner" style={{ minWidth: node.columns.length >= DENSE_FROM ? (selectable ? 44 : 0) + COL_FIRST + (node.columns.length - 1) * COL_REST : node.columns.length * 150 + (selectable ? 72 : 0) }}>
      <Table>
        <TableHeader>
          <TableRow isHeaderRow>
            {selectable ? <TableHeaderCell scope="col" style={{ width: node.columns.length >= DENSE_FROM ? 44 : 72 }}><span /></TableHeaderCell> : null}
            {node.columns.map((c, ci) => (
              <TableHeaderCell
                key={c.id}
                scope="col"
                {...(node.columns.length >= DENSE_FROM ? { style: { minWidth: ci === 0 ? COL_FIRST : COL_REST } } : ci === 0 ? { style: { width: "32%" } } : {})}
                {...(c.sort === "asc" ? { "aria-sort": "ascending" as const } : c.sort === "desc" ? { "aria-sort": "descending" as const } : c.sort === "none" ? { "aria-sort": "none" as const } : {})}
              >
                <HStack gap={1} align="center" {...(c.align === "end" ? { justify: "end" as const } : {})}>
                  <SortLabel c={c} />
                </HStack>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {node.rows.map((row) => (
            <TableRow key={row.id} {...(row.selected ? { style: { background: ACCENT_SOFT } } : {})}>
              {selectable ? (
                <TableCell>
                  {row.selectId ? (
                    <CheckboxInput isLabelHidden label={row.cells[0]?.text ?? row.id} value={row.selected} onChange={(on) => set(row.selectId!, on)} />
                  ) : null}
                </TableCell>
              ) : null}
              {row.cells.map((cell, i) => <TableCell key={i}><CellView cell={cell} /></TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      {node.rows.length === 0 ? <div className="an-table-empty"><Text type="supporting">{node.empty}</Text></div> : null}
    </div>
  );
}

function Leading({ leading }: { leading: NonNullable<ListItemNode["leading"]> }) {
  if ("avatar" in leading) return <PersonAvatar initials={leading.avatar.initials} hue={leading.avatar.hue} />;
  return (
    <span className="an-leading" style={{ background: SOFT_TONE[leading.tone], color: leading.tone === "neutral" ? "var(--color-icon-secondary)" : FILL_TONE[leading.tone] }}>
      <Ic name={leading.icon} color="inherit" />
    </span>
  );
}

export function ListNode({ node }: { node: Of<"list"> }) {
  if (node.items.length === 0) return <div className="an-list-empty"><Text type="supporting">{node.empty}</Text></div>;
  return (
    <List hasDividers>
      {node.items.map((it) => {
        const target = it.selectId;
        return (
            <ListItem
              key={it.id}
              label={<Text weight={it.emphasized ? "semibold" : undefined}>{it.title}</Text>}
              {...(it.subtitle ? { description: <Text type="supporting" size="xsm">{it.subtitle}</Text> } : {})}
              {...(it.leading ? { startContent: <Leading leading={it.leading} /> } : {})}
              {...(it.meta || it.trailing ? {
                endContent: (
                  <VStack gap={0.5} align="end">
                    {it.trailing ? <ToneBadge text={it.trailing.text} tone={it.trailing.tone} /> : null}
                    {it.meta ? <Text type="supporting" size="xsm">{it.meta}</Text> : null}
                  </VStack>
                ),
              } : {})}
              isSelected={it.selected}
              {...(target ? { onClick: () => press(target) } : {})}
            />
        );
      })}
    </List>
  );
}

export function TabsNode({ node }: { node: Of<"tabs"> }) {
  return (
    <TabList value={node.value} onChange={(v) => set(node.id, v)}>
      {node.tabs.map((t) => <Tab key={t.value} value={t.value} label={t.label} {...(t.count !== undefined ? { endContent: <Badge label={t.count} /> } : {})} />)}
    </TabList>
  );
}

export function StepperNode({ node }: { node: Of<"stepper"> }) {
  const current = node.steps.findIndex((s) => s.state === "current");
  return (
    <Stepper
      activeStep={current < 0 ? node.steps.length : current}
      onStepClick={(i) => { const id = node.steps[i]?.selectId; if (id) press(id); }}
    >
      {node.steps.map((s, i) => <Step key={i} step={i} label={s.label} {...(s.state !== "current" && !s.selectId ? { isDisabled: true } : {})} />)}
    </Stepper>
  );
}

export function MetadataNode({ node }: { node: Of<"metadata"> }) {
  return (
    <MetadataList>
      {node.items.map((m, i) => <MetadataListItem key={i} label={m.label}>{m.value}</MetadataListItem>)}
    </MetadataList>
  );
}

/**
 * The core says "previous", "next" and one line of words. Astryx's Pagination draws the two
 * buttons (variant "none": no page numbers of its own); the words are the node's.
 */
export function PaginationNode({ node }: { node: Of<"pagination"> }) {
  const prev = node.previousId, next = node.nextId;
  // Astryx wants a page number; give it one that enables exactly the buttons the core enables.
  const page = prev ? 2 : 1;
  const totalPages = next ? page + 1 : page;
  return (
    <HStack gap={3} align="center" justify="between" wrap="wrap">
      <Text type="supporting">{node.label}</Text>
      <Pagination
        variant="none"
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          const id = p < page ? prev : next;
          if (id) press(id);
        }}
      />
    </HStack>
  );
}

