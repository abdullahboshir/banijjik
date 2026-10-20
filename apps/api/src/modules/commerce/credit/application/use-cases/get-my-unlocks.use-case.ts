import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { UnlockListItem } from "@banijjik/contracts/credit";

export class GetMyUnlocksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    customerAccountId: string,
    options: { limit: number; offset: number },
  ): Promise<readonly UnlockListItem[]> {
    return this.deps.unlocks.listByCustomer(customerAccountId, options);
  }
}
