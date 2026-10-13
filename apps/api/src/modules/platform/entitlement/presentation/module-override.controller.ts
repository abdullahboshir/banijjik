import type { PlatformModuleOverrideCreateBody } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { CreateModuleOverrideUseCase } from "../application/use-cases/create-module-override.use-case.js";
import type { DeleteModuleOverrideUseCase } from "../application/use-cases/delete-module-override.use-case.js";
import type { ListModuleOverridesUseCase } from "../application/use-cases/list-module-overrides.use-case.js";
import { toModuleOverrideResponse } from "./module-override.transformer.js";

export interface ModuleOverrideControllerDependencies {
  readonly listOverrides: ListModuleOverridesUseCase;
  readonly createOverride: CreateModuleOverrideUseCase;
  readonly deleteOverride: DeleteModuleOverrideUseCase;
}

interface OverrideParams {
  readonly organizationId: string;
  readonly moduleOverrideId: string;
}

function paramsOf(response: Response): OverrideParams {
  // Safe: validate({ params }) produced this value on these routes.
  return response.locals["validated"].params as OverrideParams;
}

export class ModuleOverrideController {
  constructor(private readonly dependencies: ModuleOverrideControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { organizationId } = paramsOf(response);
    const rows = await this.dependencies.listOverrides.execute({ organizationId });
    sendData(response, rows.map(toModuleOverrideResponse));
  };

  readonly create: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the create schema.
    const body: PlatformModuleOverrideCreateBody = request.body;
    const created = await this.dependencies.createOverride.execute({
      actorUserId: requireCurrentUserId(),
      organizationId: paramsOf(response).organizationId,
      moduleKey: body.moduleKey,
      effect: body.effect,
      reason: body.reason,
      expiresAt: body.expiresAt,
    });
    sendData(response, toModuleOverrideResponse(created), { status: 201 });
  };

  readonly remove: RequestHandler = async (_request, response) => {
    const { organizationId, moduleOverrideId } = paramsOf(response);
    await this.dependencies.deleteOverride.execute({ organizationId, moduleOverrideId });
    response.status(204).end();
  };
}
