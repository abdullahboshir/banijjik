import {
  CUSTOM_ROLE_KEY_PREFIX,
  ROLE_NAME_MAX_LENGTH,
  ROLE_NAME_MIN_LENGTH,
  ROLE_STATUS,
  systemRoleNameKey,
  type RoleStatus,
  type SystemRoleKey,
} from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { invalidField, roleArchived, systemRoleImmutable } from "./errors.js";

export interface RoleProps {
  readonly roleId: RoleId;
  readonly organizationId: OrganizationId;
  readonly roleKey: string;
  /** i18n key of the display name; set for system roles only. */
  readonly nameKey: string | null;
  /** Plain display name; set for custom roles only, unique among the ACTIVE roles of the organization. */
  readonly name: string | null;
  readonly isSystem: boolean;
  readonly status: RoleStatus;
  /** Empty for system roles: their keys always come from the code template (card 1.4, ADR-054). */
  readonly permissionKeys: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created the role. */
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewSystemRoleInput {
  readonly organizationId: OrganizationId;
  readonly roleKey: SystemRoleKey;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface NewCustomRoleInput {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly permissionKeys: readonly string[];
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface RoleChanges {
  readonly name?: string;
  readonly permissionKeys?: readonly string[];
  readonly updatedByUserId: UserId;
  readonly now: Date;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < ROLE_NAME_MIN_LENGTH || trimmed.length > ROLE_NAME_MAX_LENGTH) {
    throw invalidField("name", "validation.invalid_value");
  }
  return trimmed;
}

/** A named set of permissions inside one organization (09 section 4.5). */
export class Role implements RoleProps {
  readonly roleId: RoleId;
  readonly organizationId: OrganizationId;
  readonly roleKey: string;
  readonly nameKey: string | null;
  readonly name: string | null;
  readonly isSystem: boolean;
  readonly status: RoleStatus;
  readonly permissionKeys: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;

  private constructor(props: RoleProps) {
    this.roleId = props.roleId;
    this.organizationId = props.organizationId;
    this.roleKey = props.roleKey;
    this.nameKey = props.nameKey;
    this.name = props.name;
    this.isSystem = props.isSystem;
    this.status = props.status;
    this.permissionKeys = props.permissionKeys;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  /** One of the six roles every organization gets. Permissions are resolved from code templates. */
  static createSystem(input: NewSystemRoleInput): Role {
    return new Role({
      roleId: newId(),
      organizationId: input.organizationId,
      roleKey: input.roleKey,
      nameKey: systemRoleNameKey(input.roleKey),
      name: null,
      isSystem: true,
      status: ROLE_STATUS.ACTIVE,
      permissionKeys: [],
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
      updatedByUserId: null,
    });
  }

  /**
   * A role the organization defines. The org chooses the name; the key is generated from the ID so
   * a rename never breaks a reference.
   */
  static createCustom(input: NewCustomRoleInput): Role {
    const roleId = newId<RoleId>();
    return new Role({
      roleId,
      organizationId: input.organizationId,
      roleKey: `${CUSTOM_ROLE_KEY_PREFIX}${roleId}`,
      nameKey: null,
      name: normalizeName(input.name),
      isSystem: false,
      status: ROLE_STATUS.ACTIVE,
      permissionKeys: [...new Set(input.permissionKeys)],
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
      updatedByUserId: null,
    });
  }

  /** Rebuilds a stored role. The stored data was checked when it was written. */
  static restore(props: RoleProps): Role {
    return new Role(props);
  }

  /** Only an ACTIVE custom role can change state. */
  assertEditable(): void {
    if (this.isSystem) throw systemRoleImmutable();
    if (this.status === ROLE_STATUS.ARCHIVED) throw roleArchived();
  }

  /** The role with the given changes applied; `version` stays until the repository saves it. */
  edit(changes: RoleChanges): Role {
    this.assertEditable();
    return new Role({
      ...this,
      name: changes.name === undefined ? this.name : normalizeName(changes.name),
      permissionKeys: [...new Set(changes.permissionKeys ?? this.permissionKeys)],
      updatedAt: changes.now,
      updatedByUserId: changes.updatedByUserId,
    });
  }

  /** Whether both roles grant exactly the same keys, in any order. */
  hasSamePermissionsAs(other: Role): boolean {
    const mine = new Set(this.permissionKeys);
    return (
      mine.size === other.permissionKeys.length &&
      other.permissionKeys.every((key) => mine.has(key))
    );
  }

  archive(changes: Pick<RoleChanges, "updatedByUserId" | "now">): Role {
    this.assertEditable();
    return new Role({
      ...this,
      status: ROLE_STATUS.ARCHIVED,
      updatedAt: changes.now,
      updatedByUserId: changes.updatedByUserId,
    });
  }
}
