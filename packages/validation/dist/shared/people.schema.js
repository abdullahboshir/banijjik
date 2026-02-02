import { z } from "zod";
import { StudentMetadataSchema, PatientMetadataSchema, EmployeeMetadataSchema, } from "./metadata.schema";
import { USER_PROFILE_TYPE } from "@banijjik/contracts";
/**
 * Universal Person Profile Schema
 */
export const PersonProfileSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email"),
    phone: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    dateOfBirth: z
        .preprocess((arg) => (typeof arg === "string" ? new Date(arg) : arg), z.date())
        .optional(),
    bloodGroup: z
        .enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])
        .optional(),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    emergencyContact: z.string().optional(),
    nid: z.string().optional(),
    permanentAddress: z.string().optional(),
    currentAddress: z.string().optional(),
    profilePicture: z.string().url().optional(),
});
/**
 * Shared Join Organization Schema
 * Platinum Standard: Shared between frontend and backend.
 * Uses discriminated validation for metadata.
 */
const BaseJoinSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email"),
    userId: z.string().min(1, "User ID is required"),
    organizationId: z.string().min(1, "Organization ID is required"),
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
//# sourceMappingURL=people.schema.js.map