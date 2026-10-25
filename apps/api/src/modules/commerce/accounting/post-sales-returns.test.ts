import { EVENT_TYPE } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  reversalPostingKeyFor,
  type Money,
} from "@banijjik/contracts/accounting";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, withTransaction } from "../../../kernel/db/index.js";
import type { DatabaseConnections } from "../../../kernel/db/index.js";
import { registerEventModels } from "../../../kernel/events/register-event-models.js";
import { registerSequenceModel } from "../../../kernel/sequence/index.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../test-support/test-databases.js";
import { buildPostSalesReturnsHandler } from "./application/handlers/post-sales-returns.handler.js";
import type { SalesReturnPostingSource } from "./application/ports/sales-return-posting-source.js";
import type { PostJournalDependencies } from "./application/post-journal.js";
import { seedSystemAccounts } from "./application/seed-system-accounts.js";
import { GetTrialBalanceUseCase } from "./application/use-cases/get-trial-balance.use-case.js";
import type { SalesReturnPostingSnapshot } from "./domain/sales-return-posting-rules.js";
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

const NOW = new Date("2026-10-25T10:00:00Z");
const BUSINESS_DATE = "2026-10-25";
const REVERSAL_DATE = "2026-10-27";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

interface Scene {
  readonly organizationId: OrganizationId;
  readonly returns: Map<string, SalesReturnPostingSnapshot>;
  readonly handler: ReturnType<typeof buildPostSalesReturnsHandler>;
  readonly journals: MongoJournalRepository;
  readonly trialBalance: GetTrialBalanceUseCase;
}

async function newScene(): Promise<Scene> {
  const organizationId = asId<OrganizationId>(newId());
  const returns = new Map<string, SalesReturnPostingSnapshot>();
  const source: SalesReturnPostingSource = {
    readSalesReturn: async (salesReturnId) => returns.get(salesReturnId),
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
  const trialBalance = new GetTrialBalanceUseCase(accounts, journals, { read: async () => "BDT" });
  return {
    organizationId,
    returns,
    handler: buildPostSalesReturnsHandler({ salesReturns: source, posting }),
    journals,
    trialBalance,
  };
}

function snapshotOf(
  salesReturnId: string,
  overrides: Partial<SalesReturnPostingSnapshot>,
): SalesReturnPostingSnapshot {
  return {
    salesReturnId,
    businessDate: BUSINESS_DATE,
    reversalBusinessDate: null,
    locationId: newId(),
    lineValue: bdt(1000),
    lineTax: bdt(100),
    deliveryReturned: bdt(0),
    roundingReturned: bdt(0),
    cost: bdt(0),
    ...overrides,
  };
}

function handleEvent(
  scene: Scene,
  salesReturnId: string,
  orderId: string,
  type:
    | typeof EVENT_TYPE.SALES_RETURN_CREATED
    | typeof EVENT_TYPE.SALES_RETURN_REVERSED = EVENT_TYPE.SALES_RETURN_CREATED,
) {
  return withOrganizationContext(scene.organizationId, () =>
    withTransaction(() =>
      scene.handler.handle({
        eventId: newId(),
        type,
        version: 1,
        occurredAt: NOW.toISOString(),
        organizationId: scene.organizationId,
        actorUserId: null,
        payload: { salesReturnId, orderId },
      } as const),
    ),
  );
}

function findEntry(scene: Scene, salesReturnId: string, postingKey: string) {
  return withOrganizationContext(scene.organizationId, () =>
    scene.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.SALES_RETURN,
      sourceId: salesReturnId,
      postingKey: postingKey as (typeof POSTING_KEY)[keyof typeof POSTING_KEY],
    }),
  );
}

