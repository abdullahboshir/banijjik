import type { Router } from "express";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  buildProvisionSystemRolesUseCase,
  buildReadUserProfileUseCase,
  buildRoleKeyReader,
} from "../iam/index.js";
import type { ActorProfileReader, SystemRoleProvisioner } from "./application/ports/iam-ports.js";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case.js";
import { ListMyOrganizationsUseCase } from "./application/use-cases/list-my-organizations.use-case.js";
import { MongoLocationRepository } from "./infrastructure/mongo-location.repository.js";
import { MongoMemberNumberSequence } from "./infrastructure/mongo-member-number-sequence.js";
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
}

export interface OrganizationRouters {
  /** Mounted at /me/orgs, behind authenticate(). */
  readonly myOrganizationsRouter: Router;
}

/** Composition root: repositories, iam adapters and use cases are wired here and nowhere else. */
export function buildOrganizationRouters(
  dependencies: OrganizationDependencies,
): OrganizationRouters {
  const { clock, rateLimiter } = dependencies;
  const organizations = new MongoOrganizationRepository();
  const members = new MongoMemberRepository();
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
      members,
      systemRoles,
      actorProfiles,
      memberNumbers: new MongoMemberNumberSequence(),
      unitOfWork: new MongoUnitOfWork(),
      clock,
    }),
    listMyOrganizations: new ListMyOrganizationsUseCase({
      members,
      organizations,
      roleKeys: buildRoleKeyReader(),
    }),
  });
  return { myOrganizationsRouter: buildOrganizationRouter(controller, rateLimiter) };
}
