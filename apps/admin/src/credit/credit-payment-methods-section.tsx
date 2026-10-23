"use client";

import { CREDIT_RULE_KEY } from "@banijjik/contracts/credit";
import {
  CREDIT_PURCHASE_METHOD,
  type CreditPaymentMethodSetting,
} from "@banijjik/contracts/credit";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { ApiError } from "../lib/api/api-error";
import { updateSettings } from "../lib/api/tenant-config-api";
import type { CreditPaymentMethodsLabels } from "./credit-labels";

export interface CreditPaymentMethodsSectionProps {
  organizationId: string;
  methods: readonly CreditPaymentMethodSetting[];
  version?: number | undefined;
  canUpdate: boolean;
  labels: CreditPaymentMethodsLabels;
}

interface EditableMethod {
  method: "BKASH" | "NAGAD";
  accountNumber: string;
  accountType: string;
  instructionsBn: string;
  instructionsEn: string;
}

function toEditable(item: CreditPaymentMethodSetting): EditableMethod {
  return {
    method: item.method,
    accountNumber: item.accountNumber,
    accountType: item.accountType,
    instructionsBn: item.instructions.bn,
    instructionsEn: item.instructions.en,
  };
}

function cleanItems(items: readonly EditableMethod[]): CreditPaymentMethodSetting[] {
  return items.map((item) => ({
    method: item.method,
    accountNumber: item.accountNumber.trim(),
    accountType: item.accountType.trim(),
    instructions: {
      bn: item.instructionsBn.trim(),
      en: item.instructionsEn.trim(),
    },
  }));
}

function validateItems(items: readonly EditableMethod[]): boolean {
  const methods = new Set<string>();
  for (const item of items) {
    if (methods.has(item.method)) return false;
    methods.add(item.method);
    if (!item.accountNumber.trim()) return false;
    if (!item.accountType.trim()) return false;
    if (!item.instructionsBn.trim()) return false;
    if (!item.instructionsEn.trim()) return false;
  }
  return true;
}

interface MethodCardProps {
  item: EditableMethod;
  index: number;
  canUpdate: boolean;
  labels: CreditPaymentMethodsLabels;
  onChange: (index: number, updated: EditableMethod) => void;
  onRemove: (index: number) => void;
}

function MethodCardHeader(props: MethodCardProps): ReactElement {
  const { item, index, canUpdate, labels, onChange, onRemove } = props;
  return (
    <div className="flex items-center justify-between gap-2">
      <FormField label={labels.method} htmlFor={`method-${index}`}>
        <Select
          id={`method-${index}`}
          value={item.method}
          disabled={!canUpdate}
          onChange={(e) =>
            onChange(index, { ...item, method: e.target.value as "BKASH" | "NAGAD" })
          }
        >
          <option value={CREDIT_PURCHASE_METHOD.BKASH}>
            {labels.methodLabels[CREDIT_PURCHASE_METHOD.BKASH]}
          </option>
          <option value={CREDIT_PURCHASE_METHOD.NAGAD}>
            {labels.methodLabels[CREDIT_PURCHASE_METHOD.NAGAD]}
          </option>
        </Select>
      </FormField>
      {canUpdate ? (
        <Button variant="secondary" onClick={() => onRemove(index)}>
          {labels.remove}
        </Button>
      ) : null}
    </div>
  );
}

function MethodInputs(props: MethodCardProps): ReactElement {
  const { item, index, canUpdate, labels, onChange } = props;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={labels.accountNumber} htmlFor={`account-${index}`}>
          <TextInput
            id={`account-${index}`}
            value={item.accountNumber}
            disabled={!canUpdate}
            onChange={(e) => onChange(index, { ...item, accountNumber: e.target.value })}
          />
        </FormField>
        <FormField
          label={labels.accountType}
          htmlFor={`type-${index}`}
          hint={labels.accountTypeHint}
        >
          <TextInput
            id={`type-${index}`}
            value={item.accountType}
            disabled={!canUpdate}
            onChange={(e) => onChange(index, { ...item, accountType: e.target.value })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={labels.instructionsBn} htmlFor={`inst-bn-${index}`}>
          <TextInput
            id={`inst-bn-${index}`}
            value={item.instructionsBn}
            disabled={!canUpdate}
            onChange={(e) => onChange(index, { ...item, instructionsBn: e.target.value })}
          />
        </FormField>
        <FormField label={labels.instructionsEn} htmlFor={`inst-en-${index}`}>
          <TextInput
            id={`inst-en-${index}`}
            value={item.instructionsEn}
            disabled={!canUpdate}
            onChange={(e) => onChange(index, { ...item, instructionsEn: e.target.value })}
          />
        </FormField>
      </div>
    </>
  );
}

