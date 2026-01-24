import { z } from 'zod';
import { ProfileType } from '@banijjik/contracts';
/**
 * Shared Join Organization Schema
 * Platinum Standard: Shared between frontend and backend.
 */
export const JoinOrganizationSchema = z.object({
    firstName: z.string().min(1, 'validation.people.first_name_required'),
    lastName: z.string().optional(),
    email: z.string().email('validation.common.invalid_email'),
    identityId: z.string().min(1, 'validation.common.required'),
    organizationId: z.string().min(1, 'validation.common.required'),
    type: z.nativeEnum(ProfileType),
    metadata: z.record(z.string(), z.any()).default({}),
});
//# sourceMappingURL=people.schema.js.map