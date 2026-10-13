import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  USER_STATUS,
  type PlatformRole,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import { isDuplicateKeyError, type MongoUnitOfWork } from "../../../../../kernel/db/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  OperatorExistsError,
  OperatorUserNotActiveError,
  OperatorUserNotFoundError,
} from "../../domain/errors.js";
import { PlatformOperator } from "../../domain/platform-operator.entity.js";
import type { User } from "../../domain/user.entity.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import { guardOperatorWrite } from "./operator-write-guard.js";
import type { OperatorSummarySource } from "./operator-summary.js";

export interface GrantPlatformOperatorInput {
  readonly actorOperatorId: string;
  readonly actorUserId: UserId;
  readonly identifier: { readonly kind: "EMAIL" | "PHONE"; readonly value: string };
  readonly platformRoles: readonly PlatformRole[];
  readonly reason: string;
}

export interface GrantPlatformOperatorDependencies {
  readonly operators: Pick<PlatformOperatorRepository, "findByUserId" | "insert" | "touch">;
  readonly users: Pick<UserRepository, "findByEmail" | "findByPhone">;
  readonly unitOfWork: MongoUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}

/** Grants operator access to a person who already has an account. */
export class GrantPlatformOperatorUseCase {
  constructor(private readonly dependencies: GrantPlatformOperatorDependencies) {}

  async execute(input: GrantPlatformOperatorInput): Promise<OperatorSummarySource> {
    const user = await this.requireActiveUser(input);
    await this.refuseExisting(user.userId);
    const created = PlatformOperator.grant({
      userId: user.userId,
      platformRoles: input.platformRoles,
      now: this.dependencies.clock.now(),
    });
    await this.dependencies.unitOfWork.run(() => this.persist(input, created));
    return { operator: created, user };
  }

  private async requireActiveUser(input: GrantPlatformOperatorInput): Promise<User> {
    const { users } = this.dependencies;
    const user =
      input.identifier.kind === "EMAIL"
        ? await users.findByEmail(input.identifier.value)
        : await users.findByPhone(input.identifier.value);
    if (user === undefined) throw new OperatorUserNotFoundError();
    if (user.status !== USER_STATUS.ACTIVE) throw new OperatorUserNotActiveError();
    return user;
  }

  private async refuseExisting(userId: UserId): Promise<void> {
    const existing = await this.dependencies.operators.findByUserId(userId);
    if (existing !== undefined) throw new OperatorExistsError();
  }

  private async persist(
    input: GrantPlatformOperatorInput,
    created: PlatformOperator,
  ): Promise<void> {
    const { operators, platformAudit } = this.dependencies;
    await guardOperatorWrite(operators, input.actorOperatorId);
    try {
      await operators.insert(created, input.actorUserId);
    } catch (error) {
      if (isDuplicateKeyError(error, "userId")) throw new OperatorExistsError();
      throw error;
    }
    await platformAudit.record({
      action: PLATFORM_AUDIT_ACTION.OPERATOR_CREATED,
      targetType: PLATFORM_AUDIT_TARGET_TYPE.platform_operator,
      targetId: created.platformOperatorId,
      reason: input.reason,
      changes: {
        platformRoles: { to: [...created.platformRoles] },
        userId: { to: created.userId },
      },
    });
  }
}
