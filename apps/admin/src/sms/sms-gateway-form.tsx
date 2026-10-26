"use client";

import { SMS_PROVIDER } from "@banijjik/contracts/sms";
import { Button, Checkbox, PageSection } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import { ConflictNotice } from "../settings/conflict-notice";
import type { FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import { SettingsSelect } from "../settings/settings-select";
import type { SmsGatewayView } from "./sms-api";
import { AdareachFields, BulksmsbdFields, type SmsFieldChange } from "./sms-form-fields";
import type { SmsSettingsLabels } from "./sms-labels";
import { useSmsGatewaySave, type SmsGatewaySave } from "./use-sms-gateway-save";
import { providerFromSelectValue, smsFormStateOf, type SmsFormState } from "./sms-state";

export interface SmsGatewayFormProps {
  organizationId: string;
  view: SmsGatewayView;
  labels: SmsSettingsLabels;
  /** False without `sms.credential.update` or in READ_ONLY mode: the controls are off and Save is absent. */
  canEdit: boolean;
}

function providerOptionsOf(labels: SmsSettingsLabels): { value: string; label: string }[] {
  return [
    { value: "", label: labels.providerNone },
    { value: SMS_PROVIDER.ADAREACH, label: labels.providerNames[SMS_PROVIDER.ADAREACH] },
    { value: SMS_PROVIDER.BULKSMSBD, label: labels.providerNames[SMS_PROVIDER.BULKSMSBD] },
  ];
}

/** Only the chosen provider's fields are shown; the other provider's values stay in the form. */
function ProviderFields(props: {
  state: SmsFormState;
  view: SmsGatewayView;
  labels: SmsSettingsLabels;
  disabled: boolean;
  onChange: SmsFieldChange;
}): ReactElement | null {
  const { state, view, labels, disabled, onChange } = props;
  if (state.activeProvider === SMS_PROVIDER.ADAREACH) {
    const isSaved = view.adareach?.hasPassword ?? false;
    return (
      <AdareachFields
        state={state}
        labels={labels}
        disabled={disabled}
        isSaved={isSaved}
        onChange={onChange}
      />
    );
  }
  if (state.activeProvider === SMS_PROVIDER.BULKSMSBD) {
    const isSaved = view.bulksmsbd?.hasApiKey ?? false;
    return (
      <BulksmsbdFields
        state={state}
        labels={labels}
        disabled={disabled}
        isSaved={isSaved}
        onChange={onChange}
      />
    );
  }
  return null;
}

/** A version conflict asks for a reload; a refusal with no field sits under the form. */
function SaveFailure(props: {
  failure: FormFailure | undefined;
  isIncomplete: boolean;
  labels: SmsSettingsLabels;
  onReload: () => void;
}): ReactElement {
  const { failure, isIncomplete, labels } = props;
  if (isIncomplete) {
    return (
      <p role="alert" className="text-small text-danger">
        {labels.incomplete}
      </p>
    );
  }
  if (failure === undefined) return <></>;
  return (
    <>
      {failure.isConflict ? (
        <ConflictNotice
          message={labels.conflict}
          reloadLabel={labels.reload}
          onReload={props.onReload}
        />
      ) : null}
      <FormMessage failure={failure} />
    </>
  );
}

/** The failure text, the conflict notice, and Save (or the read-only line when the person cannot change it). */
function SmsSaveBar(props: {
  canEdit: boolean;
  saving: SmsGatewaySave;
  labels: SmsSettingsLabels;
}): ReactElement {
  const { canEdit, saving, labels } = props;
  return (
    <>
      <SaveFailure
        failure={saving.failure}
        isIncomplete={saving.isIncomplete}
        labels={labels}
        onReload={saving.reload}
      />
      {canEdit ? (
        <Button
          type="submit"
          isLoading={saving.isSaving}
          disabled={saving.isSaving}
          className="min-h-11 w-full"
        >
          {saving.isSaving ? labels.saving : labels.save}
        </Button>
      ) : (
        <p className="text-small text-secondary">{labels.readOnly}</p>
      )}
    </>
  );
}

/**
 * The SMS gateway of the business: the switch, the provider and its fields, Save. The secrets are
 * write-only: an empty secret box keeps the stored value. A version conflict asks for a reload.
 */
export function SmsGatewayForm(props: SmsGatewayFormProps): ReactElement {
  const { view, labels, canEdit, organizationId } = props;
  const [state, setState] = useState<SmsFormState>(() => smsFormStateOf(view));
  const saving = useSmsGatewaySave({ organizationId, state, view, labels });
  const disabled = !canEdit || saving.isSaving;

  function changeState(changes: Partial<SmsFormState>): void {
    setState((previous) => ({ ...previous, ...changes }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void saving.save();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <p className="text-small text-secondary">
        {fillLabel(labels.sendsVia, { via: labels.sourceNames[view.source] })}
      </p>
      <PageSection title={labels.title} help={labels.subtitle}>
        <Checkbox
          id="sms-enabled"
          name="sms-enabled"
          label={labels.enabled}
          checked={state.enabled}
          disabled={disabled}
          onChange={(event) => changeState({ enabled: event.target.checked })}
        />
        <SettingsSelect
          fieldId="sms-provider"
          label={labels.provider}
          value={state.activeProvider ?? ""}
          options={providerOptionsOf(labels)}
          disabled={disabled}
          onChange={(value) => changeState({ activeProvider: providerFromSelectValue(value) })}
        />
        <ProviderFields
          state={state}
          view={view}
          labels={labels}
          disabled={disabled}
          onChange={changeState}
        />
      </PageSection>
      <SmsSaveBar canEdit={canEdit} saving={saving} labels={labels} />
    </form>
  );
}
