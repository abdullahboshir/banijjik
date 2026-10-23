"use client";

import type { PaymentMethod } from "@banijjik/contracts/payment";
import { FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { BusinessAccountInfo, ReceivePaymentSheetProps } from "./receive-payment-sheet";

export interface MethodFieldsProps {
  readonly locations: readonly { readonly locationId: string; readonly name: string }[];
  readonly locationId: string;
  readonly initialLocationId?: string | undefined;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly method: PaymentMethod;
  readonly businessNumber?: BusinessAccountInfo | undefined;
  readonly isMobileMoney: boolean;
  readonly externalReference: string;
  readonly disabled: boolean;
  readonly labels: ReceivePaymentSheetProps["labels"];
  readonly onLocationChange: (id: string) => void;
  readonly onMethodChange: (m: PaymentMethod) => void;
  readonly onReferenceChange: (ref: string) => void;
}

export function MobileMoneyFields(props: {
  readonly businessNumber?: BusinessAccountInfo | undefined;
  readonly isMobileMoney: boolean;
  readonly externalReference: string;
  readonly disabled: boolean;
  readonly labels: ReceivePaymentSheetProps["labels"];
  readonly onReferenceChange: (ref: string) => void;
}): ReactElement | null {
  const { businessNumber, isMobileMoney, externalReference, disabled, labels, onReferenceChange } =
    props;
  if (!businessNumber && !isMobileMoney) return null;
  return (
    <>
      {businessNumber ? (
        <div className="rounded-md bg-accent/10 p-3 text-body-sm text-primary">
          {labels.businessNumberNotice
            .replace("{number}", businessNumber.number)
            .replace("{type}", businessNumber.type)}
        </div>
      ) : null}
      {isMobileMoney ? (
        <FormField
          label={labels.reference}
          htmlFor="receive-payment-reference"
          hint={labels.referenceRequired}
        >
          <TextInput
            id="receive-payment-reference"
            value={externalReference}
            placeholder={labels.referencePlaceholder}
            onChange={(e) => onReferenceChange(e.target.value)}
            disabled={disabled}
          />
        </FormField>
      ) : null}
    </>
  );
}

export function MethodFields(props: MethodFieldsProps): ReactElement {
  const {
    locations,
    locationId,
    initialLocationId,
    allowedMethods,
    method,
    businessNumber,
    isMobileMoney,
    externalReference,
    disabled,
    labels,
    onLocationChange,
    onMethodChange,
    onReferenceChange,
  } = props;
  return (
    <>
      {locations.length > 1 ? (
        <FormField label={labels.location} htmlFor="receive-payment-location">
          <Select
            id="receive-payment-location"
            value={locationId}
            onChange={(e) => onLocationChange(e.target.value)}
            disabled={disabled || Boolean(initialLocationId)}
          >
            {locations.map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>
                {loc.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      <FormField label={labels.method} htmlFor="receive-payment-method">
        <Select
          id="receive-payment-method"
          value={method}
          onChange={(e) => onMethodChange(e.target.value as PaymentMethod)}
          disabled={disabled}
        >
          {allowedMethods.map((m) => (
            <option key={m} value={m}>
              {labels.methodLabels[m] ?? m}
            </option>
          ))}
        </Select>
      </FormField>

      <MobileMoneyFields
        businessNumber={businessNumber}
        isMobileMoney={isMobileMoney}
        externalReference={externalReference}
        disabled={disabled}
        labels={labels}
        onReferenceChange={onReferenceChange}
      />
    </>
  );
}

export interface AmountAndContactProps {
  readonly currencySymbol: string;
  readonly amountText: string;
  readonly contactId: string;
  readonly initialContactId?: string | undefined;
  readonly disabled: boolean;
  readonly labels: ReceivePaymentSheetProps["labels"];
  readonly onAmountChange: (v: string) => void;
  readonly onContactChange: (v: string) => void;
}

export function AmountAndContactInputs(props: AmountAndContactProps): ReactElement {
  const {
    currencySymbol,
    amountText,
    contactId,
    initialContactId,
    disabled,
    labels,
    onAmountChange,
    onContactChange,
  } = props;
  return (
    <>
      <FormField label={`${labels.amount} (${currencySymbol})`} htmlFor="receive-payment-amount">
        <TextInput
          id="receive-payment-amount"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={disabled}
        />
      </FormField>
      <FormField label={labels.contact} htmlFor="receive-payment-contact">
        <TextInput
          id="receive-payment-contact"
          value={contactId}
          placeholder={labels.contactPlaceholder}
          onChange={(e) => onContactChange(e.target.value)}
          disabled={disabled || Boolean(initialContactId)}
        />
      </FormField>
    </>
  );
}

export function NoteField(props: {
  readonly note: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (v: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor="receive-payment-note">
      <TextInput
        id="receive-payment-note"
        value={props.note}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
      />
    </FormField>
  );
}
