"use client";

import type { PaymentResponse } from "@banijjik/contracts/payment";
import { ApprovalPinDialog, Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import { useReversalFlow, type ReversalFlowState } from "./use-reversal-flow";

export interface ReversalDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly onSuccess?: ((reversedPayment: PaymentResponse) => void) | undefined;
  readonly labels: PaymentLabels["reversalDialog"] & {
    readonly cancelLabel: string;
    readonly closeLabel: string;
    readonly lockedMessage: string;
  };
}

interface ReversalFormProps {
  readonly labels: ReversalDialogProps["labels"];
  readonly reversalFlow: ReversalFlowState;
  readonly onCancel: () => void;
  readonly onReload: () => void;
}

function ReversalForm(props: ReversalFormProps): ReactElement {
  const { labels, reversalFlow, onCancel, onReload } = props;
  const [note, setNote] = useState<string>("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void reversalFlow.initiateReversal(note.trim() || null);
      }}
      className="flex flex-col gap-4 py-2"
    >
      <div className="rounded-md border border-error/20 bg-error/10 p-3 text-body-sm text-error">
        {labels.warning}
      </div>

      <FormField label={labels.note} htmlFor="reversal-note">
        <TextInput
          id="reversal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={reversalFlow.isSubmitting}
        />
      </FormField>

      {reversalFlow.isConflict ? (
        <div className="flex flex-col gap-2 rounded-md border border-error/30 bg-error/10 p-3 text-body-sm text-error">
          <span>{labels.conflict}</span>
          <div>
            <Button type="button" variant="secondary" onClick={onReload}>
              {labels.reload}
            </Button>
          </div>
        </div>
      ) : null}

      {!reversalFlow.isConflict && reversalFlow.errorMessage ? (
        <p className="text-body-sm text-error">{reversalFlow.errorMessage}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={reversalFlow.isSubmitting}
        >
          {labels.cancel}
        </Button>
        <Button
          type="submit"
          variant="danger"
          isLoading={reversalFlow.isSubmitting}
          disabled={reversalFlow.isSubmitting || reversalFlow.isConflict}
        >
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}

export function ReversalDialog(props: ReversalDialogProps): ReactElement {
  const router = useRouter();
  const { labels } = props;

  const reversalFlow = useReversalFlow({
    organizationId: props.organizationId,
    payment: props.payment,
    noApproversMessage: labels.noApprovers,
    failedMessage: labels.failed,
    loadApproversFailedMessage: labels.loadApproversFailed,
    onSuccess: (res) => {
      props.onSuccess?.(res);
      router.refresh();
      props.onOpenChange(false);
    },
  });

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent title={labels.title} closeLabel={labels.cancel}>
          <ReversalForm
            labels={labels}
            reversalFlow={reversalFlow}
            onCancel={() => props.onOpenChange(false)}
            onReload={() => {
              router.refresh();
              props.onOpenChange(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {reversalFlow.showPinDialog && reversalFlow.approvers.length > 0 ? (
        <ApprovalPinDialog
          key={reversalFlow.approvers[0]?.memberId ?? "reversal"}
          open={reversalFlow.showPinDialog}
          onOpenChange={reversalFlow.closePinDialog}
          title={labels.approvalTitle}
          approverLabel={labels.approver}
          pinLabel={labels.pin}
          submitLabel={labels.submit}
          cancelLabel={labels.cancel}
          closeLabel={labels.closeLabel}
          lockedMessage={labels.lockedMessage}
          approvers={reversalFlow.approvers.map((a) => ({
            memberId: a.memberId,
            displayName: a.displayName,
            hasPin: true,
          }))}
          {...(reversalFlow.approvalError ? { errorMessage: reversalFlow.approvalError } : {})}
          isLocked={reversalFlow.isPinLocked}
          isSubmitting={reversalFlow.isApproving}
          onSubmit={(input) => void reversalFlow.submitPin(input)}
        />
      ) : null}
    </>
  );
}
