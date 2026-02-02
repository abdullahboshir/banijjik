import { Email, Phone, UserName, UserStatus, DirectPermission, LoginHistory, UserSettings } from "../value-objects";
export declare class User {
    readonly userId: string;
    name: UserName;
    email: Email;
    phone: Phone | null;
    private password;
    needsPasswordChange: boolean;
    passwordChangedAt: Date | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    status: UserStatus;
    isActive: boolean;
    isDeleted: boolean;
    isSuperAdmin: boolean;
    systemRoles: string[];
    directPermissions: DirectPermission[];
    lastLogin: Date | null;
    lastActiveContext: any;
    loginHistory: LoginHistory[];
    settings: UserSettings;
    metadata: Record<string, any>;
    createdBy?: string | undefined;
    updatedBy?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    constructor(userId: string | undefined, name: UserName, email: Email, phone: Phone | null, password: string | null, needsPasswordChange: boolean, passwordChangedAt: Date | null, isEmailVerified: boolean, isPhoneVerified: boolean, status: UserStatus, isActive: boolean, isDeleted: boolean, isSuperAdmin: boolean, systemRoles: string[], directPermissions: DirectPermission[], lastLogin: Date | null, lastActiveContext: any, // Value object would be better, but any for now to match doc
    loginHistory: LoginHistory[], settings: UserSettings, metadata: Record<string, any>, createdBy?: string | undefined, updatedBy?: string | undefined, createdAt?: Date | undefined, updatedAt?: Date | undefined);
    get _id(): string;
    getPassword(): string | null;
    /**
     * Business Rule: Check if user is eligible to login
     */
    canLogin(): boolean;
    /**
     * Business Rule: Change password and update state
     */
    changePassword(hashed: string): void;
}
//# sourceMappingURL=user.entity.d.ts.map