"use client";

import { FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderLabels } from "./order-labels";
import type { DiscountTypeChoice } from "./order-lines";

export interface OrderDiscountFieldsProps {
  /** Prefix for the element ids, so the new-order page and the edit sheet never share ids. */
  readonly idPrefix: string;
  readonly labels: OrderLabels;
  readonly type: DiscountTypeChoice;
  readonly text: string;
  readonly isInvalid: boolean;
  readonly disabled: boolean;
  readonly onChange: (next: { type: DiscountTypeChoice; text: string }) => void;
}

/** The whole-order discount: a kind (none, percent, amount) and its value. */
export function OrderDiscountFields(props: OrderDiscountFieldsProps): ReactElement {
  const { labels } = props;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label={labels.newOrder.orderDiscount} htmlFor={`${props.idPrefix}-discount-type`}>
        <Select
          id={`${props.idPrefix}-discount-type`}
          value={props.type}
          disabled={props.disabled}
          onChange={(event) => {
            const type = event.target.value as DiscountTypeChoice;
            props.onChange({ type, text: type === "NONE" ? "" : props.text });
          }}
        >
          <option value="NONE">{labels.line.discountNone}</option>
          <option value="PERCENT">{labels.line.discountPercent}</option>
          <option value="AMOUNT">{labels.line.discountAmount}</option>
        </Select>
      </FormField>
      {props.type === "NONE" ? null : (
        <FormField
          label={labels.line.discountValue}
          htmlFor={`${props.idPrefix}-discount-value`}
          {...(props.isInvalid ? { error: labels.line.discountInvalid } : {})}
        >
          <TextInput
            id={`${props.idPrefix}-discount-value`}
            inputMode="decimal"
            value={props.text}
            disabled={props.disabled}
            onChange={(event) => props.onChange({ type: props.type, text: event.target.value })}
          />
        </FormField>
      )}
    </div>
  );
}
