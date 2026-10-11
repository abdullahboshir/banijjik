import { issuesToFieldErrors, type FieldErrors } from "../auth/field-errors";
import { profileUpdateRequestSchema, type ProfileUpdateBody } from "@banijjik/validation";
import { addressFromText } from "../settings/address-fields";
import type { ProfileFormState } from "./profile-state";

/** The API names a field by its path; the form names it by what the person fills in. */
const FORM_FIELD_BY_API_FIELD: Readonly<Record<string, string>> = {
  phoneE164: "businessPhone",
  email: "businessEmail",
};

export type ProfileFormResult =
  { ok: true; body: ProfileUpdateBody } | { ok: false; fieldErrors: FieldErrors };

function filled(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Empty fields are left out: the API merges what it gets, so an empty field keeps the saved value. */
function candidateOf(form: ProfileFormState, version: number): Record<string, unknown> {
  const profileFields = {
    legalName: filled(form.legalName),
    legalType: filled(form.legalType),
    phoneE164: filled(form.businessPhone),
    email: filled(form.businessEmail),
    tradeLicenseNumber: filled(form.tradeLicenseNumber),
    address: addressFromText(form),
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

/** Checks the form with the schema the API uses and builds the request body, or the message per field. */
export function buildProfileUpdate(form: ProfileFormState, version: number): ProfileFormResult {
  const parsed = profileUpdateRequestSchema.safeParse(candidateOf(form, version));
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
