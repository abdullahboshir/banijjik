import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

/** A keyed read is bounded by the registry, so the query is not a page (ADR-103). */
export const MAX_SETTING_KEYS_PER_READ = 100;
export const MAX_SETTING_CHANGES_PER_BATCH = 50;

const settingKeyListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  )
  .pipe(z.array(z.string().min(1)).max(MAX_SETTING_KEYS_PER_READ))
  .transform((keys) => (keys.length === 0 ? undefined : keys));

/** `GET /settings?keys=&location=`. Absent or blank `keys` means every effective setting. */
export const settingsQuerySchema = z
  .object({
    keys: settingKeyListSchema.optional(),
    location: uuidV7Schema.optional(),
  })
  .strict();

export type SettingsQuery = z.output<typeof settingsQuerySchema>;

const settingChangeSchema = z
  .object({
    settingKey: z.string().min(1),
    value: z.unknown(),
    locationId: uuidV7Schema.optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();

function duplicateChange(
  items: readonly { settingKey: string; locationId?: string | undefined }[],
): number {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const mark = `${item.settingKey}\u0000${item.locationId ?? ""}`;
    if (seen.has(mark)) return index;
    seen.add(mark);
  }
  return -1;
}

/** `PATCH /settings`. One batch, all or nothing, at most 50 items. */
export const updateSettingsRequestSchema = z
  .object({
    items: z.array(settingChangeSchema).min(1).max(MAX_SETTING_CHANGES_PER_BATCH),
  })
  .strict()
  .superRefine((body, context) => {
    const duplicateIndex = duplicateChange(body.items);
    if (duplicateIndex < 0) return;
    context.addIssue({
      code: "custom",
      path: ["items", duplicateIndex, "settingKey"],
    });
  });

export type UpdateSettingsBody = z.output<typeof updateSettingsRequestSchema>;

export const MAX_TERM_CHANGES_PER_BATCH = 50;
export const TERM_TEXT_MAX_LENGTH = 40;

const termLocaleSchema = z.enum(["bn", "en"]);

const termChangeSchema = z
  .object({
    termKey: z.string().trim().min(1),
    locale: termLocaleSchema,
    text: z.string().trim().min(1).max(TERM_TEXT_MAX_LENGTH).nullable(),
    version: z.number().int().positive().optional(),
  })
  .strict();

function duplicateTerm(items: readonly { termKey: string; locale: string }[]): number {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const mark = `${item.termKey}\u0000${item.locale}`;
    if (seen.has(mark)) return index;
    seen.add(mark);
  }
  return -1;
}

/** `PATCH /terms`. One batch, all or nothing, at most 50 items (ADR-104). */
export const updateTermsRequestSchema = z
  .object({
    items: z.array(termChangeSchema).min(1).max(MAX_TERM_CHANGES_PER_BATCH),
  })
  .strict()
  .superRefine((body, context) => {
    const duplicateIndex = duplicateTerm(body.items);
    if (duplicateIndex < 0) return;
    context.addIssue({
      code: "custom",
      path: ["items", duplicateIndex, "termKey"],
    });
  });

export type UpdateTermsBody = z.output<typeof updateTermsRequestSchema>;

const REASON_MAX_LENGTH = 200;

/** `POST /modules/{moduleKey}/disable` and `…/enable`. */
export const moduleSwitchRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
  })
  .strict();

export type ModuleSwitchBody = z.output<typeof moduleSwitchRequestSchema>;

export const moduleKeyParamsSchema = z
  .object({
    moduleKey: z.string().min(1),
  })
  .strict();

export type ModuleKeyParams = z.output<typeof moduleKeyParamsSchema>;
