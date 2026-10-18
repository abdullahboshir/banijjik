import type { ContactRole } from "@banijjik/contracts";
import {
  CONTACT_TYPE,
  type ContactCreateRequest,
  type ContactUpdateRequest,
} from "@banijjik/contracts/contact";
import { emailSchema, normalizePhoneToE164 } from "@banijjik/validation";
import type { FieldErrors } from "../auth/field-errors";

/** The names of this form's own inputs, to tell which API field errors belong to it. */
export const CONTACT_FORM_NAMES: readonly string[] = ["name", "phoneE164", "email", "contactRoles"];

/** The inputs as the person sees them: plain text and the chosen roles. */
export interface ContactFormState {
  name: string;
  phone: string;
  email: string;
  roles: ContactRole[];
}

/** What a saved contact looks like to the form; the edit sheet starts from it. */
export interface ContactFormInitial {
  contactId: string;
  version: number;
  name: string;
  phone: string;
  email: string;
  roles: ContactRole[];
}

export type ContactFormResult<Body> =
  { ok: true; body: Body } | { ok: false; fieldErrors: FieldErrors };

export function emptyContactForm(roles: ContactRole[]): ContactFormState {
  return { name: "", phone: "", email: "", roles };
}

export function formOfContact(contact: ContactFormInitial): ContactFormState {
  return {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    roles: [...contact.roles],
  };
}

/** Problems the form finds before it sends anything; an empty object means the inputs are fine. */
export function contactInputErrors(form: ContactFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim() === "" && form.phone.trim() === "") {
    errors["name"] = "contacts.form.nameOrPhone";
  }
  if (form.phone.trim() !== "" && normalizePhoneToE164(form.phone.trim()) === undefined) {
    errors["phoneE164"] = "validation.invalid_format";
  }
  if (form.email.trim() !== "" && !emailSchema.safeParse(form.email).success) {
    errors["email"] = "validation.invalid_format";
  }
  if (form.roles.length === 0) errors["contactRoles"] = "validation.too_small";
  return errors;
}

/** The create body, or the errors to show. `customFields` is the part the 2.5 block built. */
export function buildContactCreate(
  form: ContactFormState,
  customFields: Record<string, unknown>,
): ContactFormResult<ContactCreateRequest> {
  const fieldErrors = contactInputErrors(form);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const name = form.name.trim();
  const phone = form.phone.trim();
  const email = form.email.trim();
  return {
    ok: true,
    body: {
      contactType: CONTACT_TYPE.PERSON,
      contactRoles: form.roles,
      ...(name === "" ? {} : { name }),
      ...(phone === "" ? {} : { phoneE164: phone }),
      ...(email === "" ? {} : { email }),
      ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
    },
  };
}

function sameRoles(left: readonly ContactRole[], right: readonly ContactRole[]): boolean {
  return [...left].sort().join(",") === [...right].sort().join(",");
}

/** A text that was emptied is `null` (clears it); one left as it was stays out of the request. */
function textChange(next: string, before: string): string | null | undefined {
  const text = next.trim();
  if (text === before.trim()) return undefined;
  return text === "" ? null : text;
}

function changedParts(
  form: ContactFormState,
  initial: ContactFormInitial,
): Omit<ContactUpdateRequest, "version" | "customFields"> {
  const name = textChange(form.name, initial.name);
  const phone = textChange(form.phone, initial.phone);
  const email = textChange(form.email, initial.email);
  return {
    ...(name === undefined ? {} : { name }),
    ...(phone === undefined ? {} : { phoneE164: phone }),
    ...(email === undefined ? {} : { email }),
    ...(sameRoles(form.roles, initial.roles) ? {} : { contactRoles: form.roles }),
  };
}

/** The update body: only what changed, with the version that was read. `body` is `undefined` when nothing changed. */
export function buildContactUpdate(
  form: ContactFormState,
  initial: ContactFormInitial,
  customFields: Record<string, unknown>,
): ContactFormResult<ContactUpdateRequest | undefined> {
  const fieldErrors = contactInputErrors(form);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const parts = {
    ...changedParts(form, initial),
    ...(Object.keys(customFields).length === 0 ? {} : { customFields }),
  };
  if (Object.keys(parts).length === 0) return { ok: true, body: undefined };
  return { ok: true, body: { ...parts, version: initial.version } };
}
