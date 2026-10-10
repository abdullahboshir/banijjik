import type { PlatformAuditLogListQuery } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { ListPlatformAuditLogsUseCase } from "../application/use-cases/list-platform-audit-logs.use-case.js";
import { toPlatformAuditLogSummary } from "./platform-audit-log.transformer.js";

export interface PlatformAuditLogControllerDependencies {
  readonly listPlatformAuditLogs: ListPlatformAuditLogsUseCase;
}

/** validate() stores the parsed query here, because Express 5 makes request.query read-only. */
function readQuery(response: Response): PlatformAuditLogListQuery {
  // Safe: validate({ query: platformAuditLogListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as PlatformAuditLogListQuery;
}

export class PlatformAuditLogController {
  constructor(private readonly dependencies: PlatformAuditLogControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const query = readQuery(response);
    const result = await this.dependencies.listPlatformAuditLogs.execute(query);
    sendData(response, result.items.map(toPlatformAuditLogSummary), {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };
}
