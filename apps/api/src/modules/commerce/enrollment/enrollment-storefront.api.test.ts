import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import type {
  PublicEnrollmentCommands,
  StorefrontCommandContext,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { money, startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../test-support/two-organizations.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { buildModuleRegistry, MODULE_MANIFESTS } from "../../../routes/module-registry.js";
import { buildOrgConfigService } from "../../platform/entitlement/index.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../routes/organization-config-ports.js";
import { buildIndustryTemplateReader } from "../../platform/industry/index.js";
import { buildAuditRecorder } from "../../core/audit/index.js";
import { buildRequestQuoter } from "../../../routes/booking-tenant-router.js";
import { buildEnrollmentPaymentAdapter } from "../../../routes/enrollment-payment-adapter.js";
import {
  buildEnrollmentDependencies,
  buildStorefrontEnrollmentCommands,
  type EnrollmentStorefrontDependencies,
} from "./index.js";
import { createEnrollment } from "./application/create-enrollment.js";
import { MongoEnrollmentRepository } from "./infrastructure/mongo-enrollment.repository.js";
import { businessDateOf } from "../booking/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const GYM = { industryTemplateKey: "GYM" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
  harness.clock.advanceSeconds(
    (new Date("2026-03-01T02:00:00+06:00").getTime() - harness.clock.now().getTime()) / 1000,
  );
});

afterAll(async () => {
  await harness.dispose();
});

function today(harnessInstance: IamApiHarness): string {
  return businessDateOf(harnessInstance.clock.now(), "Asia/Dhaka");
}

