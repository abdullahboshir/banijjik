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
