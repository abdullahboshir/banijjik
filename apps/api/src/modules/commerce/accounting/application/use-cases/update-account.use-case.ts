import { AUDIT_ACTION } from "@banijjik/contracts";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type {
  AccountResponse,
  AccountStatus,
  LocalizedAccountName,
} from "@banijjik/contracts/accounting";
import type { AccountId, OrganizationId, UserId } from "@banijjik/ids";
import { conflict, notFound } from "../../../../../kernel/http/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { AccountRepository } from "../ports/account-repository.js";
import { toAccountResponse } from "../post-journal.js";
import { systemAccountLocked } from "../../domain/bookkeeping-errors.js";
export interface UpdateAccountInput {
  readonly organizationId: OrganizationId;
  readonly accountId: AccountId;
  readonly version: number;
  readonly name?: LocalizedAccountName | undefined;
  readonly status?: AccountStatus | undefined;
  readonly actorUserId: UserId | null;
}
export class UpdateAccountUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
    private readonly audit: AuditRecorder,
  ) {}
  async execute(input: UpdateAccountInput): Promise<AccountResponse> {
    const account = await this.accounts.findById(input.accountId);
    if (account === undefined || account.organizationId !== input.organizationId) throw notFound();
    if (account.isSystem && input.status !== undefined) throw systemAccountLocked();
    if (this.accounts.updateDetails === undefined)
      throw new Error("Versioned account writer required");
    const saved = await this.accounts.updateDetails({ ...input, now: this.clock.now() });
    if (!saved) throw conflict({ version: account.version });
    const updated = await this.accounts.findById(input.accountId);
    if (updated === undefined) throw notFound();
    await this.audit.record({
      action: AUDIT_ACTION.ACCOUNT_UPDATED,
      entityType: "account",
      entityId: account.accountId,
      changes: {
        nameBn: { from: account.name.bn, to: updated.name.bn },
        nameEn: { from: account.name.en, to: updated.name.en },
        status: { from: account.status, to: updated.status },
      },
    });
    return toAccountResponse(updated);
  }
}
