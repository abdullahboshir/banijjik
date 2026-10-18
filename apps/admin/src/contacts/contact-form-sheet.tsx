"use client";

import type { ContactRole } from "@banijjik/contracts";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { fieldsForContactRoles } from "@banijjik/web-client/client";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactElement } from "react";
import { CustomFieldsSection } from "../custom-fields/custom-fields-section";
import {
  useCustomFieldsForm,
  type CustomFieldsFormProps,
} from "../custom-fields/use-custom-fields-form";
import { SheetFeedback } from "../settings/sheet-feedback";
import { SettingsTextField } from "../settings/settings-text-field";
import {
  emptyContactForm,
  formOfContact,
  type ContactFormInitial,
  type ContactFormState,
} from "./contact-form";
import { useContactSubmit, type Duplicate } from "./use-contact-submit";
import type { RoleOption } from "./contact-labels";
import { RoleChips } from "./role-chips";

export interface ContactFormLabels {
  createTitle: string;
  editTitle: string;
  close: string;
  save: string;
  conflict: string;
  reload: string;
  name: string;
  phone: string;
  phoneHint: string;
  email: string;
  roles: string;
  /** Said when the phone already belongs to a contact, with the business's word for a contact filled in. */
  duplicate: string;
  openExisting: string;
}

export interface ContactFormSheetProps {
  organizationId: string;
  /** The contact being edited; absent when the sheet adds one. */
  contact?: ContactFormInitial;
  roleOptions: readonly RoleOption[];
  /** The roles a new contact starts with. */
  defaultRoles: ContactRole[];
  /** All contact fields of the business; the sheet shows the ones that apply to the chosen roles. */
  customFields: CustomFieldsFormProps;
  /** `/{orgSlug}/contacts`, where "Open" leads (the contact id is appended). */
  listPath: string;
  labels: ContactFormLabels;
  onClose: () => void;
}

function DuplicateNotice(props: {
  duplicate: Duplicate | undefined;
  listPath: string;
  labels: ContactFormLabels;
}): ReactElement | null {
  if (props.duplicate === undefined) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 text-small text-danger">
      <p>{props.labels.duplicate}</p>
      <Link
        href={`${props.listPath}/${props.duplicate.contactId}`}
        className="inline-flex min-h-11 items-center text-body text-brand underline"
      >
        {props.labels.openExisting}
      </Link>
    </div>
  );
}

function IdentityFields(props: {
  form: ContactFormState;
  labels: ContactFormLabels;
  errors: Partial<Record<string, string>>;
  onChange: (changes: Partial<ContactFormState>) => void;
}): ReactElement {
  const { form, labels, errors } = props;
  return (
    <>
      <SettingsTextField
        fieldId="contact-name"
        label={labels.name}
        value={form.name}
        errorKey={errors["name"]}
        autoComplete="off"
        onChange={(value) => props.onChange({ name: value })}
      />
      <SettingsTextField
        fieldId="contact-phone"
        label={labels.phone}
        hint={labels.phoneHint}
        value={form.phone}
        errorKey={errors["phoneE164"]}
        inputMode="tel"
        autoComplete="off"
        onChange={(value) => props.onChange({ phone: value })}
      />
      <SettingsTextField
        fieldId="contact-email"
        label={labels.email}
        value={form.email}
        errorKey={errors["email"]}
        inputMode="email"
        autoComplete="off"
        onChange={(value) => props.onChange({ email: value })}
      />
    </>
  );
}

/** The fields of the 2.5 block for the chosen roles; a role change shows or hides fields at once (ADR-113). */
function useRoleFields(
  customFields: CustomFieldsFormProps,
  roles: readonly ContactRole[],
): CustomFieldsFormProps {
  return useMemo(
    () => ({ ...customFields, fields: fieldsForContactRoles(customFields.fields, roles) }),
    [customFields, roles],
  );
}

/**
 * Adds a contact, or edits one. The extra fields shown are the template's fields for the chosen roles,
 * and a phone that already belongs to a contact is answered with "open existing" (ADR-110). A create
 * carries an Idempotency-Key, so a retry never adds the person twice.
 */
export function ContactFormSheet(props: ContactFormSheetProps): ReactElement {
  const { organizationId, contact, labels } = props;
  const [form, setForm] = useState<ContactFormState>(
    contact ? formOfContact(contact) : emptyContactForm(props.defaultRoles),
  );
  const roleFields = useRoleFields(props.customFields, form.roles);
  const fieldsForm = useCustomFieldsForm(roleFields);
  const { state, duplicate } = useContactSubmit({ sheet: props, form, fieldsForm });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent
        title={contact ? labels.editTitle : labels.createTitle}
        closeLabel={labels.close}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <RoleChips
            label={labels.roles}
            options={props.roleOptions}
            chosen={form.roles}
            errorKey={state.errors["contactRoles"]}
            onChange={(roles) => setForm({ ...form, roles })}
          />
          <IdentityFields
            form={form}
            labels={labels}
            errors={state.errors}
            onChange={(changes) => setForm({ ...form, ...changes })}
          />
          <CustomFieldsSection
            idPrefix="contact-custom"
            organizationId={organizationId}
            props={roleFields}
            form={fieldsForm}
          />
          <DuplicateNotice duplicate={duplicate} listPath={props.listPath} labels={labels} />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
