import type { MeUpdateBody } from "@banijjik/validation";
import type { RequestHandler } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetMeUseCase } from "../application/use-cases/get-me.use-case.js";
import type { UpdateMeUseCase } from "../application/use-cases/update-me.use-case.js";
import { toMeResponse } from "./me-response.transformer.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";

export interface MeControllerDependencies {
  readonly getMe: GetMeUseCase;
  readonly updateMe: UpdateMeUseCase;
}

export class MeController {
  constructor(private readonly dependencies: MeControllerDependencies) {}

  readonly get: RequestHandler = async (_request, response) => {
    const user = await this.dependencies.getMe.execute({ userId: requireCurrentUserId() });
    sendData(response, toMeResponse(user));
  };

  readonly update: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the me-update schema.
    const body: MeUpdateBody = request.body;
    const user = await this.dependencies.updateMe.execute({
      userId: requireCurrentUserId(),
      name: body.name,
      preferredLocale: body.preferredLocale,
      version: body.version,
    });
    sendData(response, toMeResponse(user));
  };
}
