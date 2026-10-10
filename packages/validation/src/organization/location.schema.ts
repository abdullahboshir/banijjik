import { LOCATION_STATUS, LOCATION_TYPE } from "@banijjik/contracts";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { postalAddressSchema, timezoneSchema, versionSchema } from "./organization-fields.js";

const LOCATION_NAME_MAX_LENGTH = 80;

const locationNameSchema = z.string().trim().min(1).max(LOCATION_NAME_MAX_LENGTH);

/** Body of `POST /orgs/{organizationId}/locations`. */
export const locationCreateRequestSchema = z.strictObject({
  name: locationNameSchema,
  locationType: z.enum(LOCATION_TYPE),
  address: postalAddressSchema.optional(),
  phoneE164: phoneE164Schema.optional(),
  timezone: timezoneSchema.optional(),
});
export type LocationCreateBody = z.output<typeof locationCreateRequestSchema>;

/** Body of `PATCH /orgs/{organizationId}/locations/{locationId}`; at least one field besides `version`. */
export const locationUpdateRequestSchema = z
  .strictObject({
    name: locationNameSchema.optional(),
    locationType: z.enum(LOCATION_TYPE).optional(),
    address: postalAddressSchema.optional(),
    phoneE164: phoneE164Schema.optional(),
    timezone: timezoneSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type LocationUpdateBody = z.output<typeof locationUpdateRequestSchema>;

/** Body of the transitions that carry only the version (archive, suspend, reactivate, remove, revoke). */
export const versionedTransitionRequestSchema = z.strictObject({ version: versionSchema });
export type VersionedTransitionBody = z.output<typeof versionedTransitionRequestSchema>;

export const locationIdParamsSchema = z.object({ locationId: uuidV7Schema });

/** `?status=&page=&limit=` of `GET /locations`. */
export const locationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LOCATION_STATUS).optional(),
});
export type LocationListQuery = z.output<typeof locationListQuerySchema>;
