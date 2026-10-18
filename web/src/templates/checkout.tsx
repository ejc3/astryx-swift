// Astryx's `checkout-wizard` template, refactored onto the core: the JSX of
// src/stock/templates/checkout-wizard.tsx, drawing `view` (core/src/templates/checkout/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * A stepped checkout in two columns, capped at 1000px: the form column carries
 * the Stepper, the current step and the actions; the order summary sits beside
 * it as a sticky Card so the total is visible at every step.
 *
 * This is the wizard shape for flows where a running consequence has to stay on
 * screen. Choosing express shipping on step 2 changes the total, and the total
 * is what the person is actually deciding about — hiding it behind a Review
 * step means they discover the cost after they have committed to the effort.
 * The same argument applies to any flow with a live cost, quota, or capacity
 * readout.
 *
 * It is worth contrasting with the single-page `payment-form` template. Both
 * collect the same information. A single page is faster for a returning
 * customer with saved details; the stepped version wins when the form is long
 * enough that a single page reads as a wall, or when later steps depend on
 * earlier ones — here, delivery options are priced per address, so shipping has
 * to come before delivery.
 *
 * ## Extending this template
 *
 * **Progress is scoped to the column it describes.** The Stepper sits at the
 * top of the form column rather than in the Layout header. A header stepper
 * spans the summary too, which reads as a claim that the summary is one of the
 * things being stepped through, and it puts the "where am I" marker further
 * from the fields than the fields are from each other. Hoist it only if a
 * second column is also sequenced.
 *
 * **The actions end the form rather than pinning a page-wide bar.** Continue
 * advances the column above it, so it closes that column instead of stretching
 * across the summary in a footer. Back and Continue share one row: Back hugs
 * its label, Continue takes the rest, so the forward path is several times the
 * target without either button being a different size from the other.
 *
 * **Nothing on this page overrides a control size.** Buttons and fields all sit
 * at the default, which is what keeps the promo field level with Apply and the
 * quantity stepper level with Remove. Emphasis is carried by width and variant
 * instead — cheaper to keep true than a size scale applied by hand, and a rule
 * you can check: grep for `size=` and only Icons come back.
 *
 * **The summary is derived, never advanced.** Every figure in it reads the same
 * state the form writes, so it updates as the user types rather than on step
 * change. Do not snapshot the total into state on Next.
 *
 * **Below the two-column breakpoint the summary renders first.** A 360px
 * column beside the form would leave neither usable in a narrow host, so the
 * summary becomes a collapsed card before the stepper in both DOM and visual
 * order. The breakpoint follows the width this template actually receives,
 * not the viewport around an embedded preview or application shell.
 *
 * **Payment fields are placeholders, not an integration.** A real checkout
 * mounts a PCI-compliant iframe from the payment provider here; a raw card
 * number input would put your page in scope for PCI DSS. Pay validates these
 * placeholders and records a local completion state so the example has a
 * complete outcome without claiming that a payment was sent.
 *
 * **Keep the step count at four or fewer.** Cart, address, delivery, payment is
 * already the ceiling for how much friction a checkout can carry. Anything else
 * — gift options, promo codes, account creation — belongs inside an existing
 * step as progressive disclosure, not as a fifth step.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Divider} from '@astryxdesign/core/Divider';
