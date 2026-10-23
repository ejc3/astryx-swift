// Astryx's `table-inbox` template, refactored onto the core: the JSX of
// src/stock/templates/table-inbox.tsx, drawing `view` (core/src/templates/inbox/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
//
// What moved to the core: the tab, the open thread, the ticked rows, the expanded messages, the
// attachment viewer, the compose sheet's fields, and the widths this page measures (it reports them).
// What stays here: hover reveal, the resizable pane's width, and the measuring itself.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {SetStateAction} from 'react';

import * as stylex from '@stylexjs/stylex';

import {
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
  StackItem,
  VStack,
} from '@astryxdesign/core/Layout';
import {
  durationVars,
  easeVars,
  radiusVars,
  spacingVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import {Heading, Text} from '@astryxdesign/core/Text';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {Button} from '@astryxdesign/core/Button';
import {Collapsible, CollapsibleGroup} from '@astryxdesign/core/Collapsible';
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu';
import {Section} from '@astryxdesign/core/Section';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Lightbox} from '@astryxdesign/core/Lightbox';
import {OverflowList} from '@astryxdesign/core/OverflowList';
import {ResizeHandle, useResizable} from '@astryxdesign/core/Resizable';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {Token} from '@astryxdesign/core/Token';
import {Tokenizer} from '@astryxdesign/core/Tokenizer';
import {Toolbar} from '@astryxdesign/core/Toolbar';
import type {SearchSource} from '@astryxdesign/core/Typeahead';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {useContainerReveal, useMediaQuery} from '@astryxdesign/core/hooks';
import type {UseContainerRevealReturn} from '@astryxdesign/core/hooks';
import {
  Table,
  pixel,
  proportional,
  useTableRowStatus,
  useTableSelection,
  useTableSelectionState,
} from '@astryxdesign/core/Table';
import type {TableColumn, TablePlugin} from '@astryxdesign/core/Table';
import {
  ArchiveBoxIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  FaceSmileIcon,
  FolderArrowDownIcon,
  InboxIcon,
  LinkIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PencilSquareIcon,
  PhotoIcon,
  TrashIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import {searchRecipients} from '../../../core/src/templates/inbox/model.ts';
import type {
  ActionView,
  ComposeView,
  MessageView,
  MoveTarget,
  PaneView,
  RowView,
  View,
} from '../../../core/src/templates/inbox/model.ts';
import type {TemplateProps} from './props.ts';

type Send = TemplateProps['send'];

// ============= ACTIONS =============

const press = (send: Send, id: string) =>
  send({type: 'press', id: `tpl.inbox.${id}`});
const set = (send: Send, id: string, value: string | number | boolean) =>
  send({type: 'set', id: `tpl.inbox.${id}`, value});

// ============= PRESENTATION =============

const ACTION_ICONS: Record<ActionView['id'], typeof ArchiveBoxIcon> = {
  archive: ArchiveBoxIcon,
  move: FolderArrowDownIcon,
  delete: TrashIcon,
  reply: ArrowUturnLeftIcon,
};

/**
 * One of a thread's actions (Archive, Move to folder, Delete) as an icon button. Stock leaves
 * them inert; with saving on (the view no longer lists them in `inert`) they work: Archive and
 * Delete press their action for thread `id`, and Move to folder opens a menu of folders.
 */
function ThreadActionButton({
  action,
  id,
  moveTargets,
  inert,
  send,
  size,
}: {
  action: ActionView;
  id: string;
  moveTargets: MoveTarget[];
  inert: string[];
  send: Send;
  size?: 'sm';
}) {
  const icon = <Icon icon={ACTION_ICONS[action.id]} size="sm" />;
  if (action.id === 'move' && !inert.includes('move')) {
    return (
      <DropdownMenu
        hasChevron={false}
        items={moveTargets.map(target => ({
          label: target.label,
          onClick: () => send({type: 'press', id: target.id}),
        }))}
        renderTrigger={props => (
          <IconButton
            {...props}
            variant="ghost"
            size={size}
            label={action.ariaLabel}
            tooltip={action.label}
            icon={icon}
          />
        )}
      />
    );
  }
  const press_ =
    (action.id === 'archive' || action.id === 'delete') &&
    !inert.includes(action.id)
      ? {onClick: () => press(send, `${action.id}:${id}`)}
      : {};
  return (
    <IconButton
      variant="ghost"
      size={size}
      label={action.ariaLabel}
      tooltip={action.label}
      icon={icon}
      {...press_}
    />
  );
}

const COMPOSER_TOOL_ICONS: Record<string, typeof PaperClipIcon> = {
  attach: PaperClipIcon,
  link: LinkIcon,
  image: PhotoIcon,
  emoji: FaceSmileIcon,
};

/**
 * Dwell before the row actions appear. Without it a cursor travelling down the
 * list lights up every row it crosses; keyboard focus and touch ignore it.
 */
const HOVER_INTENT_MS = 90;

/** Matches the wash the selection plugin paints, so both states look native. */
const OPEN_CELL_STYLE = {backgroundColor: 'var(--color-accent-muted)'};

/** The tab strip's height, borrowed by the bulk-selection bar that replaces it. */
const SELECTION_BAR_HEIGHT = 37;

/**
 * Reports the width of the box this template was given, as it changes: to the
 * caller (which keeps it for the pane's own sizing) and to the core, which
 * decides from it which layout the page is in.
 *
 * The first read is synchronous and inside `useLayoutEffect`, before paint.
 * `offsetWidth` is the laid-out width, minus the padding the observer also
 * excludes, so both reads are in the same units.
 */
function useSurfaceWidth(report: (width: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const {paddingInlineStart, paddingInlineEnd} = getComputedStyle(node);
    setWidth(
      node.offsetWidth -
        parseFloat(paddingInlineStart) -
        parseFloat(paddingInlineEnd),
    );

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    report(width);
  }, [report, width]);

  return [ref, width] as const;
}

