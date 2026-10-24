import { EVENT_TYPE, type EventEnvelope } from "@banijjik/contracts";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  SYSTEM_ACCOUNT_SEEDS,
  type Money,
  type PostingKey,
} from "@banijjik/contracts/accounting";
import { COMMISSION_ENTRY_KIND, COMMISSION_EVENT_TYPE } from "@banijjik/contracts/commission";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
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
import { Account } from "./domain/account.entity.js";
import type {
  CommissionEntryPostingSnapshot,
  CommissionPayoutPostingSnapshot,
} from "./domain/commission-posting-rules.js";
import { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
import { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";
import { registerAccountingModels } from "./infrastructure/register-accounting-models.js";
import { buildPostCommissionHandler } from "./application/handlers/post-commission.handler.js";
import type { CommissionPostingSource } from "./application/ports/commission-posting-source.js";
import type { PostJournalDependencies } from "./application/post-journal.js";
import { catchUpSystemAccounts, seedSystemAccounts } from "./application/seed-system-accounts.js";
import { GetTrialBalanceUseCase } from "./application/use-cases/get-trial-balance.use-case.js";

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

const NOW = new Date("2026-10-23T10:00:00Z");
const BUSINESS_DATE = "2026-10-23";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

interface Scene {
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly memberId: string;
  readonly entries: Map<string, CommissionEntryPostingSnapshot>;
  readonly payouts: Map<string, CommissionPayoutPostingSnapshot>;
  readonly handler: ReturnType<typeof buildPostCommissionHandler>;
  readonly accounts: MongoAccountRepository;
  readonly journals: MongoJournalRepository;
}

async function newScene(): Promise<Scene> {
  const organizationId = asId<OrganizationId>(newId());
  const entries = new Map<string, CommissionEntryPostingSnapshot>();
  const payouts = new Map<string, CommissionPayoutPostingSnapshot>();
  const commissions: CommissionPostingSource = {
    readEntry: async (commissionEntryId) => entries.get(commissionEntryId),
    readPayout: async (commissionPayoutId) => payouts.get(commissionPayoutId),
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
  return {
    organizationId,
    locationId: newId(),
    memberId: newId(),
    entries,
    payouts,
    handler: buildPostCommissionHandler({ commissions, posting }),
    accounts,
    journals,
  };
}

function addEntry(
  scene: Scene,
  amount: number,
  entryKind: CommissionEntryPostingSnapshot["entryKind"],
): string {
  const commissionEntryId = newId();
  scene.entries.set(commissionEntryId, {
    commissionEntryId,
    businessDate: BUSINESS_DATE,
    locationId: scene.locationId,
    amount: bdt(amount),
    entryKind,
  });
  return commissionEntryId;
}

function addPayout(scene: Scene, total: number, method: "CASH" | "BKASH" = "BKASH"): string {
  const commissionPayoutId = newId();
  scene.payouts.set(commissionPayoutId, {
    commissionPayoutId,
    businessDate: BUSINESS_DATE,
    locationId: scene.locationId,
    total: bdt(total),
    method,
  });
  return commissionPayoutId;
}

function envelopeOf(scene: Scene, type: string, payload: object) {
  const built = {
    eventId: newId(),
    type,
    version: 1,
    occurredAt: NOW.toISOString(),
    organizationId: scene.organizationId,
    actorUserId: null,
    payload,
  };
  // The handler is typed by its main event; the runner reaches it through the untyped registry.
  return built as unknown as EventEnvelope<{ commissionEntryId: string }>;
}

/** The handler runner opens the transaction a gapless journal number needs; the test does the same. */
function recorded(scene: Scene, commissionEntryId: string) {
  return withTransaction(() =>
    scene.handler.handle(
      envelopeOf(scene, COMMISSION_EVENT_TYPE.ENTRY_RECORDED, { commissionEntryId }),
    ),
  );
}

function paid(scene: Scene, commissionPayoutId: string) {
  return withTransaction(() =>
    scene.handler.handle(
      envelopeOf(scene, COMMISSION_EVENT_TYPE.PAYOUT_PAID, { commissionPayoutId }),
    ),
  );
}

function runAs<Result>(scene: Scene, work: () => Promise<Result>): Promise<Result> {
  return withOrganizationContext(scene.organizationId, work);
}

async function journalOf(scene: Scene, sourceId: string, postingKey: PostingKey) {
  const entry = await runAs(scene, () =>
    scene.journals.findBySource({
      sourceType: JOURNAL_SOURCE_TYPE.COMMISSION,
      sourceId,
      postingKey,
    }),
  );
  if (entry === undefined) throw new Error("journal missing");
  return entry;
}

function linesOf(entry: Awaited<ReturnType<typeof journalOf>>) {
  return entry.lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.debit.amount,
    credit: line.credit.amount,
  }));
}

