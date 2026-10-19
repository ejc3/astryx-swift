// Astryx's `table-page` template, refactored onto the core: the JSX of
// src/stock/templates/table-page.tsx, drawing `view` (core/src/templates/invoice/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// The long guide comment of the stock file is not repeated here; the behavior it describes
// (narrow once into one array, sort after filtering, one reset) is the core's now.
// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {useEffect, useMemo, useRef} from 'react';

import {
  HStack,
  Layout,
  LayoutContent,
  StackItem,
  VStack,
} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {useHoverCard} from '@astryxdesign/core/HoverCard';
import {Icon} from '@astryxdesign/core/Icon';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl';
import {TextInput} from '@astryxdesign/core/TextInput';
import {
  Table,
  pixel,
  proportional,
  useTableFiltering,
  useTableSortable,
} from '@astryxdesign/core/Table';
import type {
  TableColumn,
  TableFilterState,
  TablePlugin,
  TableSortState,
} from '@astryxdesign/core/Table';
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type {View} from '../../../core/src/templates/invoice/model.ts';
import type {TemplateProps} from './props.ts';

type InvoiceRow = View['rows'][number];

/**
 * Field definitions for the column filter popovers.
 *
 * `usePowerSearchConfig` is still the source even though the page no longer
 * renders a `PowerSearch`: `useTableFiltering` resolves each column's control
 * — text box, enum list, number comparator — from a config of this shape. The
 * typing here is what decides that Category gets a selector and Quantity gets
 * a numeric comparison. The category choices come from the view.
 */
function searchFields(categories: View['categories']) {
  return [
    {key: 'description', type: 'string', label: 'Description'},
    {
      key: 'category',
      type: 'enum',
      label: 'Category',
      enumValues: categories,
    },
    {key: 'quantity', type: 'number', label: 'Quantity'},
  ] as const;
}

/** Right-aligned tabular figure. The column's `align` handles the cell; this
 * keeps the digits themselves on a grid so decimal points line up. */
function Figure({
  children,
  weight,
}: {
  children: string;
  weight?: 'normal' | 'semibold';
}) {
  return (
    <Text hasTabularNumbers weight={weight}>
      {children}
    </Text>
  );
}

// ============= ROW DETAIL =============

/**
 * One hover card per row, triggered by the whole row.
 *
 * Three constraints shape this. The `<HoverCard>` wrapper is unusable: it wraps
 * its trigger in a `display: contents` span, and a span between `<tr>` and
 * `<td>` is invalid markup. A column's `renderCell` is a plain function, so the
 * hook has to live in a per-row component like this one. And `Table` has no
 * `rowComponent` escape hatch, so there is no way to hand the row itself a hook.
 *
 * The way through is to let the hook keep its own uncontrolled hover/focus
 * handling and simply point it at the enclosing `<tr>`. Driving `isOpen` from
 * row-level mouse handlers instead — the obvious alternative — produces a card
 * that closes the moment the pointer leaves the row, which makes anything
 * interactive inside it unreachable. Uncontrolled, the hook keeps the card open
 * while the pointer is moving onto it, so the Dispute button is clickable.
 *
 * `tabIndex` and `aria-describedby` are set on the row in the same effect,
 * because the node is already in hand and neither can be expressed through a
 * column definition. That also makes the detail reachable without a pointer —
 * but only alongside `focusTrigger: 'always'`, because the row is not focusable
 * yet at the moment the hook attaches to it.
 */
