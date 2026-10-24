import type {
  CustomerDataExportSection,
  CustomerDataExportSectionKey,
} from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";

export interface CustomerErasureResult {
  /** Credits the account still held before the erase; 0 for a module that holds none. */
  readonly forfeitedCredits: number;
}

/** Another module's part of an account erasure. Contact owns the use case (M.7 decision 14). */
export interface CustomerErasureParticipant {
  /** Runs inside the erase transaction. Idempotent: a second call finds nothing to do. */
  eraseForAccount(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly now: Date;
  }): Promise<CustomerErasureResult>;
}

/** Another module's section of the customer's data export (M.7 decision 15). */
export interface CustomerDataExportParticipant {
  readonly sectionKey: CustomerDataExportSectionKey;
  exportForAccount(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly maxRows: number;
  }): Promise<CustomerDataExportSection>;
}
