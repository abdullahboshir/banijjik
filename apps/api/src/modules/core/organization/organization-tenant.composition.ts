import { LIMIT_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type {
  LimitGuard,
  PermissionGate,
  PermissionMiddlewareFactory,
} from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { buildEffectiveCustomFieldReader } from "../custom-field/index.js";
import { buildReadUserProfileUseCase, type RoleGrantReader } from "../iam/index.js";
import { buildUserIdentifierReader } from "../iam/index.js";
import { AssignmentGuard } from "./application/assignment-guard.js";
import type { ActorProfileReader } from "./application/ports/iam-ports.js";
import type {
  OrganizationCustomFieldReader,
  SensitiveValueAccess,
} from "./application/ports/custom-field-ports.js";
import type { InvitationTokenLookup } from "./application/ports/invitation-token-lookup.js";
import type { OrganizationContextRunner } from "./application/ports/organization-context-runner.js";
import {
  AcceptInvitationUseCase,
  PreviewInvitationUseCase,
} from "./application/use-cases/accept-invitation.use-case.js";
import { CreateInvitationUseCase } from "./application/use-cases/create-invitation.use-case.js";
import { ListInvitationsUseCase } from "./application/use-cases/list-invitations.use-case.js";
import { RevokeInvitationUseCase } from "./application/use-cases/revoke-invitation.use-case.js";
import type { MyOrganizationsReader } from "./application/use-cases/list-my-organizations.use-case.js";
import { ArchiveLocationUseCase } from "./application/use-cases/archive-location.use-case.js";
import { CreateLocationUseCase } from "./application/use-cases/create-location.use-case.js";
import { ListLocationsUseCase } from "./application/use-cases/list-locations.use-case.js";
import { UpdateLocationUseCase } from "./application/use-cases/update-location.use-case.js";
import { ChangeMemberStatusUseCase } from "./application/use-cases/change-member-status.use-case.js";
import { GetMemberUseCase } from "./application/use-cases/get-member.use-case.js";
import { ListMembersUseCase } from "./application/use-cases/list-members.use-case.js";
import { UpdateMemberUseCase } from "./application/use-cases/update-member.use-case.js";
import { GetProfileUseCase } from "./application/use-cases/get-profile.use-case.js";
import { UpdateProfileUseCase } from "./application/use-cases/update-profile.use-case.js";
import { MongoConfigVersionBumper } from "./infrastructure/mongo-config-version-bumper.js";
import { MongoInvitationRepository } from "./infrastructure/mongo-invitation.repository.js";
import { MongoLocationRepository } from "./infrastructure/mongo-location.repository.js";
import { MongoMemberNumberSequence } from "./infrastructure/mongo-member-number-sequence.js";
import { MongoMemberRepository } from "./infrastructure/mongo-member.repository.js";
import { MongoOrganizationLimitLock } from "./infrastructure/mongo-organization-limit-lock.js";
import { MongoOrganizationRepository } from "./infrastructure/mongo-organization.repository.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { RandomInvitationTokens } from "./infrastructure/random-invitation-tokens.js";
import { InvitationController } from "./presentation/invitation.controller.js";
import { buildInvitationLinkRouter } from "./presentation/invitation-link.router.js";
import { MemberController } from "./presentation/member.controller.js";
import { buildOrganizationTenantRouter } from "./presentation/organization-tenant.router.js";
import { LocationController } from "./presentation/location.controller.js";
import { ProfileController } from "./presentation/profile.controller.js";

export interface OrganizationTenantDependencies {
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditRecorder;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts. */
  readonly idempotency: RequestHandler;
  readonly permission: PermissionMiddlewareFactory;
  /** The caller's own grants, for the anti-escalation check (ADR-092). */
  readonly permissions: Pick<PermissionGate, "describeCaller" | "locationsWith">;
  /** Role lookups of the iam module, built from the permission catalogue by routes/v1.ts. */
  readonly roleGrants: RoleGrantReader;
  /** Implemented by entitlement from the resolved config (10 section 9). */
  readonly limits: LimitGuard;
  /** Runs invitation acceptance as the inviting organization (ADR-087). */
  readonly contextRunner: OrganizationContextRunner;
  /** Already wrapped as system access by routes/v1.ts: it spans organizations. */
  readonly myOrganizationsReader: MyOrganizationsReader;
  /** Already wrapped as system access by routes/v1.ts: the token is looked up before any organization is known. */
  readonly invitationTokenLookup: InvitationTokenLookup;
  /** `authenticate()` for the admin audience, for the accept route. */
  readonly requireUser: RequestHandler;
}

export interface OrganizationTenantRouters {
  /** Mounted at /orgs/:organizationId behind the tenant pipeline. */
  readonly tenantRouter: Router;
  /** Mounted at /invitations: the public preview and the accept route. */
  readonly invitationLinkRouter: Router;
}

function buildActorProfiles(): ActorProfileReader {
  const readUserProfile = buildReadUserProfileUseCase();
  return { findProfile: (userId) => readUserProfile.execute({ userId }) };
}

interface SharedParts {
  readonly organizations: MongoOrganizationRepository;
  readonly locations: MongoLocationRepository;
  readonly members: MongoMemberRepository;
  readonly invitations: MongoInvitationRepository;
  readonly guard: AssignmentGuard;
  readonly unitOfWork: MongoUnitOfWork;
  readonly events: typeof kernelEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly limits: LimitGuard;
  readonly limitLock: MongoOrganizationLimitLock;
  readonly customFields: OrganizationCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
}

/** Sensitive values are readable only with the permission at every location (ADR-107). */
function buildSensitiveValueAccess(
  permissions: Pick<PermissionGate, "locationsWith">,
): SensitiveValueAccess {
  return {
    mayReadOrganizationSensitive: async () =>
      (await permissions.locationsWith(PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE)) === "ALL",
    mayReadMemberSensitive: async () =>
      (await permissions.locationsWith(PERMISSION_KEY.ORGANIZATION_MEMBER_READ_SENSITIVE)) ===
      "ALL",
  };
}

function buildSharedParts(dependencies: OrganizationTenantDependencies): SharedParts {
  const { clock, audit, limits, permissions, roleGrants } = dependencies;
  const locations = new MongoLocationRepository();
  return {
    organizations: new MongoOrganizationRepository(),
    locations,
    members: new MongoMemberRepository(),
    invitations: new MongoInvitationRepository(),
    guard: new AssignmentGuard({ roles: roleGrants, locations, permissions }),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit,
    clock,
    limits,
    limitLock: new MongoOrganizationLimitLock(),
    // The effective fields come from the custom-field engine through its index, as iam is used (ADR-102, ADR-107).
    customFields: buildEffectiveCustomFieldReader(),
    sensitiveAccess: buildSensitiveValueAccess(permissions),
  };
}

function buildProfileController(shared: SharedParts): ProfileController {
  const { organizations, unitOfWork, events, audit, customFields, sensitiveAccess } = shared;
  return new ProfileController({
    getProfile: new GetProfileUseCase({ organizations, customFields, sensitiveAccess }),
    updateProfile: new UpdateProfileUseCase({
      organizations,
      unitOfWork,
      events,
      audit,
      customFields,
      sensitiveAccess,
    }),
  });
}

function buildLocationController(shared: SharedParts): LocationController {
  const { locations, members, invitations } = shared;
  const { unitOfWork, events, audit, clock, limits, limitLock } = shared;
  const configVersion = new MongoConfigVersionBumper();
  return new LocationController({
    listLocations: new ListLocationsUseCase(locations),
    createLocation: new CreateLocationUseCase({
      configVersion,
      locations,
      limits,
      limitLock,
      unitOfWork,
      events,
      audit,
      clock,
    }),
    updateLocation: new UpdateLocationUseCase({ locations, unitOfWork, events, audit }),
    archiveLocation: new ArchiveLocationUseCase({
      configVersion,
      locations,
      members,
      invitations,
      unitOfWork,
      events,
      audit,
      clock,
    }),
  });
}

function buildMemberController(shared: SharedParts): MemberController {
  const { organizations, members, invitations, guard, unitOfWork, events, audit } = shared;
  const { clock } = shared;
  const memberDependencies = {
    members,
    organizations,
    guard,
    unitOfWork,
    events,
    audit,
    invitations,
    clock,
  };
  // Reactivating adds an ACTIVE member: the limit counts ACTIVE members plus pending invitations.
  const assertRoomForOneMore = async (organizationId: OrganizationId): Promise<void> => {
    await shared.limitLock.acquire(organizationId);
    const active = await members.countActive();
    const pending = await invitations.countPending(shared.clock.now());
    await shared.limits.assertBelow(LIMIT_KEY.MEMBERS, active + pending);
  };
  return new MemberController({
    listMembers: new ListMembersUseCase(members),
    getMember: new GetMemberUseCase({
      members,
      customFields: shared.customFields,
      sensitiveAccess: shared.sensitiveAccess,
    }),
    updateMember: new UpdateMemberUseCase({
      ...memberDependencies,
      customFields: shared.customFields,
      sensitiveAccess: shared.sensitiveAccess,
    }),
    changeStatus: new ChangeMemberStatusUseCase({ ...memberDependencies, assertRoomForOneMore }),
  });
}

function buildInvitationController(
  shared: SharedParts,
  dependencies: OrganizationTenantDependencies,
): InvitationController {
  const { members, invitations, guard, limits, limitLock } = shared;
  const { unitOfWork, events, audit, clock } = shared;
  const users = buildUserIdentifierReader();
  const tokens = new RandomInvitationTokens();
  const lookup = dependencies.invitationTokenLookup;
  return new InvitationController({
    listInvitations: new ListInvitationsUseCase(invitations),
    createInvitation: new CreateInvitationUseCase({
      invitations,
      members,
      users,
      guard,
      limits,
      limitLock,
      tokens,
      unitOfWork,
      events,
      audit,
      clock,
    }),
    revokeInvitation: new RevokeInvitationUseCase({
      invitations,
      guard,
      unitOfWork,
      events,
      audit,
      clock,
    }),
    previewInvitation: new PreviewInvitationUseCase({ tokens, lookup, clock }),
    acceptInvitation: new AcceptInvitationUseCase({
      tokens,
      lookup,
      users,
      actorProfiles: buildActorProfiles(),
      invitations,
      members,
      guard,
      limitLock,
      memberNumbers: new MongoMemberNumberSequence(),
      myOrganizations: dependencies.myOrganizationsReader,
      contextRunner: dependencies.contextRunner,
      unitOfWork,
      events,
      audit,
      clock,
    }),
    clock,
  });
}

/** Composition root of the card 1.7b endpoints: repositories, iam adapters and use cases are wired here. */
export function buildOrganizationTenantRouters(
  dependencies: OrganizationTenantDependencies,
): OrganizationTenantRouters {
  const shared = buildSharedParts(dependencies);
  const invitations = buildInvitationController(shared, dependencies);
  return {
    tenantRouter: buildOrganizationTenantRouter({
      profile: buildProfileController(shared),
      locations: buildLocationController(shared),
      members: buildMemberController(shared),
      invitations,
      permission: dependencies.permission,
      idempotency: dependencies.idempotency,
    }),
    invitationLinkRouter: buildInvitationLinkRouter(
      invitations,
      dependencies.rateLimiter,
      dependencies.requireUser,
    ),
  };
}
