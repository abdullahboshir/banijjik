import type { CreditRepository } from "./credit-repository.js";
import type { CreditPackRepository } from "./credit-pack-repository.js";
import type { ListingUnlockRepository } from "./listing-unlock-repository.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { EventPublisher } from "../../../../kernel/events/index.js";
import type { UnitOfWork } from "../../../../kernel/db/index.js";

export interface CreditDependencies {
  readonly credit: CreditRepository;
  readonly packs: CreditPackRepository;
  readonly unlocks: ListingUnlockRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}
