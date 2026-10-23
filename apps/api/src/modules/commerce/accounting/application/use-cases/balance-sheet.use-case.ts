import type { CurrencyCode } from "@banijjik/contracts";
import { ACCOUNT_TYPE, type BalanceSheetResponse } from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import {
  requireOrganizationCurrency,
  type OrganizationCurrencyPort,
} from "../organization-currency.js";
import type { AccountRepository } from "../ports/account-repository.js";
import type { JournalRepository } from "../ports/journal-repository.js";

export interface BalanceSheetInput {
  readonly organizationId: OrganizationId;
  readonly asOf: string;
}

export class BalanceSheetUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly journals: JournalRepository,
    private readonly currencies: OrganizationCurrencyPort,
  ) {}

  async execute(input: BalanceSheetInput): Promise<BalanceSheetResponse> {
    if (this.journals.aggregateBalances === undefined)
      throw new Error("Statement aggregation required");
    const currency = await requireOrganizationCurrency(this.currencies, input.organizationId);
    const totals = await this.journals.aggregateBalances({ to: input.asOf });
    const accounts = await this.accounts.listByOrganization(input.organizationId);
    const types = new Map(
      accounts.map((account) => [account.accountId as string, account.accountType]),
    );
    const accountBalances = new Map(
      totals.map((row) => {
        const type = types.get(row.accountId);
        return [
          row.accountId,
          type === ACCOUNT_TYPE.ASSET || type === ACCOUNT_TYPE.EXPENSE
            ? row.debit - row.credit
            : row.credit - row.debit,
        ];
      }),
    );
    const { assets, liabilities, equity } = this.groupAccounts(accounts, accountBalances, currency);
    const retainedEarnings = this.calculateRetainedEarnings(accounts, accountBalances);

    const totalAssets = this.sumBalances(assets);
    const totalLiabilities = this.sumBalances(liabilities);
    const totalEquity = this.sumBalances(equity);

    const isBalanced =
      Math.abs(totalAssets - (totalLiabilities + totalEquity + retainedEarnings)) < 1;

    return {
      asOf: input.asOf,
      assets,
      liabilities,
      equity,
      retainedEarnings: { amount: retainedEarnings, currency },
      totalAssets: { amount: totalAssets, currency },
      totalLiabilities: { amount: totalLiabilities, currency },
      totalEquity: { amount: totalEquity, currency },
      isBalanced,
    };
  }

  private groupAccounts(
    accounts: readonly {
      readonly accountId: string;
      readonly accountCode: string;
      readonly name: { readonly bn: string; readonly en: string };
      readonly accountType: import("@banijjik/contracts/accounting").AccountType;
    }[],
    balances: Map<string, number>,
    currency: CurrencyCode,
  ) {
    const toRow = (account: (typeof accounts)[number]) => ({
      accountId: account.accountId,
      accountCode: account.accountCode,
      name: account.name,
      accountType: account.accountType,
      balance: { amount: balances.get(account.accountId) ?? 0, currency },
    });

    return {
      assets: accounts.filter((account) => account.accountType === ACCOUNT_TYPE.ASSET).map(toRow),
      liabilities: accounts
        .filter((account) => account.accountType === ACCOUNT_TYPE.LIABILITY)
        .map(toRow),
      equity: accounts.filter((account) => account.accountType === ACCOUNT_TYPE.EQUITY).map(toRow),
    };
  }

  private calculateRetainedEarnings(
    accounts: readonly { readonly accountId: string; readonly accountType: string }[],
    balances: Map<string, number>,
  ): number {
    const totalIncome = accounts
      .filter((account) => account.accountType === ACCOUNT_TYPE.INCOME)
      .reduce((sum, account) => sum + (balances.get(account.accountId) ?? 0), 0);
    const totalExpense = accounts
      .filter((account) => account.accountType === ACCOUNT_TYPE.EXPENSE)
      .reduce((sum, account) => sum + (balances.get(account.accountId) ?? 0), 0);
    return totalIncome - totalExpense;
  }

  private sumBalances(rows: readonly { readonly balance: { readonly amount: number } }[]): number {
    return rows.reduce((sum, row) => sum + row.balance.amount, 0);
  }
}
