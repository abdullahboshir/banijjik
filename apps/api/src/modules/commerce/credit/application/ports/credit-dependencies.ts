import type { CreditRepository } from "./credit-repository.js";
import type { CreditPackRepository } from "./credit-pack-repository.js";
import type { ListingUnlockRepository } from "./listing-unlock-repository.js";
import type { CreditPurchaseRepository } from "./credit-purchase-repository.js";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { UnitOfWork } from "./unit-of-work.js";
import type {
  DirectorySettingsReader,
  ListingFieldReader,
  ListingRepository,
} from "../../../directory/index.js";
import type { CustomerAccountId, OrganizationId, UserId } from "@banijjik/ids";
import type { CurrencyCode } from "@banijjik/contracts";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";

export interface CreditDependencies {
  readonly credit: CreditRepository;
  readonly packs: CreditPackRepository;
  readonly unlocks: ListingUnlockRepository;
  readonly purchases: CreditPurchaseRepository;
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
  /** The organization's IANA time zone for its business date. Fails when it is missing: no UTC fallback. */
  readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
  readonly directorySettings: DirectorySettingsReader;
  readonly resolveSettings: (
    organizationId: OrganizationId,
    keys: readonly string[],
  ) => Promise<ReadonlyMap<string, { value: unknown }>>;
  readonly approvals: ApprovalVerifier;
  readonly accounts: {
    exists(customerAccountId: CustomerAccountId): Promise<boolean>;
    findById(
      customerAccountId: CustomerAccountId,
    ): Promise<{ contactId: string; phoneE164: string } | undefined>;
  };
  readonly contacts: {
    findActiveByPhone(phoneE164: string): Promise<{ contactId: string } | undefined>;
    findActiveByEmail(email: string): Promise<{ contactId: string } | undefined>;
  };
  readonly users: {
    findIdentifiers(
      userId: UserId,
    ): Promise<
      { readonly phoneE164?: string | undefined; readonly email?: string | undefined } | undefined
    >;
  };
  readonly sequences: {
    nextPurchaseNumber(): Promise<string>;
  };
  readonly currency: {
    read(organizationId: OrganizationId): Promise<CurrencyCode | undefined>;
  };
}
