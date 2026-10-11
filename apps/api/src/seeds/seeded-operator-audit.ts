import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../kernel/audit/index.js";
import { runWithRequestContext } from "../kernel/context/index.js";
import type { SeededOperatorAudit } from "../modules/core/iam/index.js";

/**
 * Audits a seeded platform operator as its own actor: the recorder reads the actor from the request
 * context, and during a seed no operator is signed in. Lives here, outside the modules, with the
 * other system marks (R26).
 */
export function buildSeededOperatorAudit(
  platformAudit: PlatformAuditRecorder,
): SeededOperatorAudit {
  return {
    recordSeeded: (operator) =>
      runWithRequestContext(
        {
          requestId: newId(),
          userId: operator.userId,
          platformOperatorId: operator.platformOperatorId,
        },
        () =>
          platformAudit.record({
            action: PLATFORM_AUDIT_ACTION.OPERATOR_SEEDED,
            targetType: PLATFORM_AUDIT_TARGET_TYPE.platform_operator,
            targetId: operator.platformOperatorId,
            changes: { platformRoles: { to: [...operator.platformRoles] } },
            reason: SYSTEM_REASON.SEED,
          }),
      ),
  };
}
