"use client";

import type { PaymentMethod } from "@banijjik/contracts/payment";
import {
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesReturnPreviewResponse,
  type SalesReturnReason,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import {
  Button,
  Checkbox,
  FormField,
  MoneyText,
  Select,
  Sheet,
  SheetContent,
  TextInput,
  Textarea,
  type DisplayLocale,
} from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { LazyOrderApprovalDialog } from "./lazy-order-approval-dialog";
import type { OrderApprovalLabels } from "./order-labels";
import { showSuccessToast } from "./order-toast";
import { ReturnLineCard } from "./return-line-card";
import type { ReturnLabels } from "./return-labels";
import { needsRefundReference, refundMethodsFor } from "./return-model";
import {
  returnBlockerOf,
  useReturnForm,
  useReturnPreview,
  useReturnSubmit,
  type ReturnBlocker,
  type ReturnFormActions,
  type ReturnFormState,
  type ReturnPreviewState,
} from "./use-return-sheet";

export interface ReturnSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly methodLabels: Readonly<Record<string, string>>;
  readonly locale: DisplayLocale;
  readonly labels: ReturnLabels;
  readonly approvalLabels: OrderApprovalLabels;
}

interface ReturnSheetBodyProps extends ReturnSheetProps {
  readonly form: ReturnFormState;
  readonly actions: ReturnFormActions;
  readonly preview: ReturnPreviewState;
}

const REASONS = Object.values(SALES_RETURN_REASON);

function previewOf(state: ReturnPreviewState): SalesReturnPreviewResponse | undefined {
  return state.status === "ready" ? state.preview : undefined;
}

