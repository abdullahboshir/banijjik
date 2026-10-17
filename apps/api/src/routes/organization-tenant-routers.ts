import { SYSTEM_REASON } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import { buildFileReferenceReader } from "../modules/core/file/index.js";
import type { PermissionCatalog } from "../modules/core/iam/index.js";
import { buildRoleGrantReader } from "../modules/core/iam/index.js";
import {
  buildInvitationTokenLookup,
  buildMyOrganizationsReader,
  buildOrganizationTenantRouters,
  type OrganizationTenantRouters,
} from "../modules/core/organization/index.js";
import { buildLimitGuard, type OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface OrganizationTenantInput {
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditRecorder;
  readonly idempotency: RequestHandler;
  readonly access: {
    readonly catalog: PermissionCatalog;
    readonly permissionGate: PermissionGate;
    readonly permission: PermissionMiddlewareFactory;
  };
  readonly orgConfig: OrgConfigService;
  readonly requireUser: RequestHandler;
}

/** The card 1.7b routers: profile, locations, members and invitations, plus the invitation link. */
export function buildOrganizationTenant(input: OrganizationTenantInput): OrganizationTenantRouters {
  const { access } = input;
  return buildOrganizationTenantRouters({
    clock: input.clock,
    rateLimiter: input.rateLimiter,
    audit: input.audit,
    idempotency: input.idempotency,
    permission: access.permission,
    permissions: access.permissionGate,
    roleGrants: buildRoleGrantReader(access.catalog),
    limits: buildLimitGuard(input.orgConfig),
    // Accepting an invitation runs as the inviting organization (ADR-087).
    contextRunner: {
      run: (organizationId, work) => runInOrganizationContext(organizationId, work),
    },
    myOrganizationsReader: asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMyOrganizationsReader()),
    // The token is looked up before any organization is known: a deliberate AUTH_LOOKUP.
    invitationTokenLookup: asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildInvitationTokenLookup()),
    // FILE and IMAGE custom field values may name only usable files of this organization (ADR-109).
    fileReferences: buildFileReferenceReader(),
    requireUser: input.requireUser,
  });
}