/**
 * Controls that live inside the row but are not the row. The row is one big
 * button, so everything nested in it inherits that click unless something
 * stops it; guarding centrally also covers the plugin's selection checkbox.
 */
const INTERACTIVE_WITHIN_ROW =
  'button, input, a, label, [role="checkbox"], [role="button"], [role="menuitem"]';

function isRowItself(event: {target: EventTarget | null}): boolean {
  return !(event.target as HTMLElement | null)?.closest(INTERACTIVE_WITHIN_ROW);
}

/** The gap between a message's avatar and the name beside it. */
const THREAD_HEADER_GAP = 3;

/** Avatar's default rendered size, which `ThreadGutter` has to match. */
const AVATAR_SIZE = 36;

/**
 * The plugin's own column key. It is internal to `useTableRowStatus`, and if it
 * is ever renamed this quietly stops applying rather than failing.
 */
const STATUS_COLUMN_KEY = '__rowStatus';

/**
 * The status gutter is re-sized to what its own contents cost: 16px of inset,
 * the 8px dot, and the 12px the density puts after every cell. The core says
 * how wide (`rules.statusGutterWidth`).
 */
const alignStatusGutter = (width: number): TablePlugin<RowView> => ({
  transformColumns: columns =>
    columns.map(column =>
      column.key === STATUS_COLUMN_KEY
        ? {...column, width: pixel(width)}
        : column,
    ),
});

/**
 * The actions take the whole cell the moment they enter flow, which is what
 * leaves the timestamp with nowhere to be.
 */
const ACTIONS_CLAIM_CELL = {flexBasis: '100%', flexShrink: 0};

/** Clips whatever the actions squeeze out of the trailing box. */
const HIDE_SQUEEZED_CONTENT = {overflow: 'hidden'};

/**
 * The bulk-selection band, matched to the one in the `table-filter` template.
 */
const styles = stylex.create({
  bulkBand: {
    borderRadius: radiusVars['--radius-element'],
  },
  bulkBandEnter: {
    opacity: 1,
    transform: 'translateY(0)',
    transitionProperty: 'opacity, transform',
    transitionDuration: {
      default: durationVars['--duration-medium'],
      '@media (prefers-reduced-motion: reduce)': '0s',
    },
    transitionTimingFunction: easeVars['--ease-standard'],
    '@starting-style': {
      opacity: 0,
      transform: `translateY(${spacingVars['--spacing-3']})`,
    },
  },
});

/**
 * The timestamp, and the actions that take its place on hover. Both
 * visibilities come from `useContainerReveal` (the row is the container), so
 * nothing here is driven by React state.
 */
