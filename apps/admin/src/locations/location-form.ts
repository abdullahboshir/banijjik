import {
  locationCreateRequestSchema,
  locationUpdateRequestSchema,
  type LocationCreateBody,
  type LocationUpdateBody,
} from "@banijjik/validation";
import type { z } from "zod";
import { issuesToFieldErrors, type FieldErrors } from "../auth/field-errors";
import { clearableAddress, clearableText } from "../settings/clearable-fields";
import { EMPTY_LOCATION_FORM, type LocationFormState } from "./location-state";

const FORM_FIELD_BY_API_FIELD: Readonly<Record<string, string>> = { phoneE164: "locationPhone" };

export type LocationFormResult<Body> =
  { ok: true; body: Body } | { ok: false; fieldErrors: FieldErrors };

/**
 * An optional field that is empty is left out, so the API keeps the saved value, unless it was
 * filled when the form opened (`initial`): then `null` tells the API to clear it. A new location
 * has no `initial`, so nothing is ever cleared there.
 */
function candidateOf(form: LocationFormState, initial: LocationFormState): Record<string, unknown> {
  const optional = {
    address: clearableAddress(form, initial),
    phoneE164: clearableText(form.locationPhone, initial.locationPhone),
    timezone: clearableText(form.timezone, initial.timezone),
  };
  const present = Object.entries(optional).filter(([, value]) => value !== undefined);
  return { name: form.name, locationType: form.locationType, ...Object.fromEntries(present) };
}

function fieldNameOf(path: readonly PropertyKey[]): string {
  const last = String(path[path.length - 1] ?? "");
  return FORM_FIELD_BY_API_FIELD[last] ?? last;
}

function toFieldErrors(issues: readonly z.core.$ZodIssue[], form: LocationFormState): FieldErrors {
  const named = issues.map((issue) => ({ ...issue, path: [fieldNameOf(issue.path)] }));
  // Safe: every field of the form state is text, which is all the empty-field check reads.
  return issuesToFieldErrors(named, form as unknown as Record<string, string>);
}

export function buildLocationCreate(
  form: LocationFormState,
): LocationFormResult<LocationCreateBody> {
  const parsed = locationCreateRequestSchema.safeParse(candidateOf(form, EMPTY_LOCATION_FORM));
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, fieldErrors: toFieldErrors(parsed.error.issues, form) };
}

export function buildLocationUpdate(
  form: LocationFormState,
  version: number,
  initial: LocationFormState,
): LocationFormResult<LocationUpdateBody> {
  const parsed = locationUpdateRequestSchema.safeParse({ ...candidateOf(form, initial), version });
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, fieldErrors: toFieldErrors(parsed.error.issues, form) };
}
