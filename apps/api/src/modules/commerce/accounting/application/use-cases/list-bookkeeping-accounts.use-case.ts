import type { OrganizationId } from "@banijjik/ids";
import type { AccountListQuery } from "@banijjik/validation/accounting";
import { ACCOUNT_TYPE, type AccountResponse } from "@banijjik/contracts/accounting";
import type { AccountRepository } from "../ports/account-repository.js";
import type { JournalRepository } from "../ports/journal-repository.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  requireOrganizationCurrency,
  type OrganizationCurrencyPort,
} from "../organization-currency.js";
import { toAccountResponse } from "../post-journal.js";
export interface ListBookkeepingAccountsDependencies {
  readonly accounts: AccountRepository;
  readonly journals: JournalRepository;
  readonly clock: Clock;
  readonly currencies: OrganizationCurrencyPort;
}
export class ListBookkeepingAccountsUseCase {
  constructor(private readonly deps: ListBookkeepingAccountsDependencies) {}
  async execute(
    organizationId: OrganizationId,
    query: AccountListQuery,
  ): Promise<{ items: AccountResponse[]; hasNext: boolean }> {
    if (
      this.deps.accounts.listPage === undefined ||
      this.deps.journals.aggregateBalances === undefined
    )
      throw new Error("Bookkeeping readers required");
    const currency = await requireOrganizationCurrency(this.deps.currencies, organizationId);
    const result = await this.deps.accounts.listPage(query.page, query.limit, query.accountId);
    const totals = await this.deps.journals.aggregateBalances({
      to: this.deps.clock.now().toISOString().slice(0, 10),
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
        return { ...toAccountResponse(account), balance: { amount, currency } };
      }),
    };
  }
}
