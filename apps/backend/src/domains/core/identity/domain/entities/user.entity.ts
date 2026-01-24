import {
  UserStatus,
  IUserName,
  ILoginHistory,
  IUserDetail,
  IDirectPermission,
  IBusinessAccess,
} from '../value-objects';

export class User {
  constructor(
    public readonly id: string,

    // Identity
    public name: IUserName,
    public email: string,
    public phone: string | null,

    // Auth
    private password: string | null,
    public needsPasswordChange: boolean,
    public passwordChangedAt: Date | null,

    // Verification
    public isEmailVerified: boolean,
    public isPhoneVerified: boolean,

    // Status
    public status: UserStatus,
    public isActive: boolean,
    public isDeleted: boolean,

    // Authorization
    public isSuperAdmin: boolean,
    public globalRoles: string[],
    public directPermissions: IDirectPermission[],

    // Domain Access
    public businessAccess: IBusinessAccess[],

    // Activity
    public lastLogin: Date | null,
    public loginHistory: ILoginHistory[],

    // UI & Meta
    public settings: IUserDetail,
    public metadata: Record<string, any>,

    // Tenant
    public organization?: string,
    public region?: string,

    // Audit
    public createdBy?: string,
    public updatedBy?: string,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}

  public getPassword(): string | null {
    return this.password;
  }

  /**
   * Business Rule: Check if user is eligible to login
   */
  canLogin(): boolean {
    return this.isActive && !this.isDeleted && this.status === UserStatus.ACTIVE;
  }

  /**
   * Business Rule: Change password and update state
   */
  changePassword(hashed: string) {
    this.password = hashed;
    this.needsPasswordChange = false;
    this.passwordChangedAt = new Date();
  }

  /**
   * Business Policy: Check if user is a Tenant Owner
   */
  isOwner(): boolean {
    return this.businessAccess.some((access) => access.role === 'OWNER');
  }
}
