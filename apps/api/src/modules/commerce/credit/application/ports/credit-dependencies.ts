import type { CreditRepository } from "./credit-repository.js";
import type { CreditPackRepository } from "./credit-pack-repository.js";
import type { ListingUnlockRepository } from "./listing-unlock-repository.js";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { UnitOfWork } from "./unit-of-work.js";
import type {
  DirectorySettingsReader,
  ListingFieldReader,
  ListingRepository,
} from "../../../directory/index.js";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import type { CurrencyCode } from "@banijjik/contracts";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";

export interface CreditDependencies {
  readonly credit: CreditRepository;
  readonly packs: CreditPackRepository;
  readonly unlocks: ListingUnlockRepository;
  readonly listings: ListingRepository;
  readonly fields: ListingFieldReader;
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
  readonly approvals: ApprovalVerifier;
  readonly accounts: {
    exists(customerAccountId: CustomerAccountId): Promise<boolean>;
  };
  readonly currency: {
    read(organizationId: OrganizationId): Promise<CurrencyCode | undefined>;
  };
}
