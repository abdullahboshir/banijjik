import { MAX_ORGANIZATION_SYNONYM_TERMS, MAX_SYNONYM_LENGTH } from "@banijjik/contracts/catalog";
import { z } from "zod";

const MAX_SYNONYMS_PER_TERM = 20;
const VERSION_MIN = 0;

const wordSchema = z.string().trim().min(1).max(MAX_SYNONYM_LENGTH);

/** Body of `PUT /catalog/synonyms`: the whole keyed list, written against the version that was read (0 when none yet). */
export const synonymsUpdateRequestSchema = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        term: wordSchema,
        synonyms: z.array(wordSchema).min(1).max(MAX_SYNONYMS_PER_TERM),
      }),
    )
    .max(MAX_ORGANIZATION_SYNONYM_TERMS),
  version: z.number().int().min(VERSION_MIN),
});
export type SynonymsUpdateBody = z.output<typeof synonymsUpdateRequestSchema>;
