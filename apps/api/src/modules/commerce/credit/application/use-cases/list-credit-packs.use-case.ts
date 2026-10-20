import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { CreditPack } from "@banijjik/contracts/credit";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import type { OrganizationId } from "@banijjik/ids";

export class ListCreditPacksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(): Promise<readonly CreditPack[]> {
    const organizationId = getRequestContext().organizationId as OrganizationId;
    return this.deps.packs.listActive(organizationId);
  }
}
