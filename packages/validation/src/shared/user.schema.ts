import { USER_STATUS } from "@banijjik/contracts";
import { z } from "zod";

// ============================================
// Supporting Schemas
// ============================================

const UserNameSchema = z.object({
  firstName: z
    .string()
    .min(1, "validation.user.first_name_required")
    .max(50, "validation.user.first_name_max"),
  lastName: z.string().max(50, "validation.user.last_name_max").optional(),
});

const DirectPermissionSchema = z.object({
  permissionId: z.string().min(1, "validation.common.required"),
  effect: z.enum(["ALLOW", "DENY"]),
});

const organizationMembershipSchema = z.object({
  role: z.string().min(1, "validation.common.required"),
  organization: z.string().min(1, "validation.common.required"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const UserDetailSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  tableHeight: z.string().default("medium"),
});

// ============================================
// Create User Schema
// ============================================

export const CreateUserSchema = z.object({
  name: UserNameSchema,
  email: z
    .string()
    .min(1, "validation.user.email_required")
    .email("validation.user.email_invalid"),
  phone: z.string().nullable().optional(),
  password: z.string().min(8, "validation.user.password_min"),
  needsPasswordChange: z.boolean().default(false),
  isEmailVerified: z.boolean().default(false),
  isPhoneVerified: z.boolean().default(false),
  status: z.nativeEnum(USER_STATUS).default(USER_STATUS.PENDING),
  isActive: z.boolean().default(true),
  isSuperAdmin: z.boolean().default(false),
  globalRoles: z.array(z.string()).default([]),
  directPermissions: z.array(DirectPermissionSchema).default([]),
  organizationMembership: z.array(organizationMembershipSchema).default([]),
  settings: UserDetailSchema.optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  organization: z.string().optional(),
  region: z.string().optional(),
});

// ============================================
// Update User Schema
// ============================================

export const UpdateUserSchema = z.object({
  name: UserNameSchema.optional(),
  email: z.string().email("validation.user.email_invalid").optional(),
  phone: z.string().nullable().optional(),
  needsPasswordChange: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
  isPhoneVerified: z.boolean().optional(),
  status: z.nativeEnum(USER_STATUS).optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  globalRoles: z.array(z.string()).optional(),
  directPermissions: z.array(DirectPermissionSchema).optional(),
  organizationMembership: z.array(organizationMembershipSchema).optional(),
  settings: UserDetailSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  organization: z.string().optional(),
  region: z.string().optional(),
});

// ============================================
// Change Password Schema
// ============================================

export const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "validation.user.current_password_required"),
    newPassword: z.string().min(8, "validation.user.password_min"),
    confirmPassword: z.string().min(1, "validation.common.required"),
  })
  .refine((data: any) => data.newPassword === data.confirmPassword, {
    message: "validation.user.password_mismatch",
    path: ["confirmPassword"],
  });