function ReceivedCell({
  item,
  reveal,
  isOverlaid,
  hasAttachmentsLabel,
  inert,
  send,
}: {
  item: RowView;
  reveal: UseContainerRevealReturn;
  /** False on coarse pointers, where the actions are permanent. */
  isOverlaid: boolean;
  hasAttachmentsLabel: string;
  inert: string[];
  send: Send;
}) {
  return (
    <HStack gap={1} vAlign="center" hAlign="end" height={28}>
      <HStack
        {...reveal.getContentRevealProps()}
        style={isOverlaid ? ACTIONS_CLAIM_CELL : undefined}
        gap={0.5}
        vAlign="center"
        hAlign="end">
        {item.actions.map(action => (
          <ThreadActionButton
            key={action.id}
            action={action}
            id={item.id}
            moveTargets={item.moveTargets}
            inert={inert}
            send={send}
            size="sm"
          />
        ))}
      </HStack>

      <StackItem size="fill">
        <HStack
          {...(isOverlaid
            ? {}
            : reveal.getContentRevealProps({isRevealInverted: true}))}
          style={HIDE_SQUEEZED_CONTENT}
          gap={1}
          vAlign="center"
          hAlign="end">
          {item.hasAttachments ? (
            <Icon
              icon={PaperClipIcon}
              size="sm"
              color="gray"
              label={hasAttachmentsLabel}
            />
          ) : null}
          <Text
            color="secondary"
            hasTabularNumbers
            justify="end"
            maxLines={1}
            hasTruncateTooltip={false}
            weight={item.isUnread ? 'semibold' : 'normal'}>
            {item.receivedAt}
          </Text>
        </HStack>
      </StackItem>
    </HStack>
  );
}

// ============= ROW BEHAVIOUR =============

/**
 * Makes each row a doorway and a reveal container at once. A `<tr>` has no
 * activation of its own, so click, Enter, and Space are wired by hand. The open
 * row is painted on its cells rather than the row itself, because the selection
 * plugin owns `row.style.backgroundColor`.
 */
function useInboxRows({
  openId,
  onOpen,
  getContainerProps,
}: {
  openId: string | null;
  onOpen: (item: RowView) => void;
  getContainerProps: UseContainerRevealReturn['getContainerProps'];
}): TablePlugin<RowView> {
  return useMemo(
    () => ({
      transformBodyRow: (props, item) => {
        const container = getContainerProps({hoverDelay: HOVER_INTENT_MS});
        return {
          ...props,
          htmlProps: {
            ...props.htmlProps,
            className: [props.htmlProps.className, container.className]
              .filter(Boolean)
              .join(' '),
            style: {...props.htmlProps.style, ...container.style},
            tabIndex: 0,
            'aria-current': item.id === openId ? true : undefined,
            onClick: event => {
              if (isRowItself(event)) {
                onOpen(item);
              }
            },
            onKeyDown: event => {
              if (
                (event.key !== 'Enter' && event.key !== ' ') ||
                !isRowItself(event)
              ) {
                return;
              }
              event.preventDefault();
              onOpen(item);
            },
          },
        };
      },
      transformBodyCell: (props, _column, item) =>
        item.id === openId
          ? {
              ...props,
              htmlProps: {
                ...props.htmlProps,
                style: {...props.htmlProps.style, ...OPEN_CELL_STYLE},
              },
            }
          : props,
    }),
    [getContainerProps, onOpen, openId],
  );
}

// ============= READING PANE =============

/** The avatar's column, continued past the row the avatar is on. */
function ThreadGutter() {
  return <VStack width={AVATAR_SIZE} />;
}

/**
 * Image attachments as Thumbnails, opening into a lightbox. The viewer's open
 * state and index are the core's.
 */
function AttachmentStrip({
  message,
  send,
}: {
  message: MessageView;
  send: Send;
}) {
  const media = useMemo(
    () =>
      message.attachments.map(attachment => ({
        src: attachment.src,
        alt: attachment.lightboxAlt,
        caption: attachment.name,
      })),
    [message.attachments],
  );

  if (message.attachments.length === 0) {
    return null;
  }

  return (
    <VStack gap={2}>
      <HStack gap={1} vAlign="center">
        <Icon icon={PaperClipIcon} size="sm" color="gray" />
        <Text type="supporting" color="secondary">
          {message.attachmentsLabel}
        </Text>
      </HStack>
      <HStack gap={2} wrap="wrap">
        {message.attachments.map((attachment, index) => (
          <Thumbnail
            key={attachment.id}
            src={attachment.src}
            alt={attachment.previewAlt}
            label={attachment.name}
            onClick={() => press(send, `lightbox:${message.id}:${index}`)}
          />
        ))}
      </HStack>
      <Lightbox
        isOpen={message.lightboxIndex !== null}
        onOpenChange={nextOpen => {
          if (!nextOpen) {
            press(send, 'lightboxClose');
          }
        }}
        media={media}
        index={message.lightboxIndex ?? 0}
        onIndexChange={index => set(send, 'lightboxIndex', index)}
        hasZoom
      />
    </VStack>
  );
}

/**
 * The whole thread, oldest first, with the message the row points at last.
 * `type="multiple"`: reading a thread is usually comparing two messages.
 */
