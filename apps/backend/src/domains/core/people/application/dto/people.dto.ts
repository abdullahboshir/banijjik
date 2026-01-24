import { z } from 'zod';
import { JoinOrganizationSchema } from '@banijjik/validation';


export type JoinOrganizationDto = z.infer<typeof JoinOrganizationSchema>;

/**
 * Profile Response DTO
 */
export interface ProfileResponseDto {
  id: string;
  type: string;
  organizationId: string;
  status: string;
  joinedAt: string;
  metadata: Record<string, any>;
  person: {
    id: string;
    fullName: string;
    email: string;
  };
}
