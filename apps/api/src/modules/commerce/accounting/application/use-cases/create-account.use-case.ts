import { type AccountResponse, type LocalizedAccountName } from "@banijjik/contracts/accounting";
import { AUDIT_ACTION, SEQUENCE_KEY } from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import { notFound, AppError } from "../../../../../kernel/http/index.js";
import { ERROR_CODE } from "@banijjik/contracts";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { Account } from "../../domain/account.entity.js";
import { accountCodeConflict } from "../../domain/bookkeeping-errors.js";
import type { AccountRepository } from "../ports/account-repository.js";
import { toAccountResponse } from "../post-journal.js";

export interface CreateAccountInput {
  readonly organizationId: OrganizationId;
  readonly name: LocalizedAccountName;
  readonly accountType: AccountResponse["accountType"];
  readonly parentAccountCode?: string | undefined;
  readonly actorUserId: UserId | null;
}

export class CreateAccountUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: CreateAccountInput): Promise<AccountResponse> {
    if (input.parentAccountCode !== undefined) {
      const parent = await this.accounts.findByCode(input.parentAccountCode);
      if (parent === undefined || parent.organizationId !== input.organizationId) throw notFound();
      if (parent.accountType !== input.accountType)
        throw new AppError({ code: ERROR_CODE.VALIDATION_ERROR });
    }
    const sequence = await nextSequenceValue({
      organizationId: input.organizationId,
      sequenceKey: SEQUENCE_KEY.CUSTOM_ACCOUNT,
    });
    const accountCode = `C-${sequence}`;

    const account = Account.create({
      organizationId: input.organizationId,
      accountCode,
      name: input.name,
      accountType: input.accountType,
      isSystem: false,
      parentAccountCode: input.parentAccountCode ?? null,
      now: this.clock.now(),
      actorUserId: input.actorUserId,
    });

    const result = await this.accounts.insert(account);
    if (result === "duplicate") throw accountCodeConflict();

    await this.audit.record({
      action: AUDIT_ACTION.ACCOUNT_CREATED,
      entityType: "account",
      entityId: account.accountId,
      changes: { accountCode: { to: account.accountCode } },
    });
    return toAccountResponse({
      version: account.version,
      parentAccountCode: account.parentAccountCode,
      accountId: account.accountId,
      accountCode: account.accountCode,
      name: account.name,
      accountType: account.accountType,
      isSystem: account.isSystem,
      status: account.status,
    });
  }
}
