import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  COLLECTION_CLAIM_STATE,
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_STATUS,
} from "@banijjik/contracts/payment";
import { FULFILLMENT_METHOD, ORDER_STATUS } from "@banijjik/contracts/sales";
import {
  asId,
  newId,
  type CollectionClaimId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  draftOrder as baseDraftOrder,
  getOrder,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { buildAuditRecorder } from "../../../core/audit/index.js";
import { buildIndustryTemplateReader } from "../../../platform/industry/index.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import { buildSalesTenantPorts } from "../../../../routes/sales-tenant-router.js";
import { buildSalesDependencies, ShipOrderUseCase } from "../../sales/index.js";
import {
  ClaimCollectionsUseCase,
  CollectCodUseCase,
  CollectionClaim,
  MongoCollectionClaimRepository,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  ReleaseCollectionsUseCase,
} from "../index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const ITEM_PRICE = 4_500;
const PACK_GRAMS = 1_000;

const DHAKA_ADDRESS = {
  recipientName: "Kamal Uddin",
  phoneE164: "01712345678",
  addressLine: "Road 10, Dhanmondi",
  districtCode: "dhaka",
  areaCode: "dhanmondi",
  postalCode: "1209",
} as const;

let harness: IamApiHarness;
let world: Awaited<ReturnType<typeof worldFor>>;
let shop: SalesShop;

beforeAll(async () => {
  harness = await startCatalogApi();
  world = await worldFor(harness, RETAIL);
  shop = shopOf(world);
});

afterAll(async () => {
  await harness.dispose();
});

async function ensureZone(salesShop: SalesShop): Promise<void> {
  await salesShop.actor.callWith({
    method: "post",
    path: `/orgs/${salesShop.organizationId}/sales/delivery-zones`,
    idempotencyKey: newId(),
    body: {
      zoneKey: `zone-${newId().slice(-8)}`,
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: [DHAKA_ADDRESS.areaCode],
      feeMinor: 0,
      status: "ACTIVE",
    },
  });
}

async function createDeliverableOrder(salesShop: SalesShop) {
  await ensureZone(salesShop);
  const randomPhone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const contactId = await addCustomer(salesShop, "Kamal", randomPhone);
  const itemId = await addInventoryItem(salesShop, `COD Item ${newId().slice(-6)}`);
  const offering = await publishOffering(salesShop, {
    kind: "PRODUCT",
    name: `COD Offering ${newId().slice(-6)}`,
    priceAmount: ITEM_PRICE,
    stockComponents: [{ inventoryItemId: itemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(salesShop, [
    { inventoryItemId: itemId, quantity: 10 * PACK_GRAMS, unitCostAmount: 20 },
  ]);

  const draft = await baseDraftOrder(salesShop, {
    locationId: salesShop.locationId,
    contactId,
    lines: [{ offeringId: offering.offeringId, variantId: offering.variantId, quantity: 1 }],
    fulfillmentMethod: FULFILLMENT_METHOD.COURIER,
    deliveryAddress: DHAKA_ADDRESS,
  });
  const placed = await placeOrder(salesShop, { orderId: draft.orderId, version: draft.version });
  const confirmed = await confirmOrder(salesShop, {
    orderId: draft.orderId,
    version: placed.order.version,
  });

  await runInOrganizationContext(salesShop.organizationId, async () => {
    const registry = buildModuleRegistry();
    const orgConfig = buildOrgConfigService({
      registry,
      clock: harness.clock,
      ...buildResolvedConfigSources(registry),
      ...buildOrganizationConfigPorts(),
      templates: buildIndustryTemplateReader(harness.clock),
    });
    const ports = buildSalesTenantPorts({
      clock: harness.clock,
      audit: buildAuditRecorder(harness.clock),
      permission: () => (_req, _res, next) => next(),
      permissions: { locationsWith: async () => "ALL" },
      idempotency: (_req, _res, next) => next(),
      orgConfig,
      manifests: registry.all(),
    });
    const useCase = new ShipOrderUseCase(buildSalesDependencies(ports));
    await useCase.execute({
      organizationId: asId<OrganizationId>(salesShop.organizationId),
      allowedLocationIds: "ALL",
      orderId: asId<OrderId>(confirmed.orderId),
      actorUserId: asId<UserId>(world.alice.userId),
      body: {
        version: confirmed.version,
        dispatch: {
          method: "COURIER",
          consignmentId: `csg-${newId().slice(-8)}`,
        },
      },
    });
  });

  return getOrder(salesShop, draft.orderId);
}

async function getApprovalToken(
  w: typeof world,
  input: {
    action: string;
    subjectKey: string;
    amount: { amount: number; currency: string };
    locationId: string;
  },
): Promise<string> {
  await w.alice.call("put", `/orgs/${w.organizationA}/me/approval-pin`, {
    currentPassword: w.alice.person.password,
    pin: "1234",
  });
  const approvers = await w.alice.call(
    "get",
    `/orgs/${w.organizationA}/approvers?locationId=${input.locationId}`,
  );
  const approverMemberId = approvers.body.data[0]?.memberId;
  const granted = await w.alice.call("post", `/orgs/${w.organizationA}/approvals`, {
    action: input.action,
    subjectKey: input.subjectKey,
    amount: input.amount,
    locationId: input.locationId,
    approverMemberId,
    pin: "1234",
  });
  expect(granted.status).toBe(200);
  return granted.body.data.approvalToken as string;
}

describe("4.3 COD P: Payment COD Collection & Claim Guarding", () => {
  it("collects COD payment and generates an OPEN collection claim upon delivery", async () => {
    const shipped = await createDeliverableOrder(shop);

    const deliverRes = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${shipped.orderId}/deliver`),
      idempotencyKey: newId(),
      body: { version: shipped.version },
    });

    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe(ORDER_STATUS.DELIVERED);

    await withOrganizationContext(shop.organizationId, async () => {
      const summaries = new MongoPaymentSummaryRepository();
      const summary = await summaries.findByRequest(
        asId<OrganizationId>(shop.organizationId),
        PAYMENT_REQUEST_TYPE.ORDER,
        shipped.orderId,
      );
      expect(summary).toBeDefined();
      expect(summary?.paymentStatus).toBe(PAYMENT_STATUS.PAID);
      expect(summary?.allocated.amount).toBe(ITEM_PRICE);

      const claims = new MongoCollectionClaimRepository();
      const [claim] = await claims.findByOrderId(
        asId<OrganizationId>(shop.organizationId),
        asId<OrderId>(shipped.orderId),
      );
      expect(claim).toBeDefined();
      expect(claim?.state).toBe(COLLECTION_CLAIM_STATE.OPEN);
      expect(claim?.carrier.method).toBe(PAYMENT_METHOD.COD_COURIER);
      if (!claim) throw new Error("missing claim");

      const payments = new MongoPaymentRepository();
      const payment = await payments.findById(
        asId<OrganizationId>(shop.organizationId),
        claim.paymentId,
      );
      expect(payment).toBeDefined();
      expect(payment?.method).toBe(PAYMENT_METHOD.COD_COURIER);
      expect(payment?.amount.amount).toBe(ITEM_PRICE);
      expect(payment?.direction).toBe(PAYMENT_DIRECTION.IN);
    });
  });

  it("returns null payment when order is already prepaid and skips claim creation", async () => {
    await withOrganizationContext(shop.organizationId, async () => {
      const collectCod = new CollectCodUseCase({
        payments: new MongoPaymentRepository(),
        summaries: new MongoPaymentSummaryRepository(),
        collectionClaims: new MongoCollectionClaimRepository(),
        events: { publish: async () => {} },
        audit: { record: async () => {} },
        timeZone: { read: async () => "Asia/Dhaka" },
      });

      const organizationId = asId<OrganizationId>(shop.organizationId);
      const locId = asId<LocationId>(shop.locationId);
      const orderId = asId<OrderId>(newId());

      const summaries = new MongoPaymentSummaryRepository();
      await summaries.ensureSummary({
        organizationId,
        locationId: locId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        requestId: orderId,
        contactId: null,
        total: { amount: 2000, currency: "BDT" },
        now: new Date(),
      });
      await summaries.applyAllocation({
        organizationId,
        locationId: locId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        requestId: orderId,
        contactId: null,
        total: { amount: 2000, currency: "BDT" },
        amount: 2000,
        currency: "BDT",
        now: new Date(),
      });

      const result = await collectCod.execute({
        organizationId,
        orderId,
        locationId: locId,
        contactId: null,
        expectedOrderVersion: 1,
        deliveryCompletionId: orderId,
        carrier: { method: "COD_COURIER", consignmentId: "csg-123" },
        actorUserId: asId<UserId>(world.alice.userId),
        now: new Date(),
      });

      expect(result.paymentId).toBeNull();

      const claims = new MongoCollectionClaimRepository();
      const [claim] = await claims.findByOrderId(organizationId, orderId);
      expect(claim).toBeUndefined();
    });
  });

  it("handles idempotent replay of collectCod without creating duplicate payments or claims", async () => {
    const shipped = await createDeliverableOrder(shop);

    const deliverRes = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${shipped.orderId}/deliver`),
      idempotencyKey: newId(),
      body: { version: shipped.version },
    });
    expect(deliverRes.status).toBe(200);

    await withOrganizationContext(shop.organizationId, async () => {
      const claims = new MongoCollectionClaimRepository();
      const [claimFirst] = await claims.findByOrderId(
        asId<OrganizationId>(shop.organizationId),
        asId<OrderId>(shipped.orderId),
      );
      expect(claimFirst).toBeDefined();

      const collectCod = new CollectCodUseCase({
        payments: new MongoPaymentRepository(),
        summaries: new MongoPaymentSummaryRepository(),
        collectionClaims: claims,
        events: { publish: async () => {} },
        audit: { record: async () => {} },
        timeZone: { read: async () => "Asia/Dhaka" },
      });

      const replayResult = await collectCod.execute({
        organizationId: asId<OrganizationId>(shop.organizationId),
        orderId: asId<OrderId>(shipped.orderId),
        locationId: asId<LocationId>(shop.locationId),
        contactId: null,
        expectedOrderVersion: shipped.version + 1,
        deliveryCompletionId: shipped.orderId,
        carrier: { method: "COD_COURIER", consignmentId: "csg-repeat" },
        actorUserId: asId<UserId>(world.alice.userId),
        now: new Date(),
      });

      expect(replayResult.paymentId).toBe(claimFirst?.paymentId ?? null);
    });
  });

  it("locks payment IDs on claim and releases them on reversal with generation increment", async () => {
    await withOrganizationContext(shop.organizationId, async () => {
      const claims = new MongoCollectionClaimRepository();
      const claimCollections = new ClaimCollectionsUseCase(claims);
      const releaseCollections = new ReleaseCollectionsUseCase(claims);

      const organizationId = asId<OrganizationId>(shop.organizationId);
      const paymentId = asId<PaymentId>(newId());
      const orderId = asId<OrderId>(newId());

      const claimEntity = CollectionClaim.create({
        collectionClaimId: asId<CollectionClaimId>(newId()),
        organizationId,
        paymentId,
        orderId,
        carrier: { method: PAYMENT_METHOD.COD_COURIER, carrierReference: "csg-lock-test" },
        state: COLLECTION_CLAIM_STATE.OPEN,
        generation: 1,
        claimedByReference: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByUserId: asId<UserId>(world.alice.userId),
        updatedByUserId: null,
      });
      await claims.save(claimEntity);

      const settlementRef = `stl-${newId().slice(-8)}`;
      await claimCollections.execute({
        organizationId,
        paymentIds: [paymentId],
        carrierMethod: PAYMENT_METHOD.COD_COURIER,
        referenceId: settlementRef,
        actorUserId: asId<UserId>(world.alice.userId),
        now: new Date(),
      });

      const claimed = await claims.findByPaymentId(organizationId, paymentId);
      expect(claimed?.state).toBe(COLLECTION_CLAIM_STATE.CLAIMED);
      expect(claimed?.claimedByReference).toBe(settlementRef);
      expect(claimed?.generation).toBe(1);

      await expect(
        claimCollections.execute({
          organizationId,
          paymentIds: [paymentId],
          carrierMethod: PAYMENT_METHOD.COD_COURIER,
          referenceId: "stl-another",
          actorUserId: asId<UserId>(world.alice.userId),
          now: new Date(),
        }),
      ).rejects.toThrow();

      await releaseCollections.execute({
        organizationId,
        paymentIds: [paymentId],
        carrierMethod: PAYMENT_METHOD.COD_COURIER,
        referenceId: settlementRef,
        actorUserId: asId<UserId>(world.alice.userId),
        now: new Date(),
      });

      const released = await claims.findByPaymentId(organizationId, paymentId);
      expect(released?.state).toBe(COLLECTION_CLAIM_STATE.OPEN);
      expect(released?.claimedByReference).toBeNull();
      expect(released?.generation).toBe(2);
    });
  });

  it("fences payment reversal endpoint against claimed collections and marks claim REVERSED on open reversal", async () => {
    const shipped = await createDeliverableOrder(shop);
    await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${shipped.orderId}/deliver`),
      idempotencyKey: newId(),
      body: { version: shipped.version },
    });

    let claimPaymentId: PaymentId | undefined;
    await withOrganizationContext(shop.organizationId, async () => {
      const claims = new MongoCollectionClaimRepository();
      const [claim] = await claims.findByOrderId(
        asId<OrganizationId>(shop.organizationId),
        asId<OrderId>(shipped.orderId),
      );
      expect(claim).toBeDefined();
      if (!claim) throw new Error("missing claim");
      claimPaymentId = claim.paymentId;

      const claimCollections = new ClaimCollectionsUseCase(claims);
      await claimCollections.execute({
        organizationId: asId<OrganizationId>(shop.organizationId),
        paymentIds: [claimPaymentId],
        carrierMethod: PAYMENT_METHOD.COD_COURIER,
        referenceId: "stl-lock-1",
        actorUserId: asId<UserId>(world.alice.userId),
        now: new Date(),
      });
    });

    if (!claimPaymentId) throw new Error("missing payment id");
    const targetPaymentId: PaymentId = claimPaymentId;

    const token = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: targetPaymentId,
      amount: { amount: ITEM_PRICE, currency: "BDT" },
      locationId: shop.locationId,
    });

    const blockedReversal = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${targetPaymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: token },
    });
    expect(blockedReversal.status).toBe(409);
    expect(blockedReversal.body.error.code).toBe(ERROR_CODE.CONFLICT);

    await withOrganizationContext(shop.organizationId, async () => {
      const claims = new MongoCollectionClaimRepository();
      const releaseCollections = new ReleaseCollectionsUseCase(claims);
      await releaseCollections.execute({
        organizationId: asId<OrganizationId>(shop.organizationId),
        paymentIds: [targetPaymentId],
        carrierMethod: PAYMENT_METHOD.COD_COURIER,
        referenceId: "stl-lock-1",
        actorUserId: asId<UserId>(world.alice.userId),
        now: new Date(),
      });
    });

    const token2 = await getApprovalToken(world, {
      action: APPROVAL_ACTION.PAYMENT_REVERSAL,
      subjectKey: targetPaymentId,
      amount: { amount: ITEM_PRICE, currency: "BDT" },
      locationId: shop.locationId,
    });

    const successfulReversal = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/payments/${targetPaymentId}/reverse`,
      idempotencyKey: newId(),
      body: { approvalToken: token2 },
    });
    expect(successfulReversal.status).toBe(201);

    await withOrganizationContext(shop.organizationId, async () => {
      const claims = new MongoCollectionClaimRepository();
      const claimAfterReversal = await claims.findByPaymentId(
        asId<OrganizationId>(shop.organizationId),
        targetPaymentId,
      );
      expect(claimAfterReversal?.state).toBe(COLLECTION_CLAIM_STATE.REVERSED);
    });
  });
});