function DescriptionCell({item}: {item: InvoiceRow}) {
  const anchorRef = useRef<HTMLElement>(null);
  const hoverCard = useHoverCard({
    placement: 'below',
    alignment: 'start',
    label: `${item.description} details`,
    // The row is a plain `<tr>` made focusable in the effect below, and `auto`
    // decides whether to bind focus listeners at attach time — when the row is
    // still a non-focusable element. It would bind nothing, leaving the card
    // reachable by pointer and touch but not by keyboard: tabbing to a row
    // would draw a focus ring and open nothing. Leave nothing to detection.
    focusTrigger: 'always',
  });

  const attach = hoverCard.ref;
  const cardId = hoverCard.id;
  useEffect(() => {
    const row = anchorRef.current?.closest('tr');
    if (row == null) {
      return;
    }
    attach(row);
    row.tabIndex = 0;
    row.setAttribute('aria-describedby', cardId);
    return () => {
      attach(null);
      row.removeAttribute('aria-describedby');
    };
  }, [attach, cardId]);

  return (
    <>
      <Text maxLines={1} ref={anchorRef}>
        {item.description}
      </Text>
      {hoverCard.renderHoverCard(
        // No padding here — useHoverCard's content wrapper already applies
        // spacing-3 on all four sides. Adding it again doubles it to 24px.
        <VStack gap={3} width={280}>
          {/* h3 sizing, h2 in the outline. The page's only other heading is
              the invoice h1, so a plain level-3 would jump h1 → h3 and read
              as a missing section to anyone navigating by heading. */}
          <Heading level={3} accessibilityLevel={2}>
            {item.description}
          </Heading>
          <MetadataList label={{position: 'start'}}>
            <MetadataListItem label="Category">{item.card.category}</MetadataListItem>
            <MetadataListItem label="Billing">{item.card.billing}</MetadataListItem>
            <MetadataListItem label="Calculation">
              {item.card.calculation}
            </MetadataListItem>
            <MetadataListItem label="Amount">{item.card.amount}</MetadataListItem>
            <MetadataListItem label="Share of invoice">
              {item.card.share}
            </MetadataListItem>
          </MetadataList>
          <Button label="Dispute this line" variant="secondary" width="100%" />
        </VStack>,
      )}
    </>
  );
}

// ============= COLUMNS =============

const columns: TableColumn<InvoiceRow>[] = [
  {
    key: 'description',
    header: 'Description',
    width: proportional(3),
    sortable: true,
    filter: 'description',
    renderCell: item => <DescriptionCell item={item} />,
  },
  {
    key: 'category',
    header: 'Category',
    width: pixel(160),
    sortable: true,
    filter: 'category',
    renderCell: item => (
      <Text color="secondary" maxLines={1}>
        {item.category}
      </Text>
    ),
  },
  {
    key: 'quantity',
    header: 'Qty',
    width: pixel(80),
    align: 'end',
    sortable: true,
    filter: 'quantity',
    renderCell: item => <Figure>{item.quantity}</Figure>,
  },
  {
    key: 'unitPrice',
    header: 'Rate',
    width: pixel(120),
    align: 'end',
    sortable: true,
    renderCell: item => <Figure>{item.rate}</Figure>,
  },
  {
    key: 'amount',
    header: 'Amount',
    width: pixel(132),
    align: 'end',
    sortable: true,
    renderCell: item => <Figure>{item.amount}</Figure>,
  },
];

// ============= EDGE ALIGNMENT =============

const FLUSH_START: React.CSSProperties = {paddingInlineStart: 0};
const FLUSH_END: React.CSSProperties = {paddingInlineEnd: 0};

/** Inline padding override for a cell at either end of the row. */
function edgeStyle(
  index: number,
  total: number,
): React.CSSProperties | undefined {
  if (index === 0) {
    return FLUSH_START;
  }
  if (index === total - 1) {
    return FLUSH_END;
  }
  return undefined;
}

/**
 * Zero padding on the outer cells, which is the second half of sitting flush.
 *
 * `LayoutContent padding={0}` already cancelled the bleed (see the page body),
 * but cell padding resolves to
 * `max(var(--container-padding-inline-start), spacing-2)` — a hard floor, so
 * zeroing the variable still leaves the text indented 8px while the
 * MetadataList above it sits at 0. Only the cell can close that gap.
 *
 * Children mode would do it with an inline `style` on the outer cells; this is
 * the data-mode equivalent, and a demonstration that a plugin is nothing more
 * than an object of transforms.
 */
