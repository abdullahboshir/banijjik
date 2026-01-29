import { z } from "zod";

import {
  StudentMetadataSchema,
  PatientMetadataSchema,
  EmployeeMetadataSchema,
} from "./metadata.schema";
import { USER_PROFILE_TYPE } from "@banijjik/contracts";

/**
 * Shared Join Organization Schema
 * Platinum Standard: Shared between frontend and backend.
 * Uses discriminated validation for metadata.
 */
const BaseJoinSchema = z.object({
  firstName: z.string().min(1, "validation.people.first_name_required"),
  lastName: z.string().optional(),
  email: z.string().email("validation.common.invalid_email"),
  identityId: z.string().min(1, "validation.common.required"),
  organizationId: z.string().min(1, "validation.common.required"),
});

export const JoinOrganizationSchema = z.discriminatedUnion("type", [
  // 1. Student Profile
  BaseJoinSchema.extend({
    type: z.literal(USER_PROFILE_TYPE.STUDENT),
    metadata: StudentMetadataSchema,
  }),
  // 2. Patient Profile
  BaseJoinSchema.extend({
    type: z.literal(USER_PROFILE_TYPE.PATIENT),
    metadata: PatientMetadataSchema,
  }),
  // 3. Employee Profile
  BaseJoinSchema.extend({
    type: z.literal(USER_PROFILE_TYPE.EMPLOYEE),
    metadata: EmployeeMetadataSchema,
  }),
  // 4. Fallback for others (Member, Guest, etc.) - metadata optional
  BaseJoinSchema.extend({
    type: z.enum([
      USER_PROFILE_TYPE.MEMBER,
      USER_PROFILE_TYPE.CUSTOMER,
      USER_PROFILE_TYPE.GUEST,
    ]),
    metadata: z.record(z.string(), z.any()).default({}),
  }),
]);
