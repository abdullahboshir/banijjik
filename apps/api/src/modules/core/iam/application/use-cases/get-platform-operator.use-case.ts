import { ERROR_CODE, DomainRuleError } from "@banijjik/contracts";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import { summariesOf, type OperatorSummarySource } from "./operator-summary.js";

export interface GetPlatformOperatorDependencies {
  readonly operators: Pick<PlatformOperatorRepository, "findById">;
  readonly users: Pick<UserRepository, "findByIds">;
}

/** One operator, or 404. */
export class GetPlatformOperatorUseCase {
  constructor(private readonly dependencies: GetPlatformOperatorDependencies) {}

  async execute(platformOperatorId: string): Promise<OperatorSummarySource> {
    const operator = await this.dependencies.operators.findById(platformOperatorId);
    if (operator === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    const [summary] = await summariesOf([operator], this.dependencies.users);
    if (summary === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return summary;
  }
}
