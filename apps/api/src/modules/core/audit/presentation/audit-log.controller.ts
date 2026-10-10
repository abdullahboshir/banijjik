import type { AuditLogListQuery } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { ListAuditLogsUseCase } from "../application/use-cases/list-audit-logs.use-case.js";
import { toAuditLogSummary } from "./audit-log.transformer.js";

export interface AuditLogControllerDependencies {
  readonly listAuditLogs: ListAuditLogsUseCase;
}

/** validate() stores the parsed query here, because Express 5 makes request.query read-only. */
function readQuery(response: Response): AuditLogListQuery {
  // Safe: validate({ query: auditLogListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as AuditLogListQuery;
}

export class AuditLogController {
  constructor(private readonly dependencies: AuditLogControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const query = readQuery(response);
    const result = await this.dependencies.listAuditLogs.execute(query);
    sendData(response, result.items.map(toAuditLogSummary), {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };
}
