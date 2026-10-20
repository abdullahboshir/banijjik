import {
  ACCOUNT_TYPE,
  type Money,
  type ProfitAndLossStatementResponse,
} from "@banijjik/contracts/accounting";
import { asId, type LocationId, type OrganizationId } from "@banijjik/ids";
import type { AccountRepository } from "../../accounting/application/ports/account-repository.js";
import type { JournalRepository } from "../../accounting/application/ports/journal-repository.js";

export interface ProfitAndLossInput {
  readonly organizationId: OrganizationId;
  readonly from: string;
  readonly to: string;
  readonly locationId?: string | undefined;
}

export class ProfitAndLossUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly journals: JournalRepository,
  ) {}

  async execute(input: ProfitAndLossInput): Promise<ProfitAndLossStatementResponse> {
    const entries = await this.journals.list({
      from: input.from,
      to: input.to,
      page: 1,
      limit: 10000,
    });

    const accounts = await this.accounts.listByOrganization(input.organizationId);
    const accountBalances = this.calculateBalances(entries.items, accounts, input.locationId);

    const statementAccounts = this.buildStatementAccounts(accounts, accountBalances);
    const { totalIncome, totalExpense } = this.calculateTotals(statementAccounts);

    return {
      from: input.from,
      to: input.to,
      accounts: statementAccounts,
      totalIncome: { amount: totalIncome, currency: "BDT" },
      totalExpense: { amount: totalExpense, currency: "BDT" },
      netProfit: { amount: totalIncome - totalExpense, currency: "BDT" },
    };
  }

  private calculateBalances(
    entries: readonly {
      readonly locationId: LocationId | null;
      readonly lines: readonly {
        readonly accountId: string;
        readonly debit: Money;
        readonly credit: Money;
      };
    }[],
    accounts: readonly { readonly accountId: string; readonly accountType: string }[],
    locationId?: string,
  ): Map<string, number> {
    const balances = new Map<string, number>();
    for (const entry of entries) {
      if (locationId !== undefined && entry.locationId !== asId<LocationId>(locationId)) {
        continue;
      }

      for (const line of entry.lines) {
        const account = accounts.find((a) => a.accountId === line.accountId);
        if (account === undefined) continue;

        const current = balances.get(line.accountId) ?? 0;
        if (account.accountType === ACCOUNT_TYPE.INCOME) {
          balances.set(line.accountId, current + line.credit.amount - line.debit.amount);
        } else if (account.accountType === ACCOUNT_TYPE.EXPENSE) {
          balances.set(line.accountId, current + line.debit.amount - line.credit.amount);
        }
      }
    }
    return balances;
  }

  private buildStatementAccounts(
    accounts: readonly {
      readonly accountId: string;
      readonly accountCode: string;
      readonly name: { readonly bn: string; readonly en: string };
      readonly accountType: string;
    }[],
    balances: Map<string, number>,
  ) {
    const toRow = (acc: (typeof accounts)[number], isIncome: boolean) => {
      const balance = balances.get(acc.accountId) ?? 0;
      return {
        accountId: acc.accountId,
        accountCode: acc.accountCode,
        name: acc.name,
        accountType: acc.accountType,
        incomeTotal: isIncome
          ? { amount: balance, currency: "BDT" }
          : { amount: 0, currency: "BDT" },
        expenseTotal: isIncome
          ? { amount: 0, currency: "BDT" }
          : { amount: balance, currency: "BDT" },
        net: { amount: isIncome ? balance : -balance, currency: "BDT" },
      };
    };

    return [
      ...accounts.filter((a) => a.accountType === ACCOUNT_TYPE.INCOME).map((a) => toRow(a, true)),
      ...accounts.filter((a) => a.accountType === ACCOUNT_TYPE.EXPENSE).map((a) => toRow(a, false)),
    ];
  }

  private calculateTotals(
    accounts: readonly {
      readonly accountType: string;
      readonly incomeTotal: { readonly amount: number };
      readonly expenseTotal: { readonly amount: number };
    },
  ) {
    const totalIncome = accounts
      .filter((a) => a.accountType === ACCOUNT_TYPE.INCOME)
      .reduce((sum, a) => sum + a.incomeTotal.amount, 0);
    const totalExpense = accounts
      .filter((a) => a.accountType === ACCOUNT_TYPE.EXPENSE)
      .reduce((sum, a) => sum + a.expenseTotal.amount, 0);
    return { totalIncome, totalExpense };
  }
}
