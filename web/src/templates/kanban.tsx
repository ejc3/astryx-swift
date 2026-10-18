// Astryx's `kanban-board` template, refactored onto the core: the JSX of
// src/stock/templates/kanban-board.tsx, drawing `view` (core/src/templates/kanban/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// The board's cards, their order and the sprint live in the core. The drag gesture (pointer
// tracking, the floating clone, the landing-slot ghost) is transient and stays here; it ends
// in one `send` that drops the card.
'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import * as stylex from '@stylexjs/stylex';
import type {
  CardView,
  ColumnId,
  ColumnView,
  EmptyIcon,
  View,
} from '../../../core/src/templates/kanban/model.ts';
import type {Action} from '@astryx-native/core';
import type {TemplateProps} from './props.ts';

import {
  Layout,
  LayoutHeader,
  LayoutContent,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Selector} from '@astryxdesign/core/Selector';
import {Tooltip} from '@astryxdesign/core/Tooltip';
import {Divider} from '@astryxdesign/core/Divider';
import {Toolbar} from '@astryxdesign/core/Toolbar';
import {Section} from '@astryxdesign/core/Section';

import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  FunnelIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  InboxIcon,
  InformationCircleIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

// ============= TYPES =============

// Where a dragged card will land: a column and an insertion index within it
// (measured against the cards remaining after the dragged card is removed).
interface DropTarget {
  column: ColumnId;
  index: number;
}

// Live state of an in-progress pointer drag. Coordinates are in viewport space.
interface DragState {
  id: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  pointerX: number;
  pointerY: number;
  target: DropTarget | null;
}

type Send = (action: Action) => void;

// ============= DATA =============

const EMPTY_ICONS: Record<EmptyIcon, typeof InboxIcon> = {
  inbox: InboxIcon,
  'arrow-path': ArrowPathIcon,
  'clipboard-check': ClipboardDocumentCheckIcon,
  'check-circle': CheckCircleIcon,
};


// Pointer travel (px) before a press is promoted to a drag, so taps and clicks
// on card controls still register normally.
const DRAG_THRESHOLD = 5;

// Shared width for every board column, so they stay visually aligned.
const COLUMN_WIDTH = 300;

// ============= STYLES =============

const styles = stylex.create({
  boardColumns: {
    overflowX: 'auto',
    overflowY: 'hidden',
    height: '100%',
    padding: 'var(--spacing-4)',
  },
  columnShell: {
    flexShrink: 0,
    flexBasis: COLUMN_WIDTH,
    height: '100%',
  },
  card: {
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    transition: 'box-shadow 120ms ease',
    ':hover': {
      boxShadow: 'var(--shadow-med)',
    },
  },
  // The dragged card is lifted out of flow and follows the pointer. It ignores
  // pointer events so hit-testing reads the columns underneath it.
  floating: {
    position: 'fixed',
    insetBlockStart: 0,
    insetInlineStart: 0,
    pointerEvents: 'none',
    cursor: 'grabbing',
    boxShadow: 'var(--shadow-high)',
    zIndex: 1000,
  },
  floatingAt: (x: number, y: number, width: number) => ({
    width,
    transform: `translate(${x}px, ${y}px)`,
  }),
  // Placeholder marking the landing slot; matches the dragged card's height.
  ghost: (height: number) => ({
    height,
    borderRadius: 'var(--radius-container)',
    backgroundColor: 'var(--color-background-muted)',
  }),
  toolbarDivider: {
    height: 'auto',
    marginBlock: 'var(--spacing-1)',
    alignSelf: 'stretch',
  },
  columnEmptyState: {
    paddingBlock: 'var(--spacing-10)',
  },
});


// ============= CARD BODY =============

// Shared card contents, rendered both in the column list and inside the
// floating drag clone so the two stay pixel-identical.
function BoardCardBody({item, send}: {item: CardView; send: Send}) {
  const moveTargets = item.moveTargets.map(t => ({
    label: t.label,
    onClick: () => send({type: 'press', id: t.id}),
  }));

  return (
    <VStack gap={2}>
      <HStack hAlign="between" vAlign="start">
        <HStack gap={1} vAlign="center" wrap="wrap">
          <Badge label={item.ref} variant="neutral" />
          <Badge label={item.priorityLabel} variant={item.priorityVariant} />
        </HStack>
        <MoreMenu
          label="Work item actions"
          size="sm"
          items={[
            {label: 'Open', onClick: () => {}},
            {label: 'Assign to me', onClick: () => {}},
            {type: 'divider'},
            ...moveTargets,
          ]}
        />
      </HStack>

      <VStack gap={1}>
        <Heading level={4}>{item.title}</Heading>
        <Text type="supporting" color="secondary" maxLines={2}>
          {item.description}
        </Text>
      </VStack>

      <Text type="supporting" color="secondary">
        {item.meta}
      </Text>
    </VStack>
  );
}