function MethodCard(props: MethodCardProps): ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-4">
      <MethodCardHeader {...props} />
      <MethodInputs {...props} />
    </div>
  );
}

function usePaymentMethodsSave(props: {
  organizationId: string;
  version?: number | undefined;
  labels: CreditPaymentMethodsLabels;
  items: EditableMethod[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  async function handleSave(): Promise<void> {
    setErrorMessage(undefined);
    setNotice(undefined);
    if (!validateItems(props.items)) {
      setErrorMessage(props.labels.invalid);
      return;
    }
    setIsSaving(true);
    try {
      await updateSettings(props.organizationId, [
        {
          settingKey: CREDIT_RULE_KEY.PAYMENT_METHODS,
          value: cleanItems(props.items),
          ...(props.version === undefined ? {} : { version: props.version }),
        },
      ]);
      setNotice(props.labels.saved);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage(props.labels.conflict);
      } else {
        setErrorMessage(error instanceof Error ? error.message : props.labels.invalid);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, errorMessage, notice, handleSave };
}

interface SectionActionsProps {
  canUpdate: boolean;
  itemCount: number;
  isSaving: boolean;
  labels: CreditPaymentMethodsLabels;
  onAdd: () => void;
  onSave: () => void;
}

function SectionActions(props: SectionActionsProps): ReactElement | null {
  const { canUpdate, itemCount, isSaving, labels, onAdd, onSave } = props;
  if (!canUpdate) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {itemCount < 2 ? (
        <Button variant="secondary" onClick={onAdd}>
          {labels.add}
        </Button>
      ) : null}
      <Button onClick={onSave} isLoading={isSaving}>
        {labels.save}
      </Button>
    </div>
  );
}

interface MethodItemsListProps {
  items: readonly EditableMethod[];
  canUpdate: boolean;
  labels: CreditPaymentMethodsLabels;
  onChange: (index: number, updated: EditableMethod) => void;
  onRemove: (index: number) => void;
}

function MethodItemsList(props: MethodItemsListProps): ReactElement {
  const { items, canUpdate, labels, onChange, onRemove } = props;
  if (items.length === 0) {
    return <p className="text-body text-secondary">{labels.empty}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <MethodCard
          key={`${item.method}-${index}`}
          item={item}
          index={index}
          canUpdate={canUpdate}
          labels={labels}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

export function CreditPaymentMethodsSection(props: CreditPaymentMethodsSectionProps): ReactElement {
  const { labels, canUpdate } = props;
  const [items, setItems] = useState<EditableMethod[]>(() => props.methods.map(toEditable));
  const { isSaving, errorMessage, notice, handleSave } = usePaymentMethodsSave({
    organizationId: props.organizationId,
    version: props.version,
    labels,
    items,
  });

  function handleAdd(): void {
    const nextMethod = items.some((i) => i.method === "BKASH") ? "NAGAD" : "BKASH";
    setItems((prev) => [
      ...prev,
      {
        method: nextMethod,
        accountNumber: "",
        accountType: "Merchant",
        instructionsBn: "",
        instructionsEn: "",
      },
    ]);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-default p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-semibold text-primary">{labels.title}</h2>
        <p className="text-small text-secondary">{labels.help}</p>
      </div>
      <MethodItemsList
        items={items}
        canUpdate={canUpdate}
        labels={labels}
        onChange={(i, u) => setItems((p) => p.map((m, idx) => (idx === i ? u : m)))}
        onRemove={(i) => setItems((p) => p.filter((_, idx) => idx !== i))}
      />
      {errorMessage ? (
        <p role="alert" className="text-small text-danger">
          {errorMessage}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-small text-success">
          {notice}
        </p>
      ) : null}
      <SectionActions
        canUpdate={canUpdate}
        itemCount={items.length}
        isSaving={isSaving}
        labels={labels}
        onAdd={handleAdd}
        onSave={() => void handleSave()}
      />
    </section>
  );
}
