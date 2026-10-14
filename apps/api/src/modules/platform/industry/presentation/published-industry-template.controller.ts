import type { RequestHandler } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { ListPublishedIndustryTemplatesUseCase } from "../application/use-cases/list-published-industry-templates.use-case.js";

export class PublishedIndustryTemplateController {
  constructor(private readonly listPublished: ListPublishedIndustryTemplatesUseCase) {}

  readonly list: RequestHandler = async (_request, response) => {
    sendData(response, await this.listPublished.execute());
  };
}
