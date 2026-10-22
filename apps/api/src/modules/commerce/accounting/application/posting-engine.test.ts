import {
  ACCOUNT_TYPE,
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  REVENUE_STATE,
  SYSTEM_ACCOUNT_CODE,
  SYSTEM_ACCOUNT_SEEDS,
} from "@banijjik/contracts/accounting";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { beforeEach, describe, expect, it } from "vitest";
import { Account } from "../domain/account.entity.js";
import { JournalEntry } from "../domain/journal-entry.entity.js";
import { unbalancedJournal } from "../domain/errors.js";
import { draftPaymentReceived, type PaymentPostingSnapshot } from "../domain/posting-rules.js";
import type { AccountRepository } from "./ports/account-repository.js";
import type { JournalListFilter, JournalRepository } from "./ports/journal-repository.js";
import type { PaymentPostingSource } from "./ports/payment-posting-source.js";
import { GetTrialBalanceUseCase } from "./use-cases/get-trial-balance.use-case.js";
import { assertBalanced } from "../domain/journal-lines.js";
import { seedSystemAccounts } from "./seed-system-accounts.js";

const money = (amount: number) => ({ amount, currency: "BDT" as const });
const now = new Date("2026-10-19T12:00:00.000Z");

class FakeAccounts implements AccountRepository {
  readonly rows = new Map<string, Account>();

  async insert(account: Account): Promise<"inserted" | "duplicate"> {
    if (this.rows.has(account.accountCode)) return "duplicate";
    this.rows.set(account.accountCode, account);
    return "inserted";
  }

  async findByCode(accountCode: string): Promise<Account | undefined> {
    return this.rows.get(accountCode);
  }

  async findById(accountId: Account["accountId"]): Promise<Account | undefined> {
    return [...this.rows.values()].find((row) => row.accountId === accountId);
  }

  async listActive(): Promise<Account[]> {
    return [...this.rows.values()];
  }

  async listByOrganization(organizationId: OrganizationId): Promise<Account[]> {
    return [...this.rows.values()].filter((row) => row.organizationId === organizationId);
  }

  async countSystemAccounts(): Promise<number> {
    return [...this.rows.values()].filter((row) => row.isSystem).length;
  }
}

class FakeJournals implements JournalRepository {
  readonly rows: JournalEntry[] = [];

  async insert(entry: JournalEntry): Promise<"inserted" | "duplicate"> {
    const existing = await this.findBySource({
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      postingKey: entry.postingKey,
    });
    if (existing !== undefined) return "duplicate";
    this.rows.push(entry);
    return "inserted";
  }

  async findById(
    journalEntryId: JournalEntry["journalEntryId"],
  ): Promise<JournalEntry | undefined> {
    return this.rows.find((row) => row.journalEntryId === journalEntryId);
  }

  async findBySource(input: {
    readonly sourceType: JournalEntry["sourceType"];
    readonly sourceId: string;
    readonly postingKey: JournalEntry["postingKey"];
  }): Promise<JournalEntry | undefined> {
    return this.rows.find(
      (row) =>
        row.sourceType === input.sourceType &&
        row.sourceId === input.sourceId &&
        row.postingKey === input.postingKey,
    );
  }

  async list(
    filter: JournalListFilter,
  ): Promise<{ readonly items: JournalEntry[]; readonly hasNext: boolean }> {
    const items = this.rows.filter((row) => {
      if (filter.sourceType !== undefined && row.sourceType !== filter.sourceType) return false;
      if (filter.from !== undefined && row.businessDate < filter.from) return false;
      if (filter.to !== undefined && row.businessDate > filter.to) return false;
      return true;
    });
    return { items, hasNext: false };
  }

  async listThrough(asOf: string): Promise<JournalEntry[]> {
    return this.rows.filter((row) => row.businessDate <= asOf);
  }
}

function fakePayments(snapshots: Map<string, PaymentPostingSnapshot>): PaymentPostingSource {
  return {
    readPayment: async (paymentId) => snapshots.get(paymentId),
    readStoreCreditEntry: async () => undefined,
  };
}

async function seedOrg(accounts: FakeAccounts): Promise<OrganizationId> {
  const organizationId = asId<OrganizationId>(newId());
  await seedSystemAccounts(
    { accounts, clock: { now: () => now } },
    { organizationId, actorUserId: null },
  );
  return organizationId;
}

describe("system account seeding", () => {
  it("seeds every system account once and is idempotent on catch-up", async () => {
    const accounts = new FakeAccounts();
    const organizationId = asId<OrganizationId>(newId());
    const first = await seedSystemAccounts(
      { accounts, clock: { now: () => now } },
      { organizationId, actorUserId: null },
    );
    const second = await seedSystemAccounts(
      { accounts, clock: { now: () => now } },
      { organizationId, actorUserId: null },
    );
    expect(first.inserted).toBe(SYSTEM_ACCOUNT_SEEDS.length);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(SYSTEM_ACCOUNT_SEEDS.length);
    expect(await accounts.countSystemAccounts()).toBe(SYSTEM_ACCOUNT_SEEDS.length);
  });
});

