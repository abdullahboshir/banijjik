import { z } from "zod";

const SEPARATORS = /[\s\-().]/g;
// Bangladesh mobile numbers: 01 + operator digit 3-9 + 8 digits (e.g. 01712345678).
const BD_LOCAL_PATTERN = /^01[3-9]\d{8}$/;
const BD_INTERNATIONAL_PATTERN = /^880(1[3-9]\d{8})$/;
// E.164: a plus sign, then 8 to 15 digits, the first not zero.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const BD_COUNTRY_PREFIX = "+880";

/**
 * Turns a typed phone number into E.164 (`+8801712345678`), or returns undefined when it is not
 * a valid number. Accepts the Bangladesh local form (`01…`), the form without a plus (`8801…`),
 * and any other valid `+<8-15 digits>` number unchanged (09 section 4.1, 15-PORT-MAP section 3).
 */
export function normalizePhoneToE164(input: string): string | undefined {
  const compact = input.replace(SEPARATORS, "");
  if (BD_LOCAL_PATTERN.test(compact)) return `${BD_COUNTRY_PREFIX}${compact.slice(1)}`;
  const international = BD_INTERNATIONAL_PATTERN.exec(compact);
  if (international?.[1] !== undefined) return `${BD_COUNTRY_PREFIX}${international[1]}`;
  return E164_PATTERN.test(compact) ? compact : undefined;
}

/** A phone number in any accepted format; the parsed value is E.164. A bad number is an `invalid_format` issue. */
export const phoneE164Schema = z
  .string()
  .transform((input) => normalizePhoneToE164(input) ?? "")
  .pipe(z.string().regex(E164_PATTERN));
