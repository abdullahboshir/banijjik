import { z } from "zod";

const ADDRESS_PART_MAX_LENGTH = 120;
const POSTAL_CODE_MAX_LENGTH = 20;
const TIMEZONE_MAX_LENGTH = 64;
const VERSION_MIN = 1;

export const versionSchema = z.number().int().min(VERSION_MIN);

function isKnownTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    // The runtime throws RangeError for a name that is not an IANA timezone: that is the answer.
    return false;
  }
}

/** An IANA timezone such as `Asia/Dhaka`. */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(TIMEZONE_MAX_LENGTH)
  .refine(isKnownTimezone);

const addressPartSchema = z.string().trim().min(1).max(ADDRESS_PART_MAX_LENGTH);

export const postalAddressSchema = z.strictObject({
  line1: addressPartSchema.optional(),
  area: addressPartSchema.optional(),
  thana: addressPartSchema.optional(),
  district: addressPartSchema.optional(),
  postalCode: z.string().trim().min(1).max(POSTAL_CODE_MAX_LENGTH).optional(),
});

const CUSTOM_FIELD_KEY_MAX_LENGTH = 64;
// A little above the 50 active organization fields plus the industry fields, so a real request fits and a flood does not.
const CUSTOM_FIELD_VALUES_MAX_KEYS = 100;

/**
 * The `customFields` object of a profile or member update. Each value's real check is the use case's,
 * against the organization's own fields, so a 400 can point at `customFields.<key>` (ADR-107).
 */
export const customFieldValuesRequestSchema = z
  .record(z.string().min(1).max(CUSTOM_FIELD_KEY_MAX_LENGTH), z.unknown())
  .refine((values) => Object.keys(values).length <= CUSTOM_FIELD_VALUES_MAX_KEYS);
