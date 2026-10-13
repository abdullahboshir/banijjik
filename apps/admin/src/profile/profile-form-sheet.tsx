"use client";

import { PREFERRED_LOCALE, type PreferredLocale } from "@banijjik/contracts";
import { Button, FormField, Select, Sheet, SheetContent } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { ConflictNotice } from "../settings/conflict-notice";
import { failureOfApiError, NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import { SettingsTextField } from "../settings/settings-text-field";
import { tidyPhone } from "../settings/tidy-phone";
import { buildProfileUpdate } from "./profile-form";
import type { ProfileFormLabels } from "./profile-labels";
import { updateProfile } from "./profile-api";
import { PROFILE_FIELD_NAMES, type ProfileFormState } from "./profile-state";

export interface ProfileFormSheetProps {
  organizationId: string;
  initial: ProfileFormState;
  /** The version the page was drawn from; a stale one is refused with a 409. */
  version: number;
  labels: ProfileFormLabels;
  onClose: () => void;
}

interface SectionProps {
  form: ProfileFormState;
  labels: ProfileFormLabels;
  errors: FieldErrors;
  onChange: (changes: Partial<ProfileFormState>) => void;
}

function TextFields({
  names,
  props,
  inputMode,
}: {
  names: readonly (keyof ProfileFormState)[];
  props: SectionProps;
  inputMode?: "tel" | "email";
}): ReactElement {
  const { form, labels, errors, onChange } = props;
  return (
    <>
      {names.map((name) => (
        <SettingsTextField
          key={name}
          fieldId={`profile-${name}`}
          label={labels.fields[name]}
          value={form[name]}
          errorKey={errors[name]}
          isRequired={name === "name"}
          inputMode={inputMode}
          onChange={(value) => onChange({ [name]: value })}
          onBlur={
            name === "businessPhone" ? () => onChange({ [name]: tidyPhone(form[name]) }) : undefined
          }
        />
      ))}
    </>
  );
}

function LocaleSelect({ form, labels, onChange }: SectionProps): ReactElement {
  return (
    <FormField label={labels.fields.defaultLocale} htmlFor="profile-defaultLocale">
      <Select
        id="profile-defaultLocale"
        value={form.defaultLocale}
        onChange={(event) =>
          // The option values are the PREFERRED_LOCALE members; the DOM types the value as a plain string.
          onChange({ defaultLocale: event.target.value as PreferredLocale })
        }
      >
        {Object.values(PREFERRED_LOCALE).map((locale) => (
          <option key={locale} value={locale}>
            {labels.locales[locale]}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-title font-semibold text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

function useProfileSubmit(props: ProfileFormSheetProps, form: ProfileFormState) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(): Promise<void> {
    const result = buildProfileUpdate(form, props.version, props.initial);
    setFailure(NO_FAILURE);
    setErrors(result.ok ? {} : result.fieldErrors);
    if (!result.ok) return;
    setIsSaving(true);
    try {
      await updateProfile(props.organizationId, result.body);
      props.onClose();
      router.refresh();
      return;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOfApiError(error, PROFILE_FIELD_NAMES);
      setErrors(refused.fieldErrors);
      setFailure(refused);
    }
    setIsSaving(false);
  }

  return { errors, failure, isSaving, submit, reload: () => router.refresh() };
}

function ProfileForm(props: ProfileFormSheetProps): ReactElement {
  const { labels } = props;
  const [form, setForm] = useState<ProfileFormState>(props.initial);
  const state = useProfileSubmit(props, form);
  const section: SectionProps = {
    form,
    labels,
    errors: state.errors,
    onChange: (changes) => setForm({ ...form, ...changes }),
  };
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-small text-secondary">{labels.keepHint}</p>
      <Section title={labels.sections.business}>
        <TextFields names={["name"]} props={section} />
        <LocaleSelect {...section} />
      </Section>
      <Section title={labels.sections.legal}>
        <TextFields names={["legalName", "legalType", "tradeLicenseNumber"]} props={section} />
        <TextFields names={["businessPhone"]} props={section} inputMode="tel" />
        <TextFields names={["businessEmail"]} props={section} inputMode="email" />
      </Section>
      <Section title={labels.sections.address}>
        <TextFields names={["line1", "area", "thana", "district", "postalCode"]} props={section} />
      </Section>
      {state.failure.isConflict ? (
        <ConflictNotice
          message={labels.conflict}
          reloadLabel={labels.reload}
          onReload={state.reload}
        />
      ) : null}
      <FormMessage failure={state.failure} />
      <Button type="submit" isLoading={state.isSaving}>
        {labels.submit}
      </Button>
    </form>
  );
}

/** Loaded on the first tap of "Edit". A stale version is a 409 with a reload hint. */
export function ProfileFormSheet(props: ProfileFormSheetProps): ReactElement {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.title} closeLabel={props.labels.close}>
        <ProfileForm {...props} />
      </SheetContent>
    </Sheet>
  );
}
