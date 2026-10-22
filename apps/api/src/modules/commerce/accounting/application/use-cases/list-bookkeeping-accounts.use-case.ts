import type { AccountListQuery } from "@banijjik/validation/accounting";
import { ACCOUNT_TYPE, type AccountResponse } from "@banijjik/contracts/accounting";
import type { AccountRepository } from "../ports/account-repository.js";
import type { JournalRepository } from "../ports/journal-repository.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { toAccountResponse } from "../post-journal.js";
export class ListBookkeepingAccountsUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly journals: JournalRepository,
    private readonly clock: Clock,
  ) {}
  async execute(query: AccountListQuery): Promise<{ items: AccountResponse[]; hasNext: boolean }> {
    if (this.accounts.listPage === undefined || this.journals.aggregateBalances === undefined)
      throw new Error("Bookkeeping readers required");
    const result = await this.accounts.listPage(query.page, query.limit, query.accountId);
    const totals = await this.journals.aggregateBalances({
      to: this.clock.now().toISOString().slice(0, 10),
    });
    const balances = new Map(totals.map((row) => [row.accountId, row]));
    return {
      ...result,
      items: result.items.map((account) => {
        const row = balances.get(account.accountId);
        const debit = row?.debit ?? 0;
        const credit = row?.credit ?? 0;
        const amount =
          account.accountType === ACCOUNT_TYPE.ASSET || account.accountType === ACCOUNT_TYPE.EXPENSE
            ? debit - credit
            : credit - debit;
        return { ...toAccountResponse(account), balance: { amount, currency: "BDT" } };
      }),
    };
  }
}
