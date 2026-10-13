import type { PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { Router } from "express";
import { ChangePlatformOperatorRolesUseCase } from "./application/use-cases/change-platform-operator-roles.use-case.js";
import { ChangePlatformOperatorStatusUseCase } from "./application/use-cases/change-platform-operator-status.use-case.js";
import { GetPlatformOperatorUseCase } from "./application/use-cases/get-platform-operator.use-case.js";
import { GrantPlatformOperatorUseCase } from "./application/use-cases/grant-platform-operator.use-case.js";
import { ListPlatformOperatorsUseCase } from "./application/use-cases/list-platform-operators.use-case.js";
import { MongoPlatformOperatorRepository } from "./infrastructure/mongo-platform-operator.repository.js";
import { MongoRefreshSessionRepository } from "./infrastructure/mongo-refresh-session.repository.js";
import { MongoUserRepository } from "./infrastructure/mongo-user.repository.js";
import { PlatformOperatorsController } from "./presentation/platform-operators.controller.js";
import { buildPlatformOperatorsRouter } from "./presentation/platform-operators.router.js";

export interface IamPlatformOperatorRouterInput {
  readonly clock: Clock;
  readonly permission: PlatformPermissionMiddlewareFactory;
  readonly platformAudit: PlatformAuditRecorder;
}

/** `/platform/operators`, mounted by routes/platform.ts behind `authenticatePlatform`. */
export function buildIamPlatformOperatorRouter(input: IamPlatformOperatorRouterInput): Router {
  const shared = {
    operators: new MongoPlatformOperatorRepository(),
    users: new MongoUserRepository(),
    sessions: new MongoRefreshSessionRepository(),
    unitOfWork: new MongoUnitOfWork(),
    platformAudit: input.platformAudit,
    clock: input.clock,
  };
  const controller = new PlatformOperatorsController({
    listOperators: new ListPlatformOperatorsUseCase(shared),
    getOperator: new GetPlatformOperatorUseCase(shared),
    grantOperator: new GrantPlatformOperatorUseCase(shared),
    changeRoles: new ChangePlatformOperatorRolesUseCase(shared),
    changeStatus: new ChangePlatformOperatorStatusUseCase(shared),
  });
  return buildPlatformOperatorsRouter(controller, input.permission);
}
