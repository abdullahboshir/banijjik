import type { AuditEntry, AuditRecorder } from "../kernel/audit/index.js";

/** Remembers every entry a use case records, for unit tests that have no transaction or database. */
export class InMemoryAuditRecorder implements AuditRecorder {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
