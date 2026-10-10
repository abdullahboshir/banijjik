import type { RequestHandler, Router } from "express";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { MembershipDirectory } from "../../../kernel/tenancy/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  buildProvisionSystemRolesUseCase,
  buildReadUserProfileUseCase,
  buildRoleKeyReader,
  type MemberAccessReader,
  type RolesVersionBumper,
} from "../iam/index.js";
import type { ActorProfileReader, SystemRoleProvisioner } from "./application/ports/iam-ports.js";
import type { OrganizationContextRunner } from "./application/ports/organization-context-runner.js";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case.js";
import {
  ListMyOrganizationsUseCase,
  type MyOrganizationsReader,
} from "./application/use-cases/list-my-organizations.use-case.js";
import { MongoLocationRepository } from "./infrastructure/mongo-location.repository.js";
import { MongoMemberNumberSequence } from "./infrastructure/mongo-member-number-sequence.js";
import { MongoMemberAccessReader } from "./infrastructure/mongo-member-access-reader.js";
import { MongoMembershipDirectory } from "./infrastructure/mongo-membership-directory.js";
import { MongoMemberRepository } from "./infrastructure/mongo-member.repository.js";
import { MongoOrganizationRepository } from "./infrastructure/mongo-organization.repository.js";
import { MongoRolesVersionBumper } from "./infrastructure/mongo-roles-version-bumper.js";
import { MongoUnitOfWork } from "./infrastructure/mongo-unit-of-work.js";
import { OrganizationController } from "./presentation/organization.controller.js";
import { buildOrganizationRouter } from "./presentation/organization.router.js";

export { registerOrganizationModels } from "./infrastructure/register-organization-models.js";
export { organizationManifest } from "./module.manifest.js";

export interface OrganizationDependencies {
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  /** Runs organization creation as the new organization; supplied by routes/v1.ts (ADR-087). */
  readonly contextRunner: OrganizationContextRunner;
  /** The listing of one login across organizations, already wrapped as system access by routes/v1.ts. */
  readonly myOrganizationsReader: MyOrganizationsReader;
  /** The kernel audit port; organization creation records its entry inside its transaction. */
  readonly audit: AuditRecorder;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts (ADR-089). */
  readonly idempotency: RequestHandler;
}

export interface OrganizationRouters {
  /** Mounted at /me/orgs, behind authenticate(). */
  readonly myOrganizationsRouter: Router;
}

/** Composition root: repositories, iam adapters and use cases are wired here and nowhere else. */
export function buildOrganizationRouters(
  dependencies: OrganizationDependencies,
): OrganizationRouters {
  const { clock, rateLimiter, contextRunner, myOrganizationsReader } = dependencies;
  const { audit, idempotency } = dependencies;
  const organizations = new MongoOrganizationRepository();
  const provisionSystemRoles = buildProvisionSystemRolesUseCase(clock);
  const readUserProfile = buildReadUserProfileUseCase();
  // The domain and application layers know only their own ports; iam is reached through its index.ts.
  const systemRoles: SystemRoleProvisioner = {
    provision: (organizationId, actorUserId) =>
      provisionSystemRoles.execute({ organizationId, actorUserId }),
  };
  const actorProfiles: ActorProfileReader = {
    findProfile: (userId) => readUserProfile.execute({ userId }),
  };
  const controller = new OrganizationController({
    createOrganization: new CreateOrganizationUseCase({
      organizations,
      locations: new MongoLocationRepository(),
      members: new MongoMemberRepository(),
      systemRoles,
      actorProfiles,
      memberNumbers: new MongoMemberNumberSequence(),
      unitOfWork: new MongoUnitOfWork(),
      events: kernelEventPublisher,
      contextRunner,
      clock,
      audit,
    }),
    listMyOrganizations: myOrganizationsReader,
  });
  return { myOrganizationsRouter: buildOrganizationRouter(controller, rateLimiter, idempotency) };
}

/** Plain reader: it spans organizations, so the caller wraps it with asSystemPort (routes/v1.ts). */
export function buildMyOrganizationsReader(): MyOrganizationsReader {
  return new ListMyOrganizationsUseCase({
    members: new MongoMemberRepository(),
    organizations: new MongoOrganizationRepository(),
    roleKeys: buildRoleKeyReader(),
  });
}

/** The kernel port behind tenantContext(); plain, wrapped as system access by routes/v1.ts. */
export function buildMembershipDirectory(): MembershipDirectory {
  return new MongoMembershipDirectory();
}

/** Members of the active organization for iam role checks; runs in the organization context. */
export function buildMemberAccessReader(): MemberAccessReader {
  return new MongoMemberAccessReader();
}

/** Bumps Organization.rolesVersion inside the surrounding transaction when a role changes. */
export function buildRolesVersionBumper(): RolesVersionBumper {
  return new MongoRolesVersionBumper();
}

export type { MyOrganizationsReader } from "./application/use-cases/list-my-organizations.use-case.js";
export type { OrganizationContextRunner } from "./application/ports/organization-context-runner.js";
