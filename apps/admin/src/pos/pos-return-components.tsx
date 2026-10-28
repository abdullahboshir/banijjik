"use client";

import {
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesReturnReason,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import {
  Button,
  FormField,
  formatMoney,
  Select,
  TextInput,
  Textarea,
  type DisplayLocale,
} from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PosLabels } from "./pos-labels";
export function OrderChoices(props: {
  readonly orders: readonly OrderResponse[];
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly onChoose: (order: OrderResponse) => void;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {props.orders.map((order) => (
        <li key={order.orderId}>
          <Button
            variant="secondary"
            className="min-h-14 w-full justify-between"
            onClick={() => props.onChoose(order)}
          >
            <span>{order.invoiceNumber ?? order.orderNumber ?? order.orderId}</span>
            <span>{formatMoney(order.totals.grandTotal, { locale: props.locale })}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function pickedLinesOf(
  order: OrderResponse,
  quantities: Readonly<Record<string, number>>,
): {
  orderLineId: string;
  quantity: number;
  disposition: typeof RETURN_DISPOSITION.RESTOCK;
}[] {
  return order.lines.flatMap((line) => {
    const quantity = quantities[line.orderLineId] ?? 0;
    if (quantity <= 0) return [];
    return [{ orderLineId: line.orderLineId, quantity, disposition: RETURN_DISPOSITION.RESTOCK }];
  });
}

function ReturnOrderLines(props: {
  readonly order: OrderResponse;
  readonly quantities: Readonly<Record<string, number>>;
  readonly labels: PosLabels;
  readonly onQuantity: (orderLineId: string, quantity: number) => void;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {props.order.lines.map((line) => {
        const remaining = Math.max(0, line.quantity - line.returnedQuantity);
        return (
          <li
            key={line.orderLineId}
            className="flex items-center justify-between gap-2 rounded-md border border-default p-3"
          >
            <span className="min-w-0 truncate">{line.nameSnapshot}</span>
            <FormField
              label={props.labels.till.returnQuantity}
              htmlFor={`return-${line.orderLineId}`}
            >
              <TextInput
                id={`return-${line.orderLineId}`}
                type="number"
                min={0}
                max={remaining}
                step={1}
                inputMode="numeric"
                className="min-h-14 w-24"
                value={props.quantities[line.orderLineId] ?? 0}
                onChange={(event) =>
                  props.onQuantity(
                    line.orderLineId,
                    Math.max(0, Math.min(remaining, Number(event.target.value))),
                  )
                }
              />
            </FormField>
          </li>
        );
      })}
    </ul>
  );
}

export function ReturnResult(props: {
  readonly result: SalesReturnResponse;
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <p role="status">{props.labels.till.returnSuccess}</p>
      <p>
        {props.labels.till.refundAmount}:{" "}
        {formatMoney(props.result.refund.amount, { locale: props.locale })}
      </p>
      <Button className="min-h-14" onClick={props.onClose}>
        {props.labels.till.approvalClose}
      </Button>
    </div>
  );
}

export function ReturnSearchPanel(props: {
  readonly query: string;
  readonly orders: readonly OrderResponse[];
  readonly failure: boolean;
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly onQueryChange: (value: string) => void;
  readonly onFind: () => void;
  readonly onChoose: (order: OrderResponse) => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <FormField label={props.labels.till.orderSearch} htmlFor="pos-return-order">
        <TextInput
          id="pos-return-order"
          className="min-h-14"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
        />
      </FormField>
      <Button className="min-h-14" onClick={props.onFind}>
        {props.labels.till.findOrder}
      </Button>
      {props.failure ? <p role="alert">{props.labels.till.returnFailed}</p> : null}
      {props.orders.length === 0 ? <p>{props.labels.till.noOrders}</p> : null}
      <OrderChoices
        orders={props.orders}
        labels={props.labels}
        locale={props.locale}
        onChoose={props.onChoose}
      />
    </div>
  );
}

export function SelectedReturnPanel(props: {
  readonly order: OrderResponse;
  readonly quantities: Readonly<Record<string, number>>;
  readonly reason: SalesReturnReason;
  readonly note: string;
  readonly pending: boolean;
  readonly labels: PosLabels;
  readonly onSelectOrder: () => void;
  readonly onQuantity: (orderLineId: string, quantity: number) => void;
  readonly onReason: (reason: SalesReturnReason) => void;
  readonly onNote: (note: string) => void;
  readonly onSubmit: () => void;
}): ReactElement {
  const hasLines = pickedLinesOf(props.order, props.quantities).length > 0;
  const needsNote = props.reason === SALES_RETURN_REASON.OTHER && props.note.trim() === "";
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" className="min-h-14" onClick={props.onSelectOrder}>
        {props.labels.till.returnSelect}: {props.order.orderNumber ?? props.order.orderId}
      </Button>
      <ReturnOrderLines
        order={props.order}
        quantities={props.quantities}
        labels={props.labels}
        onQuantity={props.onQuantity}
      />
      <ReturnReasonFields
        reason={props.reason}
        note={props.note}
        labels={props.labels}
        onReason={props.onReason}
        onNote={props.onNote}
      />
      <Button
        className="min-h-14"
        isLoading={props.pending}
        disabled={!hasLines || needsNote}
        onClick={props.onSubmit}
      >
        {props.labels.till.returnSubmit}
      </Button>
    </div>
  );
}

function ReturnReasonFields(props: {
  readonly reason: SalesReturnReason;
  readonly note: string;
  readonly labels: PosLabels;
  readonly onReason: (reason: SalesReturnReason) => void;
  readonly onNote: (note: string) => void;
}): ReactElement {
  return (
    <>
      <FormField label={props.labels.till.returnReason} htmlFor="pos-return-reason">
        <Select
          id="pos-return-reason"
          className="min-h-14"
          value={props.reason}
          onChange={(event) => props.onReason(event.target.value as SalesReturnReason)}
        >
          <option value={SALES_RETURN_REASON.CHANGED_MIND}>
            {props.labels.till.returnReasonChangedMind}
          </option>
          <option value={SALES_RETURN_REASON.DEFECTIVE}>
            {props.labels.till.returnReasonDefective}
          </option>
          <option value={SALES_RETURN_REASON.WRONG_ITEM}>
            {props.labels.till.returnReasonWrongItem}
          </option>
          <option value={SALES_RETURN_REASON.NOT_AS_DESCRIBED}>
            {props.labels.till.returnReasonNotAsDescribed}
          </option>
          <option value={SALES_RETURN_REASON.NOT_DELIVERED}>
            {props.labels.till.returnReasonNotDelivered}
          </option>
          <option value={SALES_RETURN_REASON.OTHER}>{props.labels.till.returnReasonOther}</option>
        </Select>
      </FormField>
      {props.reason === SALES_RETURN_REASON.OTHER ? (
        <FormField label={props.labels.till.returnNote} htmlFor="pos-return-note">
          <Textarea
            id="pos-return-note"
            className="min-h-14"
            value={props.note}
            onChange={(event) => props.onNote(event.target.value)}
          />
        </FormField>
      ) : null}
    </>
  );
}

/** Search and return a completed till sale for cash; retrying the same request reuses its key. */
