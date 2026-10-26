"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { SMS_PROVIDER, SMS_RULE_KEY, type SmsProvider } from "@banijjik/contracts/sms";
import { Button, Checkbox, FormField, PageSection, Select, TextInput } from "@banijjik/ui";
import { ApiError } from "@banijjik/web-client";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import type { PlatformSmsGatewayView } from "./sms-gateway-api";
import { savePlatformSmsGateway } from "./sms-gateway-api";
import type { PlatformSmsLabels } from "./sms-gateway-labels";
import {
  buildGatewayBody,
  gatewayFormStateOf,
  providerFromSelectValue,
  type SmsGatewayFormState,
} from "./sms-gateway-state";

export interface PlatformSmsGatewayFormProps {
  view: PlatformSmsGatewayView;
  labels: PlatformSmsLabels;
  /** False without `platform.sms.write`: the controls are off and Save is absent. */
  canEdit: boolean;
}

/** `conflict` asks for a reload, `incomplete` names the missing step, a key is one message from the API. */
export type PlatformSaveFailure = "conflict" | "incomplete" | { messageKey: string } | undefined;

/** Sorts a refused save into the one place the form shows it. Anything that is not an API error is a bug and is rethrown. */
export function saveFailureOf(error: unknown): PlatformSaveFailure {
  if (!(error instanceof ApiError)) throw error;
  if (error.code === ERROR_CODE.CONFLICT) return "conflict";
  if (error.details?.["ruleKey"] === SMS_RULE_KEY.GATEWAY_INCOMPLETE) return "incomplete";
  return { messageKey: error.messageKey };
}

function providerOptionsOf(labels: PlatformSmsLabels): { value: string; label: string }[] {
  return [
    { value: "", label: labels.providerNone },
    { value: SMS_PROVIDER.ADAREACH, label: labels.providerNames[SMS_PROVIDER.ADAREACH] },
    { value: SMS_PROVIDER.BULKSMSBD, label: labels.providerNames[SMS_PROVIDER.BULKSMSBD] },
  ];
}

function TextBox(props: {
  fieldId: string;
  label: string;
  value: string;
  hint?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.fieldId} hint={props.hint}>
      <TextInput
        id={props.fieldId}
        name={props.fieldId}
        autoComplete="off"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}

