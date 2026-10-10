import type { RequestHandler } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetMyConfigUseCase } from "../application/use-cases/get-my-config.use-case.js";

export interface MeConfigControllerDependencies {
  readonly getMyConfig: GetMyConfigUseCase;
}

export class MeConfigController {
  constructor(private readonly dependencies: MeConfigControllerDependencies) {}

  readonly get: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.getMyConfig.execute());
  };
}
