// Standardized Monorepo Sync Re-exports
// We use re-exports to satisfy DDD layer naming while maintaining a single truth source.

/**
 * User Status Enum
 * Pure Domain implementation.
 */
export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

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
