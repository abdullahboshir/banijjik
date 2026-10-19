import type { LocalizedAccountName } from "@banijjik/contracts/accounting";
import type { AccountId, OrganizationId, UserId } from "@banijjik/ids";

/** Creates (or returns) an EXPENSE account for an expense category (09 ExpenseCategory). */
export interface ExpenseAccountWriter {
  ensureExpenseAccount(input: {
    readonly organizationId: OrganizationId;
    readonly accountCode: string;
    readonly name: LocalizedAccountName;
    readonly actorUserId: UserId | null;
  }): Promise<{ readonly accountId: AccountId; readonly accountCode: string }>;
}