describe("accounting.postCommission handler contract", () => {
  it("follows the whole commission stream and handles both event types published on it", async () => {
    const scene = await newScene();

    expect(scene.handler.handlerKey).toBe("accounting.postCommission");
    expect(scene.handler.ordering).toBe("ORDERED");
    expect(scene.handler.streamPrefixes).toEqual(["commission:"]);
    expect(scene.handler.eventType).toBe(COMMISSION_EVENT_TYPE.ENTRY_RECORDED);
    expect(scene.handler.alsoHandles).toEqual([COMMISSION_EVENT_TYPE.PAYOUT_PAID]);
    expect(EVENT_TYPE.PAYOUT_PAID).toBe(COMMISSION_EVENT_TYPE.PAYOUT_PAID);
  });
});

describe("commission journals", () => {
  it("posts an accrual as expense against the payable", async () => {
    const scene = await newScene();
    const entryId = addEntry(scene, 1000, COMMISSION_ENTRY_KIND.ACCRUAL);

    await runAs(scene, () => recorded(scene, entryId));

    const journal = await journalOf(scene, entryId, POSTING_KEY.commission_accrued);
    expect(journal.businessDate).toBe(BUSINESS_DATE);
    expect(journal.locationId).toBe(scene.locationId);
    expect(linesOf(journal)).toEqual([
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE, debit: 1000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, debit: 0, credit: 1000 },
    ]);
  });

  it("reverses part of the expense for a negative adjustment, for the absolute amount", async () => {
    const scene = await newScene();
    const entryId = addEntry(scene, -400, COMMISSION_ENTRY_KIND.REFUND_ADJUSTMENT);

    await runAs(scene, () => recorded(scene, entryId));

    const journal = await journalOf(scene, entryId, POSTING_KEY.commission_adjusted);
    expect(linesOf(journal)).toEqual([
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, debit: 400, credit: 0 },
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE, debit: 0, credit: 400 },
    ]);
  });

  it("posts a positive adjustment with the lines of an accrual", async () => {
    const scene = await newScene();
    const entryId = addEntry(scene, 400, COMMISSION_ENTRY_KIND.REFUND_ADJUSTMENT);

    await runAs(scene, () => recorded(scene, entryId));

    const journal = await journalOf(scene, entryId, POSTING_KEY.commission_adjusted);
    expect(linesOf(journal)).toEqual([
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE, debit: 400, credit: 0 },
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, debit: 0, credit: 400 },
    ]);
  });

  it("settles the payable from the method account when a payout is paid", async () => {
    const scene = await newScene();
    const payoutId = addPayout(scene, 700, "BKASH");

    await runAs(scene, () => paid(scene, payoutId));

    const journal = await journalOf(scene, payoutId, POSTING_KEY.commission_paid);
    expect(linesOf(journal)).toEqual([
      { accountCode: SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE, debit: 700, credit: 0 },
      { accountCode: SYSTEM_ACCOUNT_CODE.BKASH, debit: 0, credit: 700 },
    ]);
  });

  it("posts nothing twice when the same event is replayed", async () => {
    const scene = await newScene();
    const entryId = addEntry(scene, 1000, COMMISSION_ENTRY_KIND.ACCRUAL);
    const payoutId = addPayout(scene, 1000, "CASH");

    await runAs(scene, async () => {
      await recorded(scene, entryId);
      await recorded(scene, entryId);
      await paid(scene, payoutId);
      await paid(scene, payoutId);
    });

    const posted = await runAs(scene, () =>
      scene.journals.list({ sourceType: JOURNAL_SOURCE_TYPE.COMMISSION, page: 1, limit: 10 }),
    );
    expect(posted.items).toHaveLength(2);
  });

  it("keeps the trial balance balanced and leaves the payable at accrual minus payout", async () => {
    const scene = await newScene();
    const accrual = addEntry(scene, 1000, COMMISSION_ENTRY_KIND.ACCRUAL);
    const reduction = addEntry(scene, -250, COMMISSION_ENTRY_KIND.REFUND_ADJUSTMENT);
    const payout = addPayout(scene, 500, "CASH");

    await runAs(scene, async () => {
      await recorded(scene, accrual);
      await recorded(scene, reduction);
      await paid(scene, payout);
    });

    const trial = await runAs(scene, () =>
      new GetTrialBalanceUseCase(scene.accounts, scene.journals, {
        read: async () => "BDT",
      }).execute(scene.organizationId, BUSINESS_DATE),
    );
    const balanceOf = (accountCode: string) =>
      trial.accounts.find((row) => row.accountCode === accountCode)?.balance.amount;
    expect(trial.balances).toBe(true);
    expect(balanceOf(SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE)).toBe(750);
    expect(balanceOf(SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE)).toBe(250);
  });

  it("fails loudly, so the event retries, when the entry cannot be read", async () => {
    const scene = await newScene();

    await expect(runAs(scene, () => recorded(scene, newId()))).rejects.toThrow();
  });
});

