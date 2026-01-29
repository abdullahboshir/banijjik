import { z } from "zod";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  LoginSchema,
} from "@banijjik/validation";

/**
 * Backend DTOs inferred from Zod Schemas.
 * Platinum Sync: Ensuring perfect alignment with validation schemas.
 */
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
