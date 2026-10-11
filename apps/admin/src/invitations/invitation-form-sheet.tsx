"use client";

import type { InvitationCreateRequest } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { mapApiError, type MappedApiError } from "../auth/map-api-error";
import { ApiError } from "../lib/api/api-error";
import { createInvitation } from "../lib/api/organization-api";
import { useTranslator } from "../lib/i18n/i18n-provider";
import { failureOfAssignmentError } from "../staff/assignment-errors";
import type { AssignmentOptions } from "../staff/assignment-options";
import { AssignmentRowsEditor } from "../staff/assignment-rows-editor";
import {
  emptyRow,
  toAssignmentRequests,
  validateRows,
  type AssignmentRow,
  type RowErrors,
} from "../staff/assignment-rows";
import { keyForSubmit, type KeyedSubmit } from "./idempotency-keeper";
import type { InviteLabels } from "./invite-labels";
import { InviteLinkPanel } from "./invite-link-panel";

export interface InvitationFormSheetProps {
  organizationId: string;
  options: AssignmentOptions;
  labels: InviteLabels;
  onClose: () => void;
}

const FIELD_NAMES = ["identifier", "displayName"];

interface FormState {
  identifier: string;
  displayName: string;
  rows: AssignmentRow[];
}

/** One identifier field takes a phone number or an email; an `@` means email, as at sign-in. */
function buildBody(form: FormState, options: AssignmentOptions): InvitationCreateRequest {
  const trimmed = form.identifier.trim();
  const name = form.displayName.trim();
  return {
    ...(trimmed.includes("@") ? { email: trimmed } : { phone: trimmed }),
    ...(name === "" ? {} : { displayName: name }),
    assignments: toAssignmentRequests(form.rows, options.isSingleLocation),
  };
}

/** Everything that can go wrong in one submit, placed on the field, the row or under the form. */
function useInvitationSubmit(props: InvitationFormSheetProps, form: FormState) {
  const { organizationId, options } = props;
  const router = useRouter();
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<MappedApiError>({ fieldErrors: {} });
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({});
  const [linkPath, setLinkPath] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(): Promise<void> {
    const foundRows = validateRows(form.rows, options.isSingleLocation);
    const missingIdentifier = form.identifier.trim() === "";
    setRowErrors(foundRows);
    setFieldErrors({
      fieldErrors: missingIdentifier ? { identifier: "validation.identifier_required" } : {},
    });
    if (missingIdentifier || Object.keys(foundRows).length > 0) return;
    const body = buildBody(form, options);
    lastSubmit.current = keyForSubmit(lastSubmit.current, JSON.stringify(body), newId);
    setIsSubmitting(true);
    try {
      const created = await createInvitation(organizationId, body, lastSubmit.current.key);
      // A new submit after this one is a different invitation: it must not reuse the key.
      lastSubmit.current = undefined;
      setLinkPath(created.inviteUrlPath);
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const rowFailure = failureOfAssignmentError(error, form.rows);
      setRowErrors(rowFailure.rowErrors);
      const mapped = mapApiError(error, FIELD_NAMES);
      const hasRowError = Object.keys(rowFailure.rowErrors).length > 0;
      setFieldErrors(hasRowError ? { fieldErrors: mapped.fieldErrors } : mapped);
    }
    setIsSubmitting(false);
  }

  return { fieldErrors, rowErrors, linkPath, isSubmitting, submit };
}

function PersonFields({
  form,
  labels,
  errors,
  onChange,
}: {
  form: FormState;
  labels: InviteLabels;
  errors: Partial<Record<string, string>>;
  onChange: (form: FormState) => void;
}): ReactElement {
  const { t } = useTranslator();
  const identifierError = errors["identifier"];
  const nameError = errors["displayName"];
  return (
    <>
      <FormField
        label={labels.identifier}
        htmlFor="invite-identifier"
        hint={labels.identifierHint}
        error={identifierError ? t(identifierError) : undefined}
        required
      >
        <TextInput
          id="invite-identifier"
          name="identifier"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={form.identifier}
          aria-invalid={identifierError ? true : undefined}
          onChange={(event) => onChange({ ...form, identifier: event.target.value })}
        />
      </FormField>
      <FormField
        label={labels.displayName}
        htmlFor="invite-name"
        error={nameError ? t(nameError) : undefined}
      >
        <TextInput
          id="invite-name"
          name="displayName"
          value={form.displayName}
          onChange={(event) => onChange({ ...form, displayName: event.target.value })}
        />
      </FormField>
    </>
  );
}

function InvitationForm(props: InvitationFormSheetProps): ReactElement {
  const { options, labels } = props;
  const { t } = useTranslator();
  const [form, setForm] = useState<FormState>({
    identifier: "",
    displayName: "",
    rows: [emptyRow(options.isSingleLocation)],
  });
  const state = useInvitationSubmit(props, form);
  if (state.linkPath) {
    return <InviteLinkPanel linkPath={state.linkPath} labels={labels} onDone={props.onClose} />;
  }
  const formMessage = state.fieldErrors.formMessage;
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <PersonFields
        form={form}
        labels={labels}
        errors={state.fieldErrors.fieldErrors}
        onChange={setForm}
      />
      <AssignmentRowsEditor
        idPrefix="invite"
        rows={form.rows}
        options={options}
        errors={state.rowErrors}
        labels={labels.assignments}
        onChange={(rows) => setForm({ ...form, rows })}
      />
      {formMessage ? (
        <p role="alert" className="text-small text-danger">
          {t(formMessage.messageKey, formMessage.values)}
        </p>
      ) : null}
      <Button type="submit" isLoading={state.isSubmitting}>
        {labels.submit}
      </Button>
    </form>
  );
}

/** Loaded on the first tap of "New invitation". The sheet holds the form, then the one-time link. */
export function InvitationFormSheet(props: InvitationFormSheetProps): ReactElement {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.title} closeLabel={props.labels.close}>
        <InvitationForm {...props} />
      </SheetContent>
    </Sheet>
  );
}
