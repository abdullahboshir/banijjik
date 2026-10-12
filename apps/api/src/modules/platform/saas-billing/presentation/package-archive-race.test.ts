import { PLATFORM_ROLE } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createOrganizationAs,
  newActor,
} from "../../../../test-support/organization-tenant-world.js";
import {
  createPlatformActor,
  type PlatformActor,
} from "../../../../test-support/platform-world.js";

registerIamApiModels();

const PAIRS = 10;
const ROUNDS = 3;
const LIMITS = {
  locations: 1,
  members: 1,
  offerings: 1,
  ordersPerMonth: 1,
  aiMessagesPerMonth: 1,
  smsPerMonth: 1,
  channels: 1,
  posDevices: 1,
};

let harness: IamApiHarness;
let operator: PlatformActor;
let organizationIds: string[];
let issuedKeys = 0;

beforeAll(async () => {
  harness = await startIamApi();
  operator = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
  organizationIds = [];
  for (let index = 0; index < PAIRS; index += 1) {
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    organizationIds.push(organizationId);
  }
});

afterAll(async () => {
  await harness.dispose();
});

async function createBasePackage(): Promise<{ packageId: string }> {
  issuedKeys += 1;
  const response = await operator.call("post", "/packages", {
    packageKey: `RACE_PACKAGE_${issuedKeys}`,
    name: "Race package",
    isAddOn: false,
    moduleKeys: [],
    limits: LIMITS,
  });
  return { packageId: response.body.data.packageId as string };
}

async function race(organizationId: string, packageId: string): Promise<void> {
  await Promise.all([
    operator.call("post", `/packages/${packageId}/archive`, { version: 1 }),
    operator.call("post", `/organizations/${organizationId}/subscription/change-package`, {
      basePackageId: packageId,
      addOnPackageIds: [],
    }),
  ]);
}

describe("archiving a package while a subscription moves onto it", () => {
  it("never leaves a subscription on an ARCHIVED package", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const packages = await Promise.all(organizationIds.map(() => createBasePackage()));

      await Promise.all(
        organizationIds.map((organizationId, index) =>
          race(organizationId, packages[index]?.packageId ?? ""),
        ),
      );

      const archived = await harness.connections.platform
        .collection("packages")
        .find({ packageId: { $in: packages.map((entry) => entry.packageId) }, status: "ARCHIVED" })
        .toArray();
      const archivedIds = archived.map((row) => row["packageId"]);
      const onArchived = await harness.connections.platform
        .collection("platform_subscriptions")
        .find({ basePackageId: { $in: archivedIds } })
        .toArray();
      expect(onArchived).toEqual([]);
    }
  });
});
