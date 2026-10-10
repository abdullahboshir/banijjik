import { invalidField } from "./errors.js";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordSubject {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phoneE164?: string | undefined;
}

const NON_DIGITS = /\D/g;
const PHONE_SEPARATORS = /[\s+-]/g;
// The Bangladesh national form of +8801XXXXXXXXX is 01XXXXXXXXX; people use their own number as a password.
const BD_COUNTRY_CODE = "880";
const BD_NATIONAL_PREFIX = "0";

/** NFC, so the same Bangla text typed on two keyboards hashes the same. Register and login both use it. */
export function normalizePassword(password: string): string {
  return password.normalize("NFC");
}

function phoneForms(phoneE164: string | undefined): string[] {
  if (phoneE164 === undefined) return [];
  const digits = phoneE164.replace(NON_DIGITS, "");
  const nationalForm = digits.startsWith(BD_COUNTRY_CODE)
    ? `${BD_NATIONAL_PREFIX}${digits.slice(BD_COUNTRY_CODE.length)}`
    : undefined;
  return nationalForm === undefined ? [digits] : [digits, nationalForm];
}

function isTooSimilar(password: string, subject: PasswordSubject): boolean {
  const candidate = password.trim().toLowerCase();
  const sameAsText = [subject.name, subject.email].some(
    (text) => text !== undefined && text.trim().toLowerCase() === candidate,
  );
  if (sameAsText) return true;
  return phoneForms(subject.phoneE164).includes(candidate.replace(PHONE_SEPARATORS, ""));
}

/**
 * Length and similarity only; no composition rules (NIST 800-63B). Length counts characters
 * (code points) of the NFC form, so a Bangla passphrase is measured fairly.
 * Pass the already normalized password.
 */
export function assertPasswordAcceptable(password: string, subject: PasswordSubject): void {
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) throw invalidField("password", "validation.password_too_short");
  if (length > PASSWORD_MAX_LENGTH) throw invalidField("password", "validation.password_too_long");
  if (isTooSimilar(password, subject)) {
    throw invalidField("password", "validation.password_too_similar");
  }
}