function useFlushEdges(): TablePlugin<InvoiceRow> {
  return useMemo(
    () => ({
      transformHeaderCell: (props, _column, columnIndex, cols) => {
        const style = edgeStyle(columnIndex, cols.length);
        return style == null
          ? props
          : {
              ...props,
              htmlProps: {
                ...props.htmlProps,
                style: {...props.htmlProps.style, ...style},
              },
            };
      },
      transformBodyCell: (props, _column, _item, columnIndex, cols) => {
        const style = edgeStyle(columnIndex, cols.length);
        return style == null
          ? props
          : {
              ...props,
              htmlProps: {
                ...props.htmlProps,
                style: {...props.htmlProps.style, ...style},
              },
            };
      },
    }),
    [],
  );
}

// ============= TOTALS =============

/**
 * The totals are arithmetic *about* the table, not rows *of* it, so they are
 * not a table.
 *
 * The tempting version is a second `<Table>` sharing the first one's
 * `<colgroup>`, since the figures have to land on the Amount column. That works
 * and it costs a hand-written `<colgroup>`, a `<col>` per column, and a border
 * declaration on every cell that needs a rule — because `dividers="none"` turns
 * the divider system off, so each hairline has to be drawn by hand.
 *
 * A right-aligned stack gets the same alignment for none of that: the figure
 * box is the Amount column's width and both are flush to the content line, so
 * they share an edge by construction. `Divider` then draws the rules, and the
 * three of them are the only ones on the page — which is what lets them read as
 * punctuation rather than as a grid.
 */
const AMOUNT_COLUMN_WIDTH = 132;

function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'muted' | 'strong';
}) {
  const weight = emphasis === 'strong' ? 'semibold' : 'normal';
  return (
    <HStack gap={6} hAlign="end" vAlign="center">
      <Text
        weight={weight}
        color={emphasis === 'muted' ? 'secondary' : 'primary'}>
        {label}
      </Text>
      <VStack width={AMOUNT_COLUMN_WIDTH}>
        <Text justify="end" display="block" hasTabularNumbers weight={weight}>
          {value}
        </Text>
      </VStack>
    </HStack>
  );
}

// ============= PAGE =============

