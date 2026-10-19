// Astryx's `theme-showcase` template, refactored onto the core: the JSX of
// src/stock/templates/theme-showcase.tsx, drawing `view` (core/src/templates/showcase/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {type CSSProperties} from 'react';
import {
  Plus,
  Search,
  Tag,
  Folder,
  MapPin,
  List,
  LayoutGrid,
  ShoppingBag,
  Banknote,
  Mic,
  CreditCard,
  Lock,
  X,
  Download,
  Smartphone,
  Wallet,
  User,
} from 'lucide-react';
import {Text, Heading} from '@astryxdesign/core/Text';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {useAppShellMobile} from '@astryxdesign/core/AppShell';
import {Grid, GridSpan} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Divider} from '@astryxdesign/core/Divider';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Item} from '@astryxdesign/core/Item';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Center} from '@astryxdesign/core/Center';
import {Section} from '@astryxdesign/core/Section';
import {AspectRatio} from '@astryxdesign/core/AspectRatio';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {OverflowList} from '@astryxdesign/core/OverflowList';
import {TopNav, TopNavHeading, TopNavItem} from '@astryxdesign/core/TopNav';
import type {Action} from '@astryx-native/core';
import type {View} from '../../../core/src/templates/showcase/model.ts';
import type {TemplateProps} from './props.ts';
import {
  ChatComposer,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
} from '@astryxdesign/core/Chat';

