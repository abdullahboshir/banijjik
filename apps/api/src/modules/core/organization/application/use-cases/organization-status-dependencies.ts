import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OrganizationContextRunner } from "../ports/organization-context-runner.js";
import type { OrganizationStatusRepository } from "../ports/organization-status-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface OrganizationStatusDependencies {
  readonly organizations: OrganizationStatusRepository;
  /** `configVersion` moves with the status, so the next request resolves the organization afresh. */
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly platformAudit: PlatformAuditRecorder;
  /** The event row carries the organization, so the change runs inside its context (ADR-087). */
  readonly contextRunner: OrganizationContextRunner;
}
