import { asId, type ContactId, type CustomerAccountId, type UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  stripMongoInternals,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { CustomerAccountRepository } from "../application/ports/customer-account-ports.js";
import { CustomerAccount } from "../domain/customer-account.entity.js";
import {
  CUSTOMER_ACCOUNT_MODEL_NAME,
  type CustomerAccountDocument,
} from "./customer-account.schema.js";

function toAccount(document: CustomerAccountDocument): CustomerAccount {
  const stored = stripMongoInternals(document);
  return CustomerAccount.restore({
    customerAccountId: asId<CustomerAccountId>(stored.customerAccountId),
    contactId: asId<ContactId>(stored.contactId),
    phoneE164: stored.phoneE164,
    status: stored.status,
    verifiedAt: stored.verifiedAt,
    lastLoginAt: stored.lastLoginAt,
    blockedAt: stored.blockedAt,
    blockedByUserId:
      stored.blockedByUserId === undefined ? undefined : asId<UserId>(stored.blockedByUserId),
    version: stored.version,
    createdAt: stored.createdAt,
  });
}

/** A tenant model: the plugin adds the organization filter, so an account of another business is never found. */
export class MongoCustomerAccountRepository implements CustomerAccountRepository {
  async insert(account: CustomerAccount): Promise<void> {
    await this.model().create(
      [
        {
          customerAccountId: account.customerAccountId,
          contactId: account.contactId,
          phoneE164: account.phoneE164,
          status: account.status,
          verifiedAt: account.verifiedAt,
          lastLoginAt: account.lastLoginAt,
          version: account.version,
        },
      ],
      sessionOption(getActiveSession()),
    );
  }

  findById(customerAccountId: CustomerAccountId): Promise<CustomerAccount | undefined> {
    return this.findOneBy({ customerAccountId });
  }

  findByPhone(phoneE164: string): Promise<CustomerAccount | undefined> {
    return this.findOneBy({ phoneE164 });
  }

  findByContactId(contactId: ContactId): Promise<CustomerAccount | undefined> {
    return this.findOneBy({ contactId });
  }

  async deleteByContactId(contactId: ContactId): Promise<CustomerAccountId | undefined> {
    const deleted = await this.model()
      .findOneAndDelete(
        { contactId },
        { projection: { customerAccountId: 1 }, ...sessionOption(getActiveSession()) },
      )
      .lean<Pick<CustomerAccountDocument, "customerAccountId">>();
    return deleted === null ? undefined : asId<CustomerAccountId>(deleted.customerAccountId);
  }

  async recordLogin(customerAccountId: CustomerAccountId, now: Date): Promise<void> {
    await this.model().updateOne(
      { customerAccountId },
      { $set: { lastLoginAt: now }, $inc: { version: 1 } },
      sessionOption(getActiveSession()),
    );
  }

  async save(
    account: CustomerAccount,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<CustomerAccount> {
    const set = { status: account.status, updatedByUserId: actorUserId };
    const saved = await updateVersioned<CustomerAccountDocument>({
      model: this.model(),
      filter: { customerAccountId: account.customerAccountId },
      expectedVersion,
      update:
        account.blockedAt === undefined
          ? { $set: set, $unset: { blockedAt: 1, blockedByUserId: 1 } }
          : {
              $set: {
                ...set,
                blockedAt: account.blockedAt,
                blockedByUserId: account.blockedByUserId,
              },
            },
    });
    return toAccount(saved);
  }

  private async findOneBy(filter: object): Promise<CustomerAccount | undefined> {
    const document = await this.model()
      .findOne(filter, null, sessionOption(getActiveSession()))
      .lean<CustomerAccountDocument>();
    return document === null ? undefined : toAccount(document);
  }

  private model() {
    return models({}).get<CustomerAccountDocument>(CUSTOMER_ACCOUNT_MODEL_NAME);
  }
}
