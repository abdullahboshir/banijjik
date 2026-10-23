"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type {
  PaymentAllocation,
  PaymentMethod,
  PaymentRequestType,
  PaymentResponse,
} from "@banijjik/contracts/payment";
import { Button, Sheet, SheetContent, formatMoney } from "@banijjik/ui";
import { type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import {
  AllocationsEditor,
  OverpaymentNotice,
  type AllocationDraft,
} from "./receive-payment-allocations";
import { AmountAndContactInputs, MethodFields, NoteField } from "./receive-payment-fields";
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
  readonly initialAllocations?:
    | readonly (PaymentAllocation & {
        readonly requestNumber?: string | null;
        readonly label?: string;
      })[]
    | undefined;
  readonly initialDueMinor?: number | undefined;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
  readonly labels: PaymentLabels["receiveSheet"] & {
    readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
    readonly requestTypeLabels?: Readonly<Record<PaymentRequestType, string>> | undefined;
  };
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

function ReceivePaymentAllocationsSection(props: {
  readonly allocations: readonly AllocationDraft[];
  readonly label: string;
  readonly disabled: boolean;
  readonly hasOverpayment: boolean;
  readonly overpaymentRequiresContact: boolean;
  readonly contactId: string;
  readonly method: PaymentMethod;
  readonly formattedAmount: string;
  readonly labels: ReceivePaymentSheetProps["labels"];
  readonly onAllocChange: (idx: number, minor: number) => void;
}): ReactElement {
  return (
    <>
      <AllocationsEditor
        allocations={props.allocations}
        label={props.label}
        disabled={props.disabled}
        requestTypeLabels={props.labels.requestTypeLabels}
        invalidAmountLabel={props.labels.amountInvalid}
        onChange={props.onAllocChange}
      />
      <OverpaymentNotice
        hasOverpayment={props.hasOverpayment}
        overpaymentRequiresContact={props.overpaymentRequiresContact}
        contactId={props.contactId}
        method={props.method}
        formattedAmount={props.formattedAmount}
        labels={props.labels}
      />
    </>
  );
}

function MethodAndAmountInputs(props: {
  readonly sheetProps: ReceivePaymentSheetProps;
  readonly form: ReturnType<typeof useReceivePaymentForm>;
}): ReactElement {
  const { sheetProps, form } = props;
  return (
    <>
      <MethodFields
        locations={sheetProps.locations}
        locationId={form.locationId}
        initialLocationId={sheetProps.initialLocationId}
        allowedMethods={sheetProps.allowedMethods}
        method={form.method}
        businessNumber={form.businessNumber}
        isMobileMoney={form.isMobileMoney}
        externalReference={form.externalReference}
        disabled={form.isSubmitting}
        labels={sheetProps.labels}
        onLocationChange={form.setLocationId}
        onMethodChange={form.setMethod}
        onReferenceChange={form.setExternalReference}
      />
      <AmountAndContactInputs
        currencySymbol={sheetProps.currencySymbol}
        amountText={form.amountText}
        contactId={form.contactId}
        initialContactId={sheetProps.initialContactId}
        disabled={form.isSubmitting}
        labels={sheetProps.labels}
        onAmountChange={form.setAmountText}
        onContactChange={form.setContactId}
      />
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
      <MethodAndAmountInputs sheetProps={props} form={form} />
      <ReceivePaymentAllocationsSection
        allocations={form.allocations}
        label={props.labels.allocations}
        disabled={form.isSubmitting}
        hasOverpayment={form.hasOverpayment}
        overpaymentRequiresContact={form.overpaymentRequiresContact}
        contactId={form.contactId}
        method={form.method}
        formattedAmount={formattedOverpayment}
        labels={props.labels}
        onAllocChange={form.handleAllocChange}
      />
      <NoteField
        note={form.note}
        label={props.labels.note}
        disabled={form.isSubmitting}
        onChange={form.setNote}
      />
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
