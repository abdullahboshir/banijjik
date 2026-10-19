import type { ModuleManifest } from "@banijjik/contracts";
import type { Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildIamTenantRouter,
  buildOwnerSelfApprovalReader,
  type MemberAccessReader,
  type PermissionCatalog,
} from "../modules/core/iam/index.js";
import {
  buildApprovalMemberStore,
  buildRolesVersionBumper,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface IamTenantRouterInput {
  readonly access: {
    readonly catalog: PermissionCatalog;
    readonly memberAccess: MemberAccessReader;
    readonly permissionGate: PermissionGate;
    readonly permission: PermissionMiddlewareFactory;
  };
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly rateLimiter: RateLimiter;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

/**
 * The role and approval endpoints of the iam module (cards 1.7a and 3.4b). The approval PIN store
 * lives in organization and the owner self-approval switch is a setting, so both are adapted here.
 */
export function buildIamTenantRouterFor(input: IamTenantRouterInput): Router {
  const { access, orgConfig, manifests } = input;
  return buildIamTenantRouter({
    catalog: access.catalog,
    memberAccess: access.memberAccess,
    rolesVersion: buildRolesVersionBumper(),
    permission: access.permission,
    permissions: access.permissionGate,
    clock: input.clock,
    audit: input.audit,
    rateLimiter: input.rateLimiter,
    approvalMembers: buildApprovalMemberStore(),
    ownerSelfApproval: buildOwnerSelfApprovalReader(
      buildSettingsResolver({ orgConfig, manifests }),
    ),
  });
}
