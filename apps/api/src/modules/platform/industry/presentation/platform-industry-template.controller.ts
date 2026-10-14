import type { PlatformIndustryTemplateListQuery } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetIndustryTemplateUseCase } from "../application/use-cases/get-industry-template.use-case.js";
import type { ListPlatformIndustryTemplatesUseCase } from "../application/use-cases/list-platform-industry-templates.use-case.js";

export interface PlatformIndustryTemplateControllerDependencies {
  readonly listTemplates: ListPlatformIndustryTemplatesUseCase;
  readonly getTemplate: GetIndustryTemplateUseCase;
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
}