describe("accounting postSalesReturns handler", () => {
  it("the return posts sales returns, tax and receivable, and reverses the cost of goods for restocked and damaged lines", async () => {
    const scene = await newScene();
    const salesReturnId = newId();
    scene.returns.set(salesReturnId, snapshotOf(salesReturnId, { cost: bdt(400) }));

    await handleEvent(scene, salesReturnId, newId());

    const valueEntry = await findEntry(scene, salesReturnId, POSTING_KEY.sales_return_value);
    expect(valueEntry?.lines.map((line) => line.accountCode).sort()).toEqual(
      ["ACCOUNTS_RECEIVABLE", "SALES_RETURNS", "TAX_PAYABLE"].sort(),
    );
    const cogsEntry = await findEntry(scene, salesReturnId, POSTING_KEY.sales_return_cogs);
    expect(cogsEntry?.lines.map((line) => line.accountCode).sort()).toEqual(
      ["COGS", "INVENTORY"].sort(),
    );
    const trial = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(trial.balances).toBe(true);
  });

  it("a second delivery of the return event posts once", async () => {
    const scene = await newScene();
    const salesReturnId = newId();
    scene.returns.set(salesReturnId, snapshotOf(salesReturnId, { cost: bdt(400) }));
    const orderId = newId();

    await handleEvent(scene, salesReturnId, orderId);
    await handleEvent(scene, salesReturnId, orderId);

    const entries = await withOrganizationContext(scene.organizationId, () =>
      scene.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.SALES_RETURN,
        sourceId: salesReturnId,
        postingKey: POSTING_KEY.sales_return_value,
      }),
    );
    expect(entries).toBeDefined();
    const trial = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, BUSINESS_DATE),
    );
    expect(trial.debitTotal.amount).toBe(trial.creditTotal.amount);
    expect(trial.debitTotal.amount).toBe(1000 + 400);
  });

  it("a return with no cost moves no inventory and posts only the value entry", async () => {
    const scene = await newScene();
    const salesReturnId = newId();
    scene.returns.set(salesReturnId, snapshotOf(salesReturnId, { cost: bdt(0) }));

    await handleEvent(scene, salesReturnId, newId());

    expect(await findEntry(scene, salesReturnId, POSTING_KEY.sales_return_cogs)).toBeUndefined();
    expect(await findEntry(scene, salesReturnId, POSTING_KEY.sales_return_value)).toBeDefined();
  });
});

describe("accounting postSalesReturns handler: reversal", () => {
  it("the reversal posts the mirror of both return journals once, also on event replay", async () => {
    const scene = await newScene();
    const salesReturnId = newId();
    const orderId = newId();
    scene.returns.set(salesReturnId, snapshotOf(salesReturnId, { cost: bdt(400) }));
    await handleEvent(scene, salesReturnId, orderId);
    scene.returns.set(
      salesReturnId,
      snapshotOf(salesReturnId, { cost: bdt(400), reversalBusinessDate: REVERSAL_DATE }),
    );

    await handleEvent(scene, salesReturnId, orderId, EVENT_TYPE.SALES_RETURN_REVERSED);
    await handleEvent(scene, salesReturnId, orderId, EVENT_TYPE.SALES_RETURN_REVERSED);

    for (const originalKey of [POSTING_KEY.sales_return_value, POSTING_KEY.sales_return_cogs]) {
      const original = await findEntry(scene, salesReturnId, originalKey);
      const mirror = await findEntry(scene, salesReturnId, reversalPostingKeyFor(originalKey));
      expect(mirror).toBeDefined();
      // The reversal belongs to the day it happened; the return's own day keeps its numbers.
      expect(mirror?.businessDate).toBe(REVERSAL_DATE);
      expect(mirror?.lines.map((line) => line.debit.amount)).toEqual(
        original?.lines.map((line) => line.credit.amount),
      );
    }
    const trial = await withOrganizationContext(scene.organizationId, () =>
      scene.trialBalance.execute(scene.organizationId, REVERSAL_DATE),
    );
    expect(trial.balances).toBe(true);
    expect(trial.debitTotal.amount).toBe(2 * (1000 + 400));
    expect(trial.accounts.every((account) => account.balance.amount === 0)).toBe(true);
  });
});
