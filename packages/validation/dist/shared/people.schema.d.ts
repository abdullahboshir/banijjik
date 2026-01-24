import { z } from 'zod';
import { ProfileType } from '@banijjik/contracts';
/**
 * Shared Join Organization Schema
 * Platinum Standard: Shared between frontend and backend.
 */
export declare const JoinOrganizationSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    identityId: z.ZodString;
    organizationId: z.ZodString;
    type: z.ZodEnum<typeof ProfileType>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
//# sourceMappingURL=people.schema.d.ts.map