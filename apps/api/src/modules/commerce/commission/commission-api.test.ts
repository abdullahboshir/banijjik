import { MODULE_KEY, MODULE_OVERRIDE_EFFECT, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_CALCULATION,
  COMMISSION_RULE_STATUS,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { asId, newId, type LocationId, type MemberId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishBookableService } from "../../../test-support/booking-api-world.js";
import { memberWithRole } from "../../../test-support/catalog-world.js";
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
import { newAccrualEntry } from "./domain/commission-entry.entity.js";
import { MongoCommissionEntryRepository } from "./infrastructure/mongo-commission-entry.repository.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

// A template that allows every module and kind, so the tests decide what is on (the seed templates list no commission yet).
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

function rulesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/commission/rules${suffix}`;
}

function commissionPath(organizationId: string, suffix: string): string {
  return `/orgs/${organizationId}/commission${suffix}`;
}

async function grantCommission(organizationId: string): Promise<void> {
  await writeModuleOverride({
    organizationId,
    moduleKey: MODULE_KEY.COMMISSION,
    effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
  });
}

/** Two organizations with the commission add-on; Alice owns A, Bob owns B, Sam is staff of A at the first location. */
async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, RETAIL);
  await grantCommission(world.organizationA);
  await grantCommission(world.organizationB);
  return world;
}

async function memberIdOf(organizationId: string, userId: string): Promise<string> {
  const row = await harness.connections.platform
    .collection("members")
    .findOne({ organizationId, userId });
  if (row === null) throw new Error("member missing");
  return row["memberId"] as string;
}

const percentRule = (memberId: string, basisPoints = 1000) => ({
  subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
  memberId,
  targetType: COMMISSION_TARGET_TYPE.ALL,
  calculation: COMMISSION_CALCULATION.PERCENT,
  percentBasisPoints: basisPoints,
});

async function insertEntry(input: {
  readonly organizationId: string;
  readonly memberId: string;
  readonly locationId: string;
  readonly amount?: number;
}): Promise<void> {
  const entry = newAccrualEntry({
    organizationId: asId<OrganizationId>(input.organizationId),
    memberId: asId<MemberId>(input.memberId),
    locationId: asId<LocationId>(input.locationId),
    sourceId: newId(),
    sourceNumber: "000001",
    amount: bdt(input.amount ?? 1000),
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
    businessDate: "2026-10-23",
    now: new Date("2026-10-23T10:00:00Z"),
    actorUserId: null,
  });
  await withOrganizationContext(input.organizationId, () =>
    new MongoCommissionEntryRepository().insertIfAbsent(entry),
  );
}

describe("commission rules API", () => {
  it("creates, lists, updates with a version and archives a rule, then frees the slot", async () => {
    const world = await aWorld();
    const aliceMemberId = await memberIdOf(world.organizationA, world.alice.userId);

    const created = await world.alice.call(
      "post",
      rulesPath(world.organizationA),
      percentRule(aliceMemberId),
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      subjectType: "MEMBER",
      memberId: aliceMemberId,
      targetType: "ALL",
      calculation: "PERCENT",
      percentBasisPoints: 1000,
      status: COMMISSION_RULE_STATUS.ACTIVE,
      version: 1,
    });
    const { commissionRuleId } = created.body.data as { commissionRuleId: string };

    const listed = await world.alice.call("get", rulesPath(world.organizationA));
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const updated = await world.alice.call(
      "patch",
      rulesPath(world.organizationA, `/${commissionRuleId}`),
      {
        calculation: COMMISSION_CALCULATION.FIXED,
        fixedAmount: bdt(2500),
        version: 1,
      },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      calculation: "FIXED",
      fixedAmount: bdt(2500),
      percentBasisPoints: null,
      version: 2,
    });

    const stale = await world.alice.call(
      "patch",
      rulesPath(world.organizationA, `/${commissionRuleId}`),
      {
        calculation: COMMISSION_CALCULATION.PERCENT,
        percentBasisPoints: 500,
        version: 1,
      },
    );
    expect(stale.status).toBe(409);

    const archived = await world.alice.call(
      "post",
      rulesPath(world.organizationA, `/${commissionRuleId}/archive`),
      { version: 2 },
    );
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe(COMMISSION_RULE_STATUS.ARCHIVED);

    const again = await world.alice.call(
      "post",
      rulesPath(world.organizationA),
      percentRule(aliceMemberId, 700),
    );
    expect(again.status).toBe(201);
  });

  it("refuses a second active rule for the same slot and names the existing rule", async () => {
    const world = await aWorld();
    const aliceMemberId = await memberIdOf(world.organizationA, world.alice.userId);
    const first = await world.alice.call(
      "post",
      rulesPath(world.organizationA),
      percentRule(aliceMemberId),
    );

    const duplicate = await world.alice.call(
      "post",
      rulesPath(world.organizationA),
      percentRule(aliceMemberId, 2000),
    );

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.messageKey).toBe("errors.commission_rule_duplicate");
    expect(duplicate.body.error.details).toMatchObject({
      commissionRuleId: first.body.data.commissionRuleId,
    });
  });

  it("rejects a rule with both a member and a role, a percentage outside 1 to 10000 and a fixed amount in another currency", async () => {
    const world = await aWorld();
    const aliceMemberId = await memberIdOf(world.organizationA, world.alice.userId);
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const bodies = [
      { ...percentRule(aliceMemberId), roleId: staffRoleId },
      percentRule(aliceMemberId, 0),
      percentRule(aliceMemberId, 10_001),
      {
        subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
        memberId: aliceMemberId,
        targetType: COMMISSION_TARGET_TYPE.ALL,
        calculation: COMMISSION_CALCULATION.FIXED,
        fixedAmount: { amount: 100, currency: "USD" },
      },
    ];
    for (const body of bodies) {
      const response = await world.alice.call("post", rulesPath(world.organizationA), body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("answers 404 for a member, role, category or offering that does not exist, and 422 for a kind the business does not use", async () => {
    const world = await aWorld();
    const missing = newId();
    const unknownReferences = [
      percentRule(missing),
      {
        subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
        roleId: missing,
        targetType: COMMISSION_TARGET_TYPE.ALL,
        calculation: COMMISSION_CALCULATION.PERCENT,
        percentBasisPoints: 1000,
      },
      {
        ...percentRule(await memberIdOf(world.organizationA, world.alice.userId)),
        targetType: COMMISSION_TARGET_TYPE.CATEGORY,
        categoryId: missing,
      },
      {
        ...percentRule(await memberIdOf(world.organizationA, world.alice.userId)),
        targetType: COMMISSION_TARGET_TYPE.OFFERING,
        offeringId: missing,
      },
    ];
    for (const body of unknownReferences) {
      const response = await world.alice.call("post", rulesPath(world.organizationA), body);
      expect(response.status, JSON.stringify(body)).toBe(404);
    }
    templateReader.excludeKinds(["RENTAL"]);
    let notEnabled;
    try {
      notEnabled = await world.alice.call("post", rulesPath(world.organizationA), {
        ...percentRule(await memberIdOf(world.organizationA, world.alice.userId)),
        targetType: COMMISSION_TARGET_TYPE.KIND,
        offeringKind: "RENTAL",
      });
    } finally {
      templateReader.reset();
    }
    expect(notEnabled.status).toBe(422);
    expect(notEnabled.body.error.messageKey).toBe("errors.commission_kind_not_enabled");
  });

  it("accepts a rule for an offering, a category and an enabled kind of this organization", async () => {
    const world = await aWorld();
    const aliceMemberId = await memberIdOf(world.organizationA, world.alice.userId);
    const offering = await publishBookableService(world.alice, world.organizationA);
    const category = await world.alice.call("post", `/orgs/${world.organizationA}/categories`, {
      name: "Hair",
    });
    expect(category.status).toBe(201);

    const byOffering = await world.alice.call("post", rulesPath(world.organizationA), {
      ...percentRule(aliceMemberId),
      targetType: COMMISSION_TARGET_TYPE.OFFERING,
      offeringId: offering.offeringId,
    });
    const byCategory = await world.alice.call("post", rulesPath(world.organizationA), {
      ...percentRule(aliceMemberId),
      targetType: COMMISSION_TARGET_TYPE.CATEGORY,
      categoryId: category.body.data.categoryId,
    });
    const byKind = await world.alice.call("post", rulesPath(world.organizationA), {
      ...percentRule(aliceMemberId),
      targetType: COMMISSION_TARGET_TYPE.KIND,
      offeringKind: "SERVICE",
    });

    expect([byOffering.status, byCategory.status, byKind.status]).toEqual([201, 201, 201]);
  });
});

describe("commission entries API", () => {
  it("lets staff read only their own entries, never create rules or read other members' entries", async () => {
    const world = await aWorld();
    const aliceMemberId = await memberIdOf(world.organizationA, world.alice.userId);
    await insertEntry({
      organizationId: world.organizationA,
      memberId: world.samMemberId,
      locationId: world.locationA1,
      amount: 700,
    });
    await insertEntry({
      organizationId: world.organizationA,
      memberId: aliceMemberId,
      locationId: world.locationA1,
      amount: 900,
    });

    const createRule = await world.sam.call(
      "post",
      rulesPath(world.organizationA),
      percentRule(world.samMemberId),
    );
    const readOthers = await world.sam.call("get", commissionPath(world.organizationA, "/entries"));
    const readSummary = await world.sam.call(
      "get",
      commissionPath(world.organizationA, "/summary"),
    );
    const own = await world.sam.call(
      "get",
      commissionPath(world.organizationA, `/my-entries?memberId=${aliceMemberId}`),
    );

    expect(createRule.status).toBe(403);
    expect(readOthers.status).toBe(403);
    expect(readSummary.status).toBe(403);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0]).toMatchObject({
      memberId: world.samMemberId,
      memberName: "Sam",
      sourceNumber: "000001",
      amount: bdt(700),
    });
  });

  it("lists entries and a per-member summary for a manager, with open and paid totals", async () => {
    const world = await aWorld();
    await insertEntry({
      organizationId: world.organizationA,
      memberId: world.samMemberId,
      locationId: world.locationA1,
      amount: 700,
    });
    await insertEntry({
      organizationId: world.organizationA,
      memberId: world.samMemberId,
      locationId: world.locationA2,
      amount: 300,
    });

    const entries = await world.alice.call("get", commissionPath(world.organizationA, "/entries"));
    const summary = await world.alice.call("get", commissionPath(world.organizationA, "/summary"));
    const atSecond = await world.alice.call(
      "get",
      commissionPath(world.organizationA, `/summary?location=${world.locationA2}`),
    );

    expect(entries.status).toBe(200);
    expect(entries.body.data).toHaveLength(2);
    expect(summary.body.data).toEqual([
      { memberId: world.samMemberId, memberName: "Sam", open: bdt(1000), paidTotal: bdt(0) },
    ]);
    expect(atSecond.body.data).toEqual([
      { memberId: world.samMemberId, memberName: "Sam", open: bdt(300), paidTotal: bdt(0) },
    ]);
  });

  it("shows nothing of another organization: rules, entries and summary of B stay empty", async () => {
    const world = await aWorld();
    const aliceMemberId = await memberIdOf(world.organizationA, world.alice.userId);
    await world.alice.call("post", rulesPath(world.organizationA), percentRule(aliceMemberId));
    await insertEntry({
      organizationId: world.organizationA,
      memberId: world.samMemberId,
      locationId: world.locationA1,
    });

    const rules = await world.bob.call("get", rulesPath(world.organizationB));
    const entries = await world.bob.call("get", commissionPath(world.organizationB, "/entries"));
    const summary = await world.bob.call("get", commissionPath(world.organizationB, "/summary"));
    const intoA = await world.bob.call("get", rulesPath(world.organizationA));

    expect(rules.body.data).toEqual([]);
    expect(entries.body.data).toEqual([]);
    expect(summary.body.data).toEqual([]);
    expect([403, 404]).toContain(intoA.status);
  });

  it("refuses a location the caller is not assigned to and hides its entries", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    await insertEntry({
      organizationId: world.organizationA,
      memberId: world.samMemberId,
      locationId: world.locationA1,
      amount: 100,
    });
    await insertEntry({
      organizationId: world.organizationA,
      memberId: world.samMemberId,
      locationId: world.locationA2,
      amount: 200,
    });

    const foreign = await manager.actor.call(
      "get",
      commissionPath(world.organizationA, `/entries?location=${world.locationA2}`),
    );
    const foreignSummary = await manager.actor.call(
      "get",
      commissionPath(world.organizationA, `/summary?location=${world.locationA2}`),
    );
    const own = await manager.actor.call(
      "get",
      commissionPath(world.organizationA, `/entries?location=${world.locationA1}`),
    );
    const all = await manager.actor.call("get", commissionPath(world.organizationA, "/entries"));

    expect(foreign.status).toBe(403);
    expect(foreignSummary.status).toBe(403);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
    expect(all.body.data.map((row: { amount: Money }) => row.amount.amount)).toEqual([100]);
  });
});

describe("commission module switch", () => {
  it("answers the module-off response on every route while the module is off", async () => {
    const world = await aWorld();
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.COMMISSION,
      effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
    });

    const paths = ["/rules", "/entries", "/my-entries", "/summary"];
    for (const suffix of paths) {
      const response = await world.alice.call("get", commissionPath(world.organizationA, suffix));
      expect(response.status, suffix).toBe(403);
      expect(response.body.error.code).toBe("MODULE_DISABLED");
    }
    const create = await world.alice.call(
      "post",
      rulesPath(world.organizationA),
      percentRule(await memberIdOf(world.organizationA, world.alice.userId)),
    );
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("MODULE_DISABLED");
  });

  it("keeps the commission routes closed when the add-on was never granted", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, RETAIL);
    const staff = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.STAFF);

    const rules = await world.alice.call("get", rulesPath(world.organizationA));
    const mine = await staff.call("get", commissionPath(world.organizationA, "/my-entries"));

    expect([rules.status, mine.status]).toEqual([403, 403]);
    expect(rules.body.error.code).toBe("MODULE_DISABLED");
  });
});
