import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { ListingUnlock } from "@banijjik/contracts/credit";
import type { CustomerAccountId } from "@banijjik/ids";

export class GetMyUnlocksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly ListingUnlock[]> {
    return this.deps.unlocks.listByCustomer(customerAccountId, options);
  }
}
