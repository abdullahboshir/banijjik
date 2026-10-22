import type { AccountStatus } from "@banijjik/contracts/accounting";
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

const ACCOUNT_PROJECTION =
  "accountId organizationId accountCode name accountType isSystem status version parentAccountCode createdAt updatedAt createdByUserId updatedByUserId -_id";
function accountModel(): Model<AccountDocument> {
  return models({}).get<AccountDocument>(ACCOUNT_MODEL_NAME);
}

function toEntity(row: AccountDocument): Account {
  return Account.rehydrate({
    accountId: asId<AccountId>(row.accountId),
    version: row.version ?? 1,
    parentAccountCode: row.parentAccountCode ?? null,
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
  /** A journal and an archive must conflict rather than both commit from an ACTIVE snapshot. */
  async reserveActive(accountId: AccountId): Promise<boolean> {
    const result = await accountModel().updateOne(
      { accountId, status: ACCOUNT_STATUS.ACTIVE },
      { $inc: { postingVersion: 1 } },
      sessionOption(getActiveSession()),
    );
    return result.matchedCount === 1;
  }

  async listPage(
    page: number,
    limit: number,
    accountId?: string | undefined,
  ): Promise<{ items: Account[]; hasNext: boolean }> {
    const rows = await accountModel()
      .find(accountId === undefined ? {} : { accountId })
      .select(ACCOUNT_PROJECTION)
      .sort({ accountType: 1, accountCode: 1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<AccountDocument[]>();
    return { items: rows.slice(0, limit).map(toEntity), hasNext: rows.length > limit };
  }

  async updateDetails(input: {
    accountId: AccountId;
    version: number;
    name?: { bn: string; en: string } | undefined;
    status?: AccountStatus | undefined;
    actorUserId: UserId | null;
    now: Date;
  }): Promise<boolean> {
    const versionFilter =
      input.version === 1
        ? { $or: [{ version: 1 }, { version: { $exists: false } }] }
        : { version: input.version };
    const result = await accountModel().updateOne(
      { accountId: input.accountId, ...versionFilter },
      {
        $set: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.status === undefined ? {} : { status: input.status }),
          version: input.version + 1,
          updatedAt: input.now,
          updatedByUserId: input.actorUserId,
        },
      },
      sessionOption(getActiveSession()),
    );
    return result.modifiedCount === 1;
  }

  async insert(account: Account): Promise<"inserted" | "duplicate"> {
    try {
      await accountModel().create(
        [
          {
            accountId: account.accountId,
            version: account.version,
            parentAccountCode: account.parentAccountCode,
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
      .findOne(
        { accountCode, status: ACCOUNT_STATUS.ACTIVE },
        ACCOUNT_PROJECTION,
        sessionOption(getActiveSession()),
      )
      .lean<AccountDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async findById(accountId: AccountId): Promise<Account | undefined> {
    const row = await accountModel()
      .findOne({ accountId }, ACCOUNT_PROJECTION, sessionOption(getActiveSession()))
      .lean<AccountDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async listAll(): Promise<Account[]> {
    const rows = await accountModel()
      .find({})
      .select(ACCOUNT_PROJECTION)
      .sort({ accountType: 1, accountCode: 1 })
      .lean<AccountDocument[]>();
    return rows.map(toEntity);
  }

  async listActive(): Promise<Account[]> {
    const rows = await accountModel()
      .find({ status: ACCOUNT_STATUS.ACTIVE })
      .select(ACCOUNT_PROJECTION)
      .sort({ accountCode: 1 })
      .lean<AccountDocument[]>();
    return rows.map(toEntity);
  }

  async countSystemAccounts(): Promise<number> {
    return accountModel().countDocuments({ isSystem: true });
  }

  async listByOrganization(organizationId: OrganizationId): Promise<Account[]> {
    const rows = await accountModel()
      .find({ organizationId })
      .select(ACCOUNT_PROJECTION)
      .sort({ accountCode: 1 })
      .lean<AccountDocument[]>();
    return rows.map(toEntity);
  }
}
