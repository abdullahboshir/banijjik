import {
  PLATFORM_ROLE,
  USER_STATUS,
  type PlatformRole,
  type UserStatus,
} from "@banijjik/contracts";
import { newId, type UserId } from "@banijjik/ids";

export interface PlatformOperatorProps {
  readonly platformOperatorId: string;
  readonly userId: UserId;
  readonly platformRoles: readonly PlatformRole[];
  readonly status: UserStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Platform-panel access of a user (09 section 4.1). It is a record of its own, not a flag on the
 * User, so it can be audited and revoked separately.
 */
export class PlatformOperator implements PlatformOperatorProps {
  readonly platformOperatorId: string;
  readonly userId: UserId;
  readonly platformRoles: readonly PlatformRole[];
  readonly status: UserStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: PlatformOperatorProps) {
    this.platformOperatorId = props.platformOperatorId;
    this.userId = props.userId;
    this.platformRoles = props.platformRoles;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static superAdmin(userId: UserId, now: Date): PlatformOperator {
    return new PlatformOperator({
      platformOperatorId: newId(),
      userId,
      platformRoles: [PLATFORM_ROLE.SUPER_ADMIN],
      status: USER_STATUS.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: PlatformOperatorProps): PlatformOperator {
    return new PlatformOperator(props);
  }

  /** Grants platform access to a user who does not have it yet. */
  static grant(input: {
    readonly userId: UserId;
    readonly platformRoles: readonly PlatformRole[];
    readonly now: Date;
  }): PlatformOperator {
    return new PlatformOperator({
      platformOperatorId: newId(),
      userId: input.userId,
      platformRoles: input.platformRoles,
      status: USER_STATUS.ACTIVE,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** A copy with a new role set. The repository bumps `version` when this is saved. */
  withRoles(platformRoles: readonly PlatformRole[], now: Date): PlatformOperator {
    return new PlatformOperator({ ...this, platformRoles, updatedAt: now });
  }

  /** A copy with a new status. The repository bumps `version` when this is saved. */
  withStatus(status: UserStatus, now: Date): PlatformOperator {
    return new PlatformOperator({ ...this, status, updatedAt: now });
  }

  /** True when the two lists hold the same roles, whatever the order. */
  hasSameRoles(platformRoles: readonly PlatformRole[]): boolean {
    if (platformRoles.length !== this.platformRoles.length) return false;
    const stored = new Set(this.platformRoles);
    return platformRoles.every((role) => stored.has(role));
  }

  /** The only actor allowed to change operators: an active super admin. */
  isActiveSuperAdmin(): boolean {
    return (
      this.status === USER_STATUS.ACTIVE && this.platformRoles.includes(PLATFORM_ROLE.SUPER_ADMIN)
    );
  }
}
