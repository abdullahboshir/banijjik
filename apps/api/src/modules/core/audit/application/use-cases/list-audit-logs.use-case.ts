import type {
  AuditLogPage,
  AuditLogQuery,
  AuditLogRepository,
} from "../ports/audit-log-repository.js";

export interface ListAuditLogsDependencies {
  readonly auditLogs: AuditLogRepository;
}

/** One page of the organization's audit entries, newest first. The tenant plugin limits it to the caller's organization. */
export class ListAuditLogsUseCase {
  constructor(private readonly dependencies: ListAuditLogsDependencies) {}

  execute(query: AuditLogQuery): Promise<AuditLogPage> {
    return this.dependencies.auditLogs.list(query);
  }
}
