import { z } from "zod";
export declare const CreateUserSchema: z.ZodObject<{
    name: z.ZodObject<{
        firstName: z.ZodString;
        lastName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    password: z.ZodString;
    needsPasswordChange: z.ZodDefault<z.ZodBoolean>;
    isEmailVerified: z.ZodDefault<z.ZodBoolean>;
    isPhoneVerified: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodEnum<any>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    isSuperAdmin: z.ZodDefault<z.ZodBoolean>;
    systemRoles: z.ZodDefault<z.ZodArray<z.ZodString>>;
    directPermissions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        permissionId: z.ZodString;
        effect: z.ZodEnum<{
            ALLOW: "ALLOW";
            DENY: "DENY";
        }>;
    }, z.core.$strip>>>;
    organizationMembership: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodString;
        organization: z.ZodString;
        status: z.ZodEnum<{
            ACTIVE: "ACTIVE";
            INACTIVE: "INACTIVE";
        }>;
    }, z.core.$strip>>>;
    settings: z.ZodOptional<z.ZodObject<{
        theme: z.ZodDefault<z.ZodEnum<{
            light: "light";
            dark: "dark";
            system: "system";
        }>>;
        tableHeight: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    lastActiveContext: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const UpdateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodObject<{
        firstName: z.ZodString;
        lastName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    needsPasswordChange: z.ZodOptional<z.ZodBoolean>;
    isEmailVerified: z.ZodOptional<z.ZodBoolean>;
    isPhoneVerified: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodEnum<any>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isSuperAdmin: z.ZodOptional<z.ZodBoolean>;
    systemRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    directPermissions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        permissionId: z.ZodString;
        effect: z.ZodEnum<{
            ALLOW: "ALLOW";
            DENY: "DENY";
        }>;
    }, z.core.$strip>>>;
    organizationMembership: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodString;
        organization: z.ZodString;
        status: z.ZodEnum<{
            ACTIVE: "ACTIVE";
            INACTIVE: "INACTIVE";
        }>;
    }, z.core.$strip>>>;
    settings: z.ZodOptional<z.ZodObject<{
        theme: z.ZodDefault<z.ZodEnum<{
            light: "light";
            dark: "dark";
            system: "system";
        }>>;
        tableHeight: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    lastActiveContext: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const ChangePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=user.schema.d.ts.map