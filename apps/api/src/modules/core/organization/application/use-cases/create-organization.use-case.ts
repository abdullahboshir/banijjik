import {
  ALL_LOCATIONS,
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ORGANIZATION_EVENT_TYPE,
  SYSTEM_ROLE_KEY,
  type IndustryTemplateKey,
} from "@banijjik/contracts";
import type { RoleId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { sessionNotValid, SlugTakenError } from "../../domain/errors.js";
import { Location } from "../../domain/location.entity.js";
import { Member } from "../../domain/member.entity.js";
import { Organization } from "../../domain/organization.entity.js";
import type { MyOrganization } from "../my-organization.js";
import type {
  ActorProfile,
  ActorProfileReader,
  SystemRoleProvisioner,
} from "../ports/iam-ports.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OrganizationContextRunner } from "../ports/organization-context-runner.js";
import type { MemberNumberSequence } from "../ports/member-number-sequence.js";
import type {
  LocationRepository,
  MemberRepository,
  OrganizationRepository,
} from "../ports/repositories.js";
import type { TrialStarter } from "../ports/trial-starter.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface CreateOrganizationInput {
  readonly actorUserId: UserId;
  readonly name: string;
  readonly slug: string;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly district: string | undefined;
}

export interface CreateOrganizationDependencies {
  readonly organizations: OrganizationRepository;
  readonly locations: LocationRepository;
  readonly members: MemberRepository;
  readonly systemRoles: SystemRoleProvisioner;
  readonly actorProfiles: ActorProfileReader;
  readonly memberNumbers: MemberNumberSequence;
  /** Gives the new organization its trial subscription inside the same transaction. */
  readonly trialStarter: TrialStarter;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly contextRunner: OrganizationContextRunner;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

/**
 * Creates a business: the organization, its six system roles, its default location and the owner
 * member, all in one transaction (09 section 4.2). The MEMBER number is taken before the
 * transaction (FAST sequence, ADR-085): an abort loses the number, it never repeats it. Both run
 * as the new organization (OrganizationContextRunner), because its rows are tenant-scoped.
 */
export class CreateOrganizationUseCase {
  constructor(private readonly dependencies: CreateOrganizationDependencies) {}

  async execute(input: CreateOrganizationInput): Promise<MyOrganization> {
    const { organizations, clock } = this.dependencies;
    const actor = await this.readActor(input.actorUserId);
    const organization = Organization.create({
      name: input.name,
      slug: input.slug,
      industryTemplateKey: input.industryTemplateKey,
      ownerUserId: input.actorUserId,
      defaultLocale: actor.preferredLocale,
      now: clock.now(),
    });
    // A taken slug answers before a member number is spent; the unique index still decides races.
    if (await organizations.isSlugTaken(organization.slug)) throw new SlugTakenError();
    await this.persist(organization, actor, input.district);
    return {
      organizationId: organization.organizationId,
      slug: organization.slug,
      name: organization.name,
      status: organization.status,
      roleKeys: [SYSTEM_ROLE_KEY.OWNER],
    };
  }

  private persist(
    organization: Organization,
    actor: ActorProfile,
    district: string | undefined,
  ): Promise<void> {
    const { memberNumbers, unitOfWork, contextRunner } = this.dependencies;
    return contextRunner.run(organization.organizationId, async () => {
      const memberNumber = await memberNumbers.next(organization.organizationId);
      await unitOfWork.run(() => this.storeAll(organization, { actor, district, memberNumber }));
    });
  }

  private async readActor(userId: UserId): Promise<ActorProfile> {
    const profile = await this.dependencies.actorProfiles.findProfile(userId);
    if (profile === undefined) throw sessionNotValid();
    return profile;
  }

  /** Order matters only for readability: the organization first, then what hangs off it. */
  private async storeAll(
    organization: Organization,
    extras: { actor: ActorProfile; district: string | undefined; memberNumber: number },
  ): Promise<void> {
    const { organizations, locations, members, systemRoles, events } = this.dependencies;
    const { ownerUserId, organizationId } = organization;
    await organizations.insert(organization);
    await this.dependencies.trialStarter.start(organizationId);
    const { ownerRoleId } = await systemRoles.provision(organizationId, ownerUserId);
    const location = Location.createDefault({
      organizationId,
      name: organization.name,
      district: extras.district,
      createdByUserId: ownerUserId,
      now: organization.createdAt,
    });
    await locations.insert(location);
    const owner = this.buildOwner(organization, ownerRoleId, extras);
    owner.assertLocationsAreActive([location]);
    await members.insert(owner);
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.ORGANIZATION_CREATED,
      entityType: AUDIT_ENTITY_TYPE.organization,
      entityId: organizationId,
      changes: { name: { to: organization.name }, slug: { to: organization.slug } },
    });
    await events.publish(ORGANIZATION_EVENT_TYPE.ORGANIZATION_CREATED, {
      organizationId,
      organizationSlug: organization.slug,
    });
    await events.publish(ORGANIZATION_EVENT_TYPE.LOCATION_CREATED, {
      locationId: location.locationId,
    });
    await events.publish(ORGANIZATION_EVENT_TYPE.MEMBER_JOINED, {
      memberId: owner.memberId,
      userId: ownerUserId,
    });
  }

  private buildOwner(
    organization: Organization,
    ownerRoleId: RoleId,
    extras: { actor: ActorProfile; memberNumber: number },
  ): Member {
    return Member.joinActive({
      organizationId: organization.organizationId,
      userId: organization.ownerUserId,
      displayName: extras.actor.name,
      assignments: [{ locationId: ALL_LOCATIONS, roleId: ownerRoleId }],
      employeeNumber: String(extras.memberNumber),
      createdByUserId: organization.ownerUserId,
      now: organization.createdAt,
    });
  }
}
