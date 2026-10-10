import type { RoleStatus } from "./role-status.js";

/** Business rule keys of the role endpoints (`details.ruleKey` of a `422 BUSINESS_RULE`). */
export const ROLE_RULE_KEY = {
  SYSTEM_ROLE_IMMUTABLE: "SYSTEM_ROLE_IMMUTABLE",
  ROLE_IN_USE: "ROLE_IN_USE",
} as const;

export const ROLE_NAME_MIN_LENGTH = 2;
export const ROLE_NAME_MAX_LENGTH = 60;

/** `roleKey` of a custom role is this prefix plus its `roleId`: stable, unique, never shown. */
export const CUSTOM_ROLE_KEY_PREFIX = "custom.";

/** `POST /orgs/{organizationId}/roles` (14-API.md section 5.1). */
export interface RoleCreateRequest {
  name: string;
  permissionKeys: string[];
}

/** `PATCH /orgs/{organizationId}/roles/{roleId}`. */
export interface RoleUpdateRequest {
  name?: string;
  permissionKeys?: string[];
  version: number;
}

/** `POST /orgs/{organizationId}/roles/{roleId}/archive`. */
export interface RoleArchiveRequest {
  version: number;
}

/** A system role carries `nameKey`, a custom role carries `name`. */
interface RoleNameFields {
  nameKey?: string;
  name?: string;
}

/** Body of create, update and archive. `permissionKeys` are the effective keys. */
export interface RoleResponse extends RoleNameFields {
  roleId: string;
  roleKey: string;
  isSystem: boolean;
  status: RoleStatus;
  permissionKeys: string[];
  version: number;
}

/** One row of `GET /orgs/{organizationId}/roles`. */
export interface RoleSummary extends RoleNameFields {
  roleId: string;
  roleKey: string;
  isSystem: boolean;
  status: RoleStatus;
  permissionKeys: string[];
  /** ACTIVE members holding the role at any location. */
  memberCount: number;
  version: number;
}
