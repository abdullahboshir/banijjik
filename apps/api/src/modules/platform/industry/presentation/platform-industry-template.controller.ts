import { INDUSTRY_TEMPLATE_STATUS } from "@banijjik/contracts";
import type {
  IndustryTemplateCreateBody,
  IndustryTemplateStatusBody,
  IndustryTemplateUpdateBody,
  PlatformIndustryTemplateListQuery,
} from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { CreateIndustryTemplateUseCase } from "../application/use-cases/create-industry-template.use-case.js";
import type { GetIndustryTemplateUseCase } from "../application/use-cases/get-industry-template.use-case.js";
import type { ListPlatformIndustryTemplatesUseCase } from "../application/use-cases/list-platform-industry-templates.use-case.js";
import type { SetIndustryTemplateStatusUseCase } from "../application/use-cases/set-industry-template-status.use-case.js";
import type { UpdateIndustryTemplateUseCase } from "../application/use-cases/update-industry-template.use-case.js";

export interface PlatformIndustryTemplateControllerDependencies {
  readonly listTemplates: ListPlatformIndustryTemplatesUseCase;
  readonly getTemplate: GetIndustryTemplateUseCase;
  readonly createTemplate: CreateIndustryTemplateUseCase;
  readonly updateTemplate: UpdateIndustryTemplateUseCase;
  readonly setStatus: SetIndustryTemplateStatusUseCase;
}

function validatedId(response: Response): string {
  // Safe: validate({ params: platformIndustryTemplateParamsSchema }) produced this value.
  return (response.locals["validated"].params as { industryTemplateId: string }).industryTemplateId;
}

export class PlatformIndustryTemplateController {
  constructor(private readonly dependencies: PlatformIndustryTemplateControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    // Safe: validate({ query: platformIndustryTemplateListQuerySchema }) produced this value.
    const query = response.locals["validated"].query as PlatformIndustryTemplateListQuery;
    const page = await this.dependencies.listTemplates.execute(query);
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly get: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.getTemplate.execute(validatedId(response)));
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: IndustryTemplateCreateBody = request.body;
    const detail = await this.dependencies.createTemplate.execute({
      actorUserId: requireCurrentUserId(),
      industryTemplateKey: body.industryTemplateKey,
      name: body.name,
      description: body.description,
      iconKey: body.iconKey,
      reason: body.reason,
      ...(body.enabledKinds === undefined ? {} : { enabledKinds: body.enabledKinds }),
      ...(body.allowedModuleKeys === undefined
        ? {}
        : { allowedModuleKeys: body.allowedModuleKeys }),
      ...(body.configuration === undefined ? {} : { configuration: body.configuration }),
      ...(body.cloneFromIndustryTemplateId === undefined
        ? {}
        : { cloneFromIndustryTemplateId: body.cloneFromIndustryTemplateId }),
    });
    sendData(response, detail, { status: 201 });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: IndustryTemplateUpdateBody = request.body;
    const detail = await this.dependencies.updateTemplate.execute({
      actorUserId: requireCurrentUserId(),
      industryTemplateId: validatedId(response),
      version: body.version,
      reason: body.reason,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.description === undefined ? {} : { description: body.description }),
      ...(body.iconKey === undefined ? {} : { iconKey: body.iconKey }),
      ...(body.enabledKinds === undefined ? {} : { enabledKinds: body.enabledKinds }),
      ...(body.allowedModuleKeys === undefined
        ? {}
        : { allowedModuleKeys: body.allowedModuleKeys }),
      ...(body.configuration === undefined ? {} : { configuration: body.configuration }),
    });
    sendData(response, detail);
  };

  readonly publish: RequestHandler = async (request, response) => {
    sendData(
      response,
      await this.changeStatus(request, response, INDUSTRY_TEMPLATE_STATUS.PUBLISHED),
    );
  };

  readonly retire: RequestHandler = async (request, response) => {
    sendData(
      response,
      await this.changeStatus(request, response, INDUSTRY_TEMPLATE_STATUS.RETIRED),
    );
  };

  private changeStatus(
    request: Parameters<RequestHandler>[0],
    response: Response,
    target: (typeof INDUSTRY_TEMPLATE_STATUS)["PUBLISHED" | "RETIRED"],
  ) {
    const body: IndustryTemplateStatusBody = request.body;
    return this.dependencies.setStatus.execute({
      actorUserId: requireCurrentUserId(),
      industryTemplateId: validatedId(response),
      version: body.version,
      reason: body.reason,
      target,
    });
  }
}
