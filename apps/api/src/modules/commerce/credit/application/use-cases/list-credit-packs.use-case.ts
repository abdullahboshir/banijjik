import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { CreditPack } from "../../domain/credit-pack.entity.js";
import { getRequestContext } from "../../../../kernel/context/index.js";

export class ListCreditPacksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(): Promise<readonly CreditPack[]> {
    return this.deps.packs.listActive(getRequestContext().organizationId);
  }
}
