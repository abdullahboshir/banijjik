import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ContactCustomFieldReader, SensitiveValueAccess } from "./ports/custom-field-ports.js";
import type { ContactRepository } from "./ports/contact-repository.js";
import type {
  CustomerAccountRepository,
  CustomerSessionRepository,
} from "./ports/customer-account-ports.js";
import type { EventPublisher } from "./ports/event-publisher.js";
import type { ContactRoleCatalog, DedupeModeReader } from "./ports/settings-and-locations.js";
import type { UnitOfWork } from "./ports/unit-of-work.js";

/** What every contact write needs: the data, the transaction, the trail and the settings it reads. */
export interface ContactWriteDependencies {
  readonly contacts: ContactRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly customFields: ContactCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly dedupeModes: DedupeModeReader;
  readonly roleCatalog: ContactRoleCatalog;
  /** Archiving or anonymizing a contact ends its website login (card M.1). */
  readonly customerAccounts: CustomerAccountRepository;
  readonly customerSessions: CustomerSessionRepository;
}
