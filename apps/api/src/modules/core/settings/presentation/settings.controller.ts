import type { SettingsQuery, UpdateSettingsBody } from "@banijjik/validation";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetSettingsUseCase } from "../application/use-cases/get-settings.use-case.js";
import type { UpdateSettingsUseCase } from "../application/use-cases/update-settings.use-case.js";
import { toSettingsResponse } from "./settings.transformer.js";

export interface SettingsControllerDependencies {
  readonly getSettings: GetSettingsUseCase;
  readonly updateSettings: UpdateSettingsUseCase;
}

/** `GET` and `PATCH /orgs/{organizationId}/settings` (14-API, ADR-103). */
export class SettingsController {
  constructor(private readonly dependencies: SettingsControllerDependencies) {}

  readonly getSettings: RequestHandler = async (_request, response) => {
    // Express 5 makes request.query read-only; validate() stores the parsed query here.
    const query = response.locals["validated"].query as SettingsQuery;
    const { organizationId } = readTenantCaller();
    const resolved = await this.dependencies.getSettings.execute({
      organizationId,
      ...(query.keys === undefined ? {} : { keys: query.keys }),
      ...(query.location === undefined ? {} : { locationId: query.location }),
    });
    sendData(response, toSettingsResponse(resolved));
  };

  readonly updateSettings: RequestHandler = async (request, response) => {
    const body: UpdateSettingsBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const resolved = await this.dependencies.updateSettings.execute({
      organizationId,
      actorUserId,
      reach: allowedLocationIds,
      items: body.items,
    });
    sendData(response, toSettingsResponse(resolved));
  };
}
