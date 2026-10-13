import { ERROR_CODE, DomainRuleError } from "@banijjik/contracts";
import { maskIdentifier } from "@banijjik/validation";
import type { User } from "../../domain/user.entity.js";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";
import type { UserRepository } from "../ports/user-repository.js";

/** An operator row plus the user fields the summary shows. */
export interface OperatorSummarySource {
  readonly operator: PlatformOperator;
  readonly user: User;
}

/** One user read for the whole page. */
export async function summariesOf(
  operators: readonly PlatformOperator[],
  users: Pick<UserRepository, "findByIds">,
): Promise<OperatorSummarySource[]> {
  const found = await users.findByIds(operators.map((operator) => operator.userId));
  const byId = new Map(found.map((user) => [user.userId, user]));
  return operators.map((operator) => {
    const user = byId.get(operator.userId);
    if (user === undefined) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
    return { operator, user };
  });
}

export function identifierHintOf(user: User): string {
  return maskIdentifier({ email: user.email, phoneE164: user.phoneE164 });
}
