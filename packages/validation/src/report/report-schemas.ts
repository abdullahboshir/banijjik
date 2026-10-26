import { REPORT_DAILY_MAX_DAYS } from "@banijjik/contracts/report";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;

/** A `YYYY-MM-DD` day that exists in the calendar (2026-02-30 is refused). */
export const businessDateSchema = z
  .string()
  .regex(BUSINESS_DATE_PATTERN, { message: "validation.invalid_format" })
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    {
      message: "validation.invalid_format",
    },
  );

/** `GET /reports/home?location=`: one location, or every allowed location when absent. */
export const reportHomeQuerySchema = z.strictObject({
  location: uuidV7Schema.optional(),
});

/**
 * `GET /reports/daily?from=&to=&location=&page=&limit=`. The range is inclusive and at most
 * REPORT_DAILY_MAX_DAYS days; a longer range or a reversed one is a validation error.
 */
export const reportDailyQuerySchema = z
  .strictObject({
    from: businessDateSchema,
    to: businessDateSchema,
    location: uuidV7Schema.optional(),
    ...paginationQuerySchema.shape,
  })
  .superRefine((query, context) => {
    const days =
      (Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`)) /
      MILLISECONDS_PER_DAY;
    if (days < 0) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "validation.report_range_reversed",
      });
      return;
    }
    if (days + 1 > REPORT_DAILY_MAX_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "validation.report_range_too_long",
      });
    }
  });

export type ReportHomeQuery = z.infer<typeof reportHomeQuerySchema>;
export type ReportDailyQuery = z.infer<typeof reportDailyQuerySchema>;
