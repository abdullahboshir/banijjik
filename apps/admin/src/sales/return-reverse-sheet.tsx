"use client";

import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { PAYMENT_METHOD, type PaymentMethod } from "@banijjik/contracts/payment";
import {
  SALES_RETURN_REVERSE_REASON,
  orderApprovalSubject,
  type SalesReturnResponse,
  type SalesReturnReverseReason,
} from "@banijjik/contracts/sales";
import type { SalesReturnReverseRequestBody } from "@banijjik/validation/sales";
import { Button, FormField, Select, Sheet, SheetContent, Textarea } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactElement } from "react";
import { LazyOrderApprovalDialog } from "./lazy-order-approval-dialog";
import { failureOf, type RuleFailure } from "./order-failure";
import type { OrderApprovalLabels } from "./order-labels";
import { showSuccessToast } from "./order-toast";
import { ApprovalCancelledError, useReturnApprovalFlow } from "./return-approval-flow";
import { newSubmitKey, reverseReturn } from "./return-api";
import type { ReturnLabels } from "./return-labels";
import { needsRefundReference, reasonNeedsNote, type ApprovalStep } from "./return-model";
import { PaybackFields, type ReverseFormState } from "./return-payback-fields";

/** The one token a reversal carries; the approval step fills it. */
export const REVERSAL_APPROVAL_KEY = "approvalToken";

export interface ReturnReverseSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly salesReturn: SalesReturnResponse;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly methodLabels: Readonly<Record<string, string>>;
  readonly labels: ReturnLabels;
  readonly approvalLabels: OrderApprovalLabels;
}

const INITIAL_FORM: ReverseFormState = {
  reasonKey: undefined,
  note: "",
  payback: false,
  paybackMethod: null,
  paybackReference: "",
};

/** The reversal's approval: always required, for the return value (plan R3). */
function reversalStepOf(salesReturn: SalesReturnResponse): ApprovalStep {
  return {
    key: REVERSAL_APPROVAL_KEY,
    action: APPROVAL_ACTION.SALES_RETURN_REVERSAL,
    subjectKey: orderApprovalSubject(salesReturn.orderId),
    locationId: salesReturn.locationId,
    amount: salesReturn.value,
  };
}

function reverseBodyOf(
  salesReturn: SalesReturnResponse,
  form: ReverseFormState & { readonly reasonKey: SalesReturnReverseReason },
  approvalToken: string,
): SalesReturnReverseRequestBody {
  const note = form.note.trim();
  const reference = form.paybackReference.trim();
  const payback =
    form.payback && form.paybackMethod !== null
      ? {
          method: form.paybackMethod,
          ...(needsRefundReference(form.paybackMethod) && reference !== ""
            ? { externalReference: reference }
            : {}),
        }
      : undefined;
  return {
    version: salesReturn.version,
    reasonKey: form.reasonKey,
    ...(note === "" ? {} : { note }),
    ...(payback === undefined ? {} : { payback }),
    approvalToken,
  };
}

