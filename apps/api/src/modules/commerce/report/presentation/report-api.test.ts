import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { ReportHomeResponse, ReportDailyResponse } from "@banijjik/contracts/report";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTransaction } from "../../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { businessDateOf, shiftBusinessDate } from "../domain/business-date.js";
import { buildDailySummaryWriter } from "../index.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  // The real v1 router mounts the report routes (routes/core-tenant-routers.ts).
  harness = await startIamApi({ tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

/** The organization default timezone (organization entity): the reports count on its days. */
const ORGANIZATION_TIME_ZONE = "Asia/Dhaka";

async function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

/** Writes one row through the real repository, the same write the counting handler makes. */
async function seedSales(
  organizationId: string,
  locationId: string,
  businessDate: string,
  netSales: number,
): Promise<void> {
  await runInOrganizationContext(organizationId, () =>
    withTransaction(() =>
      buildDailySummaryWriter().applyIncrement({
        organizationId,
        currency: "BDT",
        increment: {
          locationId,
          businessDate,
          counterDeltas: { ordersCompleted: 1, grossSales: netSales, netSales },
        },
      }),
    ),
  );
}

function todayInOrganization(): string {
  return businessDateOf(new Date(), ORGANIZATION_TIME_ZONE);
}

describe("report API", () => {
  it("home: today, yesterday and month to date for the caller's locations; one location with ?location=", async () => {
    const world = await aWorld();
    const today = todayInOrganization();
    const yesterday = shiftBusinessDate(today, -1);
    await seedSales(world.organizationA, world.locationA1, today, 1_000);
    await seedSales(world.organizationA, world.locationA2, today, 500);
    await seedSales(world.organizationA, world.locationA1, yesterday, 300);

    const all = await world.alice.call("get", `/orgs/${world.organizationA}/reports/home`);
    expect(all.status).toBe(200);
    const body = all.body.data as ReportHomeResponse;
    expect(body.businessDate).toBe(today);
    expect(body.yesterdayDate).toBe(yesterday);
    expect(body.periods.today.counters.netSales).toBe(1_500);
    expect(body.periods.yesterday.counters.netSales).toBe(300);
    expect(body.periods.today.derived.netSalesAfterReturns).toBe(1_500);

    const oneLocation = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/reports/home?location=${world.locationA2}`,
    );
    expect(oneLocation.status).toBe(200);
    expect((oneLocation.body.data as ReportHomeResponse).periods.today.counters.netSales).toBe(500);
  });

  it("a location the caller is not assigned to is 403", async () => {
    const world = await aWorld();
    const ownerRole = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.OWNER,
    );
    const ownerOfLocationA1 = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: ownerRole },
    ]);
    await seedSales(world.organizationA, world.locationA1, todayInOrganization(), 700);
    await seedSales(world.organizationA, world.locationA2, todayInOrganization(), 900);

    const otherLocation = await ownerOfLocationA1.actor.call(
      "get",
      `/orgs/${world.organizationA}/reports/home?location=${world.locationA2}`,
    );
    expect(otherLocation.status).toBe(403);

    const ownLocations = await ownerOfLocationA1.actor.call(
      "get",
      `/orgs/${world.organizationA}/reports/home`,
    );
    expect(ownLocations.status).toBe(200);
    expect((ownLocations.body.data as ReportHomeResponse).periods.today.counters.netSales).toBe(
      700,
    );
  });

  it("home leaves out the sections of modules that are not effective", async () => {
    // RETAIL does not allow booking or enrollment (its template), so those sections never appear.
    const world = await aWorld();
    const home = await world.alice.call("get", `/orgs/${world.organizationA}/reports/home`);
    expect(home.status).toBe(200);
    const sections = (home.body.data as ReportHomeResponse).sections;
    expect(sections).toContain("SALES");
    expect(sections).not.toContain("BOOKINGS");
    expect(sections).not.toContain("ENROLLMENTS");
  });

  it("daily: range above 92 days is 400; pages of at most 100; totals for the range", async () => {
    const world = await aWorld();
    const today = todayInOrganization();
    const threeDaysAgo = shiftBusinessDate(today, -3);
    await seedSales(world.organizationA, world.locationA1, today, 400);
    await seedSales(world.organizationA, world.locationA1, threeDaysAgo, 100);

    const tooLong = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/reports/daily?from=${shiftBusinessDate(today, -92)}&to=${today}`,
    );
    expect(tooLong.status).toBe(400);

    const tooManyRows = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/reports/daily?from=${threeDaysAgo}&to=${today}&limit=101`,
    );
    expect(tooManyRows.status).toBe(400);

    const range = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/reports/daily?from=${threeDaysAgo}&to=${today}&limit=100`,
    );
    expect(range.status).toBe(200);
    const report = range.body.data as ReportDailyResponse;
    expect(report.items).toHaveLength(4);
    expect(report.items[0]?.businessDate).toBe(today);
    expect(report.totals.counters.netSales).toBe(500);
    expect(range.body.meta).toMatchObject({ page: 1, limit: 100, total: 4 });
  });

  it("a cashier gets 403 on both reads", async () => {
    const world = await aWorld();
    const cashierRole = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.CASHIER,
    );
    const cashier = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: cashierRole },
    ]);
    const home = await cashier.actor.call("get", `/orgs/${world.organizationA}/reports/home`);
    const daily = await cashier.actor.call(
      "get",
      `/orgs/${world.organizationA}/reports/daily?from=${todayInOrganization()}&to=${todayInOrganization()}`,
    );
    expect(home.status).toBe(403);
    expect(daily.status).toBe(403);
  });

  it("cross-org reads are denied", async () => {
    const world = await aWorld();
    const home = await world.bob.call("get", `/orgs/${world.organizationA}/reports/home`);
    const daily = await world.bob.call(
      "get",
      `/orgs/${world.organizationA}/reports/daily?from=${todayInOrganization()}&to=${todayInOrganization()}`,
    );
    expect([403, 404]).toContain(home.status);
    expect([403, 404]).toContain(daily.status);
  });

  it("a request without a valid organization path is refused", async () => {
    const world = await aWorld();
    const missing = await world.alice.call("get", `/orgs/${newId()}/reports/home`);
    expect([403, 404]).toContain(missing.status);
  });
});