function ThreadHistory({
  pane,
  measure,
  send,
}: {
  pane: PaneView;
  /** How wide a message is allowed to get, regardless of the pane. */
  measure: number;
  send: Send;
}) {
  return (
    <VStack gap={2}>
      <CollapsibleGroup
        // Remount per thread, as the stock template does.
        key={pane.id}
        type="multiple"
        density="spacious"
        value={pane.openMessages}
        onChange={value =>
          set(send, 'messages', ([] as string[]).concat(value).join(','))
        }>
        {pane.messages.map(message => (
          <Collapsible
            key={message.id}
            value={message.id}
            trigger={
              <HStack
                gap={THREAD_HEADER_GAP}
                vAlign="center"
                paddingInlineEnd={2}>
                <Avatar name={message.sender} tooltip={false} />
                <StackItem size="fill">
                  <VStack gap={0.5}>
                    <Text maxLines={1} weight="semibold">
                      {message.sender}
                    </Text>
                    <Text maxLines={1} type="supporting" color="secondary">
                      {message.senderEmail}
                    </Text>
                  </VStack>
                </StackItem>
                <Text type="supporting" color="secondary">
                  {message.receivedFull}
                </Text>
              </HStack>
            }>
            <HStack gap={THREAD_HEADER_GAP}>
              <ThreadGutter />
              <StackItem size="fill">
                <VStack gap={3} maxWidth={measure}>
                  {message.body.map(paragraph => (
                    <Text key={paragraph}>{paragraph}</Text>
                  ))}
                  <AttachmentStrip message={message} send={send} />
                </VStack>
              </StackItem>
            </HStack>
          </Collapsible>
        ))}
      </CollapsibleGroup>
    </VStack>
  );
}

function ConversationPane({
  pane,
  text,
  messageMeasure,
  inert,
  send,
  isFullWidth,
}: {
  pane: PaneView;
  text: View['text']['pane'];
  messageMeasure: number;
  inert: string[];
  send: Send;
  /** True when the pane has replaced the list rather than sitting beside it. */
  isFullWidth: boolean;
}) {
  const onClose = () => press(send, 'close');
  const threadActions = pane.actions.map(action => (
    <ThreadActionButton
      key={action.id}
      action={action}
      id={pane.id}
      moveTargets={pane.moveTargets}
      inert={inert}
      send={send}
    />
  ));

  return (
    <VStack height="100%">
      {isFullWidth ? (
        <>
          <Toolbar
            label={text.label}
            startContent={
              <Button
                label={text.back}
                variant="ghost"
                icon={<Icon icon={ArrowLeftIcon} size="sm" />}
                onClick={onClose}
              />
            }
            endContent={threadActions}
          />
          <VStack paddingBlockEnd={3}>
            <Heading
              level={3}
              accessibilityLevel={2}
              maxLines={2}
              hasTruncateTooltip>
              {pane.subject}
            </Heading>
          </VStack>
        </>
      ) : (
        <VStack
          paddingBlockStart={4}
          paddingInlineStart={3}
          paddingInlineEnd={2}>
          <Toolbar
            label={text.label}
            startContent={
              <Heading level={2} maxLines={2} hasTruncateTooltip>
                {pane.subject}
              </Heading>
            }
            endContent={
              <>
                {threadActions}
                <IconButton
                  variant="ghost"
                  label={text.close}
                  tooltip={text.closeTooltip}
                  icon={<Icon icon={XMarkIcon} size="sm" />}
                  onClick={onClose}
                />
              </>
            }
          />
        </VStack>
      )}

      <StackItem size="fill">
        <VStack
          paddingInline={isFullWidth ? 0 : 6}
          paddingBlockStart={0}
          paddingBlockEnd={isFullWidth ? 0 : 6}
          gap={4}
          isScrollable
          height="100%">
          <HStack gap={2} vAlign="center" wrap="wrap">
            {pane.priority === null ? null : (
              <Token
                size="sm"
                color={pane.priority.color}
                label={pane.priority.label}
              />
            )}
            {pane.tags.map(tag => (
              <Token key={tag} size="sm" label={tag} />
            ))}
          </HStack>

          <ThreadHistory pane={pane} measure={messageMeasure} send={send} />

          <HStack gap={THREAD_HEADER_GAP}>
            <ThreadGutter />
            <HStack gap={2}>
              <Button
                label={text.reply}
                variant="primary"
                icon={<Icon icon={ArrowUturnLeftIcon} size="sm" />}
                onClick={() => press(send, 'reply')}
              />
              <Button
                label={text.replyAll}
                variant="secondary"
                icon={<Icon icon={UsersIcon} size="sm" />}
                onClick={() => press(send, 'replyAll')}
              />
            </HStack>
          </HStack>
        </VStack>
      </StackItem>
    </VStack>
  );
}

// ============= COMPOSER =============

/**
 * A search source over the directory, for a field that already holds `chosen`: the core's own
 * rule (`searchRecipients`), called here so typing needs no round trip. Kept stable while the
 * directory and the chosen people are unchanged.
 */
