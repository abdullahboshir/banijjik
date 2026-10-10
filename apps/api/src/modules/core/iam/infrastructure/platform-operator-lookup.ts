import { USER_STATUS } from "@banijjik/contracts";
import { asId } from "@banijjik/ids";
import type {
  ActivePlatformOperator,
  PlatformOperatorLookup,
} from "../../../../kernel/auth/index.js";
import type { PlatformOperatorRepository } from "../application/ports/platform-operator-repository.js";

/** The kernel port behind authenticatePlatform(): the operator of a user, only while it is ACTIVE. */
export class IamPlatformOperatorLookup implements PlatformOperatorLookup {
  constructor(private readonly operators: Pick<PlatformOperatorRepository, "findByUserId">) {}

  async findActiveOperator(userId: string): Promise<ActivePlatformOperator | undefined> {
    const operator = await this.operators.findByUserId(asId(userId));
    if (operator === undefined || operator.status !== USER_STATUS.ACTIVE) return undefined;
    return {
      platformOperatorId: operator.platformOperatorId,
      platformRoles: operator.platformRoles,
    };
  }
}
