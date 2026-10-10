import type {
  PlatformAuditLogPage,
  PlatformAuditLogQuery,
  PlatformAuditLogRepository,
} from "../ports/platform-audit-log-repository.js";

export interface ListPlatformAuditLogsDependencies {
  readonly auditLogs: PlatformAuditLogRepository;
}

/** One page of the operator audit log, newest first. Reading it is not itself audited. */
export class ListPlatformAuditLogsUseCase {
  constructor(private readonly dependencies: ListPlatformAuditLogsDependencies) {}

  execute(query: PlatformAuditLogQuery): Promise<PlatformAuditLogPage> {
    return this.dependencies.auditLogs.list(query);
  }
}
