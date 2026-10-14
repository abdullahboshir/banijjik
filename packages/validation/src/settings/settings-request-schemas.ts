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
