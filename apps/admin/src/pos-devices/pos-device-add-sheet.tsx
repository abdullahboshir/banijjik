"use client";

import type { PosDeviceCreatedResponse } from "@banijjik/contracts/pos";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import type { PosDeviceCreateBody } from "@banijjik/validation/pos";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { failureOfApiError, NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import { SettingsSelect } from "../settings/settings-select";
import { SettingsTextField } from "../settings/settings-text-field";
import { PosDeviceCodeView } from "./pos-device-code-view";
import { createPosDevice } from "./pos-devices-api";
import type { PosDeviceAddLabels } from "./pos-devices-labels";

export interface PosDeviceLocationOption {
  readonly locationId: string;
  readonly name: string;
}

export interface PosDeviceAddSheetProps {
  organizationId: string;
  locations: readonly PosDeviceLocationOption[];
  /** The location the page is filtered to, or the first location the caller may use. */
  defaultLocationId: string | undefined;
  labels: PosDeviceAddLabels;
  onClose: () => void;
}

const FORM_FIELD_NAMES = ["name", "locationId"] as const;

interface Draft {
  readonly name: string;
  readonly locationId: string;
}

type Checked =
  | { readonly ok: true; readonly body: PosDeviceCreateBody }
  | { readonly ok: false; readonly fieldErrors: FieldErrors };

/** Refuses an empty name or a missing location before the API is called. */
function checkDraft(draft: Draft): Checked {
  const name = draft.name.trim();
  const fieldErrors: FieldErrors = {};
  if (name === "") fieldErrors["name"] = "validation.required";
  if (draft.locationId === "") fieldErrors["locationId"] = "validation.required";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, body: { name, locationId: draft.locationId } };
}

/**
 * Sends the add. A refusal is sorted into the form's places (a field, the limit, under the form). The
 * answer that carries the code goes to `onCreated`; nothing keeps it after the sheet closes.
 */
function useAddSubmit(
  organizationId: string,
  onCreated: (created: PosDeviceCreatedResponse) => void,
) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function send(draft: Draft): Promise<void> {
    setErrors({});
    setFailure(NO_FAILURE);
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setErrors(checked.fieldErrors);
      return;
    }
    setIsSaving(true);
    try {
      onCreated(await createPosDevice(organizationId, checked.body));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOfApiError(error, FORM_FIELD_NAMES);
      setErrors(refused.fieldErrors);
      setFailure(refused);
      setIsSaving(false);
    }
  }

  return { errors, failure, isSaving, send };
}

function PosDeviceAddForm(
  props: PosDeviceAddSheetProps & { onCreated: (created: PosDeviceCreatedResponse) => void },
): ReactElement {
  const { organizationId, locations, labels, onCreated } = props;
  const [draft, setDraft] = useState<Draft>({
    name: "",
    locationId: props.defaultLocationId ?? locations[0]?.locationId ?? "",
  });
  const submit = useAddSubmit(organizationId, onCreated);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit.send(draft);
  }

  const locationOptions = locations.map((location) => ({
    value: location.locationId,
    label: location.name,
  }));
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <SettingsTextField
        fieldId="pos-device-name"
        label={labels.name}
        value={draft.name}
        errorKey={submit.errors["name"]}
        isRequired
        onChange={(name) => setDraft({ ...draft, name })}
      />
      <SettingsSelect
        fieldId="pos-device-location"
        label={labels.location}
        value={draft.locationId}
        options={locationOptions}
        onChange={(locationId) => setDraft({ ...draft, locationId })}
      />
      {submit.failure.isLimit && labels.limitReached ? (
        <p role="alert" className="text-small text-danger">
          {labels.limitReached}
        </p>
      ) : null}
      <FormMessage failure={submit.failure} />
      <Button type="submit" isLoading={submit.isSaving}>
        {labels.submit}
      </Button>
    </form>
  );
}

/** Add a till: the form first, then the one-time code. The list reloads when the sheet closes. */
export function PosDeviceAddSheet(props: PosDeviceAddSheetProps): ReactElement {
  const { labels, onClose } = props;
  const router = useRouter();
  const [created, setCreated] = useState<PosDeviceCreatedResponse | undefined>();

  function close(): void {
    onClose();
    if (created !== undefined) router.refresh();
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : close())}>
      <SheetContent title={labels.title} closeLabel={labels.close}>
        {created ? (
          <PosDeviceCodeView created={created} labels={labels} onDone={close} />
        ) : (
          <PosDeviceAddForm {...props} onCreated={setCreated} />
        )}
      </SheetContent>
    </Sheet>
  );
}
