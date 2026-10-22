import {
  CREDIT_RULE_KEY,
  type CreditPaymentInfoResponse,
  type CreditPaymentMethodSetting,
} from "@banijjik/contracts/credit";
import { asId, type OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";

export class GetCreditPaymentInfoUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(): Promise<CreditPaymentInfoResponse> {
    const organizationId = asId<OrganizationId>(String(getRequestContext().organizationId));
    const resolved = await this.deps.resolveSettings(organizationId, [
      CREDIT_RULE_KEY.PAYMENT_METHODS,
    ]);
    const methods = (resolved.get(CREDIT_RULE_KEY.PAYMENT_METHODS)?.value ??
      []) as readonly CreditPaymentMethodSetting[];
    return { methods };
  }
}
