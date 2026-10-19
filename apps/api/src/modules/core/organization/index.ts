import type { RequestHandler, Router } from "express";
import type { AuditRecorder, PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { ConfigVersionBumper, MembershipDirectory } from "../../../kernel/tenancy/index.js";
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
import type { OrganizationConfigSource } from "./application/ports/organization-config-source.js";
import type { OrganizationCurrencyReader } from "./application/ports/organization-currency-reader.js";
import type { StorefrontOrganizationReader } from "./application/ports/storefront-organization-reader.js";
import { MongoStorefrontOrganizationReader } from "./infrastructure/mongo-storefront-organization.reader.js";
import type { TrialStarter } from "./application/ports/trial-starter.js";
import type { IndustryTemplateAvailability } from "./application/ports/industry-template-availability.js";
import type { IndustryTemplateMove } from "./application/ports/industry-template-move.js";
import type { OrganizationDirectory } from "./application/ports/organization-directory.js";
import { ReactivateOrganizationUseCase } from "./application/use-cases/reactivate-organization.use-case.js";
import { SuspendOrganizationUseCase } from "./application/use-cases/suspend-organization.use-case.js";
import { MongoOrganizationDirectory } from "./infrastructure/mongo-organization-directory.js";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case.js";
import {
  ListMyOrganizationsUseCase,
  type MyOrganizationsReader,
} from "./application/use-cases/list-my-organizations.use-case.js";
import type { InvitationTokenLookup } from "./application/ports/invitation-token-lookup.js";
import { MongoInvitationTokenLookup } from "./infrastructure/mongo-invitation-token-lookup.js";
import { MongoLocationRepository } from "./infrastructure/mongo-location.repository.js";
import type { ActiveLocationCounter } from "./application/ports/active-location-counter.js";
import type { LocationLookup } from "./application/ports/location-lookup.js";
import { MongoActiveLocationCounter } from "./infrastructure/mongo-active-location-counter.js";
import { MongoLocationLookup } from "./infrastructure/mongo-location-lookup.js";
import { MongoConfigVersionBumper } from "./infrastructure/mongo-config-version-bumper.js";
import { MongoOrganizationConfigSource } from "./infrastructure/mongo-organization-config-source.js";
import { MongoOrganizationCurrencyReader } from "./infrastructure/mongo-organization-currency.reader.js";
import { MongoMemberNumberSequence } from "./infrastructure/mongo-member-number-sequence.js";
import { MongoMemberAccessReader } from "./infrastructure/mongo-member-access-reader.js";
import { MongoMembershipDirectory } from "./infrastructure/mongo-membership-directory.js";
import { MongoMemberRepository } from "./infrastructure/mongo-member.repository.js";
import { MongoOrganizationRepository } from "./infrastructure/mongo-organization.repository.js";
import { MongoOrganizationTemplateUsage } from "./infrastructure/mongo-organization-template-usage.js";
import { ChangeIndustryTemplateUseCase } from "./application/use-cases/change-industry-template.use-case.js";
import { MongoRolesVersionBumper } from "./infrastructure/mongo-roles-version-bumper.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { OrganizationController } from "./presentation/organization.controller.js";
import { buildOrganizationRouter } from "./presentation/organization.router.js";

export type { IndustryTemplateAvailability } from "./application/ports/industry-template-availability.js";
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
  /** Starts the trial subscription inside the create transaction; implemented by saas-billing (card 1.6a). */
  readonly trialStarter: TrialStarter;
  /** PUBLISHED templates only; implemented by platform/industry. */
  readonly industryTemplates: IndustryTemplateAvailability;
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
  const { audit, idempotency, trialStarter, industryTemplates } = dependencies;
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
      trialStarter,
      industryTemplates,
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

/** Approval PIN fields on Member for iam (card 3.4b). */
export { buildApprovalMemberStore } from "./infrastructure/mongo-approval-member-store.js";

/** Bumps Organization.rolesVersion inside the surrounding transaction when a role changes. */
export function buildRolesVersionBumper(): RolesVersionBumper {
  return new MongoRolesVersionBumper();
}

/** Bumps Organization.configVersion inside the surrounding transaction when a subscription or override changes. */
export function buildConfigVersionBumper(): ConfigVersionBumper {
  return new MongoConfigVersionBumper();
}

/** Counts ACTIVE locations in the current tenant context, for the menu visibility rule of the config. */
export function buildActiveLocationCounter(): ActiveLocationCounter {
  return new MongoActiveLocationCounter();
}

/** Whether a location of the current organization is ACTIVE. Settings uses this, not the model. */
export function buildLocationLookup(): LocationLookup {
  return new MongoLocationLookup();
}

/** The template key and config version of an organization, for the config resolver. */
export function buildOrganizationConfigSource(): OrganizationConfigSource {
  return new MongoOrganizationConfigSource();
}

export { buildOrganizationTenantRouters } from "./organization-tenant.composition.js";
export type {
  OrganizationTenantDependencies,
  OrganizationTenantRouters,
} from "./organization-tenant.composition.js";

/** Plain lookup of an invitation by token hash; spans organizations, so routes/v1.ts wraps it as system access (AUTH_LOOKUP). */
export function buildInvitationTokenLookup(): InvitationTokenLookup {
  return new MongoInvitationTokenLookup();
}

export type { InvitationTokenLookup } from "./application/ports/invitation-token-lookup.js";
export type { ActiveLocationCounter };
export type { LocationLookup };
export type {
  OrganizationConfigSnapshot,
  OrganizationConfigSource,
} from "./application/ports/organization-config-source.js";
export type { TrialStarter } from "./application/ports/trial-starter.js";
export type { MyOrganizationsReader } from "./application/use-cases/list-my-organizations.use-case.js";
export type { OrganizationContextRunner } from "./application/ports/organization-context-runner.js";

export interface OrganizationStatusDependencies {
  /** The kernel port for the operator audit entry, written in the same transaction as the status. */
  readonly platformAudit: PlatformAuditRecorder;
  /** Runs the change as the organization it concerns, so the outbox event carries it (ADR-087); supplied by routes/v1.ts. */
  readonly contextRunner: OrganizationContextRunner;
}

export interface OrganizationStatusUseCases {
  readonly suspend: SuspendOrganizationUseCase;
  readonly reactivate: ReactivateOrganizationUseCase;
}

/** Suspend and reactivate: owned here, called by the platform API through this entry point (card 1.8a). */
export function buildOrganizationStatusUseCases(
  dependencies: OrganizationStatusDependencies,
): OrganizationStatusUseCases {
  const shared = {
    organizations: new MongoOrganizationRepository(),
    configVersion: new MongoConfigVersionBumper(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    platformAudit: dependencies.platformAudit,
    contextRunner: dependencies.contextRunner,
  };
  return {
    suspend: new SuspendOrganizationUseCase(shared),
    reactivate: new ReactivateOrganizationUseCase(shared),
  };
}

/** Cross-organization reads for the platform panel. Plain: the caller reads under runAsSystem(PLATFORM_ADMIN). */
export function buildOrganizationDirectory(): OrganizationDirectory {
  return new MongoOrganizationDirectory();
}

export type {
  OrganizationAdminView,
  OrganizationDirectory,
  OrganizationDirectoryPage,
  OrganizationDirectoryQuery,
} from "./application/ports/organization-directory.js";
export type { SuspendOrganizationUseCase, ReactivateOrganizationUseCase };

export type { IndustryTemplateMove } from "./application/ports/industry-template-move.js";
export { ChangeIndustryTemplateUseCase, MongoOrganizationTemplateUsage };

export interface ChangeIndustryTemplateDependencies {
  readonly platformAudit: PlatformAuditRecorder;
  readonly contextRunner: OrganizationContextRunner;
  readonly templates: IndustryTemplateMove;
}

/** Moves an organization to another template. The additive check is platform/industry's. */
export function buildChangeIndustryTemplateUseCase(
  dependencies: ChangeIndustryTemplateDependencies,
): ChangeIndustryTemplateUseCase {
  return new ChangeIndustryTemplateUseCase({
    organizations: new MongoOrganizationRepository(),
    configVersion: new MongoConfigVersionBumper(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    platformAudit: dependencies.platformAudit,
    contextRunner: dependencies.contextRunner,
    templates: dependencies.templates,
  });
}

/** How many organizations use a template key, for the additive lock (ADR-101). */
export function buildOrganizationTemplateUsage(): MongoOrganizationTemplateUsage {
  return new MongoOrganizationTemplateUsage();
}

export type { OrganizationCurrencyReader } from "./application/ports/organization-currency-reader.js";

/** The currency of an organization, for modules that price things (card 3.2a). */
export function buildOrganizationCurrencyReader(): OrganizationCurrencyReader {
  return new MongoOrganizationCurrencyReader();
}

export type {
  StorefrontOrganization,
  StorefrontOrganizationReader,
} from "./application/ports/storefront-organization-reader.js";

/** Finds an ACTIVE business for the public site (card M.1). */
export function buildStorefrontOrganizationReader(): StorefrontOrganizationReader {
  return new MongoStorefrontOrganizationReader();
}
