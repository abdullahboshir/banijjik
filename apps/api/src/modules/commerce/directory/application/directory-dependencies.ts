import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  CustomerAccountBlocker,
  CustomerPhoneReader,
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
  ListingModerationAccess,
  ListingSequence,
  ListingUnlockCounter,
  ListingUnlockReader,
  OrganizationTimezoneSource,
} from "./ports/directory-context-ports.js";
import type { EventPublisher } from "./ports/event-publisher.js";
import type { ListingBlockRepository } from "./ports/listing-block-repository.js";
import type { ListingReportRepository } from "./ports/listing-report-repository.js";
import type { ListingRepository } from "./ports/listing-repository.js";
import type { UnitOfWork } from "./ports/unit-of-work.js";

export interface DirectoryDependencies {
  readonly listings: ListingRepository;
  readonly reports: ListingReportRepository;
  readonly blocks: ListingBlockRepository;
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
  readonly unlockCounter: ListingUnlockCounter | null;
  readonly timezones: OrganizationTimezoneSource;
}

/**
 * The staff side adds the ports a resolve needs: the second permission of the outcome and the
 * customer account ban (M.7 decisions 6, 7). The public site has no staff permissions to ask.
 */
export interface DirectoryStaffDependencies extends DirectoryDependencies {
  readonly moderationAccess: ListingModerationAccess;
  readonly accountBlocker: CustomerAccountBlocker;
}
