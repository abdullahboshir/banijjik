import type { AccountResponse } from "@banijjik/contracts/accounting";
import type { AccountRepository } from "../ports/account-repository.js";
import { toAccountResponse } from "../post-journal.js";

export class ListAccountsUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(): Promise<readonly AccountResponse[]> {
    const rows = await this.accounts.listActive();
    return rows.map(toAccountResponse);
  }
}
