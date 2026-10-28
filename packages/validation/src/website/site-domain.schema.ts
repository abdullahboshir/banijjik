import { SITE_DOMAIN_STATUS } from "@banijjik/contracts/website";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { versionSchema } from "../organization/organization-fields.js";

const dnsInstructionSchema = z.strictObject({
  type: z.enum(["CNAME", "TXT"]),
  name: z.string().trim().min(1).max(253),
  value: z.string().trim().min(1).max(512),
});

export const siteDomainResponseSchema = z.strictObject({
  siteDomainId: uuidV7Schema,
  hostname: z.string().min(1).max(253),
  status: z.enum(SITE_DOMAIN_STATUS),
  version: versionSchema,
  ownershipRecords: z.array(dnsInstructionSchema).max(10),
  certificateRecords: z.array(dnsInstructionSchema).max(10),
  diagnosticKey: z
    .string()
    .regex(/^[a-z][a-z0-9_.-]{0,99}$/)
    .nullable(),
  isCanonical: z.boolean(),
});

export const siteDomainListResponseSchema = z.strictObject({
  items: z.array(siteDomainResponseSchema).max(100),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100),
});

export const createSiteDomainRequestSchema = z.strictObject({
  hostname: z.string().trim().min(1).max(253),
});

export const siteDomainIdParamsSchema = z.strictObject({ siteDomainId: uuidV7Schema });

export const verifySiteDomainRequestSchema = z.strictObject({ version: versionSchema });

export const removeSiteDomainQuerySchema = z.strictObject({
  version: z.coerce.number().int().positive(),
});

export const selectCanonicalSiteDomainRequestSchema = z.strictObject({
  version: versionSchema,
  expectedSiteVersion: z.number().int().nonnegative(),
  isCanonical: z.literal(true),
});

export const siteDomainListQuerySchema = paginationQuerySchema;

export type CreateSiteDomainBody = z.output<typeof createSiteDomainRequestSchema>;
export type VerifySiteDomainBody = z.output<typeof verifySiteDomainRequestSchema>;
export type SelectCanonicalSiteDomainBody = z.output<typeof selectCanonicalSiteDomainRequestSchema>;
