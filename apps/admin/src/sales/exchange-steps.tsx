"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import {
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesReturnReason,
} from "@banijjik/contracts/sales";
import { Button, Checkbox, FormField, Select, Textarea, type DisplayLocale } from "@banijjik/ui";
import { newId } from "@banijjik/ids";
import type { ReactElement } from "react";
import { LazyOrderQuotePanel } from "./lazy-order-quote-panel";
import type { OrderLabels } from "./order-labels";
import { OrderLinesEditor } from "./order-lines-editor";
import { OrderDiscountFields } from "./order-discount-fields";
import {
  emptyOrderLine,
  lineInputsOfDrafts,
  parseManualDiscount,
  type OrderLineDraft,
} from "./order-lines";
import { ReturnLineCard } from "./return-line-card";
import type { ReturnLabels } from "./return-labels";
import type { ReturnFormState } from "./use-return-sheet";
import type { ExchangeDiscountDraft, ExchangeFormActions } from "./use-exchange-sheet";

const REASONS = Object.values(SALES_RETURN_REASON);

export interface ExchangeStepSharedProps {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly labels: ReturnLabels;
  readonly orderLabels: OrderLabels;
  readonly actions: ExchangeFormActions;
}

/** Step 1: the goods that come back. The line cards are the return sheet's own (plan B2 reuses B). */
export function ExchangeReturnStep(
  props: ExchangeStepSharedProps & {
    readonly returns: ReturnFormState;
    readonly needsNote: boolean;
  },
): ReactElement {
  const { returns, labels, actions } = props;
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {returns.drafts.map((draft) => (
          <ReturnLineCard
            key={draft.orderLineId}
            draft={draft}
            labels={labels}
            actions={actions.returns}
          />
        ))}
      </ul>
      <Checkbox
        label={labels.sheet.deliveryCharge}
        checked={returns.returnDeliveryCharge}
        onChange={(event) => actions.returns.setReturnDeliveryCharge(event.target.checked)}
      />
      <ExchangeReasonFields
        labels={labels}
        reasonKey={returns.reasonKey}
        note={returns.note}
        needsNote={props.needsNote}
        onReason={actions.returns.setReasonKey}
        onNote={actions.returns.setNote}
      />
    </div>
  );
}

function ExchangeReasonFields(props: {
  readonly labels: ReturnLabels;
  readonly reasonKey: SalesReturnReason | undefined;
  readonly note: string;
  readonly needsNote: boolean;
  readonly onReason: (reason: SalesReturnReason | undefined) => void;
  readonly onNote: (note: string) => void;
}): ReactElement {
  const { labels } = props;
  return (
    <>
      <FormField label={labels.sheet.reason} htmlFor="exchange-return-reason" required>
        <Select
          id="exchange-return-reason"
          value={props.reasonKey ?? ""}
          onChange={(event) =>
            props.onReason(
              event.target.value === "" ? undefined : (event.target.value as SalesReturnReason),
            )
          }
        >
          <option value="">{labels.sheet.reason}</option>
          {REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {labels.reasons[reason]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label={labels.sheet.note}
        htmlFor="exchange-return-note"
        {...(props.needsNote ? { error: labels.sheet.noteRequired } : {})}
      >
        <Textarea
          id="exchange-return-note"
          value={props.note}
          onChange={(event) => props.onNote(event.target.value)}
        />
      </FormField>
    </>
  );
}

/** The whole-order discount and the order note of the new order (the same fields as the order screen). */
function ExchangeOrderFields(props: {
  readonly orderLabels: OrderLabels;
  readonly discount: ExchangeDiscountDraft;
  readonly orderNote: string;
  readonly actions: ExchangeFormActions;
}): ReactElement {
  const discountInvalid =
    props.discount.type !== "NONE" &&
    parseManualDiscount(props.discount.type, props.discount.text) === undefined;
  return (
    <>
      <OrderDiscountFields
        idPrefix="exchange"
        labels={props.orderLabels}
        type={props.discount.type}
        text={props.discount.text}
        isInvalid={discountInvalid}
        disabled={false}
        onChange={props.actions.setDiscount}
      />
      <FormField label={props.orderLabels.newOrder.note} htmlFor="exchange-order-note">
        <Textarea
          id="exchange-order-note"
          value={props.orderNote}
          onChange={(event) => props.actions.setOrderNote(event.target.value)}
        />
      </FormField>
    </>
  );
}

/** The new lines: the add button and the instant sale's own line editor (plan 3.5b B2 reuses it). */
function ExchangeLinesFields(props: {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly lines: readonly OrderLineDraft[];
  readonly orderLabels: OrderLabels;
  readonly modifierGroups: readonly ModifierGroupResponse[];
  readonly unitLabels: Readonly<Record<string, string>>;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly performersEnabled: boolean;
  readonly actions: ExchangeFormActions;
}): ReactElement {
  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => props.actions.setLines([...props.lines, emptyOrderLine(newId())])}
        >
          {props.orderLabels.newOrder.addLine}
        </Button>
      </div>
      <OrderLinesEditor
        organizationId={props.organizationId}
        performers={
          props.performersEnabled
            ? { locationId: props.order.locationId, labels: props.orderLabels.line }
            : undefined
        }
        lines={props.lines}
        modifierGroups={props.modifierGroups}
        unitLabels={props.unitLabels}
        currency={props.currency}
        locale={props.locale}
        labels={props.orderLabels.line}
        disabled={false}
        onChange={props.actions.setLines}
      />
    </>
  );
}

/** Step 2: the new goods, with the instant sale's own line editor and its live quote. */
export function ExchangeNewLinesStep(
  props: ExchangeStepSharedProps & {
    readonly lines: readonly OrderLineDraft[];
    readonly discount: ExchangeDiscountDraft;
    readonly orderNote: string;
    readonly currency: CurrencyCode;
    readonly locale: DisplayLocale;
    readonly modifierGroups: readonly ModifierGroupResponse[];
    readonly unitLabels: Readonly<Record<string, string>>;
    readonly performersEnabled: boolean;
  },
): ReactElement {
  const lineInputs = lineInputsOfDrafts(props.lines);
  const orderDiscount = parseManualDiscount(props.discount.type, props.discount.text);
  return (
    <div className="flex flex-col gap-4">
      <ExchangeLinesFields
        organizationId={props.organizationId}
        order={props.order}
        lines={props.lines}
        orderLabels={props.orderLabels}
        modifierGroups={props.modifierGroups}
        unitLabels={props.unitLabels}
        currency={props.currency}
        locale={props.locale}
        performersEnabled={props.performersEnabled}
        actions={props.actions}
      />
      <ExchangeOrderFields
        orderLabels={props.orderLabels}
        discount={props.discount}
        orderNote={props.orderNote}
        actions={props.actions}
      />
      {lineInputs.length === 0 ? null : (
        <LazyOrderQuotePanel
          organizationId={props.organizationId}
          locationId={props.order.locationId}
          lines={lineInputs}
          orderDiscount={orderDiscount}
          currency={props.currency}
          locale={props.locale}
          labels={props.orderLabels.quote}
          onQuote={() => undefined}
        />
      )}
    </div>
  );
}