// ============= BOARD CARD =============

function BoardCard({
  item,
  cardRef,
  onPointerDown,
  send,
}: {
  item: CardView;
  cardRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: ReactPointerEvent, id: string) => void;
  send: Send;
}) {
  return (
    <Card
      ref={cardRef}
      padding={3}
      xstyle={styles.card}
      onPointerDown={e => onPointerDown(e, item.id)}>
      <BoardCardBody item={item} send={send} />
    </Card>
  );
}

// ============= BOARD COLUMN =============

function BoardColumn({
  meta,
  contentRef,
  children,
}: {
  meta: ColumnView;
  contentRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <Card variant="muted" padding={0} xstyle={styles.columnShell}>
      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider padding={3}>
            <HStack hAlign="between" vAlign="center">
              <HStack gap={2} vAlign="center">
                <StatusDot
                  variant={meta.variant}
                  label={`${meta.title} status`}
                />
                <Heading level={4}>{meta.title}</Heading>
                <Tooltip content={meta.tooltip}>
                  <Icon
                    icon={InformationCircleIcon}
                    size="sm"
                    color="secondary"
                  />
                </Tooltip>
              </HStack>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {meta.count}
              </Text>
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent ref={contentRef} padding={2}>
            {children ?? (
              <EmptyState
                isCompact
                xstyle={styles.columnEmptyState}
                icon={
                  <Icon
                    icon={EMPTY_ICONS[meta.emptyIcon]}
                    size="lg"
                    color="secondary"
                  />
                }
                title={meta.emptyTitle}
                description={meta.emptyDescription}
              />
            )}
          </LayoutContent>
        }
      />
    </Card>
  );
}

// ============= MAIN =============

