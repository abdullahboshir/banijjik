import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import type { CustomerAccountId } from "@banijjik/ids";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { viewCreditPurchase } from "./credit-purchase-view.js";

export class ListMyCreditPurchasesUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    customerAccountId: CustomerAccountId,
    pagination: { readonly offset: number; readonly limit: number },
  ): Promise<{ readonly items: readonly CreditPurchaseResponse[]; readonly total: number }> {
    const { items, total } = await this.deps.purchases.listByAccount(
      customerAccountId,
      pagination.offset,
      pagination.limit,
    );
    return {
      items: items.map(viewCreditPurchase),
      total,
    };
  }
}
