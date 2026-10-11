"use client";

import { LOCATION_TYPE, type LocationType } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { ApiError } from "../lib/api/api-error";
import { ConflictNotice } from "../settings/conflict-notice";
import { failureOfApiError, NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import { SettingsSelect } from "../settings/settings-select";
import { SettingsTextField } from "../settings/settings-text-field";
import { tidyPhone } from "../settings/tidy-phone";
import { createLocation, updateLocation } from "./location-api";
import { buildLocationCreate, buildLocationUpdate } from "./location-form";
import type { LocationFormLabels } from "./location-labels";
import { LOCATION_FIELD_NAMES, LOCATION_TIMEZONES, type LocationFormState } from "./location-state";

/** The location being edited; absent when the sheet adds one. */
export interface EditedLocation {
  locationId: string;
  /** The version the page was drawn from; a stale one is refused with a 409. */
  version: number;
}

export interface LocationFormSheetProps {
  organizationId: string;
  initial: LocationFormState;
  location?: EditedLocation;
  labels: LocationFormLabels;
  onClose: () => void;
}

interface FieldsProps {
  form: LocationFormState;
  labels: LocationFormLabels;
  errors: FieldErrors;
  onChange: (changes: Partial<LocationFormState>) => void;
}

function TextFields({
  names,
  props,
}: {
  names: readonly (keyof LocationFormState)[];
  props: FieldsProps;
}): ReactElement {
  const { form, labels, errors, onChange } = props;
  return (
    <>
      {names.map((name) => (
        <SettingsTextField
          key={name}
          fieldId={`location-${name}`}
          label={labels.fields[name]}
          value={form[name]}
          errorKey={errors[name]}
          isRequired={name === "name"}
          inputMode={name === "locationPhone" ? "tel" : undefined}
          onChange={(value) => onChange({ [name]: value })}
          onBlur={
            name === "locationPhone" ? () => onChange({ [name]: tidyPhone(form[name]) }) : undefined
          }
        />
      ))}
    </>
  );
}

function ChoiceFields({ form, labels, onChange }: FieldsProps): ReactElement {
  const typeOptions = Object.values(LOCATION_TYPE).map((type) => ({
    value: type,
    label: labels.types[type],
  }));
  const timezoneOptions = [
    { value: "", label: labels.businessTimezone },
    ...LOCATION_TIMEZONES.map((zone) => ({ value: zone, label: zone })),
  ];
  return (
    <>
      <SettingsSelect
        fieldId="location-locationType"
        label={labels.fields.locationType}
        value={form.locationType}
        options={typeOptions}
        // Safe: the options are the location types, so the chosen value is one of them.
        onChange={(value) => onChange({ locationType: value as LocationType })}
      />
      <SettingsSelect
        fieldId="location-timezone"
        label={labels.fields.timezone}
        value={form.timezone}
        options={timezoneOptions}
        onChange={(value) => onChange({ timezone: value })}
      />
    </>
  );
}

function useLocationSubmit(props: LocationFormSheetProps, form: LocationFormState) {
  const { organizationId, location } = props;
  const router = useRouter();
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function send(): Promise<boolean> {
    if (location) {
      const update = buildLocationUpdate(form, location.version);
      if (!update.ok) return rejectForm(update.fieldErrors);
      await updateLocation(organizationId, location.locationId, update.body);
      return true;
    }
    const create = buildLocationCreate(form);
    if (!create.ok) return rejectForm(create.fieldErrors);
    // A retry of the same submit carries the same key, so the location is never created twice.
    lastSubmit.current = keyForSubmit(lastSubmit.current, JSON.stringify(create.body), newId);
    await createLocation(organizationId, create.body, lastSubmit.current.key);
    lastSubmit.current = undefined;
    return true;
  }

  function rejectForm(fieldErrors: FieldErrors): boolean {
    setErrors(fieldErrors);
    return false;
  }

  async function submit(): Promise<void> {
    setErrors({});
    setFailure(NO_FAILURE);
    setIsSaving(true);
    try {
      if (await send()) {
        props.onClose();
        router.refresh();
        return;
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOfApiError(error, LOCATION_FIELD_NAMES);
      setErrors(refused.fieldErrors);
      setFailure(refused);
    }
    setIsSaving(false);
  }

  return { errors, failure, isSaving, submit, reload: () => router.refresh() };
}

function LimitNotice({ message }: { message: string | undefined }): ReactElement | null {
  if (!message) return null;
  return (
    <p role="alert" className="text-small text-danger">
      {message}
    </p>
  );
}

function LocationForm(props: LocationFormSheetProps): ReactElement {
  const { labels } = props;
  const [form, setForm] = useState<LocationFormState>(props.initial);
  const state = useLocationSubmit(props, form);
  const fields: FieldsProps = {
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <TextFields names={["name"]} props={fields} />
      <ChoiceFields {...fields} />
      <TextFields names={["locationPhone"]} props={fields} />
      <TextFields names={["line1", "area", "thana", "district", "postalCode"]} props={fields} />
      {state.failure.isConflict ? (
        <ConflictNotice
          message={labels.conflict}
          reloadLabel={labels.reload}
          onReload={state.reload}
        />
      ) : null}
      {state.failure.isLimit ? <LimitNotice message={labels.limitReached} /> : null}
      <FormMessage failure={state.failure} />
      <Button type="submit" isLoading={state.isSaving}>
        {labels.submit}
      </Button>
    </form>
  );
}

/** Loaded on the first tap of "Add location" or "Edit". A create carries an Idempotency-Key. */
export function LocationFormSheet(props: LocationFormSheetProps): ReactElement {
  const title = props.location ? props.labels.editTitle : props.labels.createTitle;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={title} closeLabel={props.labels.close}>
        <LocationForm {...props} />
      </SheetContent>
    </Sheet>
  );
}
