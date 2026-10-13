import {
  DomainRuleError,
  ERROR_CODE,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type PlatformRole,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { MongoUnitOfWork } from "../../../../../kernel/db/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { OwnOperatorAccessError } from "../../domain/errors.js";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import { guardOperatorWrite } from "./operator-write-guard.js";
import { summariesOf, type OperatorSummarySource } from "./operator-summary.js";

export interface ChangePlatformOperatorRolesInput {
  readonly actorOperatorId: string;
  readonly actorUserId: UserId;
  readonly platformOperatorId: string;
  readonly platformRoles: readonly PlatformRole[];
  readonly version: number;
  readonly reason: string;
}

export interface ChangePlatformOperatorRolesDependencies {
  readonly operators: Pick<PlatformOperatorRepository, "findById" | "save" | "touch">;
  readonly users: Pick<UserRepository, "findByIds">;
  readonly unitOfWork: MongoUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}

/** Replaces an operator's roles. The same set is a no-op. */
export class ChangePlatformOperatorRolesUseCase {
  constructor(private readonly dependencies: ChangePlatformOperatorRolesDependencies) {}

  async execute(input: ChangePlatformOperatorRolesInput): Promise<OperatorSummarySource> {
    this.refuseOwn(input.actorOperatorId, input.platformOperatorId);
    const current = await this.requireOperator(input.platformOperatorId);
    if (current.hasSameRoles(input.platformRoles)) return this.summaryOf(current);
    const saved = await this.dependencies.unitOfWork.run(() => this.replace(input));
    return this.summaryOf(saved);
  }

  private refuseOwn(actorOperatorId: string, platformOperatorId: string): void {
    if (actorOperatorId === platformOperatorId) throw new OwnOperatorAccessError();
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

  private async replace(input: ChangePlatformOperatorRolesInput): Promise<PlatformOperator> {
    const { operators, platformAudit, clock } = this.dependencies;
    const guarded = await guardOperatorWrite(
      operators,
      input.actorOperatorId,
      input.platformOperatorId,
    );
    const target = guarded.target;
    if (target === undefined || target.hasSameRoles(input.platformRoles)) {
      if (target === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
      return target;
    }
    const saved = await operators.save(
      target.withRoles(input.platformRoles, clock.now()),
      input.version,
      input.actorUserId,
    );
    await platformAudit.record({
      action: PLATFORM_AUDIT_ACTION.OPERATOR_ROLES_CHANGED,
      targetType: PLATFORM_AUDIT_TARGET_TYPE.platform_operator,
      targetId: saved.platformOperatorId,
      reason: input.reason,
      changes: {
        platformRoles: { from: [...target.platformRoles], to: [...saved.platformRoles] },
      },
    });
    return saved;
  }
}
