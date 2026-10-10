import { ORGANIZATION_EVENT_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, type DatabaseConnections } from "../../../../kernel/db/index.js";
import { kernelEventPublisher, registerEventModels } from "../../../../kernel/events/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { registerSequenceModel } from "../../../../kernel/sequence/index.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { FakeActorProfileReader } from "../../../../test-support/organization-fakes.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { buildAuditRecorder, registerAuditModels } from "../../audit/index.js";
import { buildProvisionSystemRolesUseCase, registerIamModels } from "../../iam/index.js";
import { CreateOrganizationUseCase } from "../application/use-cases/create-organization.use-case.js";
import type { EventPublisher } from "../application/ports/event-publisher.js";
import type { MemberRepository } from "../application/ports/repositories.js";
import { SlugTakenError } from "../domain/errors.js";
import { Location } from "../domain/location.entity.js";
import { Member } from "../domain/member.entity.js";
import { Organization } from "../domain/organization.entity.js";
import { MongoLocationRepository } from "./mongo-location.repository.js";
import { MongoMemberNumberSequence } from "./mongo-member-number-sequence.js";
import { MongoMemberRepository } from "./mongo-member.repository.js";
import { MongoOrganizationRepository } from "./mongo-organization.repository.js";
import { MongoUnitOfWork } from "./mongo-unit-of-work.js";
import { registerOrganizationModels } from "./register-organization-models.js";

registerIamModels();
registerOrganizationModels();
registerSequenceModel();
registerAuditModels();
registerEventModels();

const NOW = new Date("2026-10-11T08:00:00.000Z");
const organizations = new MongoOrganizationRepository();
const locations = new MongoLocationRepository();
const members = new MongoMemberRepository();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function anOrganization(slug: string): Organization {
  return Organization.create({
    name: "Rahim Store",
    slug,
    industryTemplateKey: "RETAIL",
    ownerUserId: newId() as UserId,
    defaultLocale: "bn",
    now: NOW,
  });
}

function aDefaultLocation(organizationId: OrganizationId, name: string): Location {
  return Location.createDefault({
    organizationId,
    name,
    district: undefined,
    createdByUserId: newId() as UserId,
    now: NOW,
  });
}

function insertLocation(location: Location): Promise<void> {
  return withOrganizationContext(location.organizationId, () => locations.insert(location));
}

function insertMember(member: Member): Promise<void> {
  return withOrganizationContext(member.organizationId, () => members.insert(member));
}

function countIn(collectionName: string, organizationId: OrganizationId): Promise<number> {
  return connections.platform.collection(collectionName).countDocuments({ organizationId });
}

describe("organization collections", () => {
  it("creates the partial unique index that allows one default location per organization", async () => {
    const indexes = await connections.platform.collection("locations").indexes();

    const defaultIndex = indexes.find(
      (index) => index.partialFilterExpression?.["isDefault"] === true,
    );
    expect(defaultIndex).toMatchObject({ key: { organizationId: 1 }, unique: true });
  });

  it("refuses a second default location in one organization but not in another", async () => {
    const organizationId = newId() as OrganizationId;
    await insertLocation(aDefaultLocation(organizationId, "Main"));

    await expect(insertLocation(aDefaultLocation(organizationId, "Second"))).rejects.toThrow();
    await expect(
      insertLocation(aDefaultLocation(newId() as OrganizationId, "Main")),
    ).resolves.toBeUndefined();
  });

  it("refuses two locations with the same name in one organization", async () => {
    const organizationId = newId() as OrganizationId;
    await insertLocation(aDefaultLocation(organizationId, "Main"));
    const sameName = Location.restore({
      ...aDefaultLocation(organizationId, "Main"),
      isDefault: false,
    });

    await expect(insertLocation(sameName)).rejects.toThrow();
  });

  it("turns a duplicate slug into a SlugTakenError and reports it through isSlugTaken", async () => {
    await organizations.insert(anOrganization("taken-slug"));

    await expect(organizations.insert(anOrganization("taken-slug"))).rejects.toBeInstanceOf(
      SlugTakenError,
    );
    expect(await organizations.isSlugTaken("taken-slug")).toBe(true);
    expect(await organizations.isSlugTaken("free-slug")).toBe(false);
  });

  it("keeps one membership per user and organization", async () => {
    const organizationId = newId() as OrganizationId;
    const userId = newId() as UserId;
    const join = (): Member =>
      Member.joinActive({
        organizationId,
        userId,
        displayName: "Rahim",
        assignments: [{ locationId: "ALL", roleId: newId() as RoleId }],
        employeeNumber: undefined,
        createdByUserId: userId,
        now: NOW,
      });
    await insertMember(join());

    await expect(insertMember(join())).rejects.toThrow();
  });

  it("returns stored organizations without Mongo internals", async () => {
    const organization = anOrganization("no-internals");
    await organizations.insert(organization);

    const [found] = await organizations.findOpenByIds([organization.organizationId]);

    expect(found).toMatchObject({ slug: "no-internals", industryTemplateKey: "RETAIL" });
    expect(Object.keys(found ?? {})).not.toContain("_id");
  });
});

