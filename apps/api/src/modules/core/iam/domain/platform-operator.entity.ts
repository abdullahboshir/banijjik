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
}
