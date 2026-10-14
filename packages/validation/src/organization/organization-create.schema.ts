import { ORGANIZATION_NAME_MAX_LENGTH, ORGANIZATION_NAME_MIN_LENGTH } from "@banijjik/contracts";
import { z } from "zod";
import { industryTemplateKeySchema } from "../industry-template-key.schema.js";
import { organizationSlugSchema } from "../slug.js";

const DISTRICT_MAX_LENGTH = 80;

/**
 * Body of `POST /me/orgs`. Unknown keys are rejected: country, currency, timezone and owner are
 * never taken from the client, and the package and trial fields arrive with card 1.6.
 */
export const organizationCreateRequestSchema = z.strictObject({
  name: z.string().trim().min(ORGANIZATION_NAME_MIN_LENGTH).max(ORGANIZATION_NAME_MAX_LENGTH),
  slug: organizationSlugSchema,
  industryTemplateKey: industryTemplateKeySchema,
  district: z.string().trim().min(1).max(DISTRICT_MAX_LENGTH).optional(),
});

export type OrganizationCreateBody = z.output<typeof organizationCreateRequestSchema>;
