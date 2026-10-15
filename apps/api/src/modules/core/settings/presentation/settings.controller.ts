import type { PaginationQuery } from "@banijjik/validation";
import type {
  ModuleKeyParams,
  ModuleSwitchBody,
  SettingsQuery,
  UpdateSettingsBody,
  UpdateTermsBody,
} from "@banijjik/validation";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { TenantModuleSwitch } from "../../../platform/entitlement/index.js";
import type { GetSettingsUseCase } from "../application/use-cases/get-settings.use-case.js";
import type { GetTermsUseCase } from "../application/use-cases/get-terms.use-case.js";
import type { UpdateSettingsUseCase } from "../application/use-cases/update-settings.use-case.js";
import type { UpdateTermsUseCase } from "../application/use-cases/update-terms.use-case.js";
import { toSettingsResponse } from "./settings.transformer.js";

export interface SettingsControllerDependencies {
  readonly getSettings: GetSettingsUseCase;
  readonly updateSettings: UpdateSettingsUseCase;
  readonly getTerms: GetTermsUseCase;
  readonly updateTerms: UpdateTermsUseCase;
  readonly modules: TenantModuleSwitch;
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

  readonly getTerms: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    sendData(response, { terms: await this.dependencies.getTerms.execute(organizationId) });
  };

  readonly updateTerms: RequestHandler = async (request, response) => {
    const body: UpdateTermsBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const terms = await this.dependencies.updateTerms.execute({
      organizationId,
      actorUserId,
      items: body.items,
    });
    sendData(response, { terms });
  };

  readonly listModules: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as PaginationQuery;
    const { organizationId } = readTenantCaller();
    const page = await this.dependencies.modules.list(organizationId, query.page, query.limit);
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly disableModule: RequestHandler = async (request, response) => {
    await this.switchModule(request, response, "disable");
  };

  readonly enableModule: RequestHandler = async (request, response) => {
    await this.switchModule(request, response, "enable");
  };

  private async switchModule(
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
    action: "disable" | "enable",
  ): Promise<void> {
    const params = response.locals["validated"].params as ModuleKeyParams;
    const body: ModuleSwitchBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const view = await this.dependencies.modules[action]({
      organizationId,
      actorUserId,
      moduleKey: params.moduleKey,
      reason: body.reason,
    });
    sendData(response, view);
  }
}
