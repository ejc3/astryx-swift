// Astryx's `detail-page` template, refactored onto the core: the JSX of
// src/stock/templates/detail-page.tsx, drawing `view` (core/src/templates/order/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {useMediaQuery} from '@astryxdesign/core/hooks';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  LayoutPanel,
  VStack,
  HStack,
  StackItem,
  Card,
  Section,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Button} from '@astryxdesign/core/Button';
import {TabList, Tab, TabMenu} from '@astryxdesign/core/TabList';
import {Divider} from '@astryxdesign/core/Divider';
import {Link} from '@astryxdesign/core/Link';
import {List, ListItem} from '@astryxdesign/core/List';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Icon} from '@astryxdesign/core/Icon';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {
  CalendarIcon,
  FlagIcon,
  FunnelIcon,
  HandThumbUpIcon,
  HeartIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import type {View} from '../../../core/src/templates/order/model.ts';
import type {TemplateProps} from './props.ts';

// ─── Styles ─────────────────────────────────────────────────────────────────
import type {CSSProperties} from 'react';

// The only custom CSS in this template is a small optical-alignment negative
// margin: List has no "bleed to container edge" prop (#2626). Everything else
// uses props. Plain inline styles — no StyleX compiler required.
// Pull the list items' inner padding back so their content optically aligns
// with the section heading above (ListItem insets content by ~8px). No
// edge/inset prop on List (#2626).
const itemsList: CSSProperties = {
  marginInline: -8,
};

// ─── Bullet separator ───────────────────────────────────────────────────────
function Bullet() {
  return (
    <Text type="supporting" color="secondary">
      {'・'}
    </Text>
  );
}

// ─── Page Header ────────────────────────────────────────────────────────────
function PageHeader({
  view,
  activeTab,
  onTabChange,
  isPanelOpen,
  onTogglePanel,
  isNarrow,
}: {
  view: View;
  activeTab: string;
  onTabChange: (v: string) => void;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  isNarrow: boolean;
}) {
  const {words} = view;
  const mainTabs = view.tabs.filter(tab => !tab.more);
  const moreTabs = view.tabs.filter(tab => tab.more);
  return (
    <LayoutHeader hasDivider padding={4} paddingBlockEnd={0}>
      <VStack gap={3}>
        <HStack gap={4} vAlign="start">
          <StackItem size="fill">
            <VStack gap={0}>
              <Link href="#" color="secondary">
                <HStack gap={1} vAlign="center">
                  <Icon icon={ArrowLeftIcon} size="sm" color="inherit" />
                  {words.allOrders}
                </HStack>
              </Link>
              <VStack gap={0}>
                <Heading level={1} maxLines={1}>
                  {view.number}
                </Heading>
                {/* Metadata wraps to multiple lines on narrow screens (rather
                    than collapsing items behind a "+N more" overflow). */}
                <HStack gap={1} vAlign="center" wrap="wrap">
                  <Text type="body" maxLines={1}>
                    {view.itemsLabelParts}
                  </Text>
                  <HStack gap={1} vAlign="center">
                    <Bullet />
                    <Avatar name={view.customerName} size="sm" />
                    <Text type="body" maxLines={1}>
                      {view.customerName}
                    </Text>
                  </HStack>
                  <HStack gap={1} vAlign="center">
                    <Bullet />
                    <Badge variant="warning" label={view.status} />
                  </HStack>
                  <HStack gap={1} vAlign="center">
                    <Bullet />
                    <Icon icon={CalendarIcon} size="sm" color="secondary" />
                    <Text type="body" maxLines={1}>
                      {view.date}
                    </Text>
                  </HStack>
                  <HStack gap={1} vAlign="center">
                    <Bullet />
                    <Icon icon={FlagIcon} size="sm" color="secondary" />
                    <Text type="body" maxLines={1}>
                      {view.flag}
                    </Text>
                  </HStack>
                  <HStack gap={1} vAlign="center">
                    <Bullet />
                    <Link href="#" color="secondary">
                      {words.seeAll}
                    </Link>
                  </HStack>
                </HStack>
              </VStack>
            </VStack>
          </StackItem>
          {!isNarrow && (
            <HStack gap={2}>
              <Button label={words.restock} variant="secondary" />
              <Button label={words.edit} variant="secondary" />
            </HStack>
          )}
        </HStack>

        {/* Mobile: actions drop below the metadata as a full-width row. The
            VStack hAlign="stretch" wrapper is the full-width-button
            workaround — Button has no full-width prop (#2600). */}
        {isNarrow && (
          <HStack gap={2}>
            <StackItem size="fill">
              <VStack hAlign="stretch">
                <Button label={words.restock} variant="secondary" />
              </VStack>
            </StackItem>
            <StackItem size="fill">
              <VStack hAlign="stretch">
                <Button label={words.edit} variant="secondary" />
              </VStack>
            </StackItem>
          </HStack>
        )}

        <HStack vAlign="center">
          <StackItem size="fill">
            <TabList
              value={activeTab}
              onChange={onTabChange}
              size="lg"
              isFullBleed>
              {mainTabs.map(tab => (
                <Tab key={tab.value} value={tab.value} label={tab.label} />
              ))}
              <TabMenu
                label={words.more}
                options={moreTabs.map(({value, label}) => ({value, label}))}
              />
            </TabList>
          </StackItem>
          <Button
            label={isPanelOpen ? words.hidePanel : words.showPanel}
            variant="ghost"
            size="md"
            icon={<Icon icon={ViewColumnsIcon} size="sm" />}
            isIconOnly
            onClick={onTogglePanel}
          />
        </HStack>
      </VStack>
    </LayoutHeader>
  );
}

// ─── Items Card ─────────────────────────────────────────────────────────────
function ItemsCard({view}: {view: View}) {
  const {words} = view;
  return (
    <Section>
      <VStack gap={4}>
        <HStack vAlign="center" gap={2} wrap="wrap">
          <StackItem size="fill">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>{words.items}</Heading>
              <Badge variant="warning" label={view.status} />
            </HStack>
          </StackItem>
          <HStack gap={2}>
            <Button label={words.fulfillItem} variant="ghost" />
            <Button label={words.createLabel} variant="secondary" />
          </HStack>
        </HStack>

        <List density="spacious" style={itemsList}>
          {view.products.map((product, i) => (
            <ListItem
              key={i}
              label={product.name}
              description={
                <VStack gap={0}>
                  {product.lines.map((line, j) => (
                    <Text key={j} type="supporting" color="secondary">
                      {line}
                    </Text>
                  ))}
                </VStack>
              }
              onClick={() => {}}
              startContent={
                <Thumbnail
                  src={product.image}
                  alt={product.name}
                  label={product.name}
                />
              }
              endContent={
                <VStack gap={0} hAlign="end">
                  <Text type="body" weight="bold" maxLines={1}>
                    {product.amount}
                  </Text>
                  <Text type="supporting" color="secondary" maxLines={1}>
                    {product.unit}
                  </Text>
                </VStack>
              }
            />
          ))}
        </List>
      </VStack>
    </Section>
  );
}

// ─── Invoice Card ───────────────────────────────────────────────────────────
function InvoiceCard({view}: {view: View}) {
  const {words} = view;
  return (
    <Section>
      <VStack gap={4}>
        <HStack vAlign="center" gap={2} wrap="wrap">
          <StackItem size="fill">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>{words.invoice}</Heading>
              <Badge variant="success" label={words.paid} />
            </HStack>
          </StackItem>
          <HStack gap={2}>
            <Button label={words.refund} variant="ghost" />
            <Button label={words.sendInvoice} variant="secondary" />
          </HStack>
        </HStack>

        <MetadataList>
          {view.summary.map(row => (
            <MetadataListItem key={row.label} label={row.label}>
              <HStack>
                <StackItem size="fill">
                  {row.note != null && <Text type="body">{row.note}</Text>}
                </StackItem>
                <Text type="body" weight={row.strong ? 'bold' : undefined}>
                  {row.amount}
                </Text>
              </HStack>
            </MetadataListItem>
          ))}
        </MetadataList>

        <Divider />

        <MetadataList>
          <MetadataListItem label={view.paidBy.label}>
            <HStack>
              <StackItem size="fill">
                <Text type="body">{view.paidBy.note}</Text>
              </StackItem>
              <Text type="body">{view.paidBy.amount}</Text>
            </HStack>
          </MetadataListItem>
        </MetadataList>
      </VStack>
    </Section>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────────────
function TimelineSection({view}: {view: View}) {
  const {words} = view;
  return (
    <Section>
      <VStack gap={4}>
        <HStack vAlign="center">
          <StackItem size="fill">
            <Heading level={2}>{words.timeline}</Heading>
          </StackItem>
          <Button
            label={words.filters}
            variant="ghost"
            icon={<Icon icon={FunnelIcon} />}
            isIconOnly
          />
        </HStack>

        <VStack gap={4}>
          {view.activity.map((item, i) => (
            <VStack key={i} gap={2}>
              <HStack gap={3} vAlign="start">
                <Avatar name={item.user} size="md" />
                <StackItem size="fill">
                  <VStack gap={2}>
                    <Card variant="muted" padding={3}>
                      <VStack gap={1}>
                        <Text type="body" weight="bold">
                          {item.user}
                        </Text>
                        <Text type="body">{item.text}</Text>
                        {item.changes && (
                          <VStack gap={1}>
                            {item.changes.map((change, j) => (
                              <HStack key={j} gap={2} vAlign="center">
                                <Icon
                                  icon={PencilSquareIcon}
                                  size="sm"
                                  color="secondary"
                                />
                                <Text type="supporting" color="secondary">
                                  {change}
                                </Text>
                              </HStack>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Card>
                    <HStack gap={3} vAlign="center">
                      <HStack gap={1} vAlign="center">
                        <Icon
                          icon={HandThumbUpIcon}
                          size="xsm"
                          color="secondary"
                        />
                        <Icon icon={HeartIcon} size="xsm" color="secondary" />
                        <Text type="supporting" color="secondary">
                          {item.reactions}
                        </Text>
                      </HStack>
                      <Text type="supporting" color="secondary">
                        {words.like}
                      </Text>
                      <Bullet />
                      <Text type="supporting" color="secondary">
                        {words.reply}
                      </Text>
                      <Bullet />
                      <Text type="supporting" color="secondary">
                        {item.time}
                      </Text>
                    </HStack>
                  </VStack>
                </StackItem>
              </HStack>
            </VStack>
          ))}
        </VStack>
      </VStack>
    </Section>
  );
}

// ─── Right Panel ────────────────────────────────────────────────────────────
// Renders as a fixed-width side panel on desktop, and as a plain stacked section
// on mobile (so it flows below the content instead of squishing beside it).
function PanelContent({view}: {view: View}) {
  const {words} = view;
  return (
    <VStack gap={4}>
      <Collapsible trigger={<Heading level={4}>{words.notes}</Heading>}>
        <Text type="body">
          {view.notes}{' '}
          <Link href="#" color="secondary">
            {words.showMore}
          </Link>
        </Text>
      </Collapsible>
      <Collapsible trigger={<Heading level={4}>{words.customer}</Heading>}>
        <MetadataList>
          {view.customer.map(field => (
            <MetadataListItem key={field.label} label={field.label}>
              {field.value}
            </MetadataListItem>
          ))}
        </MetadataList>
      </Collapsible>
      <Collapsible trigger={<Heading level={4}>{words.fraudAnalysis}</Heading>}>
        <VStack gap={1}>
          <ProgressBar
            label={words.riskLevel}
            value={view.fraud.risk}
            variant="success"
            isLabelHidden
          />
          <Text type="body">{view.fraud.recommendation}</Text>
          <Text type="body">{view.fraud.detail}</Text>
        </VStack>
      </Collapsible>
    </VStack>
  );
}

// Desktop: fixed-width side panel in the layout's `end` slot.
function RightPanel({view}: {view: View}) {
  return (
    <LayoutPanel
      width={view.rules.panelWidth}
      padding={4}
      role="complementary">
      <PanelContent view={view} />
    </LayoutPanel>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DetailPage2Template({view: raw, send}: TemplateProps) {
  const view = raw as View;
  const activeTab = view.tab;
  const setActiveTab = (value: string) =>
    send({type: 'set', id: 'tpl.order.tab', value});
  const isNarrow = useMediaQuery(
    `(max-width: ${view.rules.viewportNarrowAtMost}px)`,
  );
  // Desktop: a fixed-width `end`-slot side panel that can be hidden.
  const showSidePanel = view.sidePanel;
  // Mobile: the panel opens as a full-screen dialog (the side slot would squish
  // the main content), driven by the same toolbar button.
  const isPanelDialogOpen = view.panelDialog;
  const setPanelDialogOpen = (value: boolean) =>
    send({type: 'set', id: 'tpl.order.panelDialog', value});

  const isPanelShown = isNarrow ? isPanelDialogOpen : showSidePanel;
  const togglePanel = () =>
    send({
      type: 'press',
      id: isNarrow ? 'tpl.order.panel:dialog' : 'tpl.order.panel:side',
    });

  return (
    <>
      <Layout
        height="fill"
        contentWidth={view.rules.contentWidth}
        defaultHasDividers
        header={
          <PageHeader
            view={view}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isPanelOpen={isPanelShown}
            onTogglePanel={togglePanel}
            isNarrow={isNarrow}
          />
        }
        content={
          <LayoutContent role="main">
            <VStack gap={4}>
              <ItemsCard view={view} />
              <InvoiceCard view={view} />
              <TimelineSection view={view} />
            </VStack>
          </LayoutContent>
        }
        end={!isNarrow && showSidePanel ? <RightPanel view={view} /> : undefined}
      />
      {/* Mobile: the side panel content opens as a full-screen dialog. (A
          side drawer/sheet would be more idiomatic, but Astryx has no Drawer
          component yet — #2575 — so we use the fullscreen Dialog variant.) */}
      <Dialog
        variant="fullscreen"
        isOpen={isNarrow && isPanelDialogOpen}
        onOpenChange={setPanelDialogOpen}>
        <Layout
          header={
            <DialogHeader
              title={view.words.panelTitle}
              onOpenChange={setPanelDialogOpen}
            />
          }
          content={
            <LayoutContent padding={4}>
              <PanelContent view={view} />
            </LayoutContent>
          }
        />
      </Dialog>
    </>
  );
}
