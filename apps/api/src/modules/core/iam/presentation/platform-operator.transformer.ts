import { USER_STATUS, type PlatformOperatorSummary } from "@banijjik/contracts";
import type { OperatorSummarySource } from "../application/use-cases/operator-summary.js";
import { identifierHintOf } from "../application/use-cases/operator-summary.js";

/** The API row. Dates are ISO strings; the hint never shows the full identifier. */
export function toPlatformOperatorResponse(source: OperatorSummarySource): PlatformOperatorSummary {
  const { operator, user } = source;
  return {
    platformOperatorId: operator.platformOperatorId,
    userId: operator.userId,
    name: user.name,
    identifierHint: identifierHintOf(user),
    platformRoles: [...operator.platformRoles],
    status: operator.status === USER_STATUS.DISABLED ? USER_STATUS.DISABLED : USER_STATUS.ACTIVE,
    version: operator.version,
    createdAt: operator.createdAt.toISOString(),
    updatedAt: operator.updatedAt.toISOString(),
  };
}
