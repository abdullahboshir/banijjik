import { MODULE_KEY, MODULE_OVERRIDE_EFFECT, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_CALCULATION,
  COMMISSION_PAYOUT_METHOD,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { asId, newId, type LocationId, type MemberId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import { registerIamApiModels, startIamApi } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../../../test-support/module-contract/contract-template-reader.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../test-support/two-organizations.js";
import {
  newAccrualEntry,
  newRefundAdjustmentEntry,
  type NewCommissionEntryInput,
} from "./domain/commission-entry.entity.js";
import { MongoCommissionEntryRepository } from "./infrastructure/mongo-commission-entry.repository.js";
import {
  COMMISSION_ENTRY_COLLECTION_NAME,
  COMMISSION_PAYOUT_COLLECTION_NAME,
} from "./infrastructure/commission.schema.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

// A template that allows every module and kind, so the tests decide what is on.
const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ templateReader, tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

function payoutsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/commission/payouts${suffix}`;
}

async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, RETAIL);
  for (const organizationId of [world.organizationA, world.organizationB]) {
    await writeModuleOverride({
      organizationId,
      moduleKey: MODULE_KEY.COMMISSION,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
  }
  return world;
}

interface EntryScene {
  readonly organizationId: string;
  readonly memberId: string;
  readonly locationId: string;
}

function entryFields(scene: EntryScene, sourceId: string, businessDate: string) {
  return {
    organizationId: asId<OrganizationId>(scene.organizationId),
    memberId: asId<MemberId>(scene.memberId),
    locationId: asId<LocationId>(scene.locationId),
    sourceId,
    sourceNumber: "000001",
    base: bdt(10_000),
    sourceGrossTotal: bdt(11_500),
    ruleSnapshot: {
      commissionRuleId: newId(),
      subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
      targetType: COMMISSION_TARGET_TYPE.ALL,
      calculation: COMMISSION_CALCULATION.PERCENT,
      percentBasisPoints: 1000,
      fixedAmount: null,
    },
    businessDate,
    now: new Date("2026-10-23T10:00:00Z"),
    actorUserId: null,
  };
}

async function addAccrual(
  scene: EntryScene,
  amount: number,
  businessDate = "2026-10-20",
): Promise<string> {
  const sourceId = newId();
  const entry = newAccrualEntry({
    ...entryFields(scene, sourceId, businessDate),
    amount: bdt(amount),
  });
  await withOrganizationContext(scene.organizationId, () =>
    new MongoCommissionEntryRepository().insertIfAbsent(entry),
  );
  return entry.commissionEntryId;
}

/** A refund adjustment after a payout, or before one: a negative open entry. */
async function addNegativeEntry(
  scene: EntryScene,
  amount: number,
  businessDate = "2026-10-20",
): Promise<string> {
  const sourceId = newId();
  const fields: Omit<NewCommissionEntryInput, "amount" | "sequence" | "refundedTotalSeen"> =
    entryFields(scene, sourceId, businessDate);
  const repository = new MongoCommissionEntryRepository();
  await withOrganizationContext(scene.organizationId, async () => {
    await repository.insertIfAbsent(newAccrualEntry({ ...fields, amount: bdt(1) }));
    await repository.insertIfAbsent(
      newRefundAdjustmentEntry({
        ...fields,
        amount: bdt(-amount),
        sequence: 2,
        refundedTotalSeen: bdt(1),
      }),
    );
  });
  return sourceId;
}

async function entryRows(organizationId: string) {
  return harness.connections.tenantShared
    .collection(COMMISSION_ENTRY_COLLECTION_NAME)
    .find({ organizationId })
    .toArray();
}

async function payoutRows(organizationId: string) {
  return harness.connections.tenantShared
    .collection(COMMISSION_PAYOUT_COLLECTION_NAME)
    .find({ organizationId })
    .toArray();
}

function scene(world: TwoOrganizations, locationId = world.locationA1): EntryScene {
  return { organizationId: world.organizationA, memberId: world.samMemberId, locationId };
}

function payBody(world: TwoOrganizations, overrides: Record<string, unknown> = {}) {
  return {
    memberId: world.samMemberId,
    locationId: world.locationA1,
    upToBusinessDate: "2026-10-22",
    expectedTotal: bdt(700),
    method: COMMISSION_PAYOUT_METHOD.CASH,
    ...overrides,
  };
}

describe("commission payouts API", () => {
  it("previews and pays only the open entries of that member, location and date range", async () => {
    const world = await aWorld();
    const included = await addAccrual(scene(world), 700, "2026-10-21");
    const later = await addAccrual(scene(world), 500, "2026-10-25");
    const otherLocation = await addAccrual(scene(world, world.locationA2), 300);
    const otherMember = await addAccrual({ ...scene(world), memberId: newId() }, 200);

    const preview = await world.alice.call(
      "get",
      payoutsPath(
        world.organizationA,
        `/preview?memberId=${world.samMemberId}&location=${world.locationA1}&upTo=2026-10-22`,
      ),
    );
    const created = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world),
    );

    expect(preview.status).toBe(200);
    expect(preview.body.data).toEqual({ entryCount: 1, total: bdt(700) });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      payoutNumber: "000001",
      memberId: world.samMemberId,
      locationId: world.locationA1,
      entryCount: 1,
      total: bdt(700),
      method: "CASH",
    });
    const payoutId = created.body.data.commissionPayoutId as string;
    const claimedBy = new Map(
      (await entryRows(world.organizationA)).map((row) => [
        row["commissionEntryId"] as string,
        row["payoutId"] as string | null,
      ]),
    );
    expect(claimedBy.get(included)).toBe(payoutId);
    expect([later, otherLocation, otherMember].map((id) => claimedBy.get(id))).toEqual([
      null,
      null,
      null,
    ]);

    const listed = await world.alice.call("get", payoutsPath(world.organizationA));
    const fetched = await world.alice.call("get", payoutsPath(world.organizationA, `/${payoutId}`));
    expect(listed.body.data).toHaveLength(1);
    expect(fetched.body.data.commissionPayoutId).toBe(payoutId);
  });

  it("refuses a total that moved since the preview, shows the new total and claims nothing", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 700);
    await addAccrual(scene(world), 100);

    const response = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world),
    );

    expect(response.status).toBe(409);
    expect(response.body.error.details).toMatchObject({ total: bdt(800) });
    expect((await entryRows(world.organizationA)).map((row) => row["payoutId"])).toEqual([
      null,
      null,
    ]);
    expect(await payoutRows(world.organizationA)).toHaveLength(0);
  });

  it("ends with one winner when two payouts race for the same entries", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 400);
    await addAccrual(scene(world), 300);

    const [first, second] = await Promise.all([
      world.alice.call("post", payoutsPath(world.organizationA), payBody(world)),
      world.alice.call("post", payoutsPath(world.organizationA), payBody(world)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(201);
    expect([409, 422]).toContain(statuses[1]);
    const payoutIds = new Set((await entryRows(world.organizationA)).map((row) => row["payoutId"]));
    expect(payoutIds.size).toBe(1);
    expect(await payoutRows(world.organizationA)).toHaveLength(1);
  });

  it("nets a negative open entry into the payout", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 1000);
    await addNegativeEntry(scene(world), 300);

    const response = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world, { expectedTotal: bdt(701) }),
    );

    // 1 + 1000 from the two accruals, minus the 300 adjustment of the second source.
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ entryCount: 3, total: bdt(701) });
    expect((await entryRows(world.organizationA)).every((row) => row["payoutId"] !== null)).toBe(
      true,
    );
  });

  it("refuses a payout whose open entries net to zero or less and claims nothing", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 100);
    await addNegativeEntry(scene(world), 500);

    const response = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world, { expectedTotal: bdt(1) }),
    );

    expect(response.status).toBe(422);
    expect(response.body.error.messageKey).toBe("errors.commission_payout_nothing_to_pay");
    expect((await entryRows(world.organizationA)).every((row) => row["payoutId"] === null)).toBe(
      true,
    );
  });

  it("returns the first payout when the same Idempotency-Key is sent again", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 700);
    const key = newId();
    const send = () =>
      world.alice.callWith({
        method: "post",
        path: payoutsPath(world.organizationA),
        body: payBody(world),
        idempotencyKey: key,
      });

    const first = await send();
    const replay = await send();

    expect(first.status).toBe(201);
    expect(replay.body.data.commissionPayoutId).toBe(first.body.data.commissionPayoutId);
    expect(await payoutRows(world.organizationA)).toHaveLength(1);
  });

  it("asks for a transaction reference on bKash and Nagad, and accepts it when given", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 700);

    const missing = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world, { method: COMMISSION_PAYOUT_METHOD.BKASH }),
    );
    const given = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world, { method: COMMISSION_PAYOUT_METHOD.BKASH, externalReference: "TX-77" }),
    );

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");
    expect(given.status).toBe(201);
    expect(given.body.data).toMatchObject({ method: "BKASH", externalReference: "TX-77" });
  });

  it("keeps payouts to people who may pay: staff cannot preview, pay, list or read one", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 700);

    const preview = await world.sam.call(
      "get",
      payoutsPath(
        world.organizationA,
        `/preview?memberId=${world.samMemberId}&location=${world.locationA1}&upTo=2026-10-22`,
      ),
    );
    const create = await world.sam.call("post", payoutsPath(world.organizationA), payBody(world));
    const list = await world.sam.call("get", payoutsPath(world.organizationA));

    expect([preview.status, create.status, list.status]).toEqual([403, 403, 403]);
    expect(await payoutRows(world.organizationA)).toHaveLength(0);
  });

  it("does not let another organization pay, list or read this organization's payouts", async () => {
    const world = await aWorld();
    await addAccrual(scene(world), 700);
    const created = await world.alice.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world),
    );
    const payoutId = created.body.data.commissionPayoutId as string;

    const pay = await world.bob.call("post", payoutsPath(world.organizationB), {
      ...payBody(world, { locationId: world.locationB1 }),
    });
    const list = await world.bob.call("get", payoutsPath(world.organizationB));
    const fetched = await world.bob.call("get", payoutsPath(world.organizationB, `/${payoutId}`));

    expect(pay.status).toBe(422);
    expect(list.body.data).toEqual([]);
    expect(fetched.status).toBe(404);
  });

  it("refuses a location the caller is not assigned to, for the preview, the payout and the list", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    await addAccrual(scene(world, world.locationA2), 700);

    const preview = await manager.actor.call(
      "get",
      payoutsPath(
        world.organizationA,
        `/preview?memberId=${world.samMemberId}&location=${world.locationA2}&upTo=2026-10-22`,
      ),
    );
    const create = await manager.actor.call(
      "post",
      payoutsPath(world.organizationA),
      payBody(world, { locationId: world.locationA2 }),
    );
    const list = await manager.actor.call(
      "get",
      payoutsPath(world.organizationA, `?location=${world.locationA2}`),
    );

    expect([preview.status, create.status, list.status]).toEqual([403, 403, 403]);
    expect((await entryRows(world.organizationA)).every((row) => row["payoutId"] === null)).toBe(
      true,
    );
  });

  it("answers the module-off response on every payout route while the module is off", async () => {
    const world = await aWorld();
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.COMMISSION,
      effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
    });

    const reads = ["", `/${newId()}`];
    for (const suffix of reads) {
      const response = await world.alice.call("get", payoutsPath(world.organizationA, suffix));
      expect(response.status, suffix).toBe(403);
      expect(response.body.error.code).toBe("MODULE_DISABLED");
    }
    const preview = await world.alice.call(
      "get",
      payoutsPath(
        world.organizationA,
        `/preview?memberId=${world.samMemberId}&location=${world.locationA1}&upTo=2026-10-22`,
      ),
    );
    const create = await world.alice.call("post", payoutsPath(world.organizationA), payBody(world));
    expect([preview.body.error.code, create.body.error.code]).toEqual([
      "MODULE_DISABLED",
      "MODULE_DISABLED",
    ]);
  });
});
