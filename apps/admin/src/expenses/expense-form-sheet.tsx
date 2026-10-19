"use client";

import type { ExpenseCategoryResponse, ExpensePaidVia } from "@banijjik/contracts/accounting";
import type { CurrencyCode } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import { createExpense } from "./expense-api";
import { ExpenseFormFields } from "./expense-form-fields";
import {
  buildExpenseCreate,
  emptyExpenseForm,
  EXPENSE_FORM_NAMES,
  type ExpenseFormState,
} from "./expense-form";
import { useExpenseAttachments } from "./use-expense-attachments";

export interface ExpenseFormLabels {
  createTitle: string;
  close: string;
  save: string;
  amount: string;
  category: string;
  paidVia: string;
  date: string;
  location: string;
  note: string;
  attachments: string;
  addPhoto: string;
  removeAttachment: string;
  conflict: string;
  reload: string;
  paidViaOptions: Readonly<Record<ExpensePaidVia, string>>;
}

export interface ExpenseLocationOption {
  locationId: string;
  name: string;
}

export interface ExpenseFormSheetProps {
  organizationId: string;
  currency: CurrencyCode;
  categories: readonly ExpenseCategoryResponse[];
  locations: readonly ExpenseLocationOption[];
  labels: ExpenseFormLabels;
  defaultLocationId: string;
  defaultBusinessDate: string;
  onClose: () => void;
}

function attachmentLabels(labels: ExpenseFormLabels, uploading: string) {
  return {
    choose: labels.addPhoto,
    change: labels.addPhoto,
    remove: labels.removeAttachment,
    uploading,
    previewAlt: labels.attachments,
  };
}

/** Adds an expense. Attachments upload on pick; create carries an Idempotency-Key. */
export function ExpenseFormSheet(props: ExpenseFormSheetProps): ReactElement {
  const { organizationId, currency, categories, locations, labels } = props;
  const { t } = useTranslator();
  const [form, setForm] = useState<ExpenseFormState>(() =>
    emptyExpenseForm({
      locationId: props.defaultLocationId,
      businessDate: props.defaultBusinessDate,
    }),
  );
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);
  const attachments = useExpenseAttachments({
    organizationId,
    attachmentFileIds: form.attachmentFileIds,
    onChange: (attachmentFileIds) => setForm((current) => ({ ...current, attachmentFileIds })),
    imageLabels: attachmentLabels(labels, t("form.file.uploading")),
  });

  async function send(): Promise<SheetSendResult> {
    const built = buildExpenseCreate(form, currency);
    if (!built.ok) return { ok: false, fieldErrors: built.errors };
    lastSubmit.current = keyForSubmit(lastSubmit.current, JSON.stringify(built.body), newId);
    await createExpense(organizationId, built.body, lastSubmit.current.key);
    lastSubmit.current = undefined;
    return { ok: true };
  }

  const state = useSheetSubmit({
    fieldNames: EXPENSE_FORM_NAMES,
    onClose: props.onClose,
    send,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={labels.createTitle} closeLabel={labels.close}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <ExpenseFormFields
            form={form}
            currency={currency}
            categories={categories}
            locations={locations}
            labels={labels}
            errors={state.errors}
            attachments={attachments}
            onPatch={(changes) => setForm((current) => ({ ...current, ...changes }))}
          />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
