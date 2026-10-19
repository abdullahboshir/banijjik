"use client";

import type { ExpenseCategoryResponse } from "@banijjik/contracts/accounting";
import type { Locale } from "@banijjik/i18n";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { useRecordAction, type RecordAction } from "../catalog/use-record-action";
import {
  archiveExpenseCategory,
  createExpenseCategory,
  updateExpenseCategory,
} from "./expense-api";
import { localizedNameOf } from "./expense-labels";

export interface ExpenseCategoryLabels {
  add: string;
  nameBn: string;
  nameEn: string;
  save: string;
  archive: string;
  edit: string;
  close: string;
  empty: string;
  system: string;
  conflict: string;
  reload: string;
  archived: string;
}

export interface ExpenseCategoriesManagerProps {
  organizationId: string;
  categories: ExpenseCategoryResponse[];
  labels: ExpenseCategoryLabels;
  canUpdate: boolean;
  locale: Locale;
}

function FailureLine(props: {
  action: RecordAction;
  labels: ExpenseCategoryLabels;
}): ReactElement | null {
  const { t } = useTranslator();
  const { failure } = props.action;
  if (!failure) return null;
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.labels.conflict}</p>
        <Button variant="secondary" onClick={props.action.reload}>
          {props.labels.reload}
        </Button>
      </div>
    );
  }
  return (
    <p role="alert" className="text-small text-danger">
      {t(knownMessageKeyOrInternal(failure.messageKey ?? "errors.internal"))}
    </p>
  );
}

function AddCategory(
  props: ExpenseCategoriesManagerProps & { action: RecordAction },
): ReactElement {
  const { labels, organizationId, action } = props;
  const [nameBn, setNameBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  async function add(): Promise<void> {
    if (nameBn.trim() === "" || nameEn.trim() === "") return;
    const done = await action.run(() =>
      createExpenseCategory(organizationId, {
        name: { bn: nameBn.trim(), en: nameEn.trim() },
      }),
    );
    if (done) {
      setNameBn("");
      setNameEn("");
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <FormField label={labels.nameBn} htmlFor="new-expense-category-bn">
        <TextInput
          id="new-expense-category-bn"
          value={nameBn}
          onChange={(event) => setNameBn(event.target.value)}
        />
      </FormField>
      <FormField label={labels.nameEn} htmlFor="new-expense-category-en">
        <TextInput
          id="new-expense-category-en"
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
        />
      </FormField>
      <Button isLoading={action.isBusy} onClick={() => void add()}>
        {labels.add}
      </Button>
    </div>
  );
}

function EditPanel(props: {
  category: ExpenseCategoryResponse;
  manager: ExpenseCategoriesManagerProps;
  action: RecordAction;
  onClose: () => void;
}): ReactElement {
  const { category, manager, action } = props;
  const { labels, organizationId } = manager;
  const [nameBn, setNameBn] = useState(category.name.bn);
  const [nameEn, setNameEn] = useState(category.name.en);
  async function save(): Promise<void> {
    await action.run(() =>
      updateExpenseCategory(organizationId, category.expenseCategoryId, {
        name: { bn: nameBn.trim(), en: nameEn.trim() },
      }),
    );
  }
  async function archive(): Promise<void> {
    await action.run(() => archiveExpenseCategory(organizationId, category.expenseCategoryId));
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-brand p-3">
      <FormField
        label={labels.nameBn}
        htmlFor={`edit-expense-category-bn-${category.expenseCategoryId}`}
      >
        <TextInput
          id={`edit-expense-category-bn-${category.expenseCategoryId}`}
          value={nameBn}
          onChange={(event) => setNameBn(event.target.value)}
        />
      </FormField>
      <FormField
        label={labels.nameEn}
        htmlFor={`edit-expense-category-en-${category.expenseCategoryId}`}
      >
        <TextInput
          id={`edit-expense-category-en-${category.expenseCategoryId}`}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button isLoading={action.isBusy} onClick={() => void save()}>
          {labels.save}
        </Button>
        {!category.isSystem && category.status === "ACTIVE" ? (
          <Button variant="secondary" disabled={action.isBusy} onClick={() => void archive()}>
            {labels.archive}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={props.onClose}>
          {labels.close}
        </Button>
      </div>
    </div>
  );
}

/** Lists expense categories; add, rename and archive (never delete). */
export function ExpenseCategoriesManager(props: ExpenseCategoriesManagerProps): ReactElement {
  const { categories, labels, canUpdate, locale } = props;
  const action = useRecordAction();
  const [editingId, setEditingId] = useState<string | undefined>();
  if (categories.length === 0 && !canUpdate) {
    return <p className="text-body text-secondary">{labels.empty}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <FailureLine action={action} labels={labels} />
      {canUpdate ? <AddCategory {...props} action={action} /> : null}
      <ul className="flex flex-col gap-2">
        {categories.map((category) => {
          if (editingId === category.expenseCategoryId) {
            return (
              <li key={category.expenseCategoryId}>
                <EditPanel
                  category={category}
                  manager={props}
                  action={action}
                  onClose={() => setEditingId(undefined)}
                />
              </li>
            );
          }
          return (
            <li
              key={category.expenseCategoryId}
              className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-default px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-body text-primary">
                  {localizedNameOf(category.name, locale)}
                </p>
                <p className="text-small text-secondary">
                  {category.isSystem ? labels.system : category.accountCode}
                  {category.status === "ARCHIVED" ? ` · ${labels.archived}` : ""}
                </p>
              </div>
              {canUpdate && category.status === "ACTIVE" ? (
                <Button
                  variant="secondary"
                  onClick={() => setEditingId(category.expenseCategoryId)}
                >
                  {labels.edit}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