export default function KanbanBoardTemplate({view: raw, send}: TemplateProps) {
  const view = raw as View;
  const [drag, setDrag] = useState<DragState | null>(null);

  // Live element registries for pointer hit-testing (kept out of render state).
  const columnEls = useRef(new Map<ColumnId, HTMLElement>());
  const cardEls = useRef(new Map<string, HTMLElement>());
  const columnRefCbs = useRef(
    new Map<ColumnId, (el: HTMLDivElement | null) => void>(),
  );
  const cardRefCbs = useRef(
    new Map<string, (el: HTMLDivElement | null) => void>(),
  );
  const teardownRef = useRef<(() => void) | null>(null);

  // Stable ref callbacks so registering an element never churns across renders.
  const getColumnRef = (id: ColumnId) => {
    let cb = columnRefCbs.current.get(id);
    if (!cb) {
      cb = el => {
        if (el) {
          columnEls.current.set(id, el);
        } else {
          columnEls.current.delete(id);
        }
      };
      columnRefCbs.current.set(id, cb);
    }
    return cb;
  };

  const getCardRef = (id: string) => {
    let cb = cardRefCbs.current.get(id);
    if (!cb) {
      cb = el => {
        if (el) {
          cardEls.current.set(id, el);
        } else {
          cardEls.current.delete(id);
        }
      };
      cardRefCbs.current.set(id, cb);
    }
    return cb;
  };

  const cardsByColumn = (colId: ColumnId): CardView[] =>
    view.columns.find(c => c.id === colId)?.cards ?? [];


  // Resolve the pointer position to a column + insertion index, ignoring the
  // card being dragged so the math is against the cards that stay in place.
  const computeTarget = (
    px: number,
    py: number,
    draggedId: string,
  ): DropTarget | null => {
    for (const [colId, el] of Array.from(columnEls.current.entries())) {
      const r = el.getBoundingClientRect();
      if (px < r.left || px > r.right || py < r.top || py > r.bottom) {
        continue;
      }

      const ids = cardsByColumn(colId)
        .filter(it => it.id !== draggedId)
        .map(it => it.id);

      let index = ids.length;
      for (let i = 0; i < ids.length; i++) {
        const cardEl = cardEls.current.get(ids[i] as string);
        if (!cardEl) {
          continue;
        }
        const cr = cardEl.getBoundingClientRect();
        if (py < cr.top + cr.height / 2) {
          index = i;
          break;
        }
      }
      return {column: colId, index};
    }
    return null;
  };

  // The core owns the order: it puts the dragged card at the resolved slot while
  // every other card keeps its relative order.
  const commitDrag = (id: string, target: DropTarget) => {
    send({
      type: 'set',
      id: `tpl.kanban.drop:${id}`,
      value: `${target.column}:${target.index}`,
    });
  };


  const onCardPointerDown = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) {
      return;
    }
    // Let the card's own controls (the actions menu) handle the press.
    if (
      (e.target as HTMLElement).closest(
        'button, [role="menuitem"], [role="menu"]',
      )
    ) {
      return;
    }

    const el = cardEls.current.get(id);
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;
    const {width, height} = rect;

    let started = false;
    let target: DropTarget | null = null;

    const onMove = (ev: PointerEvent) => {
      if (
        !started &&
        Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) <
          DRAG_THRESHOLD
      ) {
        return;
      }
      started = true;
      target = computeTarget(ev.clientX, ev.clientY, id);
      setDrag({
        id,
        width,
        height,
        offsetX,
        offsetY,
        pointerX: ev.clientX,
        pointerY: ev.clientY,
        target,
      });
    };

    const onUp = () => {
      teardownRef.current?.();
      if (started && target) {
        commitDrag(id, target);
      }
      setDrag(null);
    };

    const teardown = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      teardownRef.current = null;
    };
    teardownRef.current = teardown;

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const draggedItem = drag
    ? view.columns.flatMap(c => c.cards).find(it => it.id === drag.id)
    : undefined;
  const isDragging = drag !== null;

  // Suppress selection while dragging and detach listeners on unmount.
  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [isDragging]);

  useEffect(() => () => teardownRef.current?.(), []);

  // Card nodes for a column, or null when the column should show its empty
  // state. A dashed ghost box marks the landing slot during a drag.
  const renderColumnCards = (colId: ColumnId): ReactNode => {
    const colItems = cardsByColumn(colId);
    const visible = drag ? colItems.filter(it => it.id !== drag.id) : colItems;
    const ghostTarget =
      drag && drag.target && drag.target.column === colId ? drag : null;

    if (visible.length === 0 && !ghostTarget) {
      return null;
    }

    const nodes: ReactNode[] = visible.map(it => (
      <BoardCard
        key={it.id}
        item={it}
        cardRef={getCardRef(it.id)}
        onPointerDown={onCardPointerDown}
        send={send}
      />
    ));

    if (ghostTarget && ghostTarget.target) {
      const index = Math.min(ghostTarget.target.index, nodes.length);
      nodes.splice(
        index,
        0,
        <VStack key="drag-ghost" xstyle={styles.ghost(ghostTarget.height)} />,
      );
    }

    return <VStack gap={2}>{nodes}</VStack>;
  };

  return (
    <Section height="100dvh">
      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider padding={4}>
            <Toolbar
              label="Board actions"
              gap={2}
              startContent={
                <>
                  <Heading level={3}>{view.title}</Heading>
                  <Badge label={view.total} variant="neutral" />
                </>
              }
              endContent={
                <HStack gap={2}>
                  <Selector
                    label="Sprint"
                    width={200}
                    isLabelHidden
                    value={view.sprint}
                    onChange={value =>
                      send({type: 'set', id: 'tpl.kanban.sprint', value})
                    }
                    options={view.sprintOptions}
                  />
                  <Divider
                    variant="strong"
                    orientation="vertical"
                    xstyle={styles.toolbarDivider}
                  />
                  <HStack gap={1} vAlign="center">
                    <IconButton
                      icon={<Icon icon={ArrowsUpDownIcon} size="sm" />}
                      label="Sort"
                    />
                    <IconButton
                      icon={<Icon icon={FunnelIcon} size="sm" />}
                      label="Filter"
                    />
                    <IconButton
                      icon={<Icon icon={MagnifyingGlassIcon} size="sm" />}
                      label="Search"
                    />
                  </HStack>
                  <Button
                    label="Add task"
                    variant="primary"
                    icon={<Icon icon={PlusIcon} size="sm" />}
                  />
                </HStack>
              }
            />
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={0}>
            <HStack gap={4} xstyle={styles.boardColumns}>
              {view.columns.map(meta => (
                <BoardColumn
                  key={meta.id}
                  meta={meta}
                  contentRef={getColumnRef(meta.id)}>
                  {renderColumnCards(meta.id)}
                </BoardColumn>
              ))}
            </HStack>
          </LayoutContent>
        }
      />
      {drag && draggedItem ? (
        <Card
          padding={3}
          xstyle={[
            styles.floating,
            styles.floatingAt(
              drag.pointerX - drag.offsetX,
              drag.pointerY - drag.offsetY,
              drag.width,
            ),
          ]}>
          <BoardCardBody item={draggedItem} send={() => {}} />
        </Card>
      ) : null}
    </Section>
  );
}
