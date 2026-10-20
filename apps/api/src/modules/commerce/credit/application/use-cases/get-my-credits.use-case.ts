import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { MyCreditsResponse } from "@banijjik/contracts/credit";
import type { CustomerAccountId } from "@banijjik/ids";

export class GetMyCreditsUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<MyCreditsResponse> {
    const balance = await this.deps.credit.getBalance(customerAccountId);
    const entries = await this.deps.credit.listEntries(customerAccountId, options);
    return {
      balance: balance?.balance ?? 0,
      entries,
    };
  }
}