export default function InvoiceLineItemsTemplate({
  view: raw,
  send,
}: TemplateProps) {
  const view = raw as View;
  const setQuery = (value: string) =>
    send({type: 'set', id: 'tpl.invoice.query', value});
  const setBasis = (value: string) =>
    send({type: 'set', id: 'tpl.invoice.basis', value});

  // One config drives the column popovers.
  const categoriesKey = JSON.stringify(view.categories);
  const fields = useMemo(
    () => searchFields(JSON.parse(categoriesKey) as View['categories']),
    [categoriesKey],
  );
  const {config} = usePowerSearchConfig(fields, 'Lines');
  const columnFilters: TableFilterState = view.filters;
  const onFilterChange = (key: string, value: string | number | string[] | null) => {
    if (value == null) {
      send({type: 'press', id: `tpl.invoice.unfilter:${key}`});
    } else if (!Array.isArray(value)) {
      send({type: 'set', id: `tpl.invoice.filter:${key}`, value});
    }
  };

  const filterPlugin = useTableFiltering<InvoiceRow>({
    filters: columnFilters,
    onFilterChange,
    searchConfig: config,
    variant: 'popover',
  });

  // The core narrows, sorts and totals; the page draws what it is given.
  const [subtotal, tax, total] = view.totals as [
    View['totals'][number],
    View['totals'][number],
    View['totals'][number],
  ];
  const sortPlugin = useTableSortable<InvoiceRow>({
    sort: view.sort,
    onSortChange: (next: TableSortState) =>
      send({
        type: 'set',
        id: 'tpl.invoice.sort',
        value: next[0] ? `${next[0].sortKey}:${next[0].direction}` : '',
      }),
  });
  const flushPlugin = useFlushEdges();

  const clearEverything = () => send({type: 'press', id: 'tpl.invoice.clear'});

  return (
    <Layout
      height="fill"
      contentWidth={960}
      content={
        // `padding={0}` is load-bearing, not a style choice. LayoutContent
        // publishes its padding as --container-padding-inline-*, and Table
        // reads those to bleed past it; zeroing them at the source is what
        // holds the table on the same content line as the MetadataList. The
        // padding moves to the VStack, which is a plain flex container and
        // publishes nothing.
        <LayoutContent padding={0}>
          <VStack padding={4} gap={8}>
            {/* Title, actions and document facts are one masthead, and it
                scrolls. The Layout `header` slot would pin it: with
                `height="fill"` the content area is the scroll container, so a
                slotted header stays put while the controls slide underneath
                it. A document's own title is not chrome — it belongs to the
                page it names, and reading down past it is the normal thing to
                do. Keep the slot for what stays useful mid-scroll: an app bar,
                a toolbar, a sticky action row. */}
            <VStack gap={6} paddingBlockEnd={4}>
              <HStack gap={3} vAlign="center" wrap="wrap">
                <StackItem size="fill">
                  <Heading level={1}>{view.title}</Heading>
                </StackItem>
                <Button
                  label="Download PDF"
                  variant="secondary"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                />
              </HStack>
              <MetadataList
                columns="multi"
                orientation="vertical"
                label={{position: 'top'}}>
                {view.details.map(detail => (
                  <MetadataListItem key={detail.label} label={detail.label}>
                    {detail.value}
                  </MetadataListItem>
                ))}
              </MetadataList>
            </VStack>

            {/* Scope first, then search: the segments narrow what the box is
                searching over, which is the order the sentence reads in.
                The VStack is what makes the input fill its 300px and sit
                flush right — as a bare flex child it shrinks to content. */}
            <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
              <SegmentedControl
                label="Filter by billing basis"
                value={view.basis}
                onChange={value => setBasis(value)}>
                {view.basisFilters.map(filter => (
                  <SegmentedControlItem
                    key={filter.value}
                    value={filter.value}
                    label={filter.label}
                  />
                ))}
              </SegmentedControl>
              <VStack width={300}>
                <TextInput
                  label="Search line items"
                  isLabelHidden
                  value={view.query}
                  onChange={setQuery}
                  placeholder="Search…"
                  startIcon={<Icon icon={MagnifyingGlassIcon} size="sm" />}
                />
              </VStack>
            </HStack>

            <VStack gap={6}>
              {view.empty != null ? (
                <EmptyState
                  title={view.empty.title}
                  description={view.empty.description}
                  actions={
                    <Button
                      label="Clear filters"
                      variant="secondary"
                      onClick={clearEverything}
                    />
                  }
                />
              ) : (
                <VStack gap={4}>
                  <Table<InvoiceRow>
                    data={view.rows}
                    columns={columns}
                    idKey="id"
                    density="balanced"
                    dividers="none"
                    hasHover
                    textOverflow="truncate"
                    plugins={{
                      sort: sortPlugin,
                      filter: filterPlugin,
                      flush: flushPlugin,
                    }}
                  />

                  <VStack gap={3}>
                    <Divider />
                    <TotalRow
                      label={subtotal.label}
                      value={subtotal.value}
                    />
                    <TotalRow
                      label={tax.label}
                      value={tax.value}
                      emphasis="muted"
                    />
                    <Divider />
                    <TotalRow
                      label={total.label}
                      value={total.value}
                      emphasis="strong"
                    />
                    <Divider />
                  </VStack>
                </VStack>
              )}

              {/* Mounted on a filter change rather than at first paint, so the
                  warning role actually announces. */}
              {view.banner != null && (
                <Banner
                  status="warning"
                  title={view.banner.title}
                  description={view.banner.description}
                  endContent={
                    <Button
                      label="Clear all filters"
                      variant="secondary"
                      onClick={clearEverything}
                    />
                  }
                />
              )}
            </VStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
