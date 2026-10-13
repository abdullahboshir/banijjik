import { USER_STATUS } from "@banijjik/contracts";
import type {
  PlatformOperatorCreateBody,
  PlatformOperatorListQuery,
  PlatformOperatorStatusBody,
  PlatformOperatorUpdateBody,
} from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId, requirePlatformOperatorId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { ChangePlatformOperatorRolesUseCase } from "../application/use-cases/change-platform-operator-roles.use-case.js";
import type { ChangePlatformOperatorStatusUseCase } from "../application/use-cases/change-platform-operator-status.use-case.js";
import type { GetPlatformOperatorUseCase } from "../application/use-cases/get-platform-operator.use-case.js";
import type { GrantPlatformOperatorUseCase } from "../application/use-cases/grant-platform-operator.use-case.js";
import type { ListPlatformOperatorsUseCase } from "../application/use-cases/list-platform-operators.use-case.js";
import { toPlatformOperatorResponse } from "./platform-operator.transformer.js";

export interface PlatformOperatorsControllerDependencies {
  readonly listOperators: ListPlatformOperatorsUseCase;
  readonly getOperator: GetPlatformOperatorUseCase;
  readonly grantOperator: GrantPlatformOperatorUseCase;
  readonly changeRoles: ChangePlatformOperatorRolesUseCase;
  readonly changeStatus: ChangePlatformOperatorStatusUseCase;
}

function validatedOperatorId(response: Response): string {
  // Safe: validate({ params: platformOperatorParamsSchema }) produced this value on these routes.
  return (response.locals["validated"].params as { platformOperatorId: string }).platformOperatorId;
}

/** `/platform/operators` (14-API.md section 7). */
export class PlatformOperatorsController {
  constructor(private readonly dependencies: PlatformOperatorsControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    // Safe: validate({ query: platformOperatorListQuerySchema }) produced this value on this route.
    const query = response.locals["validated"].query as PlatformOperatorListQuery;
    const page = await this.dependencies.listOperators.execute(query);
    sendData(response, page.items.map(toPlatformOperatorResponse), {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly get: RequestHandler = async (_request, response) => {
    const summary = await this.dependencies.getOperator.execute(validatedOperatorId(response));
    sendData(response, toPlatformOperatorResponse(summary));
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: PlatformOperatorCreateBody = request.body;
    const summary = await this.dependencies.grantOperator.execute({
      actorOperatorId: requirePlatformOperatorId(),
      actorUserId: requireCurrentUserId(),
      identifier: body.identifier,
      platformRoles: body.platformRoles,
      reason: body.reason,
    });
    sendData(response, toPlatformOperatorResponse(summary), { status: 201 });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: PlatformOperatorUpdateBody = request.body;
    const summary = await this.dependencies.changeRoles.execute({
      actorOperatorId: requirePlatformOperatorId(),
      actorUserId: requireCurrentUserId(),
      platformOperatorId: validatedOperatorId(response),
      platformRoles: body.platformRoles,
      version: body.version,
      reason: body.reason,
    });
    sendData(response, toPlatformOperatorResponse(summary));
  };

  readonly disable: RequestHandler = async (request, response) => {
    await this.changeStatus(request, response, USER_STATUS.DISABLED);
  };

  readonly enable: RequestHandler = async (request, response) => {
    await this.changeStatus(request, response, USER_STATUS.ACTIVE);
  };

  private async changeStatus(
    request: Parameters<RequestHandler>[0],
    response: Response,
    status: typeof USER_STATUS.ACTIVE | typeof USER_STATUS.DISABLED,
  ): Promise<void> {
    const body: PlatformOperatorStatusBody = request.body;
    const summary = await this.dependencies.changeStatus.execute({
      actorOperatorId: requirePlatformOperatorId(),
      actorUserId: requireCurrentUserId(),
      platformOperatorId: validatedOperatorId(response),
      status,
      version: body.version,
      reason: body.reason,
    });
    sendData(response, toPlatformOperatorResponse(summary));
  }
}
