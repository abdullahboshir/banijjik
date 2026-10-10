import type { Router } from "express";
import type { MembershipDirectory } from "../../../kernel/tenancy/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  buildProvisionSystemRolesUseCase,
  buildReadUserProfileUseCase,
  buildRoleKeyReader,
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
import { MongoMembershipDirectory } from "./infrastructure/mongo-membership-directory.js";
import { MongoMemberRepository } from "./infrastructure/mongo-member.repository.js";
import { MongoOrganizationRepository } from "./infrastructure/mongo-organization.repository.js";
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
      contextRunner,
      clock,
    }),
    listMyOrganizations: myOrganizationsReader,
  });
  return { myOrganizationsRouter: buildOrganizationRouter(controller, rateLimiter) };
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

export type { MyOrganizationsReader } from "./application/use-cases/list-my-organizations.use-case.js";
export type { OrganizationContextRunner } from "./application/ports/organization-context-runner.js";
