import { issuesToFieldErrors, type FieldErrors } from "../auth/field-errors";
import { profileUpdateRequestSchema, type ProfileUpdateBody } from "@banijjik/validation";
import { clearableAddress, clearableText } from "../settings/clearable-fields";
import type { ProfileFormState } from "./profile-state";

/** The API names a field by its path; the form names it by what the person fills in. */
const FORM_FIELD_BY_API_FIELD: Readonly<Record<string, string>> = {
  phoneE164: "businessPhone",
  email: "businessEmail",
};

export type ProfileFormResult =
  { ok: true; body: ProfileUpdateBody } | { ok: false; fieldErrors: FieldErrors };

/**
 * An optional field that is empty is left out, so the API keeps the saved value, unless it was
 * filled when the form opened: then `null` tells the API to clear it (14-API.md section 5.1).
 */
function candidateOf(
  form: ProfileFormState,
  version: number,
  initial: ProfileFormState,
): Record<string, unknown> {
  const profileFields = {
    legalName: clearableText(form.legalName, initial.legalName),
    legalType: clearableText(form.legalType, initial.legalType),
    phoneE164: clearableText(form.businessPhone, initial.businessPhone),
    email: clearableText(form.businessEmail, initial.businessEmail),
    tradeLicenseNumber: clearableText(form.tradeLicenseNumber, initial.tradeLicenseNumber),
    address: clearableAddress(form, initial),
  };
  const profile = Object.fromEntries(
    Object.entries(profileFields).filter(([, value]) => value !== undefined),
  );
  return {
    name: form.name,
    defaultLocale: form.defaultLocale,
    ...(Object.keys(profile).length > 0 ? { profile } : {}),
    version,
  };
}

function fieldNameOf(path: readonly PropertyKey[]): string {
  const last = String(path[path.length - 1] ?? "");
  return FORM_FIELD_BY_API_FIELD[last] ?? last;
}

/**
 * Checks the form with the schema the API uses and builds the request body, or the message per
 * field. `initial` is the form as it opened, to tell a cleared field from one that was never filled.
 */
export function buildProfileUpdate(
  form: ProfileFormState,
  version: number,
  initial: ProfileFormState,
): ProfileFormResult {
  const parsed = profileUpdateRequestSchema.safeParse(candidateOf(form, version, initial));
  if (parsed.success) return { ok: true, body: parsed.data };
  const issues = parsed.error.issues.map((issue) => ({
    ...issue,
    path: [fieldNameOf(issue.path)],
  }));
  return {
    ok: false,
    fieldErrors: issuesToFieldErrors(issues, form as unknown as Record<string, string>),
  };
}
