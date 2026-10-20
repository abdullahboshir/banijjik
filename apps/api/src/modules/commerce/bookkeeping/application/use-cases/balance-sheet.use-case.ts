import {
  ACCOUNT_TYPE,
  type BalanceSheetResponse,
  type Money,
} from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import type { AccountRepository } from "../../accounting/application/ports/account-repository.js";
import type { JournalRepository } from "../../accounting/application/ports/journal-repository.js";

export interface BalanceSheetInput {
  readonly organizationId: OrganizationId;
  readonly asOf: string;
}

export class BalanceSheetUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly journals: JournalRepository,
  ) {}

  async execute(input: BalanceSheetInput): Promise<BalanceSheetResponse> {
    const entries = await this.journals.listThrough(input.asOf);
    const accounts = await this.accounts.listByOrganization(input.organizationId);
    const accountBalances = this.calculateBalances(entries, accounts);

    const { assets, liabilities, equity } = this.groupAccounts(accounts, accountBalances);
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
      retainedEarnings: { amount: retainedEarnings, currency: "BDT" },
      totalAssets: { amount: totalAssets, currency: "BDT" },
      totalLiabilities: { amount: totalLiabilities, currency: "BDT" },
      totalEquity: { amount: totalEquity, currency: "BDT" },
      isBalanced,
    };
  }

  private calculateBalances(
    entries: readonly {
      readonly lines: readonly {
        readonly accountId: string;
        readonly debit: Money;
        readonly credit: Money;
      };
    }[],
    accounts: readonly { readonly accountId: string; readonly accountType: string }[],
  ): Map<string, number> {
    const balances = new Map<string, number>();
    for (const entry of entries) {
      for (const line of entry.lines) {
        const account = accounts.find((a) => a.accountId === line.accountId);
        if (account === undefined) continue;

        const current = balances.get(line.accountId) ?? 0;
        const debit = line.debit.amount;
        const credit = line.credit.amount;

        if (
          account.accountType === ACCOUNT_TYPE.ASSET ||
          account.accountType === ACCOUNT_TYPE.EXPENSE
        ) {
          balances.set(line.accountId, current + debit - credit);
        } else {
          balances.set(line.accountId, current + credit - debit);
        }
      }
    }
    return balances;
  }

  private groupAccounts(
    accounts: readonly {
      readonly accountId: string;
      readonly accountCode: string;
      readonly name: { readonly bn: string; readonly en: string };
      readonly accountType: string;
    }[],
    balances: Map<string, number>,
  ) {
    const toRow = (acc: (typeof accounts)[number]) => ({
      accountId: acc.accountId,
      accountCode: acc.accountCode,
      name: acc.name,
      accountType: acc.accountType,
      balance: { amount: balances.get(acc.accountId) ?? 0, currency: "BDT" },
    });

    return {
      assets: accounts.filter((a) => a.accountType === ACCOUNT_TYPE.ASSET).map(toRow),
      liabilities: accounts.filter((a) => a.accountType === ACCOUNT_TYPE.LIABILITY).map(toRow),
      equity: accounts.filter((a) => a.accountType === ACCOUNT_TYPE.EQUITY).map(toRow),
    };
  }

  private calculateRetainedEarnings(
    accounts: readonly { readonly accountId: string; readonly accountType: string }[],
    balances: Map<string, number>,
  ): number {
    const totalIncome = accounts
      .filter((a) => a.accountType === ACCOUNT_TYPE.INCOME)
      .reduce((sum, a) => sum + (balances.get(a.accountId) ?? 0), 0);
    const totalExpense = accounts
      .filter((a) => a.accountType === ACCOUNT_TYPE.EXPENSE)
      .reduce((sum, a) => sum + (balances.get(a.accountId) ?? 0), 0);
    return totalIncome - totalExpense;
  }

  private sumBalances(rows: readonly { readonly balance: { readonly amount: number } }): number {
    return rows.reduce((sum, row) => sum + row.balance.amount, 0);
  }
}
