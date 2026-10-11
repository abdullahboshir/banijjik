import {
  locationCreateRequestSchema,
  locationUpdateRequestSchema,
  type LocationCreateBody,
  type LocationUpdateBody,
} from "@banijjik/validation";
import type { z } from "zod";
import { issuesToFieldErrors, type FieldErrors } from "../auth/field-errors";
import { addressFromText } from "../settings/address-fields";
import type { LocationFormState } from "./location-state";

const FORM_FIELD_BY_API_FIELD: Readonly<Record<string, string>> = { phoneE164: "locationPhone" };

export type LocationFormResult<Body> =
  { ok: true; body: Body } | { ok: false; fieldErrors: FieldErrors };

function filled(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Empty fields are left out; the API keeps the saved value of a field it does not receive. */
function candidateOf(form: LocationFormState): Record<string, unknown> {
  const optional = {
    address: addressFromText(form),
    phoneE164: filled(form.locationPhone),
    timezone: filled(form.timezone),
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
  const parsed = locationCreateRequestSchema.safeParse(candidateOf(form));
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, fieldErrors: toFieldErrors(parsed.error.issues, form) };
}

export function buildLocationUpdate(
  form: LocationFormState,
  version: number,
): LocationFormResult<LocationUpdateBody> {
  const parsed = locationUpdateRequestSchema.safeParse({ ...candidateOf(form), version });
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, fieldErrors: toFieldErrors(parsed.error.issues, form) };
}