import {FieldStatus} from '@astryxdesign/core/FieldStatus';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Icon} from '@astryxdesign/core/Icon';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack, Stack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Step, Stepper} from '@astryxdesign/core/Stepper';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {
  CreditCardIcon,
  LockClosedIcon,
  MapPinIcon,
  ShoppingCartIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import type {View} from '../../../core/src/templates/checkout/model.ts';
import type {TemplateProps} from './props.ts';

// ── Data ──────────────────────────────────────────────────────────────────────
// The steps, cart, options and their wording live in the core (view model). Icons
// are components, so the view names them and this table maps the name.
const STEP_ICONS = {
  cart: ShoppingCartIcon,
  pin: MapPinIcon,
  truck: TruckIcon,
  card: CreditCardIcon,
} as const;

const NARROW_HOST_WIDTH = 900;

// ── Styles ────────────────────────────────────────────────────────────────────
// Plain inline styles over Astryx token CSS variables, so the template compiles
// in a project with no StyleX pipeline.

// The summary column holds its width while the form column takes the rest, and
// pins itself as the form scrolls past — the sticky offset is the page inset,
// so a stuck card sits where an unstuck one would. The narrow summary needs no
// order override because it is rendered before the form in the DOM.
const summaryColumn: CSSProperties = {
  width: 360,
  flexShrink: 0,
  position: 'sticky',
  top: 'var(--spacing-6)',
  alignSelf: 'flex-start',
};

export default function CheckoutWizardPage({view: raw, send}: TemplateProps) {
  const view = raw as View;
  const press = (id: string) => send({type: 'press', id: `tpl.checkout.${id}`});
  const set = (id: string) => (value: string | number | boolean) =>
    send({type: 'set', id: `tpl.checkout.${id}`, value});

  // The responsive variant changes rendered order, not only paint, so measure
  // the host directly. A viewport query would leave an embedded 600px preview
  // in the desktop split whenever the browser window happened to be wide.
  const hostRef = useRef<HTMLElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const attachHost = useCallback((element: HTMLElement | null) => {
    hostRef.current = element;
    if (element && element.clientWidth > 0) {
      setIsNarrow(element.clientWidth <= NARROW_HOST_WIDTH);
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? host.clientWidth;
      if (width > 0) {
        setIsNarrow(width <= NARROW_HOST_WIDTH);
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const currentErrors = view.errors;

  // Navigation queues focus until React has rendered the destination step and
  // its error state. The first aria-invalid control is also the first field in
  // DOM order; grouped controls forward focus to their first usable child.
  const stepContentRef = useRef<HTMLElement | null>(null);
  const handledFocusRef = useRef(view.focusTicket);
  useEffect(() => {
    if (handledFocusRef.current === view.focusTicket) {
      return;
    }
    handledFocusRef.current = view.focusTicket;

    const root = stepContentRef.current;
    const invalid = root?.matches('[aria-invalid="true"]')
      ? root
      : (root?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? null);
    const focusTarget = invalid?.matches(
      'input, button, select, textarea, [tabindex]',
    )
      ? invalid
      : invalid?.querySelector<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        );
    focusTarget?.focus();
  }, [view.focusTicket]);

  // ── Summary ────────────────────────────────────────────────────────────────

  const totalsRows = (
    <VStack gap={2}>
      <HStack hAlign="between" vAlign="center">
        <Text type="body" color="secondary">
          Subtotal
        </Text>
        <Text type="body">{view.summary.subtotal}</Text>
      </HStack>
      {view.summary.promoLabel != null && (
        <HStack hAlign="between" vAlign="center">
          <Text type="body" color="secondary">
            {view.summary.promoLabel}
          </Text>
          <Text type="body">{view.summary.discount}</Text>
        </HStack>
      )}
      <HStack hAlign="between" vAlign="center">
        <Text type="body" color="secondary">
          {view.summary.deliveryLabel}
        </Text>
        <Text type="body">{view.summary.shipping}</Text>
      </HStack>
      <HStack hAlign="between" vAlign="center">
        <Text type="body" color="secondary">
          Estimated tax
        </Text>
        <Text type="body">{view.summary.tax}</Text>
      </HStack>
      <Divider />
      <HStack hAlign="between" vAlign="center">
        <Text type="large" weight="bold">
          Total
        </Text>
        <Text type="large" weight="bold">
          {view.summary.total}
        </Text>
      </HStack>
    </VStack>
  );

  const summaryBody = (
    <VStack gap={4}>
      <VStack gap={3}>
        {view.items.map(item => (
          <HStack key={item.id} gap={3} vAlign="start">
            <Thumbnail src={item.src} alt={item.name} />
            <StackItem size="fill">
              <VStack gap={0.5}>
                <HStack gap={2} hAlign="between" vAlign="start">
                  <Text type="body" weight="medium">
                    {item.name}
                  </Text>
                  <Text type="body" weight="bold">
                    {item.lineTotal}
                  </Text>
                </HStack>
                <Text type="supporting" color="secondary">
                  {item.variant} · Qty {item.qty}
                </Text>
              </VStack>
            </StackItem>
          </HStack>
        ))}
      </VStack>
      <Divider />
      {totalsRows}
      {view.summary.freeShippingTitle != null && (
        <Banner
          status="info"
          icon={<Icon icon={TruckIcon} size="sm" />}
          title={view.summary.freeShippingTitle}
        />
      )}
    </VStack>
  );

  // One card, two shapes. Beside the form it is open and titled; stacked above
  // it, the title row becomes the Collapsible trigger and carries the total,
  // because that is the one line worth the vertical space when it is closed.
  const summaryCard = (
    <Card padding={5}>
      {isNarrow ? (
        <Collapsible
          trigger={view.summary.trigger}
          defaultIsOpen={false}>
          <VStack paddingBlockStart={3}>{summaryBody}</VStack>
        </Collapsible>
      ) : (
        <VStack gap={4}>
          <HStack gap={2} vAlign="center" hAlign="between">
            <Text type="label">Order summary</Text>
            <Badge
              variant="neutral"
              label={view.summary.itemCount}
            />
          </HStack>
          {summaryBody}
        </VStack>
      )}
    </Card>
  );

  // ── Form column furniture ──────────────────────────────────────────────────

  // One stepper at every width. It collapses itself once the column is too
  // narrow to label four steps — bars and a named current step, with the
  // controls its `onStepClick` earns — so there is nothing here to swap.
  const progress = (
    <Stepper
      activeStep={view.step}
      orientation="horizontal"
      onStepClick={index => press(`goto:${index}`)}
      label="Checkout progress"
      density="balanced">
      {view.steps.map(({label, icon, hasError}, i) => {
        return (
          <Step
            key={label}
            step={i}
            label={label}
            // Icons rather than the default badge, and the semantic `error`
            // glyph in place of the step's own when the step is blocked — the
            // same one FieldStatus puts beside the field that caused it, so a
            // problem looks the same wherever the eye lands first. Left
            // uncoloured on purpose: Icon inherits, so `status` tints it and
            // the indicator is never told it is an error twice.
            indicator={<Icon icon={hasError ? 'error' : STEP_ICONS[icon]} size="sm" />}
            status={hasError ? 'error' : undefined}
          />
        );
      })}
    </Stepper>
  );

  const actions = (
    // The count summarises rather than quoting a field's message, so a blocked
    // step never shows the same sentence in two places, and it sits above the
    // row rather than inside it — in the row it would compete with Continue for
    // the same horizontal space.
    <VStack gap={3} hAlign="start">
      {view.actions.blocked != null && (
        <FieldStatus
          type="error"
          variant="detached"
          message={view.actions.blocked}
        />
      )}
      {/* Back hugs its label and Continue takes everything left over, so the
          forward path is the wider target without either button changing size.
          Every control on this page is the default size; emphasis here comes
          from width, which is the axis the row has to spare. */}
      <HStack gap={3} vAlign="center" width="100%">
        <Button
          label={view.actions.backLabel}
          variant="secondary"
          onClick={() => press('back')}
        />
        <StackItem size="fill">
          <Button
            label={view.actions.nextLabel}
            variant="primary"
            width="100%"
            onClick={() => press('next')}
          />
        </StackItem>
      </HStack>
    </VStack>
  );

  return (
    <Layout
      height="fill"
      // One inset owner and one cap. The title row, the stepper, the fields,
      // the actions and the summary card all measure from this padding and
      // this width, which is what keeps "Checkout", "Review your cart" and
      // "Continue" on the same content line.
      padding={6}
      contentWidth={1000}
      content={
        <LayoutContent>
          <VStack ref={attachHost} gap={6}>
            <HStack gap={3} vAlign="center">
              <StackItem size="fill">
                <Heading level={1}>Checkout</Heading>
              </StackItem>
              <HStack gap={1.5} vAlign="center">
                <Icon icon={LockClosedIcon} size="sm" color="secondary" />
                <Text type="supporting" color="secondary">
                  Secure checkout
                </Text>
              </HStack>
            </HStack>

            <Stack
              direction={isNarrow ? 'vertical' : 'horizontal'}
              gap={6}
              vAlign="start">
              {/* When stacked, summary comes first in DOM as well as visual and
                  keyboard order. */}
              {isNarrow && <StackItem>{summaryCard}</StackItem>}

              {/* The form column owns the sequence end to end: progress at the
                  top, the step in the middle, the way out at the bottom. */}
              <StackItem size="fill">
                <VStack gap={6}>
                  {view.isComplete ? (
                    <VStack gap={4}>
                      <Banner
                        status="success"
                        title="Order confirmed"
                        description={view.confirmation}
                      />
                      <Heading level={2}>Thanks for your order</Heading>
                      <Text type="body" color="secondary">
                        The completion is stored in this page's component state
                        so the template ends in a real, reviewable outcome.
                      </Text>
                    </VStack>
                  ) : (
                    progress
                  )}

                  {!view.isComplete && view.step === 0 && (
                    <VStack
                      ref={stepContentRef}
                      gap={5}
                      aria-invalid={currentErrors.items ? true : undefined}
                      tabIndex={-1}>
                      <Heading level={2}>Review your cart</Heading>
                      <VStack gap={4}>
                        {view.items.map(item => (
                          <VStack key={item.id} gap={3}>
                            <HStack gap={4} vAlign="start" wrap="wrap">
                              <Thumbnail src={item.src} alt={item.name} />
                              <StackItem size="fill">
                                <VStack gap={1}>
                                  <HStack
                                    gap={2}
                                    hAlign="between"
                                    vAlign="start">
                                    <HStack gap={2} vAlign="center" wrap="wrap">
                                      <Text type="body" weight="medium">
                                        {item.name}
                                      </Text>
                                      {item.isLimited && (
                                        <Badge
                                          variant="green"
                                          label="Limited"
                                        />
                                      )}
                                    </HStack>
                                    <Text type="body" weight="bold">
                                      {item.lineTotal}
                                    </Text>
                                  </HStack>
                                  <Text type="supporting" color="secondary">
                                    {item.variant} · {item.priceEach} each
                                  </Text>
                                  <HStack gap={2} vAlign="center">
                                    {/* Steppers on, because a quantity is
                                        adjusted far more often than it is
                                        typed. Without them the field reads as
                                        a text box that happens to hold a
                                        number, and going 1 → 2 costs a
                                        selection and a keystroke. */}
                                    <NumberInput
                                      label={`Quantity of ${item.name}`}
                                      isLabelHidden
                                      value={item.qty}
                                      onChange={set(`qty:${item.id}`)}
                                      min={0}
                                      max={10}
                                      isIntegerOnly
                                      hasNumberSteppers
                                      // Sized for two digits and the steppers,
                                      // not for the column. A quantity field
                                      // as wide as the row reads as somewhere
                                      // to type a sentence.
                                      width={96}
                                    />
                                    <Button
                                      label="Remove"
                                      variant="ghost"
                                      onClick={() => press(`remove:${item.id}`)}
                                    />
                                  </HStack>
                                </VStack>
                              </StackItem>
                            </HStack>
                            <Divider />
                          </VStack>
                        ))}
                      </VStack>
                      {currentErrors.items && (
                        <FieldStatus
                          type="error"
                          variant="detached"
                          message={currentErrors.items}
                        />
                      )}
                      {/* vAlign="end" puts the button on the input's baseline
                    rather than the label's, so the row does not step down
                    when the status message appears under the field. */}
                      <HStack gap={2} vAlign="end">
                        <StackItem size="fill">
                          <TextInput
                            label="Promo code"
                            value={view.promo.value}
                            onChange={set('promo')}
                            placeholder="WELCOME10"
                            status={view.promo.status ?? undefined}
                          />
                        </StackItem>
                        <Button
                          label="Apply"
                          variant="secondary"
                          onClick={() => press('apply')}
                        />
                      </HStack>
                    </VStack>
                  )}

                  {!view.isComplete && view.step === 1 && (
                    <VStack ref={stepContentRef} gap={5}>
                      <VStack gap={1}>
                        <Heading level={2}>Where should it go?</Heading>
                        <Text type="supporting" color="secondary">
                          Delivery options and tax are calculated from this
                          address.
                        </Text>
                      </VStack>
                      {/* An address form is the canonical FormLayout case: a
                    vertical run with horizontal nests where fields genuinely
                    pair. `defaultOptionality="required"` inverts the marking
                    — a checkout asks for everything, so the exception worth
                    a badge is the one line you can skip. */}
                      <FormLayout defaultOptionality="required">
                        <TextInput
                          label="Email"
                          value={view.shipping.email}
                          onChange={set('email')}
                          placeholder="you@example.com"
                          description="Order confirmation and tracking go here."
                          status={
                            currentErrors.email
                              ? {type: 'error', message: currentErrors.email}
                              : undefined
                          }
                        />
                        <FormLayout
                          direction={isNarrow ? 'vertical' : 'horizontal'}
                          defaultOptionality="required">
                          <TextInput
                            label="First name"
                            value={view.shipping.firstName}
                            onChange={set('firstName')}
                            status={
                              currentErrors.firstName
                                ? {
                                    type: 'error',
                                    message: currentErrors.firstName,
                                  }
                                : undefined
                            }
                          />
                          <TextInput
                            label="Last name"
                            value={view.shipping.lastName}
                            onChange={set('lastName')}
                            status={
                              currentErrors.lastName
                                ? {
                                    type: 'error',
                                    message: currentErrors.lastName,
                                  }
                                : undefined
                            }
                          />
                        </FormLayout>
                        <Selector
                          label="Country"
                          options={view.shipping.countries}
                          value={view.shipping.country}
                          onChange={set('country')}
                        />
                        <TextInput
                          label="Street address"
                          value={view.shipping.address}
                          onChange={set('address')}
                          placeholder="123 Main Street"
                          status={
                            currentErrors.address
                              ? {
                                  type: 'error',
                                  message: currentErrors.address,
                                }
                              : undefined
                          }
                        />
                        <TextInput
                          label="Apartment, suite, etc."
                          isOptional
                          value={view.shipping.apartment}
                          onChange={set('apartment')}
                        />
                        <FormLayout
                          direction={isNarrow ? 'vertical' : 'horizontal'}
                          defaultOptionality="required">
                          <TextInput
                            label="City"
                            value={view.shipping.city}
                            onChange={set('city')}
                            status={
                              currentErrors.city
                                ? {type: 'error', message: currentErrors.city}
                                : undefined
                            }
                          />
                          {view.shipping.hasState && (
                            <Selector
                              label="State"
                              placeholder="Select state"
                              options={view.shipping.states}
                              value={view.shipping.state}
                              onChange={set('state')}
                              hasSearch
                              status={
                                currentErrors.state
                                  ? {
                                      type: 'error',
                                      message: currentErrors.state,
                                    }
                                  : undefined
                              }
                            />
                          )}
                          <TextInput
                            label={view.shipping.postalLabel}
                            value={view.shipping.postalCode}
                            onChange={set('postalCode')}
                            placeholder={view.shipping.postalPlaceholder}
                            status={
                              currentErrors.postalCode
                                ? {
                                    type: 'error',
                                    message: currentErrors.postalCode,
                                  }
                                : undefined
                            }
                          />
                        </FormLayout>
                      </FormLayout>
                    </VStack>
                  )}

                  {!view.isComplete && view.step === 2 && (
                    <VStack ref={stepContentRef} gap={5}>
                      <VStack gap={1}>
                        <Heading level={2}>How fast do you need it?</Heading>
                        <Text type="supporting" color="secondary">
                          Estimates run from the day the order ships, usually
                          1–3 business days after you place it.
                        </Text>
                      </VStack>
                      <FormLayout defaultOptionality="required">
                        <RadioList
                          label="Delivery method"
                          value={view.delivery.value}
                          onChange={set('delivery')}
                          status={
                            currentErrors.delivery
                              ? {
                                  type: 'error',
                                  message: currentErrors.delivery,
                                }
                              : undefined
                          }>
                          {view.delivery.options.map(option => (
                            <RadioListItem
                              key={option.value}
                              value={option.value}
                              label={option.label}
                              description={option.window}
                              endContent={
                                <Text type="body" weight="medium">
                                  {option.price}
                                </Text>
                              }
                            />
                          ))}
                        </RadioList>
                        <Divider />
                        <CheckboxInput
                          label="This is a gift"
                          value={view.delivery.isGift}
                          onChange={set('isGift')}
                        />
                        <TextArea
                          label={view.delivery.noteLabel}
                          isOptional
                          rows={3}
                          maxLength={240}
                          value={view.delivery.note}
                          onChange={set('deliveryNote')}
                          placeholder={view.delivery.notePlaceholder}
                          description={view.delivery.noteDescription}
                        />
                      </FormLayout>
                    </VStack>
                  )}

                  {!view.isComplete && view.step === 3 && (
                    <VStack ref={stepContentRef} gap={5}>
                      <VStack gap={1}>
                        <Heading level={2}>Payment</Heading>
                        <Text type="supporting" color="secondary">
                          This template validates payment details and completes
                          locally. No card is charged.
                        </Text>
                      </VStack>
                      <FormLayout defaultOptionality="required">
                        <TextInput
                          label="Card number"
                          value={view.payment.cardNumber}
                          onChange={set('cardNumber')}
                          placeholder="4242 4242 4242 4242"
                          startIcon={LockClosedIcon}
                          status={
                            currentErrors.cardNumber
                              ? {
                                  type: 'error',
                                  message: currentErrors.cardNumber,
                                }
                              : undefined
                          }
                        />
                        <TextInput
                          label="Name on card"
                          value={view.payment.cardName}
                          onChange={set('cardName')}
                          status={
                            currentErrors.cardName
                              ? {
                                  type: 'error',
                                  message: currentErrors.cardName,
                                }
                              : undefined
                          }
                        />
                        {/* The one row that does not stretch. A horizontal
                      FormLayout would give MM/YY and three digits half the
                      form each, which reads as a mistake — short
                      fixed-length values stay short, so these two get sized
                      rather than divided. */}
                        <HStack gap={4} wrap="wrap">
                          <TextInput
                            label="Expiry"
                            width={140}
                            value={view.payment.expiry}
                            onChange={set('expiry')}
                            placeholder="MM/YY"
                            status={
                              currentErrors.expiry
                                ? {
                                    type: 'error',
                                    message: currentErrors.expiry,
                                  }
                                : undefined
                            }
                          />
                          <TextInput
                            label="CVC"
                            width={140}
                            value={view.payment.cvc}
                            onChange={set('cvc')}
                            placeholder="123"
                            labelTooltip="Three digits on the back of the card, or four on the front for American Express."
                            status={
                              currentErrors.cvc
                                ? {type: 'error', message: currentErrors.cvc}
                                : undefined
                            }
                          />
                        </HStack>
                        <Divider />
                        <CheckboxInput
                          label="Billing address matches the shipping address"
                          value={view.payment.billingMatches}
                          onChange={set('billingMatches')}
                        />
                        {!view.payment.billingMatches && (
                          <Banner
                            status="info"
                            title="Connect a billing-address step"
                            description="This local example does not collect a separate billing address or send payment. Add that flow with your payment provider."
                          />
                        )}
                      </FormLayout>
                    </VStack>
                  )}

                  {!view.isComplete && actions}
                </VStack>
              </StackItem>

              {/* Sticky beside the form on wide hosts only. */}
              {!isNarrow && (
                <StackItem style={summaryColumn}>{summaryCard}</StackItem>
              )}
            </Stack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
