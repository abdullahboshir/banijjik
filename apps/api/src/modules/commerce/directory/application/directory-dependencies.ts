import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  CustomerPhoneReader,
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
  ListingSequence,
  ListingUnlockReader,
} from "./ports/directory-context-ports.js";
import type { EventPublisher } from "./ports/event-publisher.js";
import type { ListingRepository } from "./ports/listing-repository.js";
import type { UnitOfWork } from "./ports/unit-of-work.js";

export interface DirectoryDependencies {
  readonly listings: ListingRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly fields: ListingFieldReader;
  readonly template: DirectoryTemplateReader;
  readonly settings: DirectorySettingsReader;
  readonly phones: CustomerPhoneReader;
  readonly sequences: ListingSequence;
  readonly unlockReader: ListingUnlockReader | null;
}
