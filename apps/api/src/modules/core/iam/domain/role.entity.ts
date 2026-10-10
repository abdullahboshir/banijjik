import { systemRoleNameKey, type SystemRoleKey } from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";

export interface RoleProps {
  readonly roleId: RoleId;
  readonly organizationId: OrganizationId;
  readonly roleKey: string;
  /** i18n key of the display name; a custom role (card 1.4) will carry a plain name instead. */
  readonly nameKey: string;
  readonly isSystem: boolean;
  /** Empty for system roles until card 1.4 adds the code templates (09 section 4.5). */
  readonly permissionKeys: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created the role. */
  readonly createdByUserId: UserId | null;
}

export interface NewSystemRoleInput {
  readonly organizationId: OrganizationId;
  readonly roleKey: SystemRoleKey;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

/** A named set of permissions inside one organization (09 section 4.5). */
export class Role implements RoleProps {
  readonly roleId: RoleId;
  readonly organizationId: OrganizationId;
  readonly roleKey: string;
  readonly nameKey: string;
  readonly isSystem: boolean;
  readonly permissionKeys: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: RoleProps) {
    this.roleId = props.roleId;
    this.organizationId = props.organizationId;
    this.roleKey = props.roleKey;
    this.nameKey = props.nameKey;
    this.isSystem = props.isSystem;
    this.permissionKeys = props.permissionKeys;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  /** One of the six roles every organization gets. Permissions are resolved from code templates (card 1.4). */
  static createSystem(input: NewSystemRoleInput): Role {
    return new Role({
      roleId: newId(),
      organizationId: input.organizationId,
      roleKey: input.roleKey,
      nameKey: systemRoleNameKey(input.roleKey),
      isSystem: true,
      permissionKeys: [],
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  /** Rebuilds a stored role. The stored data was checked when it was written. */
  static restore(props: RoleProps): Role {
    return new Role(props);
  }
}
