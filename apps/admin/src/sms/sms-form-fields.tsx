"use client";

import { FormField, TextInput, formFieldMessageId } from "@banijjik/ui";
import type { ReactElement } from "react";
import { SettingsTextField } from "../settings/settings-text-field";
import type { SmsFormState } from "./sms-state";
import type { SmsSettingsLabels } from "./sms-labels";

export type SmsFieldChange = (changes: Partial<SmsFormState>) => void;

interface FieldsProps {
  state: SmsFormState;
  labels: SmsSettingsLabels;
  disabled: boolean;
  onChange: SmsFieldChange;
}

/** A secret box: never filled with the stored value, and "saved" is said in words beside it. */
export function SecretField(props: {
  fieldId: string;
  label: string;
  value: string;
  isSaved: boolean;
  labels: SmsSettingsLabels;
  disabled: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  const { fieldId, label, labels, isSaved } = props;
  const hintId = formFieldMessageId(fieldId, "hint");
  return (
    <FormField label={label} htmlFor={fieldId} hint={labels.secret.hint}>
      <TextInput
        id={fieldId}
        name={fieldId}
        type="password"
        autoComplete="new-password"
        value={props.value}
        disabled={props.disabled}
        aria-describedby={hintId}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <p className="text-small text-secondary">
        {isSaved ? labels.secret.saved : labels.secret.notSaved}
      </p>
    </FormField>
  );
}

/** adaReach: username, password (write-only) and the masking sender name. */
export function AdareachFields(props: FieldsProps & { isSaved: boolean }): ReactElement {
  const { state, labels, disabled, onChange } = props;
  return (
    <div className="flex flex-col gap-4">
      <SettingsTextField
        fieldId="sms-adareach-username"
        label={labels.adareach.username}
        value={state.adareachUsername}
        isRequired
        disabled={disabled}
        onChange={(value) => onChange({ adareachUsername: value })}
      />
      <SecretField
        fieldId="sms-adareach-password"
        label={labels.adareach.password}
        value={state.adareachPassword}
        isSaved={props.isSaved}
        labels={labels}
        disabled={disabled}
        onChange={(value) => onChange({ adareachPassword: value })}
      />
      <SettingsTextField
        fieldId="sms-adareach-sender"
        label={labels.adareach.senderId}
        value={state.adareachSenderId}
        isRequired
        disabled={disabled}
        onChange={(value) => onChange({ adareachSenderId: value })}
      />
    </div>
  );
}

/** BulkSMSBD: the API key (write-only) and the sender ID. */
export function BulksmsbdFields(props: FieldsProps & { isSaved: boolean }): ReactElement {
  const { state, labels, disabled, onChange } = props;
  return (
    <div className="flex flex-col gap-4">
      <SecretField
        fieldId="sms-bulksmsbd-key"
        label={labels.bulksmsbd.apiKey}
        value={state.bulksmsbdApiKey}
        isSaved={props.isSaved}
        labels={labels}
        disabled={disabled}
        onChange={(value) => onChange({ bulksmsbdApiKey: value })}
      />
      <SettingsTextField
        fieldId="sms-bulksmsbd-sender"
        label={labels.bulksmsbd.senderId}
        value={state.bulksmsbdSenderId}
        isRequired
        disabled={disabled}
        onChange={(value) => onChange({ bulksmsbdSenderId: value })}
      />
    </div>
  );
}
