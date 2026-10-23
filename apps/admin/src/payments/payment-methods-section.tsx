"use client";

import {
  ACCEPTED_PAYMENT_METHODS,
  PAYMENT_METHODS_SETTING_KEY,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import { Button } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { ApiError } from "../lib/api/api-error";
import { updateSettings } from "../lib/api/tenant-config-api";

export interface PaymentMethodsSectionProps {
  readonly organizationId: string;
  readonly methods: readonly PaymentMethod[];
  readonly version?: number | undefined;
  readonly canUpdate: boolean;
  readonly labels: {
    readonly title: string;
    readonly help: string;
    readonly empty: string;
    readonly save: string;
    readonly saved: string;
    readonly conflict: string;
    readonly invalid: string;
    readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
  };
}

interface MethodCheckboxProps {
  readonly method: PaymentMethod;
  readonly isEnabled: boolean;
  readonly canUpdate: boolean;
  readonly label: string;
  readonly onToggle: (m: PaymentMethod) => void;
}

function MethodCheckbox(props: MethodCheckboxProps): ReactElement {
  const { method, isEnabled, canUpdate, label, onToggle } = props;
  const checkboxId = `method-toggle-${method}`;
  return (
    <label
      htmlFor={checkboxId}
      className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
        isEnabled
          ? "border-primary bg-primary/5 text-primary"
          : "border-default bg-surface-muted text-secondary"
      } ${!canUpdate ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        id={checkboxId}
        type="checkbox"
        checked={isEnabled}
        disabled={!canUpdate}
        onChange={() => onToggle(method)}
        className="h-4 w-4 rounded border-default text-primary focus:ring-accent"
      />
      <span className="text-body font-medium">{label}</span>
    </label>
  );
}

async function saveMethodsSettings(opts: {
  readonly organizationId: string;
  readonly selectedMethods: readonly PaymentMethod[];
  readonly version?: number | undefined;
}): Promise<void> {
  await updateSettings(opts.organizationId, [
    {
      settingKey: PAYMENT_METHODS_SETTING_KEY,
      value: opts.selectedMethods,
      ...(opts.version === undefined ? {} : { version: opts.version }),
    },
  ]);
}

function resolveSettingError(error: unknown, conflictLabel: string, invalidLabel: string): string {
  if (error instanceof ApiError && error.status === 409) return conflictLabel;
  return error instanceof Error ? error.message : invalidLabel;
}

function MethodCheckboxesGrid(props: {
  readonly selectedMethods: readonly PaymentMethod[];
  readonly canUpdate: boolean;
  readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
  readonly onToggle: (m: PaymentMethod) => void;
}): ReactElement {
  const { selectedMethods, canUpdate, methodLabels, onToggle } = props;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {ACCEPTED_PAYMENT_METHODS.map((method) => (
        <MethodCheckbox
          key={method}
          method={method}
          isEnabled={selectedMethods.includes(method)}
          canUpdate={canUpdate}
          label={methodLabels[method] ?? method}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function usePaymentMethodsState(props: PaymentMethodsSectionProps, routerRefresh: () => void) {
  const [selectedMethods, setSelectedMethods] = useState<readonly PaymentMethod[]>(
    props.methods.length > 0 ? props.methods : ACCEPTED_PAYMENT_METHODS,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  function toggleMethod(method: PaymentMethod): void {
    if (!props.canUpdate) return;
    const next = selectedMethods.includes(method)
      ? selectedMethods.filter((m) => m !== method)
      : [...selectedMethods, method];
    setSelectedMethods(next);
  }

  async function handleSave(): Promise<void> {
    setErrorMessage(undefined);
    setNotice(undefined);
    if (selectedMethods.length === 0) {
      setErrorMessage(props.labels.empty);
      return;
    }
    setIsSaving(true);
    try {
      await saveMethodsSettings({
        organizationId: props.organizationId,
        selectedMethods,
        version: props.version,
      });
      setNotice(props.labels.saved);
      routerRefresh();
    } catch (error) {
      setErrorMessage(resolveSettingError(error, props.labels.conflict, props.labels.invalid));
    } finally {
      setIsSaving(false);
    }
  }

  return { selectedMethods, isSaving, errorMessage, notice, toggleMethod, handleSave };
}

export function PaymentMethodsSection(props: PaymentMethodsSectionProps): ReactElement {
  const router = useRouter();
  const state = usePaymentMethodsState(props, () => router.refresh());

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-semibold text-primary">{props.labels.title}</h2>
        <p className="text-body-sm text-secondary">{props.labels.help}</p>
      </div>

      <MethodCheckboxesGrid
        selectedMethods={state.selectedMethods}
        canUpdate={props.canUpdate}
        methodLabels={props.labels.methodLabels}
        onToggle={state.toggleMethod}
      />

      {state.notice ? <p className="text-body-sm text-success">{state.notice}</p> : null}
      {state.errorMessage ? <p className="text-body-sm text-error">{state.errorMessage}</p> : null}

      {props.canUpdate ? (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            isLoading={state.isSaving}
            disabled={state.isSaving || state.selectedMethods.length === 0}
            onClick={() => void state.handleSave()}
          >
            {props.labels.save}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
