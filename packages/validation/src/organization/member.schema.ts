import {
  ALL_LOCATIONS,
  INVITATION_STATUS,
  INVITATION_TOKEN_LENGTH,
  MEMBER_STATUS,
} from "@banijjik/contracts";
import { z } from "zod";
import { emailSchema } from "../email.js";
import { paginationQuerySchema } from "../pagination.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { customFieldValuesRequestSchema, versionSchema } from "./organization-fields.js";

const DISPLAY_NAME_MAX_LENGTH = 100;
const JOB_TITLE_MAX_LENGTH = 80;
const SEARCH_MAX_LENGTH = 80;
const MAX_ASSIGNMENTS = 50;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);

const assignmentSchema = z.strictObject({
  locationId: z.union([z.literal(ALL_LOCATIONS), uuidV7Schema]),
  roleId: uuidV7Schema,
});

/** At least one assignment; duplicates and ACTIVE checks are domain rules (09 section 4.4). */
export const assignmentsSchema = z.array(assignmentSchema).min(1).max(MAX_ASSIGNMENTS);

/** Body of `PATCH /orgs/{organizationId}/members/{memberId}`; at least one field besides `version`. */
export const memberUpdateRequestSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    jobTitle: z.string().trim().min(1).max(JOB_TITLE_MAX_LENGTH).optional(),
    assignments: assignmentsSchema.optional(),
    customFields: customFieldValuesRequestSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type MemberUpdateBody = z.output<typeof memberUpdateRequestSchema>;

export const memberIdParamsSchema = z.object({ memberId: uuidV7Schema });

/** `?status=&q=&page=&limit=` of `GET /members`; `q` searches the display name. */
export const memberListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(MEMBER_STATUS).optional(),
  q: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
});
export type MemberListQuery = z.output<typeof memberListQuerySchema>;

/** Body of `POST /orgs/{organizationId}/invitations`: exactly one of email and phone. */
export const invitationCreateRequestSchema = z
  .strictObject({
    email: emailSchema.optional(),
    phone: phoneE164Schema.optional(),
    displayName: displayNameSchema.optional(),
    assignments: assignmentsSchema,
  })
  .refine((body) => (body.email === undefined) !== (body.phone === undefined));
export type InvitationCreateBody = z.output<typeof invitationCreateRequestSchema>;

export const invitationIdParamsSchema = z.object({ invitationId: uuidV7Schema });

/** The token of the user-level accept routes: a fixed-length base64url string. */
export const invitationTokenParamsSchema = z.object({
  token: z.string().length(INVITATION_TOKEN_LENGTH).regex(TOKEN_PATTERN),
});

export const invitationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(INVITATION_STATUS).optional(),
});
export type InvitationListQuery = z.output<typeof invitationListQuerySchema>;
