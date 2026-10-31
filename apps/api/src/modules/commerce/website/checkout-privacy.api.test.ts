import { CURRENCY_CODE, ERROR_CODE, type CurrencyCode } from "@banijjik/contracts";
import type { CheckoutExportSection } from "@banijjik/contracts/contact";
import { newId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { buildCheckoutPrivacyParticipants } from "./application/checkout-privacy-participants.js";
import { ReadOwnRequestsUseCase } from "./application/read-own-requests.js";
import type { Checkout, CheckoutAccess, CheckoutRequestLinkRecord } from "./domain/checkout-types.js";
import {
  MongoCheckoutAccessRepository,
  MongoCheckoutQuoteRepository,
  MongoCheckoutRepository,
  MongoCheckoutRequestLinkRepository,
} from "./infrastructure/mongo-checkout.repository.js";
import { buildAuthorizeReplay } from "./presentation/storefront-principal.middleware.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("Storefront Checkout Privacy Participants (Card 4.3 Part A5B)", () => {
  const clock = {
    now: () => new Date("2026-10-30T12:00:00.000Z"),
  };

  const accessRepo = new MongoCheckoutAccessRepository();
  const checkoutRepo = new MongoCheckoutRepository();
  const requestLinkRepo = new MongoCheckoutRequestLinkRepository();
  const quoteRepo = new MongoCheckoutQuoteRepository();

  const participants = buildCheckoutPrivacyParticipants({
    accesses: accessRepo,
    checkouts: checkoutRepo,
    requestLinks: requestLinkRepo,
    quotes: quoteRepo,
  });

  const readOwnRequests = new ReadOwnRequestsUseCase({
    access: accessRepo,
    checkouts: checkoutRepo,
    requestLinks: requestLinkRepo,
    requestStatusReader: {
      readStatus: async (input) => ({
        requestId: input.requestId,
        requestType: input.requestType,
        status: "SUBMITTED",
        publicNumber: "PUB-1",
        paymentRequired: { amount: 5000, currency: CURRENCY_CODE.BDT as CurrencyCode },
        holdExpiresAt: null,
        createdAt: new Date("2026-10-30T10:00:00.000Z"),
      }),
    },
    clock,
  });

  const authorizeReplay = buildAuthorizeReplay(accessRepo);

  async function seedCheckoutFixture(input: {
    readonly organizationId: string;
    readonly locationId: string;
    readonly checkoutId: string;
    readonly quoteId: string;
    readonly owner: { readonly type: "CUSTOMER" | "GUEST"; readonly identifier: string };
    readonly links?: readonly CheckoutRequestLinkRecord[];
    readonly contactSnapshot?: {
      readonly name: string;
      readonly phoneE164: string;
      readonly customFields: Readonly<Record<string, unknown>>;
    };
  }) {
    const contactSnapshot = input.contactSnapshot ?? {
      name: "Alice Rahman",
      phoneE164: "+8801711000001",
      customFields: { instructions: "Deliver after 5pm" },
    };

    const checkout: Checkout = {
      checkoutId: input.checkoutId,
      organizationId: input.organizationId,
      locationId: input.locationId,
      creationPrincipalKey:
        input.owner.type === "CUSTOMER"
          ? `CUSTOMER:${input.owner.identifier}`
          : `GUEST:${input.owner.identifier}`,
      contactId: newId(),
      contactSnapshot,
      quoteId: input.quoteId,
      acceptedTotals: {
        total: { amount: 5000, currency: CURRENCY_CODE.BDT as CurrencyCode },
        deliveryCharge: { amount: 100, currency: CURRENCY_CODE.BDT as CurrencyCode },
      },
      idempotencyKeyHash: "hash-" + input.checkoutId,
      inputHash: "input-hash-" + input.checkoutId,
      version: 1,
      createdAt: new Date("2026-10-30T10:00:00.000Z"),
      updatedAt: new Date("2026-10-30T10:00:00.000Z"),
    };
    await checkoutRepo.save(checkout);

    const access: CheckoutAccess = {
      checkoutAccessId: newId(),
      organizationId: input.organizationId,
      checkoutId: input.checkoutId,
      owner: input.owner,
      revokedAt: null,
      version: 1,
      createdAt: new Date("2026-10-30T10:00:00.000Z"),
      updatedAt: new Date("2026-10-30T10:00:00.000Z"),
    };
    await accessRepo.save(access);

    if (input.links && input.links.length > 0) {
      await requestLinkRepo.saveMany(input.links);
    }

    await quoteRepo.save({
      quoteId: input.quoteId,
      organizationId: input.organizationId,
      principalKey:
        input.owner.type === "CUSTOMER"
          ? `CUSTOMER:${input.owner.identifier}`
          : `GUEST:${input.owner.identifier}`,
      input: {
        locationId: input.locationId,
        selections: [
          {
            selectionId: newId(),
            selection: {
              kind: "PRODUCT",
              offeringId: newId(),
              variantId: newId(),
              quantity: 1,
              modifierOptionIds: [],
            },
            customFields: { color: "navy" },
          },
        ],
        fulfillment: {
          method: "COURIER",
          address: {
            recipientName: contactSnapshot.name,
            phone: contactSnapshot.phoneE164,
            addressLine: "Road 12, Banani",
            districtCode: "DHK",
            areaCode: "BANANI",
          },
        },
      },
      inputHash: "quote-hash-" + input.quoteId,
      pricedSnapshot: {
        total: { amount: 5000, currency: CURRENCY_CODE.BDT as CurrencyCode },
        lines: [],
        deliveryCharge: { amount: 100, currency: CURRENCY_CODE.BDT as CurrencyCode },
      },
      configVersion: 1,
      expiresAt: new Date("2026-10-30T12:00:00.000Z"),
      consumedAt: new Date("2026-10-30T10:00:00.000Z"),
      consumedCheckoutId: input.checkoutId,
      version: 1,
      createdAt: new Date("2026-10-30T09:55:00.000Z"),
      updatedAt: new Date("2026-10-30T10:00:00.000Z"),
    });
  }

  it("exports owned and claimed checkouts and request links in customer privacy export", async () => {
    const world = await worldFor(harness, RETAIL);
    const customerAccountId = newId() as CustomerAccountId;
    const organizationId = world.organizationA as OrganizationId;
    const locationId = world.locationA1;

    const checkout1Id = newId();
    const quote1Id = newId();
    const link1: CheckoutRequestLinkRecord = {
      checkoutRequestLinkId: newId(),
      organizationId,
      checkoutId: checkout1Id,
      selectionIds: [newId()],
      requestType: "ORDER",
      requestId: newId(),
      publicNumber: "ORD-001",
      status: "PLACED",
      paymentRequired: { amount: 5000, currency: CURRENCY_CODE.BDT as CurrencyCode },
      holdExpiresAt: null,
      createdAt: new Date("2026-10-30T10:00:00.000Z"),
      updatedAt: new Date("2026-10-30T10:00:00.000Z"),
    };

    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId: checkout1Id,
      quoteId: quote1Id,
      owner: { type: "CUSTOMER", identifier: customerAccountId },
      links: [link1],
    });

    const checkout2Id = newId();
    const quote2Id = newId();
    const link2: CheckoutRequestLinkRecord = {
      checkoutRequestLinkId: newId(),
      organizationId,
      checkoutId: checkout2Id,
      selectionIds: [newId()],
      requestType: "BOOKING",
      requestId: newId(),
      publicNumber: "BKG-002",
      status: "CONFIRMED",
      paymentRequired: { amount: 2000, currency: CURRENCY_CODE.BDT as CurrencyCode },
      holdExpiresAt: new Date("2026-10-30T11:00:00.000Z"),
      createdAt: new Date("2026-10-30T10:05:00.000Z"),
      updatedAt: new Date("2026-10-30T10:05:00.000Z"),
    };

    // Guest checkout claimed by customer
    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId: checkout2Id,
      quoteId: quote2Id,
      owner: { type: "CUSTOMER", identifier: customerAccountId },
      links: [link2],
    });

    const exportResult = (await participants.exportParticipant.exportForAccount({
      organizationId,
      customerAccountId,
      maxRows: 10,
    })) as CheckoutExportSection;

    expect(exportResult.sectionKey).toBe("CHECKOUT");
    expect(exportResult.truncated).toBe(false);
    expect(exportResult.checkouts).toHaveLength(2);

    const exportedIds = exportResult.checkouts.map((c) => c.checkoutId);
    expect(exportedIds).toContain(checkout1Id);
    expect(exportedIds).toContain(checkout2Id);

    const c1 = exportResult.checkouts.find((c) => c.checkoutId === checkout1Id);
    expect(c1?.requests).toHaveLength(1);
    expect(c1?.requests[0]?.requestType).toBe("ORDER");
    expect(c1?.requests[0]?.publicNumber).toBe("ORD-001");

    const c2 = exportResult.checkouts.find((c) => c.checkoutId === checkout2Id);
    expect(c2?.requests).toHaveLength(1);
    expect(c2?.requests[0]?.requestType).toBe("BOOKING");
    expect(c2?.requests[0]?.publicNumber).toBe("BKG-002");
    expect(c2?.requests[0]?.holdExpiresAt).toBe("2026-10-30T11:00:00.000Z");

    // Max rows truncation test
    const truncatedResult = (await participants.exportParticipant.exportForAccount({
      organizationId,
      customerAccountId,
      maxRows: 1,
    })) as CheckoutExportSection;
    expect(truncatedResult.truncated).toBe(true);
    expect(truncatedResult.checkouts).toHaveLength(1);
  });

  it("excludes unclaimed guest checkouts or another customer's checkouts from privacy export", async () => {
    const world = await worldFor(harness, RETAIL);
    const targetCustomerAccountId = newId() as CustomerAccountId;
    const otherCustomerAccountId = newId();
    const organizationId = world.organizationA as OrganizationId;
    const locationId = world.locationA1;

    const targetCheckoutId = newId();
    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId: targetCheckoutId,
      quoteId: newId(),
      owner: { type: "CUSTOMER", identifier: targetCustomerAccountId },
    });

    const guestCheckoutId = newId();
    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId: guestCheckoutId,
      quoteId: newId(),
      owner: { type: "GUEST", identifier: newId() },
    });

    const otherCheckoutId = newId();
    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId: otherCheckoutId,
      quoteId: newId(),
      owner: { type: "CUSTOMER", identifier: otherCustomerAccountId },
    });

    const exportResult = (await participants.exportParticipant.exportForAccount({
      organizationId,
      customerAccountId: targetCustomerAccountId,
      maxRows: 10,
    })) as CheckoutExportSection;

    expect(exportResult.checkouts).toHaveLength(1);
    expect(exportResult.checkouts[0]?.checkoutId).toBe(targetCheckoutId);
  });

  it("erasure revokes CheckoutAccess, scrubs private checkout contact snapshot, and blocks subsequent replay or tracking", async () => {
    const world = await worldFor(harness, RETAIL);
    const customerAccountId = newId() as CustomerAccountId;
    const organizationId = world.organizationA as OrganizationId;
    const locationId = world.locationA1;
    const checkoutId = newId();
    const quoteId = newId();

    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId,
      quoteId,
      owner: { type: "CUSTOMER", identifier: customerAccountId },
      contactSnapshot: {
        name: "Private Customer",
        phoneE164: "+8801700112233",
        customFields: { personalId: "987654" },
      },
    });

    // Tracking and replay work before erasure
    const trackingBefore = await readOwnRequests.getCheckoutDetail({
      organizationId,
      principal: { type: "CUSTOMER", customerAccountId, contactId: "" },
      checkoutId,
    });
    expect(trackingBefore.contactSnapshot.name).toBe("Private Customer");

    await runInOrganizationContext(organizationId, async () => {
      await authorizeReplay(
        { body: { data: { checkoutId } } } as any,
        { checkoutPrincipal: { type: "CUSTOMER", customerAccountId, contactId: "" } } as any,
      );
    });

    // Execute erasure
    const eraseTime = new Date("2026-10-30T14:30:00.000Z");
    const eraseResult = await participants.erasureParticipant.eraseForAccount({
      organizationId,
      customerAccountId,
      now: eraseTime,
    });
    expect(eraseResult.forfeitedCredits).toBe(0);

    // Verify CheckoutAccess is revoked
    const accessAfter = await accessRepo.findByCheckoutId(organizationId, checkoutId);
    expect(accessAfter?.revokedAt?.toISOString()).toBe(eraseTime.toISOString());
    expect(accessAfter?.version).toBe(2);

    // Verify contact snapshot is redacted
    const checkoutAfter = await checkoutRepo.findById(organizationId, checkoutId);
    expect(checkoutAfter?.contactSnapshot).toEqual({
      name: "[REDACTED]",
      phoneE164: "[REDACTED]",
      customFields: {},
    });
    expect(checkoutAfter?.version).toBe(2);

    // Verify CheckoutQuote PII is scrubbed
    const quoteAfter = await quoteRepo.findById(organizationId, quoteId);
    const fulfillmentAddress = (quoteAfter?.input.fulfillment as any)?.address;
    expect(fulfillmentAddress.recipientName).toBe("[REDACTED]");
    expect(fulfillmentAddress.phone).toBe("[REDACTED]");
    expect(fulfillmentAddress.addressLine).toBe("[REDACTED]");
    expect(quoteAfter?.input.selections[0]?.customFields).toEqual({});

    // Verify subsequent tracking throws FORBIDDEN
    await expect(
      readOwnRequests.getCheckoutDetail({
        organizationId,
        principal: { type: "CUSTOMER", customerAccountId, contactId: "" },
        checkoutId,
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.FORBIDDEN,
    });

    // Verify subsequent replay authorization throws FORBIDDEN
    await expect(
      runInOrganizationContext(organizationId, async () => {
        await authorizeReplay(
          { body: { data: { checkoutId } } } as any,
          { checkoutPrincipal: { type: "CUSTOMER", customerAccountId, contactId: "" } } as any,
        );
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.FORBIDDEN,
    });

    // Idempotency check: second erase call succeeds safely
    const secondEraseResult = await participants.erasureParticipant.eraseForAccount({
      organizationId,
      customerAccountId,
      now: new Date("2026-10-30T15:00:00.000Z"),
    });
    expect(secondEraseResult.forfeitedCredits).toBe(0);
  });

  it("erasure preserves underlying order, booking, and enrollment financial records and audit integrity", async () => {
    const world = await worldFor(harness, RETAIL);
    const customerAccountId = newId() as CustomerAccountId;
    const organizationId = world.organizationA as OrganizationId;
    const locationId = world.locationA1;
    const checkoutId = newId();
    const orderId = newId();
    const bookingId = newId();
    const enrollmentId = newId();

    const linkRecords: CheckoutRequestLinkRecord[] = [
      {
        checkoutRequestLinkId: newId(),
        organizationId,
        checkoutId,
        selectionIds: [newId()],
        requestType: "ORDER",
        requestId: orderId,
        publicNumber: "ORD-FIN-1",
        status: "PLACED",
        paymentRequired: { amount: 5000, currency: CURRENCY_CODE.BDT as CurrencyCode },
        holdExpiresAt: null,
        createdAt: new Date("2026-10-30T10:00:00.000Z"),
        updatedAt: new Date("2026-10-30T10:00:00.000Z"),
      },
      {
        checkoutRequestLinkId: newId(),
        organizationId,
        checkoutId,
        selectionIds: [newId()],
        requestType: "BOOKING",
        requestId: bookingId,
        publicNumber: "BKG-FIN-2",
        status: "CONFIRMED",
        paymentRequired: { amount: 1000, currency: CURRENCY_CODE.BDT as CurrencyCode },
        holdExpiresAt: null,
        createdAt: new Date("2026-10-30T10:00:00.000Z"),
        updatedAt: new Date("2026-10-30T10:00:00.000Z"),
      },
      {
        checkoutRequestLinkId: newId(),
        organizationId,
        checkoutId,
        selectionIds: [newId()],
        requestType: "ENROLLMENT",
        requestId: enrollmentId,
        publicNumber: "ENR-FIN-3",
        status: "PENDING",
        paymentRequired: { amount: 3000, currency: CURRENCY_CODE.BDT as CurrencyCode },
        holdExpiresAt: null,
        createdAt: new Date("2026-10-30T10:00:00.000Z"),
        updatedAt: new Date("2026-10-30T10:00:00.000Z"),
      },
    ];

    await seedCheckoutFixture({
      organizationId,
      locationId,
      checkoutId,
      quoteId: newId(),
      owner: { type: "CUSTOMER", identifier: customerAccountId },
      links: linkRecords,
    });

    const tenantDb = harness.connections.tenantShared;

    // Seed real records in orders, bookings, enrollments, and audit collections
    await tenantDb.collection("orders").insertOne({
      orderId,
      organizationId,
      locationId,
      orderNumber: "ORD-FIN-1",
      status: "PLACED",
      checkoutId,
      totals: { total: { amount: 5000, currency: CURRENCY_CODE.BDT } },
      version: 1,
    });

    await tenantDb.collection("bookings").insertOne({
      bookingId,
      organizationId,
      locationId,
      bookingNumber: "BKG-FIN-2",
      status: "CONFIRMED",
      checkoutId,
      depositRequired: { amount: 1000, currency: CURRENCY_CODE.BDT },
      version: 1,
    });

    await tenantDb.collection("enrollments").insertOne({
      enrollmentId,
      organizationId,
      locationId,
      enrollmentNumber: "ENR-FIN-3",
      status: "PENDING",
      checkoutId,
      upfrontFees: { amount: 3000, currency: CURRENCY_CODE.BDT },
      version: 1,
    });

    const auditRecordId = newId();
    await tenantDb.collection("audit_records").insertOne({
      auditRecordId,
      organizationId,
      action: "CHECKOUT_CREATED",
      entityType: "checkout",
      entityId: checkoutId,
      createdAt: new Date("2026-10-30T10:00:00.000Z"),
    });

    // Run erasure
    await participants.erasureParticipant.eraseForAccount({
      organizationId,
      customerAccountId,
      now: new Date("2026-10-30T15:00:00.000Z"),
    });

    // Assert underlying financial/business documents are preserved exactly
    const orderAfter = await tenantDb.collection("orders").findOne({ orderId });
    expect(orderAfter).not.toBeNull();
    expect(orderAfter?.["status"]).toBe("PLACED");
    expect(orderAfter?.["totals"]).toEqual({ total: { amount: 5000, currency: CURRENCY_CODE.BDT } });

    const bookingAfter = await tenantDb.collection("bookings").findOne({ bookingId });
    expect(bookingAfter).not.toBeNull();
    expect(bookingAfter?.["status"]).toBe("CONFIRMED");
    expect(bookingAfter?.["depositRequired"]).toEqual({
      amount: 1000,
      currency: CURRENCY_CODE.BDT,
    });

    const enrollmentAfter = await tenantDb.collection("enrollments").findOne({ enrollmentId });
    expect(enrollmentAfter).not.toBeNull();
    expect(enrollmentAfter?.["status"]).toBe("PENDING");
    expect(enrollmentAfter?.["upfrontFees"]).toEqual({
      amount: 3000,
      currency: CURRENCY_CODE.BDT,
    });

    // Assert request links and accepted totals on checkout are preserved
    const linksAfter = await requestLinkRepo.listByCheckoutId(organizationId, checkoutId);
    expect(linksAfter).toHaveLength(3);
    expect(linksAfter.map((l) => l.publicNumber)).toEqual([
      "ORD-FIN-1",
      "BKG-FIN-2",
      "ENR-FIN-3",
    ]);

    const checkoutDoc = await checkoutRepo.findById(organizationId, checkoutId);
    expect(checkoutDoc?.acceptedTotals).toEqual({
      total: { amount: 5000, currency: CURRENCY_CODE.BDT },
      deliveryCharge: { amount: 100, currency: CURRENCY_CODE.BDT },
    });

    // Assert audit integrity preserved
    const auditAfter = await tenantDb.collection("audit_records").findOne({ auditRecordId });
    expect(auditAfter).not.toBeNull();
    expect(auditAfter?.["action"]).toBe("CHECKOUT_CREATED");
  });

  it("enforces cross-organization isolation during privacy export and erasure", async () => {
    const world = await worldFor(harness, RETAIL);
    const orgAId = world.organizationA as OrganizationId;
    const orgBId = world.organizationB as OrganizationId;

    const customerA = newId() as CustomerAccountId;
    const customerB = newId() as CustomerAccountId;

    const checkoutAId = newId();
    await seedCheckoutFixture({
      organizationId: orgAId,
      locationId: world.locationA1,
      checkoutId: checkoutAId,
      quoteId: newId(),
      owner: { type: "CUSTOMER", identifier: customerA },
      contactSnapshot: {
        name: "Customer A",
        phoneE164: "+8801700000001",
        customFields: {},
      },
    });

    const checkoutBId = newId();
    await seedCheckoutFixture({
      organizationId: orgBId,
      locationId: world.locationB1,
      checkoutId: checkoutBId,
      quoteId: newId(),
      owner: { type: "CUSTOMER", identifier: customerB },
      contactSnapshot: {
        name: "Customer B",
        phoneE164: "+8801700000002",
        customFields: {},
      },
    });

    // Cross-org export attempt produces empty checkouts
    const crossExport = (await participants.exportParticipant.exportForAccount({
      organizationId: orgAId,
      customerAccountId: customerB,
      maxRows: 10,
    })) as CheckoutExportSection;
    expect(crossExport.checkouts).toEqual([]);

    // Cross-org erasure attempt does not affect customer B in Org B
    await participants.erasureParticipant.eraseForAccount({
      organizationId: orgAId,
      customerAccountId: customerB,
      now: new Date("2026-10-30T16:00:00.000Z"),
    });

    const accessB = await accessRepo.findByCheckoutId(orgBId, checkoutBId);
    expect(accessB?.revokedAt).toBeNull();

    const checkoutB = await checkoutRepo.findById(orgBId, checkoutBId);
    expect(checkoutB?.contactSnapshot.name).toBe("Customer B");
    expect(checkoutB?.contactSnapshot.phoneE164).toBe("+8801700000002");

    // Correct org erasure erases customer B in Org B, leaving customer A in Org A untouched
    await participants.erasureParticipant.eraseForAccount({
      organizationId: orgBId,
      customerAccountId: customerB,
      now: new Date("2026-10-30T16:30:00.000Z"),
    });

    const accessBAfter = await accessRepo.findByCheckoutId(orgBId, checkoutBId);
    expect(accessBAfter?.revokedAt).not.toBeNull();

    const checkoutBAfter = await checkoutRepo.findById(orgBId, checkoutBId);
    expect(checkoutBAfter?.contactSnapshot.name).toBe("[REDACTED]");

    const checkoutA = await checkoutRepo.findById(orgAId, checkoutAId);
    expect(checkoutA?.contactSnapshot.name).toBe("Customer A");
  });
});
