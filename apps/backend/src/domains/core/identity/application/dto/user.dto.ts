import { z } from 'zod';
import { 
  CreateUserSchema, 
  UpdateUserSchema, 
  ChangePasswordSchema,
  LoginSchema
} from '@banijjik/validation';
import { UserStatus } from '@banijjik/contracts';
import type { 
  UserResponseDto, 
  LoginResponseDto,
  IUserName,
  ILoginHistory,
  IUserDetail,
  IDirectPermission,
  IBusinessAccess,
} from '@banijjik/contracts';

export type { UserResponseDto, LoginResponseDto, IUserName, ILoginHistory, IUserDetail, IDirectPermission, IBusinessAccess };
export { UserStatus };

/**
 * Backend DTOs inferred from Zod Schemas.
 * Platinum Sync: Ensuring perfect alignment with validation schemas.
 */
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
