import type { PermissionGate, PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { Router } from "express";
import type { PermissionCatalog } from "./application/permission-catalog.js";
import { PermissionResolver } from "./application/permission-resolver.js";
import type { ApprovalMemberStore } from "./application/ports/approval-member-store.js";
import type { MemberAccessReader } from "./application/ports/member-access-reader.js";
import type { RolesVersionBumper } from "./application/ports/roles-version-bumper.js";
import { ArchiveRoleUseCase } from "./application/use-cases/archive-role.use-case.js";
import { CreateRoleUseCase } from "./application/use-cases/create-role.use-case.js";
import {
  GrantApprovalUseCase,
  type OwnerSelfApprovalReader,
} from "./application/use-cases/grant-approval.use-case.js";
import { ListApproversUseCase } from "./application/use-cases/list-approvers.use-case.js";
import { ListRolesUseCase } from "./application/use-cases/list-roles.use-case.js";
import { RemoveApprovalPinUseCase } from "./application/use-cases/remove-approval-pin.use-case.js";
import { SetApprovalPinUseCase } from "./application/use-cases/set-approval-pin.use-case.js";
import { UpdateRoleUseCase } from "./application/use-cases/update-role.use-case.js";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher.js";
import { MongoApprovalTokenRepository } from "./infrastructure/mongo-approval-token.repository.js";
import { MongoRoleRepository } from "./infrastructure/mongo-role.repository.js";
import { MongoUserRepository } from "./infrastructure/mongo-user.repository.js";
import { RandomApprovalTokens } from "./infrastructure/random-approval-tokens.js";
import { ApprovalsController } from "./presentation/approvals.controller.js";
import { buildApprovalsRouter } from "./presentation/approvals.router.js";
import { RolesController } from "./presentation/roles.controller.js";
import { buildRolesRouter } from "./presentation/roles.router.js";

export interface IamTenantRouterDependencies {
  readonly catalog: PermissionCatalog;
  readonly memberAccess: MemberAccessReader;
  readonly rolesVersion: RolesVersionBumper;
  readonly permission: PermissionMiddlewareFactory;
  /** The gate of the same request: role writes check the caller's grants (ADR-092). */
  readonly permissions: PermissionGate;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly rateLimiter: RateLimiter;
  /** Member PIN store; implemented by organization, wired in routes/v1.ts. */
  readonly approvalMembers: ApprovalMemberStore;
  readonly ownerSelfApproval: OwnerSelfApprovalReader;
}

interface TenantShared {
  readonly dependencies: IamTenantRouterDependencies;
  readonly roles: MongoRoleRepository;
  readonly resolver: PermissionResolver;
  readonly unitOfWork: MongoUnitOfWork;
  readonly hasher: Argon2PasswordHasher;
}

/** The role and approval endpoints of `/orgs/{organizationId}`, mounted by routes/v1.ts. */
export function buildIamTenantRouter(dependencies: IamTenantRouterDependencies): Router {
  const shared: TenantShared = {
    dependencies,
    roles: new MongoRoleRepository(),
    resolver: new PermissionResolver(dependencies.catalog),
    unitOfWork: new MongoUnitOfWork(),
    hasher: new Argon2PasswordHasher(),
  };
  const router = Router({ mergeParams: true });
  router.use(buildRolesRouter(buildRolesController(shared), dependencies.permission));
  router.use(
    buildApprovalsRouter(
      buildApprovalsController(shared),
      dependencies.permission,
      dependencies.rateLimiter,
    ),
  );
  return router;
}

function buildRolesController(shared: TenantShared): RolesController {
  const { dependencies, roles, resolver, unitOfWork } = shared;
  const { catalog, memberAccess, rolesVersion, clock, audit, permissions } = dependencies;
  const writeShared = {
    roles,
    rolesVersion,
    unitOfWork,
    events: kernelEventPublisher,
    catalog,
    resolver,
  };
  return new RolesController({
    listRoles: new ListRolesUseCase({ roles, members: memberAccess, resolver }),
    createRole: new CreateRoleUseCase({ ...writeShared, clock, audit, permissions }),
    updateRole: new UpdateRoleUseCase({ ...writeShared, clock, audit, permissions }),
    archiveRole: new ArchiveRoleUseCase({
      roles,
      members: memberAccess,
      rolesVersion,
      unitOfWork,
      events: kernelEventPublisher,
      resolver,
      clock,
      audit,
    }),
  });
}

function buildApprovalsController(shared: TenantShared): ApprovalsController {
  const { dependencies, roles, resolver, unitOfWork, hasher } = shared;
  const { approvalMembers, ownerSelfApproval, audit, clock } = dependencies;
  return new ApprovalsController({
    setPin: new SetApprovalPinUseCase({
      members: approvalMembers,
      users: new MongoUserRepository(),
      hasher,
      unitOfWork,
      audit,
    }),
    removePin: new RemoveApprovalPinUseCase({ members: approvalMembers, unitOfWork, audit }),
    grant: new GrantApprovalUseCase({
      members: approvalMembers,
      roles,
      tokens: new MongoApprovalTokenRepository(),
      tokenSecrets: new RandomApprovalTokens(),
      hasher,
      resolver,
      ownerSelfApproval,
      unitOfWork,
      audit,
      clock,
    }),
    listApprovers: new ListApproversUseCase({ members: approvalMembers, roles, resolver }),
  });
}