/** A secret box: the stored value is never filled in, and "saved" is said in words under it. */
function SecretBox(props: {
  fieldId: string;
  label: string;
  value: string;
  isSaved: boolean;
  labels: PlatformSmsLabels;
  disabled: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  const { labels, isSaved } = props;
  return (
    <div className="flex flex-col gap-2">
      <FormField label={props.label} htmlFor={props.fieldId} hint={labels.secret.hint}>
        <TextInput
          id={props.fieldId}
          name={props.fieldId}
          type="password"
          autoComplete="new-password"
          value={props.value}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </FormField>
      <p className="text-small text-secondary">
        {isSaved ? labels.secret.saved : labels.secret.notSaved}
      </p>
    </div>
  );
}

function AdareachFields(props: ProviderFieldsProps): ReactElement {
  const { state, view, labels, disabled, onChange } = props;
  return (
    <div className="flex flex-col gap-4">
      <TextBox
        fieldId="sms-adareach-username"
        label={labels.adareach.username}
        value={state.adareachUsername}
        disabled={disabled}
        onChange={(value) => onChange({ adareachUsername: value })}
      />
      <SecretBox
        fieldId="sms-adareach-password"
        label={labels.adareach.password}
        value={state.adareachPassword}
        isSaved={view.adareach?.hasPassword ?? false}
        labels={labels}
        disabled={disabled}
        onChange={(value) => onChange({ adareachPassword: value })}
      />
      <TextBox
        fieldId="sms-adareach-sender"
        label={labels.adareach.senderId}
        value={state.adareachSenderId}
        disabled={disabled}
        onChange={(value) => onChange({ adareachSenderId: value })}
      />
    </div>
  );
}

function BulksmsbdFields(props: ProviderFieldsProps): ReactElement {
  const { state, view, labels, disabled, onChange } = props;
  return (
    <div className="flex flex-col gap-4">
      <SecretBox
        fieldId="sms-bulksmsbd-key"
        label={labels.bulksmsbd.apiKey}
        value={state.bulksmsbdApiKey}
        isSaved={view.bulksmsbd?.hasApiKey ?? false}
        labels={labels}
        disabled={disabled}
        onChange={(value) => onChange({ bulksmsbdApiKey: value })}
      />
      <TextBox
        fieldId="sms-bulksmsbd-sender"
        label={labels.bulksmsbd.senderId}
        value={state.bulksmsbdSenderId}
        disabled={disabled}
        onChange={(value) => onChange({ bulksmsbdSenderId: value })}
      />
    </div>
  );
}

interface ProviderFieldsProps {
  state: SmsGatewayFormState;
  view: PlatformSmsGatewayView;
  labels: PlatformSmsLabels;
  disabled: boolean;
  onChange: (changes: Partial<SmsGatewayFormState>) => void;
}

/** Only the chosen provider's fields are shown; the other provider's values stay in the form. */
function ProviderFields(props: ProviderFieldsProps): ReactElement | null {
  const provider: SmsProvider | null = props.state.activeProvider;
  if (provider === SMS_PROVIDER.ADAREACH) return <AdareachFields {...props} />;
  if (provider === SMS_PROVIDER.BULKSMSBD) return <BulksmsbdFields {...props} />;
  return null;
}

function FailureText(props: {
  failure: PlatformSaveFailure;
  labels: PlatformSmsLabels;
}): ReactElement | null {
  const { t } = useTranslator();
  const { failure, labels } = props;
  if (failure === undefined) return null;
  const text = failureTextOf(failure, labels, t);
  return (
    <p role="alert" className="text-small text-danger">
      {text}
    </p>
  );
}

function failureTextOf(
  failure: Exclude<PlatformSaveFailure, undefined>,
  labels: PlatformSmsLabels,
  t: (key: string) => string,
): string {
  if (failure === "conflict") return labels.conflict;
  if (failure === "incomplete") return labels.incomplete;
  return t(failure.messageKey);
}

/** The switch, the provider and the chosen provider's fields. */
function GatewayFields(props: ProviderFieldsProps): ReactElement {
  const { state, labels, disabled, onChange } = props;
  return (
    <>
      <Checkbox
        id="sms-enabled"
        name="sms-enabled"
        label={labels.enabled}
        checked={state.enabled}
        disabled={disabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
      />
      <FormField label={labels.provider} htmlFor="sms-provider">
        <Select
          id="sms-provider"
          name="sms-provider"
          value={state.activeProvider ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange({ activeProvider: providerFromSelectValue(event.target.value) })
          }
        >
          {providerOptionsOf(labels).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
      <ProviderFields
        state={state}
        view={props.view}
        labels={labels}
        disabled={disabled}
        onChange={onChange}
      />
    </>
  );
}

/** The save and its failure: a toast and a refresh on success, otherwise the refusal under the form. */
async function persistGateway(
  state: SmsGatewayFormState,
  view: PlatformSmsGatewayView,
  labels: PlatformSmsLabels,
): Promise<PlatformSaveFailure> {
  try {
    await savePlatformSmsGateway(buildGatewayBody(state, view));
    // The toast library loads on demand, like the Toaster itself.
    const { toast } = await import("@banijjik/ui/toast");
    toast.success(labels.saved);
    return undefined;
  } catch (error) {
    return saveFailureOf(error);
  }
}

/** The failure text, and Save (or the read-only line when the person cannot change it). */
function PlatformSaveBar(props: {
  canEdit: boolean;
  isSaving: boolean;
  failure: PlatformSaveFailure;
  labels: PlatformSmsLabels;
}): ReactElement {
  const { canEdit, isSaving, failure, labels } = props;
  return (
    <>
      <FailureText failure={failure} labels={labels} />
      {canEdit ? (
        <Button type="submit" isLoading={isSaving} disabled={isSaving} className="min-h-11 w-full">
          {isSaving ? labels.saving : labels.save}
        </Button>
      ) : (
        <p className="text-small text-secondary">{labels.readOnly}</p>
      )}
    </>
  );
}

/** The default gateway of the platform: the same fields as a business's own. Save needs `platform.sms.write`. */
export function PlatformSmsGatewayForm(props: PlatformSmsGatewayFormProps): ReactElement {
  const { view, labels, canEdit } = props;
  const router = useRouter();
  const [state, setState] = useState<SmsGatewayFormState>(() => gatewayFormStateOf(view));
  const [failure, setFailure] = useState<PlatformSaveFailure>();
  const [isSaving, setIsSaving] = useState(false);
  const disabled = !canEdit || isSaving;

  function changeState(changes: Partial<SmsGatewayFormState>): void {
    setState((previous) => ({ ...previous, ...changes }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitGateway();
  }

  async function submitGateway(): Promise<void> {
    setIsSaving(true);
    setFailure(undefined);
    const outcome = await persistGateway(state, view, labels);
    if (outcome === undefined) router.refresh();
    else setFailure(outcome);
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <p className="text-small text-secondary">
        {view.source === "PLATFORM" ? labels.sendsNow : labels.notSetUp}
      </p>
      <PageSection title={labels.title} help={labels.subtitle}>
        <GatewayFields
          state={state}
          view={view}
          labels={labels}
          disabled={disabled}
          onChange={changeState}
        />
      </PageSection>
      <PlatformSaveBar canEdit={canEdit} isSaving={isSaving} failure={failure} labels={labels} />
    </form>
  );
}
