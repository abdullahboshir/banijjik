import type { ReportDailyQuery, ReportHomeQuery } from "@banijjik/validation/report";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { DailyReportUseCase } from "../application/daily.use-case.js";
import type { HomeReportUseCase } from "../application/home.use-case.js";

export interface ReportControllerDependencies {
  readonly home: HomeReportUseCase;
  readonly daily: DailyReportUseCase;
}

export class ReportController {
  constructor(private readonly dependencies: ReportControllerDependencies) {}

  readonly home: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as ReportHomeQuery;
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.home.execute({ organizationId, locationId: query.location }),
    );
  };

  readonly daily: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as ReportDailyQuery;
    const { organizationId } = readTenantCaller();
    const result = await this.dependencies.daily.execute({
      organizationId,
      from: query.from,
      to: query.to,
      locationId: query.location,
      page: query.page,
      limit: query.limit,
    });
    sendData(response, result, {
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  };
}
