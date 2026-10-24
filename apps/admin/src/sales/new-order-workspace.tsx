"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import { FULFILLMENT_METHOD, type FulfillmentMethod } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import {
  Button,
  ContactLinkInput,
  FormField,
  PageLayout,
  PageSection,
  Select,
  StickyActionBar,
  Textarea,
  type DisplayLocale,
} from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { LazyOrderQuotePanel } from "./lazy-order-quote-panel";
import { OrderApprovalDialog } from "./order-approval";
import { searchContactChoices } from "./order-contact";
import { OrderDiscountFields } from "./order-discount-fields";
import type { OrderLabels } from "./order-labels";
import { OrderLinesEditor } from "./order-lines-editor";
import { emptyOrderLine } from "./order-lines";
import { useNewOrderForm, type NewOrderForm } from "./use-new-order-form";

const FULFILLMENT_CHOICES: readonly FulfillmentMethod[] = [
  FULFILLMENT_METHOD.PICKUP,
  FULFILLMENT_METHOD.INSTANT,
];

export interface NewOrderWorkspaceProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly locations: readonly { readonly locationId: string; readonly name: string }[];
  readonly modifierGroups: readonly ModifierGroupResponse[];
  readonly unitLabels: Readonly<Record<string, string>>;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: OrderLabels;
}

type SectionProps = NewOrderWorkspaceProps & { readonly form: NewOrderForm };

function ignoreQuote(): void {
  // The panel owns the display; the submit actions take a fresh quote for the approval amount.
}

function WhereAndWho(props: SectionProps): ReactElement {
  const { form, labels } = props;
  return (
    <PageSection title={labels.newOrder.title}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label={labels.newOrder.location} htmlFor="order-location" required>
          <Select
            id="order-location"
            value={form.values.locationId}
            disabled={form.isSaving}
            onChange={(event) => form.setValues({ locationId: event.target.value })}
          >
            {props.locations.map((location) => (
              <option key={location.locationId} value={location.locationId}>
                {location.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={labels.newOrder.fulfillment} htmlFor="order-fulfillment">
          <Select
            id="order-fulfillment"
            value={form.values.fulfillment}
            disabled={form.isSaving}
            onChange={(event) =>
              form.setValues({ fulfillment: event.target.value as FulfillmentMethod })
            }
          >
            {FULFILLMENT_CHOICES.map((method) => (
              <option key={method} value={method}>
                {labels.fulfillment[method]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        label={labels.newOrder.contact}
        htmlFor="order-contact"
        hint={labels.newOrder.contactHint}
      >
        <ContactLinkInput
          id="order-contact"
          value={form.values.contact}
          onChange={(contact) => form.setValues({ contact })}
          search={(text) => searchContactChoices(props.organizationId, text, form.contactNames)}
          nameOf={(contactId) => form.contactNames.get(contactId)}
          labels={labels.contact}
          disabled={form.isSaving}
        />
      </FormField>
    </PageSection>
  );
}

function LinesAndDiscount(props: SectionProps): ReactElement {
  const { form, labels } = props;
  const { values } = form;
  return (
    <PageSection
      title={labels.newOrder.lines}
      action={
        <Button
          variant="secondary"
          disabled={form.isSaving}
          onClick={() => form.setValues({ lines: [...values.lines, emptyOrderLine(newId())] })}
        >
          {labels.newOrder.addLine}
        </Button>
      }
    >
      <OrderLinesEditor
        organizationId={props.organizationId}
        lines={values.lines}
        modifierGroups={props.modifierGroups}
        unitLabels={props.unitLabels}
        currency={props.currency}
        locale={props.locale}
        labels={labels.line}
        disabled={form.isSaving}
        onChange={(lines) => form.setValues({ lines })}
      />
      <OrderDiscountFields
        idPrefix="order"
        labels={labels}
        type={values.discountType}
        text={values.discountText}
        isInvalid={form.discountInvalid}
        disabled={form.isSaving}
        onChange={(next) => form.setValues({ discountType: next.type, discountText: next.text })}
      />
      <FormField label={labels.newOrder.note} htmlFor="order-note">
        <Textarea
          id="order-note"
          value={values.note}
          disabled={form.isSaving}
          onChange={(event) => form.setValues({ note: event.target.value })}
        />
      </FormField>
    </PageSection>
  );
}

function SubmitActions(props: SectionProps): ReactElement {
  const { form, labels } = props;
  if (form.createdOrder !== undefined) {
    const createdId = form.createdOrder.orderId;
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          disabled={form.isSaving}
          onClick={() => form.openOrder(createdId)}
        >
          {labels.newOrder.openDraft}
        </Button>
      </div>
    );
  }
  return (
    <StickyActionBar label={labels.detail.actionsTitle}>
      <Button variant="secondary" isLoading={form.isSaving} onClick={() => void form.saveDraft()}>
        {labels.newOrder.saveDraft}
      </Button>
      <Button
        isLoading={form.isSaving}
        onClick={() => void (form.isInstant ? form.completeInstant() : form.place())}
      >
        {form.isInstant ? labels.newOrder.complete : labels.newOrder.place}
      </Button>
    </StickyActionBar>
  );
}

/** A new order: contact, products in their units, discounts, a live quote and the chosen fulfillment. */
export function NewOrderWorkspace(props: NewOrderWorkspaceProps): ReactElement {
  const { labels } = props;
  const form = useNewOrderForm(props);
  const sectionProps = { ...props, form };
  return (
    <PageLayout
      title={labels.newOrder.title}
      subtitle={labels.newOrder.subtitle}
      actions={
        <Link
          href={`/${props.orgSlug}/orders`}
          className="inline-flex min-h-11 items-center text-body text-brand"
        >
          {labels.newOrder.back}
        </Link>
      }
    >
      <WhereAndWho {...sectionProps} />
      <LinesAndDiscount {...sectionProps} />
      {form.lineInputs.length > 0 ? (
        <LazyOrderQuotePanel
          organizationId={props.organizationId}
          locationId={form.values.locationId}
          lines={form.lineInputs}
          orderDiscount={form.discountInvalid ? undefined : form.orderDiscount}
          currency={props.currency}
          locale={props.locale}
          labels={labels.quote}
          onQuote={ignoreQuote}
        />
      ) : null}
      {form.errorMessage ? (
        <p role="alert" className="text-body text-danger">
          {form.errorMessage}
        </p>
      ) : null}
      <SubmitActions {...sectionProps} />
      <OrderApprovalDialog flow={form.approval} labels={labels.approval} />
    </PageLayout>
  );
}
