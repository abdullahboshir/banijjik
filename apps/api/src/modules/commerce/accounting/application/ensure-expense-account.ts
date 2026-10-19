import { ACCOUNT_TYPE } from "@banijjik/contracts/accounting";
import type { LocalizedAccountName } from "@banijjik/contracts/accounting";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Clock } from "../../../../kernel/time/index.js";
import { Account } from "../domain/account.entity.js";
import type { AccountRepository } from "./ports/account-repository.js";
import type { ExpenseAccountWriter } from "./ports/expense-account-writer.js";

export function buildExpenseAccountWriter(input: {
  readonly accounts: AccountRepository;
  readonly clock: Clock;
}): ExpenseAccountWriter {
  return {
    async ensureExpenseAccount(request: {
      readonly organizationId: OrganizationId;
      readonly accountCode: string;
      readonly name: LocalizedAccountName;
      readonly actorUserId: UserId | null;
    }) {
      const existing = await input.accounts.findByCode(request.accountCode);
      if (existing !== undefined) {
        return { accountId: existing.accountId, accountCode: existing.accountCode };
      }
      const account = Account.create({
        organizationId: request.organizationId,
        accountCode: request.accountCode,
        name: request.name,
        accountType: ACCOUNT_TYPE.EXPENSE,
        isSystem: false,
        now: input.clock.now(),
        actorUserId: request.actorUserId,
      });
      const result = await input.accounts.insert(account);
      if (result === "duplicate") {
        const raced = await input.accounts.findByCode(request.accountCode);
        if (raced === undefined) throw new Error("expense account duplicate without row");
        return { accountId: raced.accountId, accountCode: raced.accountCode };
      }
      return { accountId: account.accountId, accountCode: account.accountCode };
    },
  };
}
