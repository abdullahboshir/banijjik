import type { CreditRepository } from "./credit-repository.js";
import type { CreditPackRepository } from "./credit-pack-repository.js";
import type { ListingUnlockRepository } from "./listing-unlock-repository.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { UnitOfWork } from "../../../../kernel/db/index.js";
import type { DirectorySettingsReader } from "../../../directory/index.js";

export interface CreditDependencies {
  readonly credit: CreditRepository;
  readonly packs: CreditPackRepository;
  readonly unlocks: ListingUnlockRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: {
    publish: (
      type: string,
      payload: unknown,
      options?: { version?: number; orderingKey?: string },
    ) => Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly directorySettings: DirectorySettingsReader;
}
