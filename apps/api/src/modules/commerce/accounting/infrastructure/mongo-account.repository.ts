import { ACCOUNT_STATUS } from "@banijjik/contracts/accounting";
import { asId, type AccountId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type { AccountRepository } from "../application/ports/account-repository.js";
import { Account } from "../domain/account.entity.js";
import { ACCOUNT_MODEL_NAME, type AccountDocument } from "./account.schema.js";

function accountModel(): Model<AccountDocument> {
  return models({}).get<AccountDocument>(ACCOUNT_MODEL_NAME);
}

function toEntity(row: AccountDocument): Account {
  return Account.rehydrate({
    accountId: asId<AccountId>(row.accountId),
    organizationId: asId<OrganizationId>(row.organizationId),
    accountCode: row.accountCode,
    name: row.name,
    accountType: row.accountType,
    isSystem: row.isSystem,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

export class MongoAccountRepository implements AccountRepository {
  async insert(account: Account): Promise<"inserted" | "duplicate"> {
    try {
      await accountModel().create(
        [
          {
            accountId: account.accountId,
            organizationId: account.organizationId,
            accountCode: account.accountCode,
            name: account.name,
            accountType: account.accountType,
            isSystem: account.isSystem,
            status: account.status,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            createdByUserId: account.createdByUserId,
            updatedByUserId: account.updatedByUserId,
          },
        ],
        sessionOption(getActiveSession()),
      );
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error, "accountCode")) return "duplicate";
      throw error;
    }
  }

  async findByCode(accountCode: string): Promise<Account | undefined> {
    const row = await accountModel()
      .findOne({ accountCode, status: ACCOUNT_STATUS.ACTIVE })
      .lean<AccountDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async findById(accountId: AccountId): Promise<Account | undefined> {
    const row = await accountModel().findOne({ accountId }).lean<AccountDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async listActive(): Promise<Account[]> {
    const rows = await accountModel()
      .find({ status: ACCOUNT_STATUS.ACTIVE })
      .sort({ accountCode: 1 })
      .lean<AccountDocument[]>();
    return rows.map(toEntity);
  }

  async countSystemAccounts(): Promise<number> {
    return accountModel().countDocuments({ isSystem: true });
  }

  async updateName(
    accountId: AccountId,
    name: { readonly bn: string; readonly en: string },
  ): Promise<void> {
    await accountModel().updateOne(
      { accountId },
      { name, updatedAt: new Date() },
      sessionOption(getActiveSession()),
    );
  }

  async updateStatus(accountId: AccountId, status: AccountStatus): Promise<void> {
    await accountModel().updateOne(
      { accountId },
      { status, updatedAt: new Date() },
      sessionOption(getActiveSession()),
    );
  }

  async listByOrganization(organizationId: OrganizationId): Promise<Account[]> {
    const rows = await accountModel()
      .find({ organizationId })
      .sort({ accountCode: 1 })
      .lean<AccountDocument[]>();
    return rows.map(toEntity);
  }

  async listByTypeAndStatus(
    organizationId: OrganizationId,
    accountType: AccountType,
    status: AccountStatus,
  ): Promise<Account[]> {
    const rows = await accountModel()
      .find({ organizationId, accountType, status })
      .sort({ accountCode: 1 })
      .lean<AccountDocument[]>();
    return rows.map(toEntity);
  }
}