describe("posting engine with payment fake", () => {
  let accounts: FakeAccounts;
  let journals: FakeJournals;
  let organizationId: OrganizationId;

  beforeEach(async () => {
    accounts = new FakeAccounts();
    journals = new FakeJournals();
    organizationId = await seedOrg(accounts);
  });

  async function postDraft(draft: ReturnType<typeof draftPaymentReceived>[number]): Promise<void> {
    assertBalanced(draft.lines);
    const lines = [];
    for (const line of draft.lines) {
      const account = await accounts.findByCode(line.accountCode);
      if (account === undefined) throw new Error(`missing ${line.accountCode}`);
      lines.push({
        accountId: account.accountId,
        accountCode: account.accountCode,
        debit: line.debit,
        credit: line.credit,
      });
    }
    const entry = JournalEntry.create({
      organizationId,
      entryNumber: String(journals.rows.length + 1).padStart(6, "0"),
      businessDate: draft.businessDate,
      locationId: null,
      lines,
      sourceType: draft.sourceType as JournalEntry["sourceType"],
      sourceId: draft.sourceId,
      postingKey: draft.postingKey,
      reversesJournalEntryId: null,
      now,
      actorUserId: null,
    });
    await journals.insert(entry);
  }

  it("is idempotent: the same payment draft posted twice yields one journal entry", async () => {
    const [draft] = draftPaymentReceived({
      paymentId: "pay-1",
      businessDate: "2026-10-19",
      locationId: null,
      amount: money(1000),
      method: "CASH",
      direction: "IN",
      allocations: [
        { requestId: "r1", amount: money(1000), revenueState: REVENUE_STATE.BEFORE_REVENUE },
      ],
    });
    expect(draft).toBeDefined();
    if (draft === undefined) throw new Error("expected payment draft");
    await postDraft(draft);
    await postDraft(draft);
    expect(journals.rows).toHaveLength(1);
  });

  it("refuses an unbalanced forced bug before any write", async () => {
    const before = journals.rows.length;
    expect(() =>
      assertBalanced([
        {
          accountCode: SYSTEM_ACCOUNT_CODE.CASH,
          debit: money(10),
          credit: money(0),
        },
        {
          accountCode: SYSTEM_ACCOUNT_CODE.CUSTOMER_ADVANCES,
          debit: money(0),
          credit: money(9),
        },
      ]),
    ).toThrow(unbalancedJournal(10, 9).messageKey);
    expect(journals.rows).toHaveLength(before);
  });

  it("runs a full-day scenario and the trial balance nets to zero", async () => {
    const payments = new Map<string, PaymentPostingSnapshot>([
      [
        "dep",
        {
          paymentId: "dep",
          businessDate: "2026-10-19",
          locationId: null,
          amount: money(500),
          method: "CASH",
          direction: "IN",
          allocations: [
            { requestId: "r1", amount: money(500), revenueState: REVENUE_STATE.BEFORE_REVENUE },
          ],
        },
      ],
      [
        "settle",
        {
          paymentId: "settle",
          businessDate: "2026-10-19",
          locationId: null,
          amount: money(500),
          method: "BKASH",
          direction: "IN",
          allocations: [
            { requestId: "r1", amount: money(500), revenueState: REVENUE_STATE.AFTER_REVENUE },
          ],
        },
      ],
    ]);
    void fakePayments(payments);

    for (const snapshot of payments.values()) {
      for (const draft of draftPaymentReceived(snapshot)) {
        await postDraft(draft);
      }
    }

    // Expense category account (non-system) for two expenses + void.
    const rent = Account.create({
      organizationId,
      accountCode: "EXPENSE_RENT",
      name: { bn: "ভাড়া", en: "Rent" },
      accountType: ACCOUNT_TYPE.EXPENSE,
      isSystem: false,
      now,
      actorUserId: null as unknown as UserId | null,
    });
    await accounts.insert(rent);

    for (const [sourceId, amount] of [
      ["exp-1", 200],
      ["exp-2", 100],
    ] as const) {
      await postDraft({
        businessDate: "2026-10-19",
        locationId: null,
        sourceType: JOURNAL_SOURCE_TYPE.EXPENSE,
        sourceId,
        postingKey: POSTING_KEY.expense_posted,
        lines: [
          {
            accountCode: "EXPENSE_RENT",
            debit: money(amount),
            credit: money(0),
          },
          {
            accountCode: SYSTEM_ACCOUNT_CODE.CASH,
            debit: money(0),
            credit: money(amount),
          },
        ],
      });
    }
    // Void exp-2
    await postDraft({
      businessDate: "2026-10-19",
      locationId: null,
      sourceType: JOURNAL_SOURCE_TYPE.EXPENSE,
      sourceId: "exp-2",
      postingKey: POSTING_KEY.expense_voided,
      lines: [
        {
          accountCode: "EXPENSE_RENT",
          debit: money(0),
          credit: money(100),
        },
        {
          accountCode: SYSTEM_ACCOUNT_CODE.CASH,
          debit: money(100),
          credit: money(0),
        },
      ],
    });

    const trial = await new GetTrialBalanceUseCase(accounts, journals).execute("2026-10-19");
    expect(trial.balances).toBe(true);
    expect(trial.debitTotal.amount).toBe(trial.creditTotal.amount);
  });
});
