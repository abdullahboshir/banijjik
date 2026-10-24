import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import { INVENTORY_EVENT_TYPE, type StockReceiptPaidVia } from "@banijjik/contracts/inventory";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { stockReceiptRequestSchema } from "@banijjik/validation/inventory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, withTransaction } from "../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../kernel/db/index.js";
import { registerSequenceModel } from "../../../kernel/sequence/index.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../test-support/test-databases.js";
import { buildPostStockHandler } from "./application/handlers/post-stock.handler.js";
import type { StockPostingSource } from "./application/ports/stock-posting-source.js";
import type { PostJournalDependencies } from "./application/post-journal.js";
import { seedSystemAccounts } from "./application/seed-system-accounts.js";
import { GetTrialBalanceUseCase } from "./application/use-cases/get-trial-balance.use-case.js";
import type { StockPostingSnapshot } from "./domain/stock-posting-rules.js";
import { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
import { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";
import { registerAccountingModels } from "./infrastructure/register-accounting-models.js";

registerAccountingModels();
registerSequenceModel();

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
  readonly stocks: Map<string, StockPostingSnapshot>;
  readonly handler: ReturnType<typeof buildPostStockHandler>;
  readonly accounts: MongoAccountRepository;
  readonly journals: MongoJournalRepository;
  readonly trialBalance: GetTrialBalanceUseCase;
}

async function newScene(seedAccounts = true): Promise<Scene> {
  const organizationId = asId<OrganizationId>(newId());
  const stocks = new Map<string, StockPostingSnapshot>();
  const stockSource: StockPostingSource = {
    readStockSource: async (source) => stocks.get(`${source.sourceType}:${source.sourceId}`),
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
  if (seedAccounts) {
    await withOrganizationContext(organizationId, () =>
      seedSystemAccounts(
        { accounts, clock: { now: () => NOW } },
        { organizationId, actorUserId: null },
      ),
    );
  }
  const trialBalance = new GetTrialBalanceUseCase(accounts, journals, {
    read: async () => "BDT",
  });
  return {
    organizationId,
    locationId: newId(),
    stocks,
    handler: buildPostStockHandler({ stocks: stockSource, posting }),
    accounts,
    journals,
    trialBalance,
  };
}

function envelopeOf(scene: Scene, sourceType: string, sourceId: string) {
  return {
    eventId: newId(),
    type: INVENTORY_EVENT_TYPE.STOCK_SOURCE_RECORDED,
    version: 1,
    occurredAt: NOW.toISOString(),
    organizationId: scene.organizationId,
    actorUserId: null,
    payload: { sourceType, sourceId },
  } as const;
}

function handleEvent(scene: Scene, sourceType: string, sourceId: string) {
  return withOrganizationContext(scene.organizationId, () =>
    withTransaction(() => scene.handler.handle(envelopeOf(scene, sourceType, sourceId))),
  );
}

describe("accounting postStock handler", () => {
  it("Receipts: CASH, BKASH, NAGAD, BANK and ON_CREDIT each credit the right account; missing paidVia -> 400", async () => {
    const scene = await newScene();

    const methods: readonly [StockReceiptPaidVia, string][] = [
      ["CASH", SYSTEM_ACCOUNT_CODE.CASH],
      ["BKASH", SYSTEM_ACCOUNT_CODE.BKASH],
      ["NAGAD", SYSTEM_ACCOUNT_CODE.NAGAD],
      ["BANK", SYSTEM_ACCOUNT_CODE.BANK],
      ["ON_CREDIT", SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE],
    ];

    for (const [paidVia, expectedAccount] of methods) {
      const sourceId = newId();
      scene.stocks.set(`STOCK_RECEIPT:${sourceId}`, {
        organizationId: scene.organizationId,
        sourceType: "STOCK_RECEIPT",
        sourceId,
        businessDate: BUSINESS_DATE,
        locationId: scene.locationId,
        currency: "BDT",
        movements: [
          {
            stockMovementId: newId(),
            inventoryItemId: newId(),
            quantityDelta: 10,
            stockState: "SELLABLE",
            reason: "PURCHASE",
            paidVia,
            value: bdt(500),
          },
        ],
      });

      await handleEvent(scene, "STOCK_RECEIPT", sourceId);

      const entry = await withOrganizationContext(scene.organizationId, () =>
        scene.journals.findBySource({
          sourceType: JOURNAL_SOURCE_TYPE.STOCK,
          sourceId,
          postingKey: POSTING_KEY.stock_receipt,
        }),
      );
      expect(entry).toBeDefined();
      expect(entry?.lines).toEqual([
        expect.objectContaining({
          accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY,
          debit: bdt(500),
          credit: bdt(0),
        }),
        expect.objectContaining({
          accountCode: expectedAccount,
          debit: bdt(0),
          credit: bdt(500),
        }),
      ]);
    }

    // Validation schema test: missing paidVia -> validation error (400)
    const invalidReceipt = {
      locationId: newId(),
      lines: [
        { inventoryItemId: newId(), quantity: 1, unitCost: { amount: 100, currency: "BDT" } },
      ],
    };
    const parsed = stockReceiptRequestSchema.safeParse(invalidReceipt);
    expect(parsed.success).toBe(false);
  });

  it("an old organization without ACCOUNTS_PAYABLE gets it on first use", async () => {
    // Simulate an old organization by seeding accounts, then removing ACCOUNTS_PAYABLE
    const scene = await newScene();
    const accounts = scene.accounts;

    // Check existing ACCOUNTS_PAYABLE and delete it to simulate pre-3.24 org
    const existing = await withOrganizationContext(scene.organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE),
    );
    expect(existing).toBeDefined();

    const { getActiveSession, models, sessionOption } = await import("../../../kernel/db/index.js");
    const { ACCOUNT_MODEL_NAME } = await import("./infrastructure/account.schema.js");
    await withOrganizationContext(scene.organizationId, async () => {
      const session = getActiveSession();
      const Model = models({ organizationId: scene.organizationId }).get(ACCOUNT_MODEL_NAME);
      await Model.deleteOne(
        { accountCode: SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE },
        sessionOption(session),
      );
    });

    const deleted = await withOrganizationContext(scene.organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE),
    );
    expect(deleted).toBeUndefined();

    // Now receive on credit -> postStock handler should call ensureSystemAccount and post cleanly
    const sourceId = newId();
    scene.stocks.set(`STOCK_RECEIPT:${sourceId}`, {
      organizationId: scene.organizationId,
      sourceType: "STOCK_RECEIPT",
      sourceId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      currency: "BDT",
      movements: [
        {
          stockMovementId: newId(),
          inventoryItemId: newId(),
          quantityDelta: 20,
          stockState: "SELLABLE",
          reason: "PURCHASE",
          paidVia: "ON_CREDIT",
          value: bdt(1000),
        },
      ],
    });

    await handleEvent(scene, "STOCK_RECEIPT", sourceId);

    // ACCOUNTS_PAYABLE now exists
    const restored = await withOrganizationContext(scene.organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE),
    );
    expect(restored).toBeDefined();
    expect(restored?.accountCode).toBe(SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE);

    // Journal entry posted with ACCOUNTS_PAYABLE credit
    const entry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.STOCK,
        sourceId,
        postingKey: POSTING_KEY.stock_receipt,
      }),
    );
    expect(entry).toBeDefined();
    expect(entry?.lines[1]?.accountCode).toBe(SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE);
  });

  it("Opening stock, an adjustment up, an adjustment down and a damage write-off (sellable and damaged) post the rows of decision 7", async () => {
    const scene = await newScene();

    // 1. Opening stock: Dr INVENTORY / Cr OPENING_BALANCE
    const openingSourceId = newId();
    scene.stocks.set(`STOCK_OPENING:${openingSourceId}`, {
      organizationId: scene.organizationId,
      sourceType: "STOCK_OPENING",
      sourceId: openingSourceId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      currency: "BDT",
      movements: [
        {
          stockMovementId: newId(),
          inventoryItemId: newId(),
          quantityDelta: 50,
          stockState: "SELLABLE",
          reason: "OPENING",
          value: bdt(2500),
        },
      ],
    });

    await handleEvent(scene, "STOCK_OPENING", openingSourceId);

    const openingEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.STOCK,
        sourceId: openingSourceId,
        postingKey: POSTING_KEY.stock_opening,
      }),
    );
    expect(openingEntry?.lines).toEqual([
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY,
        debit: bdt(2500),
        credit: bdt(0),
      }),
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.OPENING_BALANCE,
        debit: bdt(0),
        credit: bdt(2500),
      }),
    ]);

    // 2. Adjustment up and adjustment down
    const adjSourceId = newId();
    scene.stocks.set(`STOCK_ADJUSTMENT:${adjSourceId}`, {
      organizationId: scene.organizationId,
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: adjSourceId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      currency: "BDT",
      movements: [
        {
          stockMovementId: newId(),
          inventoryItemId: newId(),
          quantityDelta: 5,
          stockState: "SELLABLE",
          reason: "ADJUSTMENT",
          value: bdt(250),
        },
        {
          stockMovementId: newId(),
          inventoryItemId: newId(),
          quantityDelta: -2,
          stockState: "SELLABLE",
          reason: "ADJUSTMENT",
          value: bdt(100),
        },
      ],
    });

    await handleEvent(scene, "STOCK_ADJUSTMENT", adjSourceId);

    const adjEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.STOCK,
        sourceId: adjSourceId,
        postingKey: POSTING_KEY.stock_adjustment,
      }),
    );
    expect(adjEntry?.lines).toHaveLength(4);
    expect(adjEntry?.lines).toEqual([
      expect.objectContaining({ accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY, debit: bdt(250) }),
      expect.objectContaining({ accountCode: SYSTEM_ACCOUNT_CODE.OTHER_INCOME, credit: bdt(250) }),
      expect.objectContaining({ accountCode: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS, debit: bdt(100) }),
      expect.objectContaining({ accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY, credit: bdt(100) }),
    ]);

    // 3. Damage write-off: sellable vs damaged stockState
    const writeOffSourceId = newId();
    scene.stocks.set(`STOCK_ADJUSTMENT:${writeOffSourceId}`, {
      organizationId: scene.organizationId,
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: writeOffSourceId,
      businessDate: BUSINESS_DATE,
      locationId: scene.locationId,
      currency: "BDT",
      movements: [
        {
          stockMovementId: newId(),
          inventoryItemId: newId(),
          quantityDelta: -1,
          stockState: "DAMAGED",
          reason: "DAMAGE_WRITE_OFF",
          value: bdt(60),
        },
        {
          stockMovementId: newId(),
          inventoryItemId: newId(),
          quantityDelta: -1,
          stockState: "SELLABLE",
          reason: "DAMAGE_WRITE_OFF",
          value: bdt(40),
        },
      ],
    });

    await handleEvent(scene, "STOCK_ADJUSTMENT", writeOffSourceId);

    const writeOffEntry = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.STOCK,
        sourceId: writeOffSourceId,
        postingKey: POSTING_KEY.stock_write_off,
      }),
    );
    expect(writeOffEntry?.lines).toEqual([
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS,
        debit: bdt(60),
        credit: bdt(0),
      }),
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY_DAMAGED,
        debit: bdt(0),
        credit: bdt(60),
      }),
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.DAMAGE_LOSS,
        debit: bdt(40),
        credit: bdt(0),
      }),
      expect.objectContaining({
        accountCode: SYSTEM_ACCOUNT_CODE.INVENTORY,
        debit: bdt(0),
        credit: bdt(40),
      }),
    ]);

    // Check trial balance balances
    const tb = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(tb.balances).toBe(true);
  });
});
