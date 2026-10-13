import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  TOKEN_AUDIENCE,
  USER_STATUS,
  DomainRuleError,
  ERROR_CODE,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { MongoUnitOfWork } from "../../../../../kernel/db/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { OwnOperatorAccessError } from "../../domain/errors.js";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import { guardOperatorWrite } from "./operator-write-guard.js";
import { summariesOf, type OperatorSummarySource } from "./operator-summary.js";

export type OperatorStatusChange = typeof USER_STATUS.ACTIVE | typeof USER_STATUS.DISABLED;

export interface ChangePlatformOperatorStatusInput {
  readonly actorOperatorId: string;
  readonly actorUserId: UserId;
  readonly platformOperatorId: string;
  readonly status: OperatorStatusChange;
  readonly version: number;
  readonly reason: string;
}

export interface ChangePlatformOperatorStatusDependencies {
  readonly operators: Pick<PlatformOperatorRepository, "findById" | "save" | "touch">;
  readonly users: Pick<UserRepository, "findByIds">;
  readonly sessions: Pick<RefreshSessionRepository, "revokeAllForUser">;
  readonly unitOfWork: MongoUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}

/** Disables or enables an operator. Disabling also ends that person's platform sessions. */
export class ChangePlatformOperatorStatusUseCase {
  constructor(private readonly dependencies: ChangePlatformOperatorStatusDependencies) {}

  async execute(input: ChangePlatformOperatorStatusInput): Promise<OperatorSummarySource> {
    if (input.actorOperatorId === input.platformOperatorId) throw new OwnOperatorAccessError();
    const current = await this.requireOperator(input.platformOperatorId);
    if (current.status === input.status) return this.summaryOf(current);
    const saved = await this.dependencies.unitOfWork.run(() => this.apply(input));
    return this.summaryOf(saved);
  }

  private async requireOperator(platformOperatorId: string): Promise<PlatformOperator> {
    const operator = await this.dependencies.operators.findById(platformOperatorId);
    if (operator === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return operator;
  }

  private async summaryOf(operator: PlatformOperator): Promise<OperatorSummarySource> {
    const [summary] = await summariesOf([operator], this.dependencies.users);
    if (summary === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return summary;
  }

  private async apply(input: ChangePlatformOperatorStatusInput): Promise<PlatformOperator> {
    const { operators, sessions, platformAudit, clock } = this.dependencies;
    const guarded = await guardOperatorWrite(
      operators,
      input.actorOperatorId,
      input.platformOperatorId,
    );
    const target = guarded.target;
    if (target === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    if (target.status === input.status) return target;
    const now = clock.now();
    const saved = await operators.save(
      target.withStatus(input.status, now),
      input.version,
      input.actorUserId,
    );
    if (input.status === USER_STATUS.DISABLED) {
      await sessions.revokeAllForUser(saved.userId, TOKEN_AUDIENCE.PLATFORM, now);
    }
    await platformAudit.record({
      action:
        input.status === USER_STATUS.DISABLED
          ? PLATFORM_AUDIT_ACTION.OPERATOR_DISABLED
          : PLATFORM_AUDIT_ACTION.OPERATOR_ENABLED,
      targetType: PLATFORM_AUDIT_TARGET_TYPE.platform_operator,
      targetId: saved.platformOperatorId,
      reason: input.reason,
      changes: { status: { from: target.status, to: saved.status } },
    });
    return saved;
  }
}
