import { type AccountResponse, type LocalizedAccountName } from "@banijjik/contracts/accounting";
import { SEQUENCE_KEY } from "@banijjik/contracts";
import type { OrganizationId, type UserId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { Account } from "../../accounting/domain/account.entity.js";
import type { AccountRepository } from "../../accounting/application/ports/account-repository.js";
import { toAccountResponse } from "../../accounting/application/post-journal.js";

export interface CreateAccountInput {
  readonly organizationId: OrganizationId;
  readonly name: LocalizedAccountName;
  readonly accountType: string;
  readonly parentAccountCode?: string | undefined;
  readonly actorUserId: UserId | null;
}

export class CreateAccountUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateAccountInput): Promise<AccountResponse> {
    const sequence = await nextSequenceValue({
      organizationId: input.organizationId,
      sequenceKey: SEQUENCE_KEY.CUSTOM_ACCOUNT,
    });
    const accountCode = `C-${sequence}`;

    const account = Account.create({
      organizationId: input.organizationId,
      accountCode,
      name: input.name,
      accountType: input.accountType as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
      isSystem: false,
      now: this.clock.now(),
      actorUserId: input.actorUserId,
    });

    const result = await this.accounts.insert(account);
    if (result === "duplicate") {
      throw new Error("Duplicate custom account code");
    }

    return toAccountResponse({
      accountId: account.accountId,
      accountCode: account.accountCode,
      name: account.name,
      accountType: account.accountType,
      isSystem: account.isSystem,
      status: account.status,
    });
  }
}
