import { UserStatus } from '../../enums/user-status.enum';
/**
 * Identity Base Types
 */
export interface IUserName {
    firstName: string;
    lastName?: string;
}
export interface ILoginHistory {
    date: Date;
    ip: string;
    userAgent: string;
}
export interface IUserDetail {
    theme: 'light' | 'dark' | 'system';
    tableHeight: 'small' | 'medium' | 'large';
    [key: string]: any;
}
export interface IDirectPermission {
    permissionId: string;
    effect: 'allow' | 'deny';
}
export interface IBusinessAccess {
    role: string;
    organization: string;
    businessUnit?: string;
    status: 'active' | 'inactive';
}
/**
 * Identity Response DTOs
 */
export interface UserResponseDto {
    id: string;
    name: IUserName;
    email: string;
    phone: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    status: UserStatus;
    isActive: boolean;
    isSuperAdmin: boolean;
    globalRoles: string[];
    directPermissions: IDirectPermission[];
    businessAccess: IBusinessAccess[];
    lastLogin: Date | null | string;
    loginHistory: ILoginHistory[];
    settings: IUserDetail;
    organization?: string;
    region?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
export interface LoginResponseDto {
    accessToken: string;
    user: UserResponseDto;
}
//# sourceMappingURL=user.response.d.ts.map