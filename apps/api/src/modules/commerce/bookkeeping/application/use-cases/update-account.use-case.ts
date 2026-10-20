import {
  ACCOUNT_STATUS,
  type AccountResponse,
  type LocalizedAccountName,
} from "@banijjik/contracts/accounting";
import type { AccountId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AccountRepository } from "../../accounting/application/ports/account-repository.js";
import { toAccountResponse } from "../../accounting/application/post-journal.js";
import { systemAccountLocked } from "../domain/errors.js";

export interface UpdateAccountInput {
  readonly organizationId: OrganizationId;
  readonly accountId: AccountId;
  readonly version: number;
  readonly name?: LocalizedAccountName | undefined;
  readonly status?: string | undefined;
  readonly actorUserId: UserId | null;
}

export class UpdateAccountUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateAccountInput): Promise<AccountResponse> {
    const account = await this.accounts.findById(input.accountId);
    if (account === undefined) {
      throw new Error("Account not found");
    }

    if (account.isSystem) {
      if (input.status !== undefined) {
        throw systemAccountLocked();
      }
    }

    if (input.status === ACCOUNT_STATUS.ARCHIVED && account.isSystem) {
      throw systemAccountLocked();
    }

    if (input.name !== undefined) {
      await this.accounts.updateName(input.accountId, input.name);
    }

    if (input.status !== undefined) {
      await this.accounts.updateStatus(input.accountId, input.status as "ACTIVE" | "ARCHIVED");
    }

    const updated = await this.accounts.findById(input.accountId);
    if (updated === undefined) {
      throw new Error("Account not found after update");
    }

    return toAccountResponse({
      accountId: updated.accountId,
      accountCode: updated.accountCode,
      name: updated.name,
      accountType: updated.accountType,
      isSystem: updated.isSystem,
      status: updated.status,
    });
  }
}
