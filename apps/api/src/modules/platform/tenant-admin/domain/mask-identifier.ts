const VISIBLE_PHONE_DIGITS = 4;
const MASK_CHARACTER = "*";
const MASKED_EMAIL_STARS = 3;

function maskEmail(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator <= 0) return MASK_CHARACTER.repeat(MASKED_EMAIL_STARS);
  return `${email.slice(0, 1)}${MASK_CHARACTER.repeat(MASKED_EMAIL_STARS)}${email.slice(separator)}`;
}

function maskPhone(phoneE164: string): string {
  const visible = phoneE164.slice(-VISIBLE_PHONE_DIGITS);
  const hidden = Math.max(0, phoneE164.length - VISIBLE_PHONE_DIGITS);
  return `${MASK_CHARACTER.repeat(hidden)}${visible}`;
}

/**
 * The owner contact the platform sees: enough to recognise the person, never the full address or
 * number. The email wins when both exist. An account with neither shows only the mask.
 */
export function maskIdentifier(identifiers: {
  readonly email?: string | undefined;
  readonly phoneE164?: string | undefined;
}): string {
  if (identifiers.email !== undefined) return maskEmail(identifiers.email);
  if (identifiers.phoneE164 !== undefined) return maskPhone(identifiers.phoneE164);
  return MASK_CHARACTER.repeat(MASKED_EMAIL_STARS);
}