/** Seeds every system account except the listed codes, as an organization created before them would have. */
async function seedAccountsExcept(
  organizationId: OrganizationId,
  accounts: MongoAccountRepository,
  skippedCodes: readonly string[],
): Promise<void> {
  await withOrganizationContext(organizationId, async () => {
    for (const seed of SYSTEM_ACCOUNT_SEEDS) {
      if (skippedCodes.includes(seed.accountCode)) continue;
      await accounts.insert(
        Account.create({
          organizationId,
          accountCode: seed.accountCode,
          name: seed.name,
          accountType: seed.accountType,
          isSystem: true,
          now: NOW,
          actorUserId: null,
        }),
      );
    }
  });
}

describe("commission system accounts", () => {
  it("gives an organization seeded before this card the two commission accounts on catch-up", async () => {
    const organizationId = asId<OrganizationId>(newId());
    const accounts = new MongoAccountRepository();
    const commissionCodes: string[] = [
      SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE,
      SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE,
    ];
    await seedAccountsExcept(organizationId, accounts, commissionCodes);

    const result = await withOrganizationContext(organizationId, () =>
      catchUpSystemAccounts({ accounts, clock: { now: () => NOW } }, async () => [organizationId]),
    );

    expect(result.inserted).toBe(2);
    const expense = await withOrganizationContext(organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.COMMISSION_EXPENSE),
    );
    const payable = await withOrganizationContext(organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.COMMISSION_PAYABLE),
    );
    expect([expense?.accountType, payable?.accountType]).toEqual(["EXPENSE", "LIABILITY"]);
  });
});

describe("bad debt system account", () => {
  it("gives an organization seeded before card 3.34 the BAD_DEBT_EXPENSE expense account on catch-up", async () => {
    const organizationId = asId<OrganizationId>(newId());
    const accounts = new MongoAccountRepository();
    await seedAccountsExcept(organizationId, accounts, [SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE]);

    const result = await withOrganizationContext(organizationId, () =>
      catchUpSystemAccounts({ accounts, clock: { now: () => NOW } }, async () => [organizationId]),
    );

    expect(result.inserted).toBe(1);
    const badDebt = await withOrganizationContext(organizationId, () =>
      accounts.findByCode(SYSTEM_ACCOUNT_CODE.BAD_DEBT_EXPENSE),
    );
    expect(badDebt?.accountType).toBe("EXPENSE");
  });
});
