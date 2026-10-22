import type { CreditPurchaseResponse, CreditPurchaseStatus } from "@banijjik/contracts/credit";
import type { CreditPurchaseId } from "@banijjik/ids";
import { CreditPurchaseNotFoundError } from "../../domain/errors.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { viewCreditPurchase } from "./credit-purchase-view.js";

export interface ListCreditPurchasesStaffInput {
  readonly status?: CreditPurchaseStatus | undefined;
  readonly q?: string | undefined;
  readonly offset: number;
  readonly limit: number;
}

export class ListCreditPurchasesStaffUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    input: ListCreditPurchasesStaffInput,
  ): Promise<{ readonly items: readonly CreditPurchaseResponse[]; readonly total: number }> {
    const { items, total } = await this.deps.purchases.listForStaff(input);
    return {
      items: items.map(viewCreditPurchase),
      total,
    };
  }
}

export class GetCreditPurchaseStaffUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(creditPurchaseId: CreditPurchaseId): Promise<CreditPurchaseResponse> {
    const purchase = await this.deps.purchases.findById(creditPurchaseId);
    if (!purchase) {
      throw new CreditPurchaseNotFoundError();
    }
    return viewCreditPurchase(purchase);
  }
}