function useRecipientSource(
  directory: ComposeView['directory'],
  chosen: ComposeView['recipients'],
): SearchSource {
  const key = JSON.stringify([directory, chosen]);
  return useMemo<SearchSource>(() => {
    const [people, taken] = JSON.parse(key) as [
      ComposeView['directory'],
      ComposeView['recipients'],
    ];
    return {
      search: (query: string) => searchRecipients(people, taken, query),
      bootstrap: () => searchRecipients(people, taken, ''),
    };
  }, [key]);
}

/** The compose sheet. The fields and whether it is open are the core's. */
function ComposeWindow({
  compose,
  text,
  inert,
  send,
}: {
  compose: ComposeView;
  text: View['text']['composer'];
  inert: string[];
  send: Send;
}) {
  // A source over the directory the core offers, for what each field holds already.
  const {directory} = compose;
  const recipientSource = useRecipientSource(directory, compose.recipients);
  const ccSource = useRecipientSource(directory, compose.cc);
  const bccSource = useRecipientSource(directory, compose.bcc);

  const onOpenChange = (isOpen: boolean) => set(send, 'composeOpen', isOpen);
  const people = (field: 'recipients' | 'cc' | 'bcc') =>
    (items: {id: string; label: string}[]) =>
      set(
        send,
        field,
        JSON.stringify(items.map(({id, label}) => ({id, label}))),
      );

  return (
    <BottomSheet
      isOpen={compose.isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      label={text.sheetLabel}
      height="hug"
      hasScrim={false}
      padding={0}>
      <VStack paddingBlockStart={3}>
        <Layout
          height="auto"
          padding={4}
          defaultHasDividers
          header={
            <Toolbar
              label={text.toolbarLabel}
              startContent={<Heading level={2}>{text.heading}</Heading>}
              endContent={
                <IconButton
                  variant="ghost"
                  label={text.close}
                  tooltip={text.closeTooltip}
                  icon={<Icon icon={XMarkIcon} size="sm" />}
                  onClick={() => onOpenChange(false)}
                />
              }
            />
          }
          content={
            <LayoutContent padding={3}>
              <VStack gap={2}>
                <Tokenizer
                  label={text.recipient}
                  isLabelHidden
                  placeholder={text.recipient}
                  searchSource={recipientSource}
                  value={compose.recipients}
                  onChange={people('recipients')}
                  hasCreate
                  hasAutoFocus
                  endContent={
                    <>
                      {compose.hasCc ? null : (
                        <Button
                          label={text.cc}
                          variant="ghost"
                          size="sm"
                          onClick={() => press(send, 'showCc')}
                        />
                      )}
                      {compose.hasBcc ? null : (
                        <Button
                          label={text.bcc}
                          variant="ghost"
                          size="sm"
                          onClick={() => press(send, 'showBcc')}
                        />
                      )}
                    </>
                  }
                />
                {compose.hasCc ? (
                  <Tokenizer
                    label={text.cc}
                    isLabelHidden
                    placeholder={text.cc}
                    searchSource={ccSource}
                    value={compose.cc}
                    onChange={people('cc')}
                    hasCreate
                  />
                ) : null}
                {compose.hasBcc ? (
                  <Tokenizer
                    label={text.bcc}
                    isLabelHidden
                    placeholder={text.bcc}
                    searchSource={bccSource}
                    value={compose.bcc}
                    onChange={people('bcc')}
                    hasCreate
                  />
                ) : null}
                <TextInput
                  label={text.subject}
                  isLabelHidden
                  placeholder={text.subject}
                  value={compose.subject}
                  onChange={value => set(send, 'subject', value)}
                />

                <TextArea
                  label={text.body}
                  isLabelHidden
                  placeholder={text.bodyPlaceholder}
                  value={compose.body}
                  onChange={value => set(send, 'body', value)}
                  rows={8}
                  width="100%"
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <Toolbar
              label={text.actionsLabel}
              dividers={['top']}
              startContent={
                <>
                  <Button
                    label={text.send}
                    variant="primary"
                    icon={<Icon icon={PaperAirplaneIcon} size="sm" />}
                    // Stock leaves Send inert; with saving on it sends once there
                    // is someone to send to and something to say.
                    {...(inert.includes('send')
                      ? {}
                      : {
                          isDisabled: !compose.canSend,
                          onClick: () => press(send, 'send'),
                        })}
                  />
                  {text.tools.map(tool => (
                    <IconButton
                      key={tool.id}
                      variant="ghost"
                      label={tool.label}
                      tooltip={tool.label}
                      icon={
                        <Icon
                          icon={COMPOSER_TOOL_ICONS[tool.id] ?? PaperClipIcon}
                          size="sm"
                        />
                      }
                    />
                  ))}
                </>
              }
              endContent={
                <IconButton
                  variant="ghost"
                  label={text.discard}
                  tooltip={text.discard}
                  icon={<Icon icon={TrashIcon} size="sm" />}
                  onClick={() => press(send, 'discard')}
                />
              }
            />
          }
        />
      </VStack>
    </BottomSheet>
  );
}

// ============= PAGE =============

export default function SupportInboxTemplate({view: rawView, send}: TemplateProps) {
  const view = rawView as View;
  const {text, mode} = view;
  const {isSingleSurface, isPaneFullWidth, isStacked, isTight, isTouch} = mode;
  const {rules} = mode;
  const statusGutter = useMemo(
    () => alignStatusGutter(rules.statusGutterWidth),
    [rules.statusGutterWidth],
  );

  // The page measures; the core decides what the measurements mean.
  const reportSurface = useCallback(
    (width: number) => set(send, 'surface', width),
    [send],
  );
  const reportList = useCallback(
    (width: number) => set(send, 'list', width),
    [send],
  );
  const [surfaceRef, surfaceWidth] = useSurfaceWidth(reportSurface);
  const [listRef] = useSurfaceWidth(reportList);

  // Touch never hovers, so the reveal shows the actions permanently there.
  const isHoverless = useMediaQuery('(hover: none)');
  useLayoutEffect(() => {
    set(send, 'touch', isHoverless);
  }, [send, isHoverless]);

  // Selection: the core holds the keys; the table hook wants a Set and a setter.
  const selectedKeys = useMemo(
    () => new Set(view.selectedKeys),
    [view.selectedKeys],
  );
  const selectedRef = useRef(selectedKeys);
  useEffect(() => {
    selectedRef.current = selectedKeys;
  });
  const setSelectedKeys = useCallback(
    (update: SetStateAction<Set<string>>) => {
      const next =
        typeof update === 'function' ? update(selectedRef.current) : update;
      selectedRef.current = next;
      set(send, 'selection', [...next].join(','));
    },
    [send],
  );

  const {selectionConfig} = useTableSelectionState<RowView>({
    data: view.rows,
    idKey: 'id',
    selectedKeys,
    setSelectedKeys,
  });

  const reveal = useContainerReveal();

  // Nothing measured yet — assume the roomy case.
  const isMeasured = surfaceWidth > 0;

  // The movable boundary between the list and the pane. Where the handle puts
  // it is presentation, and stays here.
  const hasUserMovedPane = useRef(false);
  const isPlacingPane = useRef(false);
  const onPaneSizeChange = useCallback(() => {
    if (isPlacingPane.current) {
      return;
    }
    hasUserMovedPane.current = true;
  }, []);

  const pane = useResizable({
    defaultSize: '58%',
    minSize: rules.paneMin,
    maxSize: isMeasured
      ? Math.max(rules.paneMin, surfaceWidth - rules.listMin)
      : undefined,
    onSizeChange: onPaneSizeChange,
  });

  // Land the pane on its share of the surface, and keep it there until the
  // handle is used.
  const {resize: resizePane} = pane;
  useLayoutEffect(() => {
    if (hasUserMovedPane.current || !isMeasured) {
      return;
    }
    isPlacingPane.current = true;
    resizePane(Math.round(surfaceWidth * rules.paneDefaultShare));
    isPlacingPane.current = false;
  }, [isMeasured, surfaceWidth, resizePane, rules.paneDefaultShare]);

  const handleOpen = useCallback(
    (item: RowView) => press(send, `open:${item.id}`),
    [send],
  );

  const rowStatus = useTableRowStatus<RowView>({
    getStatus: useCallback(
      (item: RowView) =>
        item.status === null
          ? null
          : {color: 'accent' as const, label: item.status},
      [],
    ),
  });

  const selection = useTableSelection<RowView>({
    ...selectionConfig,
    getRowLabel: item => item.selectionLabel,
    // The open row already owns the row background; two washes would fight.
    hasRowHighlight: false,
  });

  const rows = useInboxRows({
    openId: view.openId,
    onOpen: handleOpen,
    getContainerProps: reveal.getContainerProps,
  });

  const {receivedWidth, inert} = view;
  const {
    columns: columnText,
    hasAttachments: hasAttachmentsLabel,
    overflowMark,
    previewSeparator,
  } = text;
  const columns = useMemo((): TableColumn<RowView>[] => {
    const received: TableColumn<RowView> = {
      key: 'receivedAt',
      header: columnText.received,
      width: pixel(receivedWidth),
      align: 'end',
      renderCell: item => (
        <ReceivedCell
          item={item}
          reveal={reveal}
          isOverlaid={!isTouch}
          hasAttachmentsLabel={hasAttachmentsLabel}
          inert={inert}
          send={send}
        />
      ),
    };

    if (isStacked) {
      // Stacked, the row stops being tabular: sender over subject, and the time.
      return [
        {
          key: 'conversation',
          header: columnText.conversation,
          width: proportional(1, {minWidth: 160}),
          renderCell: item => (
            <VStack gap={0.5}>
              <Text maxLines={1} weight={item.isUnread ? 'semibold' : 'normal'}>
                {item.sender}
              </Text>
              <Text maxLines={1} color="secondary">
                {item.subject}
              </Text>
            </VStack>
          ),
        },
        received,
      ];
    }

    const all: TableColumn<RowView>[] = [
      {
        key: 'sender',
        header: columnText.from,
        width: pixel(190),
        renderCell: item => (
          <HStack gap={2} vAlign="center">
            <Avatar name={item.sender} size="sm" tooltip={false} />
            <Text maxLines={1} weight={item.isUnread ? 'semibold' : 'normal'}>
              {item.sender}
            </Text>
          </HStack>
        ),
      },
      {
        key: 'subject',
        header: columnText.subject,
        width: proportional(3),
        renderCell: item => (
          <HStack gap={2} vAlign="center">
            <StackItem size="static">
              <Text maxLines={1} weight={item.isUnread ? 'semibold' : 'normal'}>
                {item.subject}
              </Text>
            </StackItem>
            <StackItem size="fill">
              <Text maxLines={1} color="secondary">
                {previewSeparator} {item.preview}
              </Text>
            </StackItem>
          </HStack>
        ),
      },
      {
        key: 'tags',
        header: columnText.tags,
        width: pixel(200),
        renderCell: item => (
          <OverflowList
            gap={1}
            behavior="observeParent"
            overflowRenderer={hidden => (
              <Token
                size="sm"
                label={`${overflowMark}${hidden.length}`}
                description={hidden
                  .map(entry => entry.child.key)
                  .filter(Boolean)
                  .join(', ')}
              />
            )}>
            {item.priority === null ? null : (
              <Token
                key={item.priority.label.toLowerCase()}
                size="sm"
                color={item.priority.color}
                label={item.priority.label}
              />
            )}
            {item.tags.map(tag => (
              <Token key={tag} size="sm" label={tag} />
            ))}
          </OverflowList>
        ),
      },
      received,
    ];

    return isTight ? all.filter(column => column.key !== 'tags') : all;
  }, [
    isStacked,
    isTight,
    isTouch,
    reveal,
    receivedWidth,
    inert,
    send,
    hasAttachmentsLabel,
    overflowMark,
    previewSeparator,
    columnText.received,
    columnText.conversation,
    columnText.from,
    columnText.subject,
    columnText.tags,
  ]);

  // Stacked, the checkbox column goes.
  const tablePlugins: Record<string, TablePlugin<RowView>> = isStacked
    ? {rowStatus, rows, gutter: statusGutter}
    : {selection, rowStatus, rows, gutter: statusGutter};

  const openPane = view.pane;

  return (
    <>
      <Layout
        ref={surfaceRef}
        height="fill"
        header={
          <LayoutHeader hasDivider={isPaneFullWidth} padding={0}>
            <VStack gap={0}>
              <HStack gap={3} vAlign="center" wrap="wrap" padding={4}>
                <StackItem size="fill">
                  <VStack gap={0.5}>
                    <Heading level={1}>{text.title}</Heading>
                    <Text type="supporting">{view.subtitle}</Text>
                  </VStack>
                </StackItem>
                <Button
                  label={text.refresh}
                  variant="ghost"
                  icon={<Icon icon={ArrowPathIcon} size="sm" />}
                />
                <Button
                  label={text.compose}
                  variant="primary"
                  icon={<Icon icon={PencilSquareIcon} size="sm" />}
                  onClick={() => press(send, 'compose')}
                />
              </HStack>

              {isPaneFullWidth ? null : view.hasSelection ? (
                <VStack
                  height={SELECTION_BAR_HEIGHT}
                  vAlign="end"
                  paddingBlockEnd={0.5}>
                  <Section
                    variant="muted"
                    paddingInline={3}
                    paddingBlock={2}
                    xstyle={[styles.bulkBand, styles.bulkBandEnter]}>
                    <HStack gap={3} vAlign="center" minHeight={28}>
                      <StackItem size="fill">
                        <HStack gap={1} vAlign="center">
                          {view.bulkActions.map(action =>
                            action.id === 'move' && !inert.includes('move') ? (
                              <DropdownMenu
                                key={action.id}
                                hasChevron={false}
                                items={view.bulkMoveTargets.map(target => ({
                                  label: target.label,
                                  onClick: () =>
                                    send({type: 'press', id: target.id}),
                                }))}
                                renderTrigger={props => (
                                  <Button
                                    {...props}
                                    label={action.label}
                                    variant="ghost"
                                    size="sm"
                                    icon={
                                      <Icon
                                        icon={ACTION_ICONS[action.id]}
                                        size="sm"
                                      />
                                    }
                                  />
                                )}
                              />
                            ) : (
                              <Button
                                key={action.id}
                                label={action.label}
                                variant="ghost"
                                size="sm"
                                icon={
                                  <Icon
                                    icon={ACTION_ICONS[action.id]}
                                    size="sm"
                                  />
                                }
                                // Stock leaves these inert; with saving on they
                                // work on the ticked rows.
                                {...((action.id === 'archive' ||
                                  action.id === 'delete') &&
                                !inert.includes(action.id)
                                  ? {
                                      onClick: () =>
                                        press(send, `${action.id}Selected`),
                                    }
                                  : {})}
                              />
                            ),
                          )}
                        </HStack>
                      </StackItem>

                      <HStack gap={3} vAlign="center">
                        <Text type="body">{view.selectionLabel}</Text>
                        <Text type="supporting" color="secondary">
                          {text.bullet}
                        </Text>
                        <Button
                          label={text.unselectAll}
                          variant="ghost"
                          size="sm"
                          onClick={() => press(send, 'unselectAll')}
                        />
                      </HStack>
                    </HStack>
                  </Section>
                </VStack>
              ) : (
                <>
                  <VStack paddingInline={1}>
                    <TabList
                      hasDivider
                      value={view.tab}
                      onChange={value => set(send, 'tab', value)}>
                      {view.tabs.map(option => (
                        <Tab
                          key={option.value}
                          value={option.value}
                          label={option.label}
                          endContent={
                            option.badge === null ? undefined : (
                              <Badge
                                variant="neutral"
                                label={
                                  <>
                                    {option.badge}
                                    <VisuallyHidden>
                                      {text.unreadSuffix}
                                    </VisuallyHidden>
                                  </>
                                }
                              />
                            )
                          }
                        />
                      ))}
                    </TabList>
                  </VStack>
                </>
              )}
            </VStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent ref={listRef} padding={4} isScrollable>
            {isPaneFullWidth && openPane != null ? (
              <ConversationPane
                pane={openPane}
                text={text.pane}
                messageMeasure={rules.messageMeasure}
                inert={view.inert}
                send={send}
                isFullWidth
              />
            ) : view.rows.length === 0 ? (
              <VStack padding={6}>
                <EmptyState
                  title={text.empty.title}
                  description={text.empty.description}
                  icon={<Icon icon={InboxIcon} size="lg" />}
                  actions={
                    <Button
                      label={text.empty.action}
                      variant="secondary"
                      onClick={() => set(send, 'tab', 'inbox')}
                    />
                  }
                />
              </VStack>
            ) : (
              <Table
                data={view.rows}
                columns={columns}
                idKey="id"
                plugins={tablePlugins}
                density="balanced"
                dividers="none"
                hasHover
                textOverflow="truncate"
              />
            )}
          </LayoutContent>
        }
        end={
          isSingleSurface || openPane == null ? undefined : (
            <>
              <ResizeHandle
                direction="horizontal"
                isReversed
                hasDivider
                pillPlacement="end"
                resizable={pane.props}
                label={text.pane.resizeLabel}
              />
              <LayoutPanel
                resizable={pane.props}
                padding={0}
                role="complementary"
                label={text.pane.label}>
                <ConversationPane
                  pane={openPane}
                  text={text.pane}
                  messageMeasure={rules.messageMeasure}
                  inert={view.inert}
                  send={send}
                  isFullWidth={false}
                />
              </LayoutPanel>
            </>
          )
        }
      />
      <ComposeWindow
        compose={view.compose}
        text={text.composer}
        inert={view.inert}
        send={send}
      />
      {view.confirm === null ? null : (
        // Delete asks first (saving on only; the view has no question otherwise).
        <AlertDialog
          isOpen
          onOpenChange={isOpen => {
            if (!isOpen) {
              send({type: 'press', id: view.confirm?.cancelId ?? ''});
            }
          }}
          title={view.confirm.title}
          description={view.confirm.description}
          actionLabel={view.confirm.actionLabel}
          cancelLabel={view.confirm.cancelLabel}
          onAction={() => send({type: 'press', id: view.confirm?.actionId ?? ''})}
        />
      )}
    </>
  );
}
