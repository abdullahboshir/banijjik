import { CURRENCY_CODE } from "@banijjik/contracts";
import { REVENUE_STATE } from "@banijjik/contracts/accounting";
import {
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
} from "@banijjik/contracts/payment";
import { asId, newId, type LocationId, type OrganizationId, type PaymentId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models } from "../../../../kernel/db/index.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { PAYMENT_MODEL_NAME, type PaymentDocument } from "./payment.schema.js";
import { buildRequestAdvanceReader } from "./request-advance.reader.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function insertPayment(input: {
  readonly organizationId: OrganizationId;
  readonly direction:
    | typeof PAYMENT_DIRECTION.IN
    | typeof PAYMENT_DIRECTION.REFUND
    | typeof PAYMENT_DIRECTION.REVERSAL;
  readonly amount: number;
  readonly requestId: string;
  readonly requestType?: typeof PAYMENT_REQUEST_TYPE.BOOKING;
  readonly revenueState?: typeof REVENUE_STATE.BEFORE_REVENUE | typeof REVENUE_STATE.AFTER_REVENUE;
  readonly currency?: string;
  readonly reversesPaymentId?: string;
}) {
  const model = models({}).get<PaymentDocument>(PAYMENT_MODEL_NAME);
  const now = new Date();
  const paymentId = newId<PaymentId>();
  const currency = input.currency ?? CURRENCY_CODE.BDT;
  return model.create({
    paymentId,
    organizationId: input.organizationId,
    locationId: asId<LocationId>(newId()),
    paymentNumber: `P-${paymentId.slice(0, 8)}`,
    direction: input.direction,
    method: PAYMENT_METHOD.CASH,
    amount: { amount: input.amount, currency },
    externalReference: null,
    reversesPaymentId: input.reversesPaymentId ?? null,
    allocations: [
      {
        requestType: input.requestType ?? PAYMENT_REQUEST_TYPE.BOOKING,
        requestId: input.requestId,
        enrollmentPeriodId: null,
        amount: { amount: input.amount, currency },
        revenueState: input.revenueState ?? REVENUE_STATE.BEFORE_REVENUE,
      },
    ],
    contactId: null,
    receivedByMemberId: newId(),
    businessDate: "2026-10-23",
    approval: null,
    note: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: null,
    updatedByUserId: null,
  });
}

describe("RequestAdvanceReader", () => {
  const reader = buildRequestAdvanceReader();

  it("Held advance: deposit required 500, nothing paid -> settles 0", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    await withOrganizationContext(organizationId, async () => {
      const held = await reader.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId: "booking-unpaid",
      });
      expect(held).toEqual({ amount: 0, currency: CURRENCY_CODE.BDT });
    });
  });

  it("Held advance: paid 500 -> 500", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const requestId = "booking-500";
    await withOrganizationContext(organizationId, async () => {
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.IN,
        amount: 500,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });

      const held = await reader.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(held).toEqual({ amount: 500, currency: CURRENCY_CODE.BDT });
    });
  });

  it("Held advance: paid 800 before the visit -> 800", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const requestId = "booking-800";
    await withOrganizationContext(organizationId, async () => {
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.IN,
        amount: 800,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });

      const held = await reader.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(held).toEqual({ amount: 800, currency: CURRENCY_CODE.BDT });
    });
  });

  it("Held advance: paid 500 then refunded 200 -> 300", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const requestId = "booking-refunded";
    await withOrganizationContext(organizationId, async () => {
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.IN,
        amount: 500,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.REFUND,
        amount: 200,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });

      const held = await reader.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(held).toEqual({ amount: 300, currency: CURRENCY_CODE.BDT });
    });
  });

  it("Held advance: a reversed payment -> 0", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const requestId = "booking-reversed";
    await withOrganizationContext(organizationId, async () => {
      const original = await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.IN,
        amount: 500,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.REVERSAL,
        amount: 500,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
        reversesPaymentId: original.paymentId,
      });

      const held = await reader.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(held).toEqual({ amount: 0, currency: CURRENCY_CODE.BDT });
    });
  });

  it("Held advance: a payment after completion is not counted", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const requestId = "booking-after-revenue";
    await withOrganizationContext(organizationId, async () => {
      // Payment made after revenue earned
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.IN,
        amount: 1000,
        requestId,
        revenueState: REVENUE_STATE.AFTER_REVENUE,
      });

      const held = await reader.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(held).toEqual({ amount: 0, currency: CURRENCY_CODE.BDT });
    });
  });

  it("Cross-org: the advance reader never sums another organization's payments", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationIdA = asId<OrganizationId>(world.organizationA);
    const organizationIdB = asId<OrganizationId>(world.organizationB);
    const requestId = "shared-request-id-123";

    await withOrganizationContext(organizationIdA, async () => {
      await insertPayment({
        organizationId: organizationIdA,
        direction: PAYMENT_DIRECTION.IN,
        amount: 500,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });
    });

    await withOrganizationContext(organizationIdB, async () => {
      await insertPayment({
        organizationId: organizationIdB,
        direction: PAYMENT_DIRECTION.IN,
        amount: 900,
        requestId,
        revenueState: REVENUE_STATE.BEFORE_REVENUE,
      });
    });

    await withOrganizationContext(organizationIdA, async () => {
      const heldA = await reader.readHeldAdvance({
        organizationId: organizationIdA,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(heldA.amount).toBe(500);
    });

    await withOrganizationContext(organizationIdB, async () => {
      const heldB = await reader.readHeldAdvance({
        organizationId: organizationIdB,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        currency: CURRENCY_CODE.BDT,
        requestId,
      });
      expect(heldB.amount).toBe(900);
    });
  });

  it("refuses an allocation in another currency instead of assuming one", async () => {
    const world = await worldFor(harness, RETAIL);
    const organizationId = asId<OrganizationId>(world.organizationA);
    const requestId = newId();
    await withOrganizationContext(organizationId, async () => {
      await insertPayment({
        organizationId,
        direction: PAYMENT_DIRECTION.IN,
        amount: 500,
        requestId,
        currency: "USD",
      });
      await expect(
        reader.readHeldAdvance({
          organizationId,
          requestType: PAYMENT_REQUEST_TYPE.BOOKING,
          requestId,
          currency: CURRENCY_CODE.BDT,
        }),
      ).rejects.toMatchObject({ code: "INTERNAL" });
    });
  });
});
