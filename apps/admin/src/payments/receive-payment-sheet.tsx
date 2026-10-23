"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type {
  PaymentAllocation,
  PaymentMethod,
  PaymentResponse,
} from "@banijjik/contracts/payment";
import {
  Button,
  FormField,
  Select,
  Sheet,
  SheetContent,
  TextInput,
  formatMoney,
} from "@banijjik/ui";
import { type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import { AllocationsEditor, OverpaymentNotice } from "./receive-payment-allocations";
import { useReceivePaymentForm } from "./use-receive-payment-form";

export type { AllocationDraft } from "./receive-payment-allocations";

export interface BusinessAccountInfo {
  readonly number: string;
  readonly type: string;
}

export interface ReceivePaymentSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly currencySymbol: string;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly locations: readonly { readonly locationId: string; readonly name: string }[];
  readonly businessNumbers?: {
    readonly bkash?: BusinessAccountInfo | undefined;
    readonly nagad?: BusinessAccountInfo | undefined;
  };
  readonly initialLocationId?: string | undefined;
  readonly initialContactId?: string | undefined;
  readonly initialAllocations?: readonly PaymentAllocation[] | undefined;
  readonly initialDueMinor?: number | undefined;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
  readonly labels: PaymentLabels["receiveSheet"] & {
    readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
  };
}

interface MethodFieldsProps {
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

function MethodFields(props: MethodFieldsProps): ReactElement {
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

interface AmountAndContactProps {
  readonly currencySymbol: string;
  readonly amountText: string;
  readonly contactId: string;
  readonly initialContactId?: string | undefined;
  readonly disabled: boolean;
  readonly labels: ReceivePaymentSheetProps["labels"];
  readonly onAmountChange: (v: string) => void;
  readonly onContactChange: (v: string) => void;
}

function AmountAndContactInputs(props: AmountAndContactProps): ReactElement {
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

function ReceivePaymentFooter(props: {
  readonly errorMessage?: string | undefined;
  readonly successMessage?: string | undefined;
  readonly isSubmitting: boolean;
  readonly submitDisabled: boolean;
  readonly cancelLabel: string;
  readonly submitLabel: string;
  readonly onCancel: () => void;
}): ReactElement {
  const {
    errorMessage,
    successMessage,
    isSubmitting,
    submitDisabled,
    cancelLabel,
    submitLabel,
    onCancel,
  } = props;
  return (
    <>
      {errorMessage ? <p className="text-body-sm text-error">{errorMessage}</p> : null}
      {successMessage ? <p className="text-body-sm text-success">{successMessage}</p> : null}
      <div className="flex justify-end gap-2 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
}

function ReceivePaymentForm(props: ReceivePaymentSheetProps): ReactElement {
  const form = useReceivePaymentForm(props);
  const formattedOverpayment = formatMoney(
    { amount: form.overpaymentMinor, currency: props.currency },
    { locale: "bn" },
  );

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)} className="flex flex-col gap-4 py-2">
      <MethodFields
        locations={props.locations}
        locationId={form.locationId}
        initialLocationId={props.initialLocationId}
        allowedMethods={props.allowedMethods}
        method={form.method}
        businessNumber={form.businessNumber}
        isMobileMoney={form.isMobileMoney}
        externalReference={form.externalReference}
        disabled={form.isSubmitting}
        labels={props.labels}
        onLocationChange={form.setLocationId}
        onMethodChange={form.setMethod}
        onReferenceChange={form.setExternalReference}
      />
      <AmountAndContactInputs
        currencySymbol={props.currencySymbol}
        amountText={form.amountText}
        contactId={form.contactId}
        initialContactId={props.initialContactId}
        disabled={form.isSubmitting}
        labels={props.labels}
        onAmountChange={form.setAmountText}
        onContactChange={form.setContactId}
      />
      <AllocationsEditor
        allocations={form.allocations}
        label={props.labels.allocations}
        disabled={form.isSubmitting}
        onChange={form.handleAllocChange}
      />
      <OverpaymentNotice
        hasOverpayment={form.hasOverpayment}
        overpaymentRequiresContact={form.overpaymentRequiresContact}
        contactId={form.contactId}
        method={form.method}
        formattedAmount={formattedOverpayment}
        labels={props.labels}
      />
      <FormField label={props.labels.note} htmlFor="receive-payment-note">
        <TextInput
          id="receive-payment-note"
          value={form.note}
          onChange={(e) => form.setNote(e.target.value)}
          disabled={form.isSubmitting}
        />
      </FormField>
      <ReceivePaymentFooter
        errorMessage={form.errorMessage}
        successMessage={form.successMessage}
        isSubmitting={form.isSubmitting}
        submitDisabled={
          form.isSubmitting || form.parsedAmount <= 0 || form.overpaymentRequiresContact
        }
        cancelLabel={props.labels.cancel}
        submitLabel={props.labels.submit}
        onCancel={() => props.onOpenChange(false)}
      />
    </form>
  );
}

export function ReceivePaymentSheet(props: ReceivePaymentSheetProps): ReactElement {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={props.labels.title} closeLabel={props.labels.cancel}>
        <ReceivePaymentForm {...props} />
      </SheetContent>
    </Sheet>
  );
}
