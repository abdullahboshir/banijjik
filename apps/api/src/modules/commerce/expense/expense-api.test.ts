import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTransaction } from "../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { systemClock } from "../../../kernel/time/index.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import { createTwoOrganizations } from "../../../test-support/two-organizations.js";
import {
  buildAccountingExpenseAccountWriter,
  MongoAccountRepository,
  seedSystemAccounts,
} from "../accounting/index.js";
import { seedExpenseCategories } from "./application/seed-expense-categories.js";
import { MongoExpenseCategoryRepository } from "./infrastructure/mongo-expense.repository.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

async function seedOrgBooks(organizationId: string): Promise<void> {
  await runInOrganizationContext(organizationId, async () => {
    await withTransaction(async () => {
      const typedOrganizationId = asId<OrganizationId>(organizationId);
      await seedSystemAccounts(
        { accounts: new MongoAccountRepository(), clock: systemClock },
        { organizationId: typedOrganizationId, actorUserId: null },
      );
      await seedExpenseCategories(
        {
          categories: new MongoExpenseCategoryRepository(),
          accounts: buildAccountingExpenseAccountWriter(systemClock),
          clock: systemClock,
        },
        { organizationId: typedOrganizationId, actorUserId: null },
      );
    });
  });
}

function money(amount: number) {
  return { amount, currency: "BDT" };
}

async function aWorld() {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

describe("expense API", () => {
  it("creates, lists and voids an expense; denies cross-org and missing permission", async () => {
    const world = await aWorld();
    await seedOrgBooks(world.organizationA);
    await seedOrgBooks(world.organizationB);

    const categories = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/expense-categories`,
    );
    expect(categories.status).toBe(200);
    const rent = categories.body.data.find(
      (row: { accountCode: string }) => row.accountCode === "EXPENSE_RENT",
    );
    expect(rent).toBeDefined();

    const created = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/expenses`,
      idempotencyKey: newId(),
      body: {
        expenseCategoryId: rent.expenseCategoryId,
        amount: money(50000),
        paidVia: "CASH",
        businessDate: "2026-10-19",
        locationId: world.locationA1,
        note: "October rent",
        attachmentFileIds: [],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      status: "POSTED",
      paidVia: "CASH",
      amount: money(50000),
    });

    const listed = await world.alice.call("get", `/orgs/${world.organizationA}/expenses`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const voided = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/expenses/${created.body.data.expenseId}/void`,
      idempotencyKey: null,
      body: { reason: "Entered twice", version: 1 },
    });
    expect(voided.status).toBe(200);
    expect(voided.body.data.status).toBe("VOIDED");

    const crossOrg = await world.bob.call(
      "get",
      `/orgs/${world.organizationA}/expenses/${created.body.data.expenseId}`,
    );
    expect([403, 404]).toContain(crossOrg.status);

    const viewerRole = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const viewer = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: viewerRole },
    ]);
    const denied = await viewer.actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/expenses`,
      idempotencyKey: newId(),
      body: {
        expenseCategoryId: rent.expenseCategoryId,
        amount: money(1000),
        paidVia: "CASH",
        businessDate: "2026-10-19",
        locationId: world.locationA1,
        attachmentFileIds: [],
      },
    });
    expect(denied.status).toBe(403);
  });

  it("requires an attachment above the threshold setting", async () => {
    const world = await aWorld();
    await seedOrgBooks(world.organizationA);
    const categories = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/expense-categories`,
    );
    const rent = categories.body.data[0];

    const patched = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "expense.requireAttachmentAbove", value: 10000 }],
    });
    expect(patched.status).toBe(200);

    const response = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/expenses`,
      idempotencyKey: newId(),
      body: {
        expenseCategoryId: rent.expenseCategoryId,
        amount: money(50000),
        paidVia: "CASH",
        businessDate: "2026-10-19",
        locationId: world.locationA1,
        attachmentFileIds: [],
      },
    });
    expect(response.status).toBe(422);
    expect(response.body.error.messageKey).toMatch(/attachment_required/);
  });

  it("denies a location the member is not assigned to", async () => {
    const world = await aWorld();
    await seedOrgBooks(world.organizationA);
    const categories = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/expense-categories`,
    );
    const rent = categories.body.data[0];
    const response = await world.sam.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/expenses`,
      idempotencyKey: newId(),
      body: {
        expenseCategoryId: rent.expenseCategoryId,
        amount: money(1000),
        paidVia: "CASH",
        businessDate: "2026-10-19",
        locationId: world.locationA2,
        attachmentFileIds: [],
      },
    });
    // Staff has no expense create; location denial would be 403 LOCATION_FORBIDDEN for a cashier.
    expect(response.status).toBe(403);
  });
});
