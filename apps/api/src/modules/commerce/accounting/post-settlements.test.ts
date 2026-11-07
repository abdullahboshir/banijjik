import {
  COURIER_EVENT_TYPE,
  DELIVERY_EVENT_TYPE,
} from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, models, withTransaction } from "../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../kernel/db/index.js";
import { registerEventModels } from "../../../kernel/events/register-event-models.js";
import { registerSequenceModel } from "../../../kernel/sequence/index.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../test-support/test-databases.js";
import { buildPostCourierSettlementsHandler } from "./application/handlers/post-courier-settlements.handler.js";
import { buildPostRiderHandoversHandler } from "./application/handlers/post-rider-handovers.handler.js";
import type { CourierSettlementPostingSource } from "./application/ports/courier-settlement-posting-source.js";
import type { RiderHandoverPostingSource } from "./application/ports/rider-handover-posting-source.js";
import type { PostJournalDependencies } from "./application/post-journal.js";
import { postJournalEntry } from "./application/post-journal.js";
import { seedSystemAccounts } from "./application/seed-system-accounts.js";
import { GetTrialBalanceUseCase } from "./application/use-cases/get-trial-balance.use-case.js";
import { debit, credit } from "./domain/journal-lines.js";
import type {
  CourierSettlementPostingSnapshot,
  RiderHandoverPostingSnapshot,
} from "./domain/settlement-posting-rules.js";
import { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
import { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";
import { registerAccountingModels } from "./infrastructure/register-accounting-models.js";

registerAccountingModels();
registerSequenceModel();
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

const NOW = new Date("2026-10-24T10:00:00Z");
const BUSINESS_DATE = "2026-10-24";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

interface Scene {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly courierSettlements: Map<string, CourierSettlementPostingSnapshot>;
  readonly riderHandovers: Map<string, RiderHandoverPostingSnapshot>;
  readonly courierHandler: ReturnType<typeof buildPostCourierSettlementsHandler>;
  readonly riderHandler: ReturnType<typeof buildPostRiderHandoversHandler>;
  readonly accounts: MongoAccountRepository;
  readonly journals: MongoJournalRepository;
  readonly trialBalance: GetTrialBalanceUseCase;
  readonly posting: PostJournalDependencies;
}

async function newScene(): Promise<Scene> {
  const organizationId = asId<OrganizationId>(newId());
  const locationId = newId();
  const courierSettlements = new Map<string, CourierSettlementPostingSnapshot>();
  const riderHandovers = new Map<string, RiderHandoverPostingSnapshot>();

  const courierSource: CourierSettlementPostingSource = {
    readCourierSettlement: async (id) => courierSettlements.get(id),
  };
  const riderSource: RiderHandoverPostingSource = {
    readRiderHandover: async (id) => riderHandovers.get(id),
  };

  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  const posting: PostJournalDependencies = {
    accounts,
    journals,
    events: { publish: async () => undefined },
    audit: { record: async () => undefined },
    clock: { now: () => NOW },
  };

  await withOrganizationContext(organizationId, () =>
    seedSystemAccounts(
      { accounts, clock: { now: () => NOW } },
      { organizationId, actorUserId: null },
    ),
  );

  const trialBalance = new GetTrialBalanceUseCase(accounts, journals, {
    read: async () => "BDT",
  });

  return {
    organizationId,
    locationId,
    courierSettlements,
    riderHandovers,
    courierHandler: buildPostCourierSettlementsHandler({
      courierSettlements: courierSource,
      posting,
    }),
    riderHandler: buildPostRiderHandoversHandler({
      riderHandovers: riderSource,
      posting,
    }),
    accounts,
    journals,
    trialBalance,
    posting,
  };
}

describe("4.3 COD J2: Accounting Settlement & Handover Reconciliation", () => {
  it("declares ORDERED streams with correct stream prefixes and event types", () => {
    const courierHandler = buildPostCourierSettlementsHandler({
      courierSettlements: { readCourierSettlement: async () => undefined },
      posting: {} as any,
    });
    expect(courierHandler.handlerKey).toBe("accounting.postCourierSettlements");
    expect(courierHandler.ordering).toBe("ORDERED");
    expect(courierHandler.streamPrefixes).toEqual(["courierSettlement:"]);
    expect(courierHandler.eventType).toBe(COURIER_EVENT_TYPE.SETTLEMENT_RECORDED);
    expect(courierHandler.alsoHandles).toEqual([COURIER_EVENT_TYPE.SETTLEMENT_REVERSED]);

    const riderHandler = buildPostRiderHandoversHandler({
      riderHandovers: { readRiderHandover: async () => undefined },
      posting: {} as any,
    });
    expect(riderHandler.handlerKey).toBe("accounting.postRiderHandovers");
    expect(riderHandler.ordering).toBe("ORDERED");
    expect(riderHandler.streamPrefixes).toEqual(["riderHandover:"]);
    expect(riderHandler.eventType).toBe(DELIVERY_EVENT_TYPE.HANDOVER_RECORDED);
    expect(riderHandler.alsoHandles).toEqual([DELIVERY_EVENT_TYPE.HANDOVER_REVERSED]);
  });

  it("posts courier settlement journal and clears courier receivable", async () => {
    const scene = await newScene();
    const paymentId = newId();
    const settlementId = newId();

    // 1. Seed prerequisite payment journal: Dr COURIER_RECEIVABLE / Cr ACCOUNTS_RECEIVABLE
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        postJournalEntry(scene.posting, {
          organizationId: scene.organizationId,
          actorUserId: null,
          draft: {
            businessDate: BUSINESS_DATE,
            locationId: scene.locationId,
            sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
            sourceId: paymentId,
            postingKey: POSTING_KEY.payment_in_after_revenue,
            lines: [
              debit(SYSTEM_ACCOUNT_CODE.COURIER_RECEIVABLE, bdt(1500)),
              credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, bdt(1500)),
            ],
          },
        }),
      ),
    );

    // 2. Setup courier settlement snapshot: gross 1500, charge 100, net 1400 via BANK
    scene.courierSettlements.set(settlementId, {
      courierSettlementId: settlementId,
      organizationId: scene.organizationId,
      businessDate: BUSINESS_DATE,
      locationId: null,
      paymentIds: [paymentId],
      grossAmount: bdt(1500),
      courierCharges: bdt(100),
      netReceived: bdt(1400),
      receivedVia: "BANK",
    });

    // 3. Dispatch settlement recorded event
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        scene.courierHandler.handle({
          eventId: newId(),
          type: COURIER_EVENT_TYPE.SETTLEMENT_RECORDED,
          version: 1,
          occurredAt: NOW.toISOString(),
          organizationId: scene.organizationId,
          actorUserId: null,
          payload: { courierSettlementId: settlementId },
        }),
      ),
    );

    // 4. Verify settlement journal exists
    const entry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.COURIER,
        sourceId: settlementId,
        postingKey: POSTING_KEY.courier_settlement,
      }),
    );
    expect(entry).toBeDefined();
    expect(entry?.lines).toHaveLength(3);

    // 5. Verify trial balance is balanced
    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);

    // 6. Verify COURIER_RECEIVABLE balance is zero
    const receivableRow = tb.accounts.find((a) => a.accountCode === SYSTEM_ACCOUNT_CODE.COURIER_RECEIVABLE);
    expect(receivableRow).toBeDefined();
    expect(receivableRow?.debitTotal.amount).toBe(1500);
    expect(receivableRow?.creditTotal.amount).toBe(1500);
    expect(receivableRow?.balance.amount).toBe(0);
  });

  it("reverses courier settlement journal upon settlement reversal", async () => {
    const scene = await newScene();
    const paymentId = newId();
    const originalSettlementId = newId();
    const reversalSettlementId = newId();

    // Prerequisite payment journal
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        postJournalEntry(scene.posting, {
          organizationId: scene.organizationId,
          actorUserId: null,
          draft: {
            businessDate: BUSINESS_DATE,
            locationId: scene.locationId,
            sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
            sourceId: paymentId,
            postingKey: POSTING_KEY.payment_in_after_revenue,
            lines: [
              debit(SYSTEM_ACCOUNT_CODE.COURIER_RECEIVABLE, bdt(1000)),
              credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, bdt(1000)),
            ],
          },
        }),
      ),
    );

    // Settlement
    scene.courierSettlements.set(originalSettlementId, {
      courierSettlementId: originalSettlementId,
      organizationId: scene.organizationId,
      businessDate: BUSINESS_DATE,
      locationId: null,
      paymentIds: [paymentId],
      grossAmount: bdt(1000),
      courierCharges: bdt(0),
      netReceived: bdt(1000),
      receivedVia: "CASH",
    });

    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        scene.courierHandler.handle({
          eventId: newId(),
          type: COURIER_EVENT_TYPE.SETTLEMENT_RECORDED,
          version: 1,
          occurredAt: NOW.toISOString(),
          organizationId: scene.organizationId,
          actorUserId: null,
          payload: { courierSettlementId: originalSettlementId },
        }),
      ),
    );

    // Setup reversal snapshot
    scene.courierSettlements.set(reversalSettlementId, {
      courierSettlementId: reversalSettlementId,
      organizationId: scene.organizationId,
      businessDate: BUSINESS_DATE,
      locationId: null,
      paymentIds: [paymentId],
      grossAmount: bdt(1000),
      courierCharges: bdt(0),
      netReceived: bdt(1000),
      receivedVia: "CASH",
      reversesCourierSettlementId: originalSettlementId,
    });

    // Reversal event
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        scene.courierHandler.handle({
          eventId: newId(),
          type: COURIER_EVENT_TYPE.SETTLEMENT_REVERSED,
          version: 1,
          occurredAt: NOW.toISOString(),
          organizationId: scene.organizationId,
          actorUserId: null,
          payload: {
            courierSettlementId: reversalSettlementId,
            reversesCourierSettlementId: originalSettlementId,
          },
        }),
      ),
    );

    const revEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.COURIER,
        sourceId: originalSettlementId,
        postingKey: POSTING_KEY.reversal_courier_settlement,
      }),
    );
    expect(revEntry).toBeDefined();

    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);
  });

  it("refuses courier settlement when prerequisite payment journal is missing", async () => {
    const scene = await newScene();
    const unpostedPaymentId = newId();
    const settlementId = newId();

    scene.courierSettlements.set(settlementId, {
      courierSettlementId: settlementId,
      organizationId: scene.organizationId,
      businessDate: BUSINESS_DATE,
      locationId: null,
      paymentIds: [unpostedPaymentId],
      grossAmount: bdt(500),
      courierCharges: bdt(50),
      netReceived: bdt(450),
      receivedVia: "BANK",
    });

    await expect(
      withOrganizationContext(scene.organizationId, () =>
        withTransaction(() =>
          scene.courierHandler.handle({
            eventId: newId(),
            type: COURIER_EVENT_TYPE.SETTLEMENT_RECORDED,
            version: 1,
            occurredAt: NOW.toISOString(),
            organizationId: scene.organizationId,
            actorUserId: null,
            payload: { courierSettlementId: settlementId },
          }),
        ),
      ),
    ).rejects.toThrow(/posting_source_missing/);
  });

  it("posts rider cash handover journal and clears rider cash", async () => {
    const scene = await newScene();
    const paymentId = newId();
    const handoverId = newId();

    // 1. Seed prerequisite payment journal: Dr RIDER_CASH / Cr ACCOUNTS_RECEIVABLE
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        postJournalEntry(scene.posting, {
          organizationId: scene.organizationId,
          actorUserId: null,
          draft: {
            businessDate: BUSINESS_DATE,
            locationId: scene.locationId,
            sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
            sourceId: paymentId,
            postingKey: POSTING_KEY.payment_in_after_revenue,
            lines: [
              debit(SYSTEM_ACCOUNT_CODE.RIDER_CASH, bdt(800)),
              credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, bdt(800)),
            ],
          },
        }),
      ),
    );

    // 2. Setup rider handover snapshot: amount 800 via CASH
    scene.riderHandovers.set(handoverId, {
      riderCashHandoverId: handoverId,
      organizationId: scene.organizationId,
      locationId: scene.locationId,
      businessDate: BUSINESS_DATE,
      paymentIds: [paymentId],
      amount: bdt(800),
      receivedVia: "CASH",
    });

    // 3. Dispatch handover recorded event
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        scene.riderHandler.handle({
          eventId: newId(),
          type: DELIVERY_EVENT_TYPE.HANDOVER_RECORDED,
          version: 1,
          occurredAt: NOW.toISOString(),
          organizationId: scene.organizationId,
          actorUserId: null,
          payload: { riderCashHandoverId: handoverId },
        }),
      ),
    );

    // 4. Verify handover journal exists
    const entry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.DELIVERY,
        sourceId: handoverId,
        postingKey: POSTING_KEY.rider_handover,
      }),
    );
    expect(entry).toBeDefined();
    expect(entry?.lines).toHaveLength(2);

    // 5. Verify trial balance is balanced
    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);

    // 6. Verify RIDER_CASH balance is zero
    const riderRow = tb.accounts.find((a) => a.accountCode === SYSTEM_ACCOUNT_CODE.RIDER_CASH);
    expect(riderRow).toBeDefined();
    expect(riderRow?.debitTotal.amount).toBe(800);
    expect(riderRow?.creditTotal.amount).toBe(800);
    expect(riderRow?.balance.amount).toBe(0);
  });

  it("reverses rider cash handover journal upon handover reversal", async () => {
    const scene = await newScene();
    const paymentId = newId();
    const originalHandoverId = newId();
    const reversalHandoverId = newId();

    // Prerequisite payment journal
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        postJournalEntry(scene.posting, {
          organizationId: scene.organizationId,
          actorUserId: null,
          draft: {
            businessDate: BUSINESS_DATE,
            locationId: scene.locationId,
            sourceType: JOURNAL_SOURCE_TYPE.PAYMENT,
            sourceId: paymentId,
            postingKey: POSTING_KEY.payment_in_after_revenue,
            lines: [
              debit(SYSTEM_ACCOUNT_CODE.RIDER_CASH, bdt(600)),
              credit(SYSTEM_ACCOUNT_CODE.ACCOUNTS_RECEIVABLE, bdt(600)),
            ],
          },
        }),
      ),
    );

    // Handover
    scene.riderHandovers.set(originalHandoverId, {
      riderCashHandoverId: originalHandoverId,
      organizationId: scene.organizationId,
      locationId: scene.locationId,
      businessDate: BUSINESS_DATE,
      paymentIds: [paymentId],
      amount: bdt(600),
      receivedVia: "CASH",
    });

    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        scene.riderHandler.handle({
          eventId: newId(),
          type: DELIVERY_EVENT_TYPE.HANDOVER_RECORDED,
          version: 1,
          occurredAt: NOW.toISOString(),
          organizationId: scene.organizationId,
          actorUserId: null,
          payload: { riderCashHandoverId: originalHandoverId },
        }),
      ),
    );

    // Reversal snapshot
    scene.riderHandovers.set(reversalHandoverId, {
      riderCashHandoverId: reversalHandoverId,
      organizationId: scene.organizationId,
      locationId: scene.locationId,
      businessDate: BUSINESS_DATE,
      paymentIds: [paymentId],
      amount: bdt(600),
      receivedVia: "CASH",
      reversesRiderCashHandoverId: originalHandoverId,
    });

    // Reversal event
    await withOrganizationContext(scene.organizationId, () =>
      withTransaction(() =>
        scene.riderHandler.handle({
          eventId: newId(),
          type: DELIVERY_EVENT_TYPE.HANDOVER_REVERSED,
          version: 1,
          occurredAt: NOW.toISOString(),
          organizationId: scene.organizationId,
          actorUserId: null,
          payload: {
            riderCashHandoverId: reversalHandoverId,
            reversesRiderCashHandoverId: originalHandoverId,
          },
        }),
      ),
    );

    const revEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.DELIVERY,
        sourceId: originalHandoverId,
        postingKey: POSTING_KEY.reversal_rider_handover,
      }),
    );
    expect(revEntry).toBeDefined();

    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);
  });

  it("refuses rider handover when prerequisite payment journal is missing", async () => {
    const scene = await newScene();
    const unpostedPaymentId = newId();
    const handoverId = newId();

    scene.riderHandovers.set(handoverId, {
      riderCashHandoverId: handoverId,
      organizationId: scene.organizationId,
      locationId: scene.locationId,
      businessDate: BUSINESS_DATE,
      paymentIds: [unpostedPaymentId],
      amount: bdt(400),
      receivedVia: "CASH",
    });

    await expect(
      withOrganizationContext(scene.organizationId, () =>
        withTransaction(() =>
          scene.riderHandler.handle({
            eventId: newId(),
            type: DELIVERY_EVENT_TYPE.HANDOVER_RECORDED,
            version: 1,
            occurredAt: NOW.toISOString(),
            organizationId: scene.organizationId,
            actorUserId: null,
            payload: { riderCashHandoverId: handoverId },
          }),
        ),
      ),
    ).rejects.toThrow(/posting_source_missing/);
  });
});
