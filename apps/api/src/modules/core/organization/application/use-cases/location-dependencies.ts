import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { LocationManagementRepository } from "../ports/location-management-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface LocationDependencies {
  readonly locations: LocationManagementRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
}