function ReturnReasonFields(
  props: ReturnSheetBodyProps & { readonly blocker: ReturnBlocker | undefined },
): ReactElement {
  const { labels, form, actions } = props;
  const needsNote = props.blocker === "NOTE";
  return (
    <>
      <FormField label={labels.sheet.reason} htmlFor="return-reason" required>
        <Select
          id="return-reason"
          value={form.reasonKey ?? ""}
          onChange={(event) =>
            actions.setReasonKey(
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
        htmlFor="return-note"
        {...(needsNote ? { error: labels.sheet.noteRequired } : {})}
      >
        <Textarea
          id="return-note"
          value={form.note}
          onChange={(event) => actions.setNote(event.target.value)}
        />
      </FormField>
    </>
  );
}

function ReturnSummary(props: {
  readonly labels: ReturnLabels;
  readonly locale: DisplayLocale;
  readonly preview: ReturnPreviewState;
}): ReactElement {
  const { labels, preview, locale } = props;
  if (preview.status === "loading" || preview.status === "idle") {
    return <p className="text-caption text-muted">{labels.sheet.previewLoading}</p>;
  }
  if (preview.status === "failed")
    return <p className="text-caption text-danger">{labels.sheet.previewFailed}</p>;
  return (
    <dl className="flex flex-col gap-2 rounded-lg bg-surface p-4">
      <div className="flex justify-between gap-3">
        <dt className="text-body text-muted">{labels.sheet.previewValue}</dt>
        <dd>
          <MoneyText money={preview.preview.value} locale={locale} />
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-body text-muted">{labels.sheet.previewDue}</dt>
        <dd>
          <MoneyText money={preview.preview.dueReduced} locale={locale} />
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-body text-muted">{labels.sheet.previewRefund}</dt>
        <dd>
          <MoneyText money={preview.preview.refundAmount} locale={locale} />
        </dd>
      </div>
    </dl>
  );
}

function ReturnRefundFields(
  props: ReturnSheetBodyProps & { readonly blocker: ReturnBlocker | undefined },
): ReactElement {
  const { labels, form, actions, preview, allowedMethods, methodLabels, order } = props;
  const summary = previewOf(preview);
  if (summary === undefined) return <></>;
  if (summary.refundAmount.amount === 0)
    return <p className="text-caption text-muted">{labels.sheet.noRefund}</p>;
  const methods = refundMethodsFor(allowedMethods, order.contactId !== null);
  const needsReference = needsRefundReference(form.refundMethod);
  return (
    <>
      <FormField
        label={labels.sheet.refundMethod}
        htmlFor="return-refund-method"
        required
        {...(props.blocker === "REFUND_METHOD" ? { error: labels.sheet.refundMethodRequired } : {})}
      >
        <Select
          id="return-refund-method"
          value={form.refundMethod ?? ""}
          onChange={(event) =>
            actions.setRefundMethod(
              event.target.value === "" ? null : (event.target.value as PaymentMethod),
            )
          }
        >
          <option value="">{labels.sheet.refundMethod}</option>
          {methods.map((method) => (
            <option key={method} value={method}>
              {methodLabels[method] ?? method}
            </option>
          ))}
        </Select>
      </FormField>
      {needsReference ? (
        <FormField label={labels.sheet.refundReference} htmlFor="return-refund-reference" required>
          <TextInput
            id="return-refund-reference"
            value={form.refundReference}
            onChange={(event) => actions.setRefundReference(event.target.value)}
          />
        </FormField>
      ) : null}
    </>
  );
}

function ReturnSheetFooter(props: {
  readonly labels: ReturnLabels;
  readonly blocker: ReturnBlocker | undefined;
  readonly isSubmitting: boolean;
  readonly canSubmit: boolean;
  readonly failureMessage: string | undefined;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}): ReactElement {
  const { labels } = props;
  return (
    <div className="flex flex-col gap-3">
      {props.failureMessage === undefined ? null : (
        <p role="alert" className="text-body text-danger">
          {props.failureMessage}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={props.isSubmitting} onClick={props.onCancel}>
          {labels.sheet.cancel}
        </Button>
        <Button
          variant="primary"
          disabled={!props.canSubmit}
          isLoading={props.isSubmitting}
          onClick={props.onSubmit}
        >
          {labels.sheet.submit}
        </Button>
      </div>
    </div>
  );
}

function ReturnSheetBody(
  props: ReturnSheetBodyProps & { readonly onCreated: (created: SalesReturnResponse) => void },
): ReactElement {
  const { labels, form, actions, preview } = props;
  const summary = previewOf(preview);
  const blocker = returnBlockerOf(form, summary);
  const submit = useReturnSubmit({
    organizationId: props.organizationId,
    order: props.order,
    form,
    preview: summary,
    approvalLabels: props.approvalLabels,
    onCreated: props.onCreated,
  });
  return (
    <>
      <ul className="flex flex-col gap-3">
        {form.drafts.map((draft) => (
          <ReturnLineCard key={draft.orderLineId} draft={draft} labels={labels} actions={actions} />
        ))}
      </ul>
      <Checkbox
        label={labels.sheet.deliveryCharge}
        checked={form.returnDeliveryCharge}
        onChange={(event) => actions.setReturnDeliveryCharge(event.target.checked)}
      />
      <ReturnReasonFields {...props} blocker={blocker} />
      <ReturnSummary labels={labels} locale={props.locale} preview={preview} />
      <ReturnRefundFields {...props} blocker={blocker} />
      <ReturnSheetFooter
        labels={labels}
        blocker={blocker}
        isSubmitting={submit.isSubmitting}
        canSubmit={blocker === undefined && summary !== undefined && !submit.isSubmitting}
        failureMessage={submit.failure?.message}
        onCancel={() => props.onOpenChange(false)}
        onSubmit={() => void submit.submit()}
      />
      <LazyOrderApprovalDialog flow={submit.approvals.dialog} labels={props.approvalLabels} />
    </>
  );
}

/** Returns goods of a completed order: the server previews every amount, then the staff member confirms. */
export function ReturnSheet(props: ReturnSheetProps): ReactElement {
  const router = useRouter();
  const { form, actions } = useReturnForm(props.order);
  const preview = useReturnPreview({
    organizationId: props.organizationId,
    order: props.order,
    form,
  });
  if (!props.open) return <></>;
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        title={props.labels.sheet.title}
        description={props.labels.sheet.description}
        closeLabel={props.labels.sheet.cancel}
      >
        <ReturnSheetBody
          {...props}
          form={form}
          actions={actions}
          preview={preview}
          onCreated={(created) => {
            props.onOpenChange(false);
            void showSuccessToast(props.labels.sheet.success);
            router.push(`/${props.orgSlug}/returns/${created.salesReturnId}`);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
