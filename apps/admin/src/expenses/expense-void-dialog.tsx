"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { voidExpense } from "./expense-api";

export interface ExpenseVoidLabels {
  title: string;
  description: string;
  reason: string;
  confirm: string;
  cancel: string;
  close: string;
  conflict: string;
}

export interface ExpenseVoidDialogProps {
  organizationId: string;
  expenseId: string;
  version: number;
  labels: ExpenseVoidLabels;
  onClose: () => void;
}

/** Confirms void with a required reason; keeps the record and reverses the books. */
export function ExpenseVoidDialog(props: ExpenseVoidDialogProps): ReactElement {
  const { organizationId, expenseId, version, labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [refusal, setRefusal] = useState<string | undefined>();
  const [isConflict, setIsConflict] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  async function run(): Promise<void> {
    if (reason.trim() === "") {
      setRefusal(t("validation.required"));
      return;
    }
    setIsBusy(true);
    try {
      await voidExpense(organizationId, expenseId, { reason: reason.trim(), version });
      onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const conflict = error.code === ERROR_CODE.CONFLICT;
      setIsConflict(conflict);
      setRefusal(conflict ? labels.conflict : t(knownMessageKeyOrInternal(error.messageKey)));
    }
    setIsBusy(false);
  }

  function handleOpenChange(open: boolean): void {
    if (open) return;
    onClose();
    if (isConflict) router.refresh();
  }

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent title={labels.title} closeLabel={labels.close}>
        <p className="text-small text-secondary">{refusal ?? labels.description}</p>
        <FormField label={labels.reason} htmlFor="expense-void-reason" required>
          <TextInput
            id="expense-void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoComplete="off"
          />
        </FormField>
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isBusy}>
            {labels.cancel}
          </Button>
          <Button variant="danger" isLoading={isBusy} onClick={() => void run()}>
            {labels.confirm}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
