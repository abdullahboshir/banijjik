"use client";

import { ACCEPTED_PAYMENT_METHODS, type PaymentMethod } from "@banijjik/contracts/payment";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";

export interface RefundMethodFieldsProps {
  readonly method: PaymentMethod;
  readonly isMobileMoney: boolean;
  readonly externalReference: string;
  readonly disabled: boolean;
  readonly methodLabel: string;
  readonly referenceLabel: string;
  readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
  readonly onMethodChange: (method: PaymentMethod) => void;
  readonly onReferenceChange: (reference: string) => void;
}

/** The refund method, and the reference field a mobile-money refund needs. */
export function RefundMethodAndRefFields(props: RefundMethodFieldsProps): ReactElement {
  const {
    method,
    isMobileMoney,
    externalReference,
    disabled,
    methodLabel,
    referenceLabel,
    methodLabels,
    onMethodChange,
    onReferenceChange,
  } = props;
  return (
    <>
      <FormField label={methodLabel} htmlFor="refund-method">
        <Select
          id="refund-method"
          value={method}
          onChange={(e) => onMethodChange(e.target.value as PaymentMethod)}
          disabled={disabled}
        >
          {ACCEPTED_PAYMENT_METHODS.map((accepted) => (
            <option key={accepted} value={accepted}>
              {methodLabels[accepted] ?? accepted}
            </option>
          ))}
        </Select>
      </FormField>
      {isMobileMoney ? (
        <FormField label={referenceLabel} htmlFor="refund-reference">
          <TextInput
            id="refund-reference"
            value={externalReference}
            onChange={(e) => onReferenceChange(e.target.value)}
            disabled={disabled}
          />
        </FormField>
      ) : null}
    </>
  );
}

export interface RefundFooterProps {
  readonly errorMessage?: string | undefined;
  readonly isSubmitting: boolean;
  readonly disabled: boolean;
  readonly cancelLabel: string;
  readonly submitLabel: string;
  readonly onCancel: () => void;
}

export function RefundFooterActions(props: RefundFooterProps): ReactElement {
  const { errorMessage, isSubmitting, disabled, cancelLabel, submitLabel, onCancel } = props;
  return (
    <>
      {errorMessage ? <p className="text-body-sm text-error">{errorMessage}</p> : null}
      <div className="flex justify-end gap-2 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