async function publishPlan(
  world: TwoOrganizations,
  details: object = {},
  variantPrice: number = 10001,
  org: "A" | "B" = "A",
): Promise<{ offeringId: string; variantId: string; version: number }> {
  const actor = org === "A" ? world.alice : world.bob;
  const targetOrganizationId = org === "A" ? world.organizationA : world.organizationB;
  const created = await actor.call("post", `/orgs/${targetOrganizationId}/offerings`, {
    kind: "PLAN",
    name: "Membership",
    kindDetails: {
      billingPeriod: { unit: "MONTH", count: 1 },
      freezeAllowed: true,
      maxFreezeDaysPerYear: 30,
      startRule: "ANY_DATE",
      autoRenewDefault: false,
      ...details,
    },
    variants: [{ name: "Monthly", price: money(variantPrice), unitKey: "SESSION" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const offering = created.body.data as {
    offeringId: string;
    version: number;
    variants: { variantId: string }[];
  };
  const published = await actor.call(
    "post",
    `/orgs/${targetOrganizationId}/offerings/${offering.offeringId}/publish`,
    { version: offering.version },
  );
  expect(published.status, JSON.stringify(published.body)).toBe(200);
  const variantId = offering.variants[0]?.variantId;
  if (!variantId) throw new Error("Missing variant");
  return { offeringId: offering.offeringId, variantId, version: offering.version };
}

async function createCustomerContact(
  world: TwoOrganizations,
  name = "Member",
  org: "A" | "B" = "A",
): Promise<string> {
  const actor = org === "A" ? world.alice : world.bob;
  const targetOrganizationId = org === "A" ? world.organizationA : world.organizationB;
  const contactRoles = org === "A" ? ["RELATED"] : ["CUSTOMER"];
  const response = await actor.call("post", `/orgs/${targetOrganizationId}/contacts`, {
    name,
    contactType: "PERSON",
    contactRoles,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return (response.body.data as { contactId: string }).contactId;
}

async function setSetting(
  world: TwoOrganizations,
  settingKey: string,
  value: unknown,
): Promise<void> {
  const response = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
    items: [{ settingKey, value }],
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
}

async function setupWorld(suffix: string) {
  void suffix;
  const world = await worldFor(harness, RETAIL, GYM);
  await harness.connections.platform
    .collection("platform_subscriptions")
    .updateOne(
      { organizationId: world.organizationA },
      { $set: { trialEndsAt: new Date("2030-01-01") } },
    );

  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: harness.clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(harness.clock),
  });

  const audit = buildAuditRecorder(harness.clock);
  const quoter = buildRequestQuoter({
    clock: harness.clock,
    audit,
    permission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
    idempotency: () => (_req: Request, _res: Response, next: NextFunction) => next(),
    permissions: { locationsWith: async () => "ALL" },
    orgConfig,
    manifests: MODULE_MANIFESTS,
  });

  const deps = buildEnrollmentDependencies({
    clock: harness.clock,
    audit,
    payments: buildEnrollmentPaymentAdapter(),
    orgConfig,
    manifests: MODULE_MANIFESTS,
    fee: async (organizationId, body) => {
      const quote = await quoter.quote({
        organizationId: asId<OrganizationId>(organizationId),
        locationId: body.locationId,
        offeringId: body.offeringId,
        variantId: body.variantId,
      });
      return quote.totals.grandTotal;
    },
  });

  const storefrontDeps: EnrollmentStorefrontDependencies = {
    ...deps,
    kinds: {
      effectiveKinds: async (organizationId: OrganizationId) =>
        (await orgConfig.forOrganization(organizationId)).config.kinds,
    },
  };

  const rawCommands = buildStorefrontEnrollmentCommands(storefrontDeps);
  const commands: PublicEnrollmentCommands = {
    request: (context: StorefrontCommandContext, input) =>
      runInOrganizationContext(context.organizationId, () => rawCommands.request(context, input)),
  };

  return { world, deps, storefrontDeps, commands };
}

describe("PublicEnrollmentCommands.request (Storefront Enrollment Adapter)", () => {
  it("creates enrollment in PENDING status under CUSTOMER_REQUEST mode even when startsOn is today", async () => {
    const { world, commands } = await setupWorld("pending-customer");
    await setSetting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const contactId = await createCustomerContact(world);
    const checkoutId = newId();

    const link = await commands.request(
      {
        organizationId: world.organizationA,
        locationId: world.locationA1,
        contactId,
        checkoutId,
        actorUserId: null,
      },
      {
        selectionId: "sel-pending",
        selection: {
          kind: "PLAN",
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: today(harness),
          resourceIds: [],
        },
        customFields: {},
      },
    );

    expect(link.requestType).toBe("ENROLLMENT");
    expect(link.status).toBe("PENDING");
    expect(link.holdExpiresAt).toBeNull();

    const repo = new MongoEnrollmentRepository();
    const doc = await runInOrganizationContext(world.organizationA, () =>
      repo.find(link.requestId),
    );
    expect(doc?.status).toBe("PENDING");
  });

  it("preserves staff create behavior: creates ACTIVE enrollment when startsOn is today and payment not required", async () => {
    const { world, deps } = await setupWorld("staff-active");
    await setSetting(world, ENROLLMENT_SETTING.REQUIRE_PAYMENT, false);
    const plan = await publishPlan(world);
    const contactId = await createCustomerContact(world);

    const enrollment = await runInOrganizationContext(world.organizationA, () =>
      createEnrollment(
        deps,
        {
          organizationId: world.organizationA,
          actorUserId: null,
          allowedLocationIds: "ALL",
          creationMode: "STAFF",
        },
        {
          locationId: world.locationA1,
          contactId,
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: today(harness),
          resourceIds: [],
          customFields: {},
        },
      ),
    );

    expect(enrollment.status).toBe("ACTIVE");
  });

  it("calculates upfront obligation including admission fee, first recurring fee and security deposit", async () => {
    const { world, commands } = await setupWorld("upfront-obligation");
    const plan = await publishPlan(
      world,
      {
        admissionFee: { amount: 1500, currency: "BDT" },
        securityDeposit: { amount: 3000, currency: "BDT" },
      },
      10001,
    );
    const contactId = await createCustomerContact(world);

    const link = await commands.request(
      {
        organizationId: world.organizationA,
        locationId: world.locationA1,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selectionId: "sel-upfront",
        selection: {
          kind: "PLAN",
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: today(harness),
          resourceIds: [],
        },
        customFields: {},
      },
    );

    // 10001 + 1500 + 3000 = 14501
    expect(link.paymentRequired).toEqual({ amount: 14501, currency: "BDT" });
  });

  it("initializes payment summary with enrollmentPeriodId as payment requestId", async () => {
    const { world, commands } = await setupWorld("payment-summary");
    const plan = await publishPlan(
      world,
      { admissionFee: { amount: 1000, currency: "BDT" } },
      5000,
    );
    const contactId = await createCustomerContact(world);

    const link = await commands.request(
      {
        organizationId: world.organizationA,
        locationId: world.locationA1,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selectionId: "sel-summary",
        selection: {
          kind: "PLAN",
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: today(harness),
          resourceIds: [],
        },
        customFields: {},
      },
    );

    const repo = new MongoEnrollmentRepository();
    const enrollment = await runInOrganizationContext(world.organizationA, () =>
      repo.find(link.requestId),
    );
    expect(enrollment).toBeDefined();

    const summary = await harness.connections.tenantShared.collection("payment_summaries").findOne({
      organizationId: world.organizationA,
      requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
      requestId: enrollment?.currentEnrollmentPeriodId,
    });

    expect(summary).not.toBeNull();
    expect(summary?.["total"]).toEqual({ amount: 6000, currency: "BDT" });
    expect(summary?.["requestId"]).toBe(enrollment?.currentEnrollmentPeriodId);
  });

  it("takes seat count and resource holds within unit of work", async () => {
    const { world, commands } = await setupWorld("seat-resource");
    const plan = await publishPlan(world, { capacity: 5 });
    const contactId = await createCustomerContact(world);

    // Create a resource in locationA1 with capacity 1
    const resResponse = await world.alice.call("post", `/orgs/${world.organizationA}/resources`, {
      locationId: world.locationA1,
      resourceTypeKey: "LOCKER",
      name: "Desk 1",
      capacity: 1,
      weeklySchedule: [],
      offeringIds: [],
    });
    expect(resResponse.status).toBe(201);
    const resourceId = (resResponse.body.data as { resourceId: string }).resourceId;

    const link = await commands.request(
      {
        organizationId: world.organizationA,
        locationId: world.locationA1,
        contactId,
        checkoutId: newId(),
        actorUserId: null,
      },
      {
        selectionId: "sel-seat",
        selection: {
          kind: "PLAN",
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: today(harness),
          resourceIds: [resourceId],
        },
        customFields: {},
      },
    );

    // Verify seat count incremented
    const seatsDoc = await harness.connections.tenantShared
      .collection("enrollment_seats")
      .findOne({ organizationId: world.organizationA, variantId: plan.variantId });
    expect(seatsDoc).not.toBeNull();
    expect(seatsDoc?.["count"]).toBe(1);

    // Verify resource hold taken
    const holdDoc = await harness.connections.tenantShared
      .collection("resource_exclusive_holds")
      .findOne({
        organizationId: world.organizationA,
        enrollmentId: link.requestId,
        resourceId,
      });
    expect(holdDoc).not.toBeNull();
    expect(holdDoc?.["endsOn"]).toBeNull();
  });

  it("attaches checkoutId to enrollment document and allows sparse lookup", async () => {
    const { world, commands } = await setupWorld("checkout-lookup");
    const plan = await publishPlan(world);
    const contactId = await createCustomerContact(world);
    const checkoutId = newId();

    const link = await commands.request(
      {
        organizationId: world.organizationA,
        locationId: world.locationA1,
        contactId,
        checkoutId,
        actorUserId: null,
      },
      {
        selectionId: "sel-checkout",
        selection: {
          kind: "PLAN",
          offeringId: plan.offeringId,
          variantId: plan.variantId,
          startsOn: today(harness),
          resourceIds: [],
        },
        customFields: {},
      },
    );

    const repo = new MongoEnrollmentRepository();
    const doc = await runInOrganizationContext(world.organizationA, () =>
      repo.findByCheckoutId(world.organizationA, checkoutId),
    );
    expect(doc).toBeDefined();
    expect(doc?.enrollmentId).toBe(link.requestId);
    expect(doc?.checkoutId).toBe(checkoutId);
  });

  it("validates billToContactId and refuses foreign payer", async () => {
    const { world, commands } = await setupWorld("foreign-payer");
    const plan = await publishPlan(world);
    const contactId = await createCustomerContact(world, "Local Student");

    // Create a contact in organization B
    const foreignContactId = await createCustomerContact(world, "Foreign Payer", "B");

    await expect(
      commands.request(
        {
          organizationId: world.organizationA,
          locationId: world.locationA1,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-foreign-payer",
          selection: {
            kind: "PLAN",
            offeringId: plan.offeringId,
            variantId: plan.variantId,
            startsOn: today(harness),
            resourceIds: [],
          },
          customFields: { billToContactId: foreignContactId },
        },
      ),
    ).rejects.toThrow();
  });

  it("refuses customer enrollment request for disabled plan offering or inactive location", async () => {
    const { world, commands } = await setupWorld("disabled-plan");
    const contactId = await createCustomerContact(world);

    // Create draft (unpublished) offering
    const draft = await world.alice.call("post", `/orgs/${world.organizationA}/offerings`, {
      kind: "PLAN",
      name: "Draft Plan",
      kindDetails: {
        billingPeriod: { unit: "MONTH", count: 1 },
        startRule: "ANY_DATE",
      },
      variants: [{ name: "Monthly", price: money(5000), unitKey: "SESSION" }],
    });
    expect(draft.status).toBe(201);
    const draftData = draft.body.data as { offeringId: string; variants: { variantId: string }[] };

    await expect(
      commands.request(
        {
          organizationId: world.organizationA,
          locationId: world.locationA1,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-draft",
          selection: {
            kind: "PLAN",
            offeringId: draftData.offeringId,
            variantId: draftData.variants[0]?.variantId ?? "",
            startsOn: today(harness),
            resourceIds: [],
          },
          customFields: {},
        },
      ),
    ).rejects.toThrow();

    // Inactive location
    const plan = await publishPlan(world);
    await expect(
      commands.request(
        {
          organizationId: world.organizationA,
          locationId: newId(), // non-existent / inactive location
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-inactive-loc",
          selection: {
            kind: "PLAN",
            offeringId: plan.offeringId,
            variantId: plan.variantId,
            startsOn: today(harness),
            resourceIds: [],
          },
          customFields: {},
        },
      ),
    ).rejects.toThrow();
  });

  it("refuses enrollment when plan start rule FIXED_DATES is violated", async () => {
    const { world, commands } = await setupWorld("fixed-dates");
    const plan = await publishPlan(world, {
      startRule: "FIXED_DATES",
      startDates: ["2026-03-15", "2026-04-01"],
    });
    const contactId = await createCustomerContact(world);

    await expect(
      commands.request(
        {
          organizationId: world.organizationA,
          locationId: world.locationA1,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-violates-fixed-date",
          selection: {
            kind: "PLAN",
            offeringId: plan.offeringId,
            variantId: plan.variantId,
            startsOn: "2026-03-01", // Not in startDates
            resourceIds: [],
          },
          customFields: {},
        },
      ),
    ).rejects.toThrow();
  });

  it("enforces cross-organization isolation: cannot request enrollment in another organization", async () => {
    const { world, commands } = await setupWorld("cross-org");
    // Enable GYM and trial on Org B so it can create PLAN offering
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId: world.organizationB },
        { $set: GYM, $inc: { configVersion: 1 } },
      );
    await harness.connections.platform
      .collection("platform_subscriptions")
      .updateOne(
        { organizationId: world.organizationB },
        { $set: { trialEndsAt: new Date("2030-01-01") } },
      );

    // Plan created and published in Org B
    const planB = await publishPlan(world, {}, 8000, "B");
    const contactId = await createCustomerContact(world);

    // Org A context requesting Org B offering
    await expect(
      commands.request(
        {
          organizationId: world.organizationA,
          locationId: world.locationA1,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-cross-org-offering",
          selection: {
            kind: "PLAN",
            offeringId: planB.offeringId,
            variantId: planB.variantId,
            startsOn: today(harness),
            resourceIds: [],
          },
          customFields: {},
        },
      ),
    ).rejects.toThrow();

    // Org A context requesting Org B location
    const planA = await publishPlan(world);
    await expect(
      commands.request(
        {
          organizationId: world.organizationA,
          locationId: world.locationB1,
          contactId,
          checkoutId: newId(),
          actorUserId: null,
        },
        {
          selectionId: "sel-cross-org-location",
          selection: {
            kind: "PLAN",
            offeringId: planA.offeringId,
            variantId: planA.variantId,
            startsOn: today(harness),
            resourceIds: [],
          },
          customFields: {},
        },
      ),
    ).rejects.toThrow();
  });

  it("rolls back seat and resource holds if payment summary initialization or database write fails", async () => {
    const { world, storefrontDeps, commands } = await setupWorld("rollback-seat-resource");
    const plan = await publishPlan(world, { capacity: 10 });
    const contactId = await createCustomerContact(world);

    // Create resource
    const resResponse = await world.alice.call("post", `/orgs/${world.organizationA}/resources`, {
      locationId: world.locationA1,
      resourceTypeKey: "LOCKER",
      name: "Seat Rollback Test",
      capacity: 1,
      weeklySchedule: [],
      offeringIds: [],
    });
    expect(resResponse.status).toBe(201);
    const resourceId = (resResponse.body.data as { resourceId: string }).resourceId;

    // Simulate failure in payments.initializeSummary
    const originalInit = storefrontDeps.payments.initializeSummary;
    const paymentsWithMock = storefrontDeps.payments as { initializeSummary: typeof originalInit };
    paymentsWithMock.initializeSummary = async () => {
      throw new Error("SIMULATED_PAYMENT_INIT_FAILURE");
    };

    const checkoutId = newId();
    try {
      await expect(
        commands.request(
          {
            organizationId: world.organizationA,
            locationId: world.locationA1,
            contactId,
            checkoutId,
            actorUserId: null,
          },
          {
            selectionId: "sel-rollback",
            selection: {
              kind: "PLAN",
              offeringId: plan.offeringId,
              variantId: plan.variantId,
              startsOn: today(harness),
              resourceIds: [resourceId],
            },
            customFields: {},
          },
        ),
      ).rejects.toThrow("SIMULATED_PAYMENT_INIT_FAILURE");
    } finally {
      paymentsWithMock.initializeSummary = originalInit;
    }

    // Verify seat count was NOT incremented (or is 0)
    const seatsDoc = await harness.connections.tenantShared
      .collection("enrollment_seats")
      .findOne({ organizationId: world.organizationA, variantId: plan.variantId });
    expect(seatsDoc === null || seatsDoc["count"] === 0).toBe(true);

    // Verify resource hold was NOT taken
    const holdDocs = await harness.connections.tenantShared
      .collection("resource_exclusive_holds")
      .find({
        organizationId: world.organizationA,
        resourceId,
      })
      .toArray();
    expect(holdDocs).toHaveLength(0);

    // Verify no enrollment was created
    const enrollmentDocs = await harness.connections.tenantShared
      .collection("enrollments")
      .find({ organizationId: world.organizationA, checkoutId })
      .toArray();
    expect(enrollmentDocs).toHaveLength(0);
  });
});
