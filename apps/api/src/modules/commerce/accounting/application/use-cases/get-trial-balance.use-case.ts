import {
  ACCOUNT_TYPE,
  type Money,
  type TrialBalanceAccountRow,
  type TrialBalanceResponse,
} from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import {
  requireOrganizationCurrency,
  type OrganizationCurrencyPort,
} from "../organization-currency.js";
import type { AccountRepository } from "../ports/account-repository.js";
import type { JournalRepository } from "../ports/journal-repository.js";

export class GetTrialBalanceUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly journals: JournalRepository,
    private readonly currencies: OrganizationCurrencyPort,
  ) {}

  async execute(organizationId: OrganizationId, asOf: string): Promise<TrialBalanceResponse> {
    const [accounts, entries, currency] = await Promise.all([
      this.accounts.listAll?.() ?? this.accounts.listActive(),
      this.journals.listThrough(asOf),
      requireOrganizationCurrency(this.currencies, organizationId),
    ]);
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const account of accounts) {
      totals.set(account.accountId, { debit: 0, credit: 0 });
    }
    for (const entry of entries) {
      for (const line of entry.lines) {
        const bucket = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        bucket.debit += line.debit.amount;
        bucket.credit += line.credit.amount;
        totals.set(line.accountId, bucket);
      }
    }
    const rows: TrialBalanceAccountRow[] = accounts.map((account) => {
      const bucket = totals.get(account.accountId) ?? { debit: 0, credit: 0 };
      const money = (amount: number): Money => ({
        amount,
        currency,
      });
      // Signed balance: debit − credit (assets/expenses positive when debit-heavy).
      const balanceAmount =
        account.accountType === ACCOUNT_TYPE.ASSET || account.accountType === ACCOUNT_TYPE.EXPENSE
          ? bucket.debit - bucket.credit
          : bucket.credit - bucket.debit;
      return {
        accountId: account.accountId,
        accountCode: account.accountCode,
        name: account.name,
        accountType: account.accountType,
        debitTotal: money(bucket.debit),
        creditTotal: money(bucket.credit),
        balance: money(balanceAmount),
      };
    });
    const debitTotalAmount = rows.reduce((sum, row) => sum + row.debitTotal.amount, 0);
    const creditTotalAmount = rows.reduce((sum, row) => sum + row.creditTotal.amount, 0);
    const money = (amount: number): Money => ({
      amount,
      currency,
    });
    return {
      asOf,
      accounts: rows,
      debitTotal: money(debitTotalAmount),
      creditTotal: money(creditTotalAmount),
      balances: debitTotalAmount === creditTotalAmount,
    };
  }
}
