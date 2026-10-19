"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { removeApprovalPin, setApprovalPin } from "./approval-pin-api";

export interface ApprovalPinSectionProps {
  organizationId: string;
}

/** Set, change or remove the manager approval PIN from the account menu (card 3.4b). */
export function ApprovalPinSection(props: ApprovalPinSectionProps): ReactElement {
  const { t } = useTranslator();
  const form = useApprovalPinForm(props.organizationId);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-small font-semibold text-secondary">{t("account.approvalPin.title")}</h3>
      <p className="text-small text-secondary">{t("account.approvalPin.hint")}</p>
      <form className="flex flex-col gap-3" onSubmit={(event) => void form.onSave(event)}>
        <FormField label={t("account.approvalPin.currentPassword")} htmlFor="approval-pin-password">
          <TextInput
            id="approval-pin-password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => form.setPassword(event.target.value)}
            disabled={form.isBusy}
          />
        </FormField>
        <FormField label={t("account.approvalPin.pin")} htmlFor="approval-pin-value">
          <TextInput
            id="approval-pin-value"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={form.pin}
            onChange={(event) => form.setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
            disabled={form.isBusy}
          />
        </FormField>
        {form.errorKey !== undefined ? (
          <p className="text-small text-danger" role="alert">
            {t(knownMessageKeyOrInternal(form.errorKey))}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="primary" disabled={form.isBusy || form.pin.length < 4}>
            {t("account.approvalPin.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={form.isBusy}
            onClick={() => void form.onRemove()}
          >
            {t("account.approvalPin.remove")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function useApprovalPinForm(organizationId: string) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [errorKey, setErrorKey] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);

  function clearFields(): void {
    setPassword("");
    setPin("");
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setIsBusy(true);
    setErrorKey(undefined);
    try {
      await action();
      clearFields();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : "errors.internal");
    } finally {
      setIsBusy(false);
    }
  }

  return {
    password,
    setPassword,
    pin,
    setPin,
    errorKey,
    isBusy,
    onSave: (event: FormEvent) => {
      event.preventDefault();
      return run(() => setApprovalPin(organizationId, { currentPassword: password, pin }));
    },
    onRemove: () => run(() => removeApprovalPin(organizationId)),
  };
}