/** Writes the member for real, then fails, so the whole creation must roll back. */
class FailingAfterInsertMemberRepository implements MemberRepository {
  private readonly real = new MongoMemberRepository();

  async insert(member: Member): Promise<void> {
    await this.real.insert(member);
    throw new Error("injected failure after the member insert");
  }

  findActiveByUserId(userId: UserId, limit: number): Promise<Member[]> {
    return this.real.findActiveByUserId(userId, limit);
  }
}

/** Publishes for real, but fails on the last of the three organization events. */
const failingOnMemberJoined: EventPublisher = {
  async publish(type, payload) {
    await kernelEventPublisher.publish(type, payload);
    if (type === ORGANIZATION_EVENT_TYPE.MEMBER_JOINED) throw new Error("injected event failure");
  },
};

describe("CreateOrganizationUseCase on MongoDB", () => {
  function aUseCase(
    memberRepository: MemberRepository,
    events: EventPublisher = kernelEventPublisher,
  ): {
    useCase: CreateOrganizationUseCase;
    actorUserId: UserId;
  } {
    const actorUserId = newId() as UserId;
    const actorProfiles = new FakeActorProfileReader();
    actorProfiles.profiles.set(actorUserId, { name: "Rahim Uddin", preferredLocale: "bn" });
    const clock = new MutableClock();
    const provisionSystemRoles = buildProvisionSystemRolesUseCase(clock);
    const useCase = new CreateOrganizationUseCase({
      organizations,
      locations,
      members: memberRepository,
      systemRoles: {
        provision: (organizationId, actor) =>
          provisionSystemRoles.execute({ organizationId, actorUserId: actor }),
      },
      actorProfiles,
      memberNumbers: new MongoMemberNumberSequence(),
      unitOfWork: new MongoUnitOfWork(),
      events,
      contextRunner: { run: runInOrganizationContext },
      clock,
      audit: buildAuditRecorder(clock),
    });
    return { useCase, actorUserId };
  }

  it("writes nothing at all when a failure comes after the member insert", async () => {
    const { useCase, actorUserId } = aUseCase(new FailingAfterInsertMemberRepository());
    const input = {
      actorUserId,
      name: "Atomic Store",
      slug: "atomic-store",
      industryTemplateKey: "RETAIL",
      district: undefined,
    } as const;

    await expect(useCase.execute(input)).rejects.toThrow("injected failure");

    expect(await organizations.isSlugTaken("atomic-store")).toBe(false);
    const sequences = await connections.tenantShared
      .collection("sequences")
      .find({ sequenceKey: SEQUENCE_KEY.MEMBER })
      .toArray();
    // The member number was taken before the transaction: it is lost, never reused (a gap).
    expect(sequences.map((sequence) => sequence["nextValue"])).toEqual([1]);
    for (const collectionName of ["locations", "roles", "members"]) {
      const orphans = await connections.platform
        .collection(collectionName)
        .countDocuments({ createdByUserId: actorUserId });
      expect(orphans, collectionName).toBe(0);
    }
  });

  it("leaves no outbox row when a failure comes after the events were written", async () => {
    const { useCase, actorUserId } = aUseCase(members, failingOnMemberJoined);

    await expect(
      useCase.execute({
        actorUserId,
        name: "Event Store",
        slug: "event-store",
        industryTemplateKey: "RETAIL",
        district: undefined,
      }),
    ).rejects.toThrow("injected event failure");

    const outboxRows = await connections.platform
      .collection("outbox_events")
      .countDocuments({ "payload.organizationSlug": "event-store" });
    expect(outboxRows).toBe(0);
    expect(await organizations.isSlugTaken("event-store")).toBe(false);
  });

  it("creates the same organization afterwards, with all four kinds of record, once the failure is gone", async () => {
    const { useCase, actorUserId } = aUseCase(members);

    const created = await useCase.execute({
      actorUserId,
      name: "Atomic Store",
      slug: "atomic-store",
      industryTemplateKey: "RETAIL",
      district: undefined,
    });

    expect(await countIn("organizations", created.organizationId)).toBe(1);
    expect(await countIn("locations", created.organizationId)).toBe(1);
    expect(await countIn("roles", created.organizationId)).toBe(6);
    expect(await countIn("members", created.organizationId)).toBe(1);
  });
});
