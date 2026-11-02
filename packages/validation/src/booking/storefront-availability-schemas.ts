import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_INCLUSIVE_DAYS = 31;

const localDateSchema = z.string().regex(LOCAL_DATE_PATTERN);

/** UTC day number for a real YYYY-MM-DD calendar date; undefined when the date does not exist. */
export function calendarDayNumber(date: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return undefined;
  }
  return utcMs / MS_PER_DAY;
}

export const publicAvailabilityQuerySchema = z
  .strictObject({
    offeringId: uuidV7Schema,
    variantId: uuidV7Schema,
    locationId: uuidV7Schema,
    startDate: localDateSchema,
    endDate: localDateSchema,
  })
  .superRefine((query, context) => {
    const start = calendarDayNumber(query.startDate);
    const end = calendarDayNumber(query.endDate);
    if (start === undefined) {
      context.addIssue({ code: "custom", path: ["startDate"] });
      return;
    }
    if (end === undefined) {
      context.addIssue({ code: "custom", path: ["endDate"] });
      return;
    }
    const inclusiveDays = end - start + 1;
    if (inclusiveDays < 1 || inclusiveDays > MAX_INCLUSIVE_DAYS) {
      context.addIssue({ code: "custom", path: ["endDate"] });
    }
  });

export type PublicAvailabilityQuery = z.infer<typeof publicAvailabilityQuerySchema>;
