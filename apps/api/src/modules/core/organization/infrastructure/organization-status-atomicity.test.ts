import { ORGANIZATION_EVENT_TYPE, ORGANIZATION_STATUS } from "@banijjik/contracts";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlatformAuditEntry } from "../../../../kernel/audit/index.js";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { initializeModels } from "../../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../../kernel/db/index.js";
import { kernelEventPublisher, registerEventModels } from "../../../../kernel/events/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { SuspendOrganizationUseCase } from "../application/use-cases/organization-status.use-cases.js";
import { Organization } from "../domain/organization.entity.js";
import { MongoConfigVersionBumper } from "./mongo-config-version-bumper.js";
import { MongoOrganizationRepository } from "./mongo-organization.repository.js";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { registerOrganizationModels } from "./register-organization-models.js";

registerOrganizationModels();
registerEventModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

const organizations = new MongoOrganizationRepository();
const actorUserId = asId<UserId>(newId());

async function insertOrganization(): Promise<Organization> {
  const organization = Organization.create({
    name: "Atomic Shop",
    slug: `atomic-${newId().slice(-12)}`,
    industryTemplateKey: "RETAIL",
    ownerUserId: actorUserId,
    defaultLocale: "bn",
    now: new Date(),
  });
  await organizations.insert(organization);
  return organization;
}

function buildUseCase(record: (entry: PlatformAuditEntry) => Promise<void>) {
  return new SuspendOrganizationUseCase({
    organizations,
    configVersion: new MongoConfigVersionBumper(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    platformAudit: { record },
    contextRunner: {
      run: (organizationId, work) => runInOrganizationContext(organizationId, work),
    },
  });
}

function suspend(useCase: SuspendOrganizationUseCase, organizationId: OrganizationId) {
  return runWithRequestContext({ requestId: newId(), userId: actorUserId }, () =>
    useCase.execute({ organizationId, actorUserId, reason: "test" }),
  );
}

async function stateOf(organizationId: string) {
  const row = await connections.platform.collection("organizations").findOne({ organizationId });
  const events = await connections.platform
    .collection("outbox_events")
    .find({ organizationId, type: ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED })
    .toArray();
  return { status: row?.["status"], configVersion: row?.["configVersion"], events: events.length };
}

describe("suspending an organization is one transaction", () => {
  it("changes the status, bumps configVersion, writes the audit entry and the event together", async () => {
    const organization = await insertOrganization();
    const recorded: PlatformAuditEntry[] = [];
    const useCase = buildUseCase(async (entry) => void recorded.push(entry));

    await suspend(useCase, organization.organizationId);

    expect(await stateOf(organization.organizationId)).toEqual({
      status: ORGANIZATION_STATUS.SUSPENDED,
      configVersion: organization.configVersion + 1,
      events: 1,
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.reason).toBe("test");
  });

  it("leaves no status change, no version bump and no event when the audit entry fails", async () => {
    const organization = await insertOrganization();
    const useCase = buildUseCase(async () => {
      throw new Error("injected audit failure");
    });

    await expect(suspend(useCase, organization.organizationId)).rejects.toThrow("injected");

    expect(await stateOf(organization.organizationId)).toEqual({
      status: ORGANIZATION_STATUS.ACTIVE,
      configVersion: organization.configVersion,
      events: 0,
    });
  });

  it("refuses to suspend an organization that is already suspended", async () => {
    const organization = await insertOrganization();
    const useCase = buildUseCase(async () => undefined);
    await suspend(useCase, organization.organizationId);

    await expect(suspend(useCase, organization.organizationId)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
});