/** Reverses one return: one PIN, one key per submit (reused on a retry of the same body). */
function useReverseSubmit(
  props: ReturnReverseSheetProps,
  form: ReverseFormState,
  onDone: () => void,
) {
  const { t } = useTranslator();
  const approvals = useReturnApprovalFlow(props.organizationId, props.approvalLabels);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<RuleFailure | undefined>(undefined);
  const keyRef = useRef<{ readonly bodyKey: string; readonly key: string } | undefined>(undefined);

  async function submit(): Promise<void> {
    const { salesReturn } = props;
    if (form.reasonKey === undefined) return;
    const reasonKey = form.reasonKey;
    setIsSubmitting(true);
    setFailure(undefined);
    try {
      const granted = await approvals.collect([reversalStepOf(salesReturn)]);
      const token = granted[REVERSAL_APPROVAL_KEY] ?? "";
      const body = reverseBodyOf(salesReturn, { ...form, reasonKey }, token);
      const bodyKey = JSON.stringify(reverseBodyOf(salesReturn, { ...form, reasonKey }, ""));
      const key = keyRef.current?.bodyKey === bodyKey ? keyRef.current.key : newSubmitKey();
      keyRef.current = { bodyKey, key };
      await reverseReturn({
        organizationId: props.organizationId,
        salesReturnId: salesReturn.salesReturnId,
        body,
        idempotencyKey: key,
      });
      onDone();
    } catch (error) {
      if (!(error instanceof ApprovalCancelledError)) setFailure(failureOf(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, failure, approvals, submit };
}

interface ReverseFieldsProps {
  readonly form: ReverseFormState;
  readonly setForm: (update: Partial<ReverseFormState>) => void;
  readonly labels: ReturnLabels;
  readonly salesReturn: SalesReturnResponse;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly methodLabels: Readonly<Record<string, string>>;
}

function ReverseFields(props: ReverseFieldsProps): ReactElement {
  const { form, setForm, labels, salesReturn, allowedMethods, methodLabels } = props;
  const hasRefund = salesReturn.refund.amount.amount > 0;
  const methods = allowedMethods.filter(
    (method) => method !== PAYMENT_METHOD.STORE_CREDIT || salesReturn.contactId !== null,
  );
  return (
    <>
      <FormField label={labels.reverse.reason} htmlFor="reverse-reason" required>
        <Select
          id="reverse-reason"
          value={form.reasonKey ?? ""}
          onChange={(event) =>
            setForm({
              reasonKey:
                event.target.value === ""
                  ? undefined
                  : (event.target.value as SalesReturnReverseReason),
            })
          }
        >
          <option value="">{labels.reverse.reason}</option>
          {Object.values(SALES_RETURN_REVERSE_REASON).map((reason) => (
            <option key={reason} value={reason}>
              {labels.reverseReasons[reason]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label={labels.reverse.note}
        htmlFor="reverse-note"
        {...(reasonNeedsNote(form.reasonKey ?? "", form.note)
          ? { error: labels.reverse.noteRequired }
          : {})}
      >
        <Textarea
          id="reverse-note"
          value={form.note}
          onChange={(event) => setForm({ note: event.target.value })}
        />
      </FormField>
      {hasRefund ? (
        <PaybackFields
          form={form}
          setForm={setForm}
          methods={methods}
          methodLabels={methodLabels}
          labels={labels}
        />
      ) : null}
    </>
  );
}

/** Lets the staff member reverse a return: reason, note, optional payback and the PIN. */
export function ReturnReverseSheet(props: ReturnReverseSheetProps): ReactElement {
  const router = useRouter();
  const [form, setFormState] = useState<ReverseFormState>(INITIAL_FORM);
  const setForm = (update: Partial<ReverseFormState>): void =>
    setFormState((current) => ({ ...current, ...update }));
  const submit = useReverseSubmit(props, form, () => {
    props.onOpenChange(false);
    void showSuccessToast(props.labels.reverse.success);
    router.refresh();
  });
  const canSubmit =
    form.reasonKey !== undefined &&
    !reasonNeedsNote(form.reasonKey, form.note) &&
    !submit.isSubmitting;
  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          title={props.labels.reverse.title}
          description={props.labels.reverse.description}
          closeLabel={props.labels.reverse.cancel}
        >
          <div className="flex flex-col gap-4">
            <ReverseFields
              form={form}
              setForm={setForm}
              labels={props.labels}
              salesReturn={props.salesReturn}
              allowedMethods={props.allowedMethods}
              methodLabels={props.methodLabels}
            />
            {submit.failure === undefined ? null : (
              <p role="alert" className="text-body text-danger">
                {submit.failure.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={submit.isSubmitting}
                onClick={() => props.onOpenChange(false)}
              >
                {props.labels.reverse.cancel}
              </Button>
              <Button
                variant="danger"
                disabled={!canSubmit}
                isLoading={submit.isSubmitting}
                onClick={() => void submit.submit()}
              >
                {props.labels.reverse.submit}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <LazyOrderApprovalDialog flow={submit.approvals.dialog} labels={props.approvalLabels} />
    </>
  );
}
