import type { CurrencyCode } from "@banijjik/contracts";
import { ACCOUNT_TYPE, type ProfitAndLossStatementResponse } from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import {
  requireOrganizationCurrency,
  type OrganizationCurrencyPort,
} from "../organization-currency.js";
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
    private readonly currencies: OrganizationCurrencyPort,
  ) {}

  async execute(input: ProfitAndLossInput): Promise<ProfitAndLossStatementResponse> {
    if (this.journals.aggregateBalances === undefined)
      throw new Error("Statement aggregation required");
    const currency = await requireOrganizationCurrency(this.currencies, input.organizationId);
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
    const statementAccounts = this.buildStatementAccounts(accounts, accountBalances, currency);
    const { totalIncome, totalExpense } = this.calculateTotals(statementAccounts);

    return {
      from: input.from,
      to: input.to,
      accounts: statementAccounts,
      totalIncome: { amount: totalIncome, currency },
      totalExpense: { amount: totalExpense, currency },
      netProfit: { amount: totalIncome - totalExpense, currency },
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
    currency: CurrencyCode,
  ) {
    const toRow = (account: (typeof accounts)[number], isIncome: boolean) => {
      const balance = balances.get(account.accountId) ?? 0;
      return {
        accountId: account.accountId,
        accountCode: account.accountCode,
        name: account.name,
        accountType: account.accountType,
        incomeTotal: isIncome ? { amount: balance, currency } : { amount: 0, currency },
        expenseTotal: isIncome ? { amount: 0, currency } : { amount: balance, currency },
        net: { amount: isIncome ? balance : -balance, currency },
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
