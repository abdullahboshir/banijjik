import type { CreditRepository } from "./credit-repository.js";
import type { CreditPackRepository } from "./credit-pack-repository.js";
import type { ListingUnlockRepository } from "./listing-unlock-repository.js";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { UnitOfWork } from "./unit-of-work.js";
import type { DirectorySettingsReader, ListingRepository } from "../../../directory/index.js";
import type { OrganizationId } from "@banijjik/ids";

export interface CreditDependencies {
  readonly credit: CreditRepository;
  readonly packs: CreditPackRepository;
  readonly unlocks: ListingUnlockRepository;
  readonly listings: ListingRepository;
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
  readonly resolveSettings: (
    organizationId: OrganizationId,
    keys: readonly string[],
  ) => Promise<ReadonlyMap<string, { value: unknown }>>;
}
