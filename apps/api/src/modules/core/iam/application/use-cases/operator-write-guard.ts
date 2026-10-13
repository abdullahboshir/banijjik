import { ERROR_CODE, DomainRuleError } from "@banijjik/contracts";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";

export interface GuardedOperatorWrite {
  readonly actor: PlatformOperator;
  readonly target: PlatformOperator | undefined;
}

/**
 * Serializes operator writes (ADR-092). Touching the actor and the target makes two transactions
 * that would remove the last active super admin conflict, so one retries and then sees a disabled actor.
 */
export async function guardOperatorWrite(
  operators: Pick<PlatformOperatorRepository, "touch">,
  actorOperatorId: string,
  targetOperatorId?: string,
): Promise<GuardedOperatorWrite> {
  const actor = await operators.touch(actorOperatorId);
  if (actor === undefined || !actor.isActiveSuperAdmin()) {
    throw new DomainRuleError({ code: ERROR_CODE.FORBIDDEN });
  }
  if (targetOperatorId === undefined) return { actor, target: undefined };
  const target = await operators.touch(targetOperatorId);
  if (target === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
  return { actor, target };
}
