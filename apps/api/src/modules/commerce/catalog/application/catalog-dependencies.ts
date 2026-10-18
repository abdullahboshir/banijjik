import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { LimitGuard } from "../../../../kernel/access/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  CatalogCustomFieldReader,
  DefaultUnitReader,
  EventPublisher,
  LocationLookup,
  OfferingImageChecker,
  OrganizationCatalogContext,
  SensitiveValueAccess,
  UnitOfWork,
} from "./ports/catalog-context-ports.js";
import type { OfferingRepository } from "./ports/offering-repository.js";
import type {
  CategoryRepository,
  ModifierGroupRepository,
  OfferingCounter,
  OfferingLocationRepository,
  SynonymRepository,
} from "./ports/record-ports.js";

/** Everything a catalog use case may need: the data, the transaction, the trail and the other modules it reads. */
export interface CatalogDependencies {
  readonly offerings: OfferingRepository;
  readonly categories: CategoryRepository;
  readonly modifierGroups: ModifierGroupRepository;
  readonly locationRows: OfferingLocationRepository;
  readonly synonyms: SynonymRepository;
  readonly counter: OfferingCounter;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly limits: LimitGuard;
  readonly organization: OrganizationCatalogContext;
  readonly customFields: CatalogCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly images: OfferingImageChecker;
  readonly locationLookup: LocationLookup;
  readonly defaultUnits: DefaultUnitReader;
}
