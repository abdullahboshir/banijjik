import { ACCOUNT_TYPE, type ProfitAndLossStatementResponse } from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import type { AccountRepository } from "../ports/account-repository.js";
import type { JournalRepository } from "../ports/journal-repository.js";

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
    if (this.journals.aggregateBalances === undefined)
      throw new Error("Statement aggregation required");
    const totals = await this.journals.aggregateBalances({
      from: input.from,
      to: input.to,
      locationId: input.locationId,
    });
    const accounts = await this.accounts.listByOrganization(input.organizationId);
    const types = new Map(
      accounts.map((account) => [account.accountId as string, account.accountType]),
    );
    const accountBalances = new Map(
      totals.map((row) => [
        row.accountId,
        types.get(row.accountId) === ACCOUNT_TYPE.INCOME
          ? row.credit - row.debit
          : row.debit - row.credit,
      ]),
    );
    const statementAccounts = this.buildStatementAccounts(accounts, accountBalances);
    const { totalIncome, totalExpense } = this.calculateTotals(statementAccounts);

    return {
      from: input.from,
      to: input.to,
      accounts: statementAccounts,
      totalIncome: { amount: totalIncome, currency: "BDT" as const },
      totalExpense: { amount: totalExpense, currency: "BDT" as const },
      netProfit: { amount: totalIncome - totalExpense, currency: "BDT" as const },
    };
  }

  private buildStatementAccounts(
    accounts: readonly {
      readonly accountId: string;
      readonly accountCode: string;
      readonly name: { readonly bn: string; readonly en: string };
      readonly accountType: import("@banijjik/contracts/accounting").AccountType;
    }[],
    balances: Map<string, number>,
  ) {
    const toRow = (account: (typeof accounts)[number], isIncome: boolean) => {
      const balance = balances.get(account.accountId) ?? 0;
      return {
        accountId: account.accountId,
        accountCode: account.accountCode,
        name: account.name,
        accountType: account.accountType,
        incomeTotal: isIncome
          ? { amount: balance, currency: "BDT" as const }
          : { amount: 0, currency: "BDT" as const },
        expenseTotal: isIncome
          ? { amount: 0, currency: "BDT" as const }
          : { amount: balance, currency: "BDT" as const },
        net: { amount: isIncome ? balance : -balance, currency: "BDT" as const },
      };
    };

    return [
      ...accounts
        .filter((account) => account.accountType === ACCOUNT_TYPE.INCOME)
        .map((account) => toRow(account, true)),
      ...accounts
        .filter((account) => account.accountType === ACCOUNT_TYPE.EXPENSE)
        .map((account) => toRow(account, false)),
    ];
  }

  private calculateTotals(
    accounts: readonly {
      readonly accountType: string;
      readonly incomeTotal: { readonly amount: number };
      readonly expenseTotal: { readonly amount: number };
    }[],
  ) {
    const totalIncome = accounts
      .filter((account) => account.accountType === ACCOUNT_TYPE.INCOME)
      .reduce((sum, account) => sum + account.incomeTotal.amount, 0);
    const totalExpense = accounts
      .filter((account) => account.accountType === ACCOUNT_TYPE.EXPENSE)
      .reduce((sum, account) => sum + account.expenseTotal.amount, 0);
    return { totalIncome, totalExpense };
  }
}