// Styles passed to Astryx components via their `style` prop. Astryx components
// forward the DOM `style` prop, so these work with no CSS compiler — in
// compiled builds and in the live playground preview alike.
const styles: Record<string, CSSProperties> = {
  card: {
    backgroundColor: 'var(--color-background-body)',
    color: 'var(--color-text-primary)',
    minWidth: 0,
    borderColor: 'transparent',
  },
  checkoutStack: {
    minWidth: 0,
    width: '100%',
  },
  paymentCardContent: {
    minWidth: 0,
    width: '100%',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  inventoryCard: {
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
  },
  inventoryHeader: {
    paddingBlock: 'var(--spacing-6)',
    paddingInline: 'var(--spacing-6)',
  },
  inventoryFilterRow: {
    paddingBlock: 'var(--spacing-4)',
    paddingInline: 'var(--spacing-6)',
    width: '100%',
    overflowX: 'auto' as const,
  },
  // Inset the table by --spacing-6 (the card is padding={0}) so its edge lines
  // up with the header/filter row in every theme's spacing scale.
  inventoryTableWrap: {
    paddingInline: 'var(--spacing-6)',
    paddingBlockEnd: 'var(--spacing-2)',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    maxWidth: 240,
  },
  activityCard: {
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    minWidth: 0,
    height: '100%',
  },
  chatCard: {
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    minWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  chatHeader: {
    paddingBlock: 'var(--spacing-4)',
    paddingInline: 'var(--spacing-4)',
  },
  activityCardStack: {
    height: '100%',
  },
  activityListFade: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    maskImage:
      'linear-gradient(to bottom, black calc(100% - 48px), transparent)',
    WebkitMaskImage:
      'linear-gradient(to bottom, black calc(100% - 48px), transparent)',
    marginInline: 'calc(var(--spacing-2) * -1)',
  },
  content: {
    maxWidth: 960,
    marginInline: 'auto',
    minWidth: 0,
  },
  contentFluid: {
    maxWidth: 880,
  },
  heroText: {
    textAlign: 'center' as const,
    maxWidth: 560,
  },
  centerText: {
    textAlign: 'center',
  },
  cardStack: {
    height: '100%',
  },
  cardDescription: {
    flex: 1,
  },
  quantityInput: {
    flexShrink: 0,
  },
  // `auto` basis so the button wraps to its own line rather than ellipsizing.
  cartButton: {
    flex: '1 1 auto',
    minWidth: 0,
  },
  cartRow: {
    width: '100%',
    minWidth: 0,
  },
};

// Styles applied directly to plain DOM elements via the `style` prop.
// Plain inline styles so they render with no CSS compiler. All are static
// (no media/pseudo variants), so inline styles reproduce them exactly.
const inlineStyles: Record<string, CSSProperties> = {
  inventoryBannerWrap: {
    paddingInline: 'var(--spacing-6)',
    paddingBottom: 'var(--spacing-4)',
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-element)',
    objectFit: 'cover',
    display: 'block',
    flexShrink: 0,
  },
  thumbnailFallback: {
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-element)',
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    flexShrink: 0,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.1,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-heading)',
    letterSpacing: '-0.01em',
  },
  chatBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chatSuggestions: {
    paddingInline: 'var(--spacing-4)',
    paddingBottom: 'var(--spacing-2)',
  },
  chatComposer: {
    paddingInline: 'var(--spacing-4)',
    paddingBottom: 'var(--spacing-4)',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  productImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardBody: {
    padding: 'var(--spacing-4)',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  // Flex bases, not grid tracks: the checkout form needs a width floor, and the
  // chat wraps to its own row rather than squeezing it under one.
  checkoutColumn: {
    flex: '1 1 300px',
    minWidth: 0,
    display: 'grid',
  },
  chatColumn: {
    flex: '2 1 520px',
    minWidth: 0,
    display: 'grid',
  },
};

type Send = TemplateProps['send'];

/** The stock template's controls all have no-op handlers; ours tell the core, which ignores them the same way. */
const setter = (send: Send, id: string) => (value: string | number | boolean) =>
  send({type: 'set', id: 'tpl.showcase.' + id, value} satisfies Action);

const NAV_ICONS = {
  search: <Search size={20} />,
  account: <User size={20} />,
  cart: <ShoppingBag size={20} />,
};
const PAYMENT_ICONS = {
  card: <CreditCard size={20} />,
  smartphone: <Smartphone size={20} />,
  wallet: <Wallet size={20} />,
};
const CHAT_ACTION_ICONS = {
  download: <Download size={16} />,
  close: <X size={16} />,
};
const ACTIVITY_ICONS = {
  bag: <ShoppingBag size={16} />,
  banknote: <Banknote size={16} />,
};
const FILTER_ICONS = {
  folder: <Folder size={16} />,
  mapPin: <MapPin size={16} />,
  tag: <Tag size={16} />,
};
const VIEW_ICONS = {
  list: <List size={18} />,
  grid: <LayoutGrid size={18} />,
};

export default function Template({view, send}: TemplateProps) {
  const v = view as View;
  const {isMobile} = useAppShellMobile();
  return (
    <div
      style={{
        minHeight: '100%',
        backgroundColor: 'var(--color-background-body)',
      }}>
      <StorePreview v={v} isMobile={isMobile} />
      <div
        style={{
          padding: 'var(--spacing-6)',
          backgroundColor: 'var(--color-background-surface)',
        }}>
        <CardShowcase v={v} send={send} isMobile={isMobile} />
      </div>
    </div>
  );
}

function CardShowcase({
  v,
  send,
  isMobile,
}: {
  v: View;
  send: Send;
  isMobile: boolean;
}) {
  const columns = isMobile ? 1 : ({minWidth: 200, repeat: 'fit'} as const);

  return (
    <VStack gap={8}>
      <HStack gap={4} wrap="wrap">
        <div style={inlineStyles.checkoutColumn}>
          <CheckoutCard v={v.checkout} send={send} isMobile={isMobile} />
        </div>
        <div style={inlineStyles.chatColumn}>
          <ChatCard v={v.chat} send={send} />
        </div>
      </HStack>
      <Grid columns={columns} gap={4}>
        <GridSpan columns={isMobile ? 1 : 3}>
          <InventoryCard v={v.inventory} send={send} />
        </GridSpan>
        <GridSpan columns={1}>
          <LatestActivityCard v={v.revenue} isMobile={isMobile} />
        </GridSpan>
      </Grid>
    </VStack>
  );
}

function StorePreview({v, isMobile}: {v: View; isMobile: boolean}) {
  return (
    <div data-theme-preview="true">
      <VStack gap={0}>
        <TopNav
          label={v.nav.label}
          heading={<TopNavHeading heading={v.nav.heading} />}
          centerContent={
            isMobile ? undefined : (
              <>
                {v.nav.items.map(item => (
                  <TopNavItem
                    key={item.label}
                    label={item.label}
                    href="#"
                    isSelected={item.isSelected || undefined}
                  />
                ))}
              </>
            )
          }
          endContent={
            <HStack gap={2} vAlign="center">
              <HStack gap={0.5}>
                {v.nav.actions.map(action => (
                  <Button
                    key={action.label}
                    label={action.label}
                    tooltip={action.label}
                    variant="ghost"
                    isIconOnly
                    icon={NAV_ICONS[action.icon]}
                    href="#"
                  />
                ))}
              </HStack>
              <Button label={v.nav.signIn} variant="primary" href="#" />
            </HStack>
          }
        />

        <Section padding={6} variant="transparent">
          <VStack gap={10} style={{...styles.content, ...styles.contentFluid}}>
            <Center>
              <VStack gap={4} hAlign="center" style={styles.heroText}>
                <Text type="display-2" color="accent">
                  {v.hero.lines[0]}
                  <br />
                  {v.hero.lines[1]}
                </Text>
                <Text type="body" color="secondary">
                  {v.hero.body}
                </Text>
              </VStack>
            </Center>

            <Grid columns={isMobile ? 1 : {minWidth: 200, max: 3}} gap={4}>
              {v.products.map(p => (
                <Card key={p.name} padding={0} height="100%">
                  <VStack gap={0} style={styles.cardStack}>
                    <AspectRatio ratio={1}>
                      <img
                        src={p.image}
                        alt={p.name}
                        style={inlineStyles.productImage}
                      />
                    </AspectRatio>
                    <div style={inlineStyles.cardBody}>
                      <VStack gap={2} hAlign="center" style={styles.cardStack}>
                        <HStack>
                          <Badge label={p.badge} variant={p.badgeVariant} />
                        </HStack>
                        <Heading level={2} style={styles.centerText}>
                          {p.name}
                        </Heading>
                        <Text
                          type="supporting"
                          color="secondary"
                          style={{
                            ...styles.cardDescription,
                            ...styles.centerText,
                          }}>
                          {p.description}
                        </Text>
                        <HStack
                          gap={2}
                          vAlign="center"
                          hAlign="center"
                          wrap="wrap"
                          style={styles.cartRow}>
                          <NumberInput
                            label={p.quantity.label}
                            isLabelHidden
                            value={p.quantity.value}
                            onChange={() => {}}
                            min={p.quantity.min}
                            max={p.quantity.max}
                            size="sm"
                            width={72}
                            controlStyle={styles.quantityInput}
                          />
                          <Button
                            label={p.addLabel}
                            variant="secondary"
                            size="sm"
                            href="#"
                            style={styles.cartButton}
                          />
                        </HStack>
                      </VStack>
                    </div>
                  </VStack>
                </Card>
              ))}
            </Grid>
          </VStack>
        </Section>
      </VStack>
    </div>
  );
}

function CheckoutCard({
  v,
  send,
  isMobile,
}: {
  v: View['checkout'];
  send: Send;
  isMobile: boolean;
}) {
  return (
    <Card padding={isMobile ? 4 : 5} style={styles.card}>
      <VStack gap={4} style={styles.checkoutStack}>
        <Heading level={2}>{v.heading}</Heading>

        <VStack gap={3} style={styles.checkoutStack}>
          <TextInput
            label={v.email.label}
            placeholder={v.email.placeholder}
            value={v.email.value}
            onChange={setter(send, 'email')}
            size="lg"
          />

          <RadioList
            label={v.shipping.label}
            description={v.shipping.description}
            value={v.shipping.value}
            onChange={setter(send, 'shipping')}>
            {v.shipping.options.map(option => (
              <RadioListItem
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                endContent={
                  <Text type="body" weight="bold">
                    {option.price}
                  </Text>
                }
              />
            ))}
          </RadioList>

          <VStack gap={2} style={styles.checkoutStack}>
            <Text type="supporting" weight="bold">
              {v.payment.label}
            </Text>
            <Grid columns={isMobile ? 1 : {minWidth: 80, max: 3}} gap={2}>
              {v.payment.options.map(option => (
                <SelectableCard
                  key={option.value}
                  label={option.label}
                  isSelected={option.isSelected}
                  onChange={() => setter(send, 'payment')(option.value)}
                  padding={3}>
                  <VStack
                    gap={1}
                    hAlign="center"
                    style={styles.paymentCardContent}>
                    {PAYMENT_ICONS[option.icon]}
                    <Text type="supporting" weight="bold">
                      {option.text}
                    </Text>
                  </VStack>
                </SelectableCard>
              ))}
            </Grid>
          </VStack>

          <TextInput
            label={v.card.label}
            placeholder={v.card.placeholder}
            value={v.card.value}
            onChange={setter(send, 'card')}
            startIcon={isMobile ? undefined : <CreditCard size={16} />}
            size="lg"
          />

          <Grid columns={isMobile ? 1 : {minWidth: 90, max: 2}} gap={2}>
            <TextInput
              label={v.expiry.label}
              placeholder={v.expiry.placeholder}
              value={v.expiry.value}
              onChange={setter(send, 'expiry')}
              size="lg"
            />
            <TextInput
              label={v.cvc.label}
              placeholder={v.cvc.placeholder}
              value={v.cvc.value}
              onChange={setter(send, 'cvc')}
              size="lg"
            />
          </Grid>

          <Selector
            label={v.country.label}
            value={v.country.value}
            onChange={setter(send, 'country')}
            size="lg"
            options={v.country.options}
          />
        </VStack>

        <CheckboxInput
          label={v.saveInfo.label}
          description={v.saveInfo.description}
          value={v.saveInfo.value}
          onChange={setter(send, 'saveInfo')}
        />

        <Button
          variant="primary"
          size="lg"
          label={v.payLabel}
          icon={<Lock size={16} />}
        />
      </VStack>
    </Card>
  );
}

function ChatCard({v, send}: {v: View['chat']; send: Send}) {
  return (
    <Card padding={0} style={styles.chatCard}>
      <HStack
        hAlign="between"
        vAlign="center"
        gap={3}
        style={styles.chatHeader}>
        <Heading level={2}>{v.heading}</Heading>

        <HStack gap={1} vAlign="center">
          {v.actions.map(action => (
            <Button
              key={action.label}
              variant="ghost"
              size="sm"
              isIconOnly
              label={action.label}
              tooltip={action.label}
              icon={CHAT_ACTION_ICONS[action.icon]}
            />
          ))}
        </HStack>
      </HStack>

      <Divider variant="subtle" />

      <div style={inlineStyles.chatBody}>
        <ChatMessageList>
          {v.messages.map((message, i) => {
            if (message.kind === 'system') {
              return <ChatSystemMessage key={i}>{message.text}</ChatSystemMessage>;
            }
            if (message.kind === 'user') {
              return (
                <ChatMessage key={i} sender="user">
                  <ChatMessageBubble variant="filled">
                    {message.text}
                  </ChatMessageBubble>
                </ChatMessage>
              );
            }
            return (
              <ChatMessage key={i} sender="assistant">
                <VStack gap={3}>
                  {message.paragraphs.map(paragraph => (
                    <Text key={paragraph} type="body">
                      {paragraph}
                    </Text>
                  ))}
                  {message.details && (
                    <Card padding={3}>
                      <VStack gap={1}>
                        {message.details.map(detail => (
                          <Item
                            key={detail.label}
                            label={detail.label}
                            description={detail.description}
                            endContent={
                              detail.end.kind === 'amount' ? (
                                <Text type="body" weight="bold">
                                  {detail.end.text}
                                </Text>
                              ) : detail.end.kind === 'badge' ? (
                                <Badge
                                  variant={detail.end.variant}
                                  label={detail.end.text}
                                />
                              ) : (
                                <Link href="#">{detail.end.text}</Link>
                              )
                            }
                          />
                        ))}
                      </VStack>
                    </Card>
                  )}
                </VStack>
              </ChatMessage>
            );
          })}
        </ChatMessageList>
      </div>

      <div style={inlineStyles.chatSuggestions}>
        <HStack gap={1} hAlign="center" wrap="wrap">
          {v.suggestions.map(question => (
            <Button
              key={question}
              variant="secondary"
              size="sm"
              label={question}
            />
          ))}
        </HStack>
      </div>

      <div style={inlineStyles.chatComposer}>
        <ChatComposer
          value={v.composer.value}
          onChange={setter(send, 'chatDraft')}
          onSubmit={() => send({type: 'press', id: 'tpl.showcase.chatSend'})}
          placeholder={v.composer.placeholder}
          footerActions={
            <Button
              variant="ghost"
              size="md"
              isIconOnly
              label={v.composer.attachLabel}
              tooltip={v.composer.attachLabel}
              icon={<Plus size={16} />}
            />
          }
          sendActions={
            <Button
              variant="ghost"
              size="md"
              isIconOnly
              label={v.composer.voiceLabel}
              tooltip={v.composer.voiceLabel}
              icon={<Mic size={16} />}
            />
          }
        />
      </div>
    </Card>
  );
}

function LatestActivityCard({
  v,
  isMobile,
}: {
  v: View['revenue'];
  isMobile: boolean;
}) {
  return (
    <Card padding={5} style={styles.activityCard}>
      <VStack gap={4} style={styles.activityCardStack}>
        <Heading level={2}>{v.heading}</Heading>

        <Grid columns={isMobile ? 1 : 2} gap={3}>
          {v.kpis.map(kpi => (
            <VStack key={kpi.label} gap={0}>
              <span style={inlineStyles.kpiValue}>{kpi.value}</span>
              <Text type="supporting" color="secondary">
                {kpi.label}
              </Text>
            </VStack>
          ))}
        </Grid>

        <Divider variant="subtle" />

        <HStack hAlign="between" vAlign="center">
          <Heading level={3}>{v.activityHeading}</Heading>
          <Link href="#">{v.seeAll}</Link>
        </HStack>

        <VStack gap={1} style={styles.activityListFade}>
          {v.items.map(item => (
            <Item
              key={item.id}
              startContent={
                <div style={inlineStyles.activityIcon} aria-hidden="true">
                  {ACTIVITY_ICONS[item.icon]}
                </div>
              }
              label={item.label}
              description={item.detail}
              endContent={
                <Text
                  type="body"
                  weight="bold"
                  color={item.isMuted ? 'secondary' : 'primary'}>
                  {item.amount}
                </Text>
              }
              href="#"
            />
          ))}
        </VStack>
      </VStack>
    </Card>
  );
}

type Row = View['inventory']['rows'][number] & Record<string, unknown>;

function InventoryCard({v, send}: {v: View['inventory']; send: Send}) {
  const rows = v.rows as Row[];
  return (
    <Card padding={0} style={styles.inventoryCard}>
      <HStack hAlign="between" vAlign="center" style={styles.inventoryHeader}>
        <Heading level={2}>{v.heading}</Heading>
        <Button
          label={v.addLabel}
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
        />
      </HStack>

      <Divider variant="subtle" />

      <HStack
        gap={3}
        vAlign="center"
        hAlign="between"
        style={styles.inventoryFilterRow}>
        <HStack gap={2} vAlign="center" style={{flex: 1, minWidth: 0}}>
          <TextInput
            label={v.search.label}
            isLabelHidden
            placeholder={v.search.placeholder}
            value={v.search.value}
            onChange={setter(send, 'search')}
            startIcon={<Search size={16} />}
            controlStyle={styles.searchInput}
          />
          <OverflowList
            gap={2}
            overflowRenderer={() => (
              <Button
                label={v.moreFiltersLabel}
                variant="ghost"
                size="sm"
                icon={<Tag size={16} />}
              />
            )}>
            {v.filters.map(filter => (
              <Selector
                key={filter.label}
                label={filter.label}
                isLabelHidden
                placeholder={filter.placeholder}
                size="sm"
                startIcon={FILTER_ICONS[filter.icon]}
                value={undefined}
                onChange={setter(send, 'filter.' + filter.label)}
                options={filter.options}
              />
            ))}
          </OverflowList>
        </HStack>
        <HStack gap={1} vAlign="center">
          {v.viewButtons.map(button => (
            <Button
              key={button.label}
              variant="ghost"
              size="sm"
              isIconOnly
              label={button.label}
              tooltip={button.label}
              icon={VIEW_ICONS[button.icon]}
            />
          ))}
        </HStack>
      </HStack>

      {v.banner !== null && (
        <div style={inlineStyles.inventoryBannerWrap}>
          <Banner status="warning" title={v.banner} />
        </div>
      )}

      <div style={styles.inventoryTableWrap}>
        <Table<Row>
          data={rows}
          columns={[
            {
              key: 'select',
              header: v.columns.select,
              // Wide enough that the control + the theme's cell padding (up to
              // --spacing-4 = 16px/side on spacious density) fit inside the cell,
              // so the control's hover background doesn't overflow toward the
              // card's clipped (rounded) edge on larger-padding themes.
              width: pixel(64),
              renderCell: row => (
                <CheckboxInput
                  label={row.selectLabel}
                  isLabelHidden
                  value={row.selected}
                  onChange={setter(send, 'select.' + row.id)}
                />
              ),
            },
            {
              key: 'item',
              header: v.columns.item,
              // Lower min-width (default 120) so the table fits its container on
              // larger-spacing themes instead of overflowing the actions column.
              width: proportional(3, {minWidth: 80}),
              renderCell: row => (
                <HStack gap={3} vAlign="center">
                  {row.image ? (
                    <img src={row.image} alt="" style={inlineStyles.thumbnail} />
                  ) : (
                    <div style={inlineStyles.thumbnailFallback} aria-hidden="true">
                      {row.fallback}
                    </div>
                  )}
                  <VStack gap={0} style={{minWidth: 0}}>
                    <Text type="body" weight="bold">
                      {row.name}
                    </Text>
                    <Text type="supporting" color="secondary">
                      {row.meta}
                    </Text>
                  </VStack>
                </HStack>
              ),
            },
            {
              key: 'available',
              header: v.columns.available,
              width: pixel(100),
              renderCell: row => <Text type="body">{row.available}</Text>,
            },
            {
              key: 'location',
              header: v.columns.location,
              width: pixel(100),
              renderCell: row => <Text type="body">{row.location}</Text>,
            },
            {
              key: 'tags',
              header: v.columns.tags,
              width: proportional(2, {minWidth: 80}),
              align: 'end',
              renderCell: row => (
                <HStack gap={1} wrap="wrap" hAlign="end">
                  {row.tags.map(tag => (
                    <Badge key={tag.label} label={tag.label} variant={tag.variant} />
                  ))}
                </HStack>
              ),
            },
            {
              key: 'actions',
              header: v.columns.actions,
              // Match the select column: fit the sm more-menu button + cell
              // padding so its hover background stays clear of the card's
              // clipped rounded edge across themes.
              width: pixel(64),
              align: 'end',
              renderCell: () => (
                <MoreMenu
                  label={v.rowMenuLabel}
                  size="sm"
                  items={v.rowMenu.map(item =>
                    'divider' in item ? {type: 'divider' as const} : {label: item.label},
                  )}
                />
              ),
            },
          ]}
          density="spacious"
          dividers="rows"
          hasHover
        />
      </div>
    </Card>
  );
}
