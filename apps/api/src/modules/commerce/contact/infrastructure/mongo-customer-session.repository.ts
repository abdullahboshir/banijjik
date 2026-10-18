import { asId, type CustomerAccountId, type CustomerSessionId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  stripMongoInternals,
} from "../../../../kernel/db/index.js";
import type { CustomerSessionRepository } from "../application/ports/customer-account-ports.js";
import type { CustomerSession } from "../domain/customer-session.js";
import {
  CUSTOMER_SESSION_MODEL_NAME,
  type CustomerSessionDocument,
} from "./customer-account.schema.js";

function toSession(document: CustomerSessionDocument): CustomerSession {
  const stored = stripMongoInternals(document);
  return {
    customerSessionId: asId<CustomerSessionId>(stored.customerSessionId),
    customerAccountId: asId<CustomerAccountId>(stored.customerAccountId),
    refreshTokenHash: stored.refreshTokenHash,
    previousRefreshTokenHash: stored.previousRefreshTokenHash,
    expiresAt: stored.expiresAt,
    lastUsedAt: stored.lastUsedAt,
    userAgentSummary: stored.userAgentSummary,
  };
}

/** Sessions are revoked by deletion; MongoDB removes expired ones through the TTL index. */
export class MongoCustomerSessionRepository implements CustomerSessionRepository {
  async insert(session: CustomerSession): Promise<void> {
    await this.model().create(
      [
        {
          customerSessionId: session.customerSessionId,
          customerAccountId: session.customerAccountId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
          lastUsedAt: session.lastUsedAt,
          ...(session.userAgentSummary === undefined
            ? {}
            : { userAgentSummary: session.userAgentSummary }),
        },
      ],
      sessionOption(getActiveSession()),
    );
  }

  findByTokenHash(refreshTokenHash: string): Promise<CustomerSession | undefined> {
    return this.findOneBy({ refreshTokenHash });
  }

  findByPreviousTokenHash(refreshTokenHash: string): Promise<CustomerSession | undefined> {
    return this.findOneBy({ previousRefreshTokenHash: refreshTokenHash });
  }

  async rotate(input: {
    readonly customerSessionId: CustomerSessionId;
    readonly currentHash: string;
    readonly newHash: string;
    readonly now: Date;
  }): Promise<boolean> {
    const result = await this.model().updateOne(
      { customerSessionId: input.customerSessionId, refreshTokenHash: input.currentHash },
      {
        $set: {
          refreshTokenHash: input.newHash,
          previousRefreshTokenHash: input.currentHash,
          lastUsedAt: input.now,
        },
      },
      sessionOption(getActiveSession()),
    );
    return result.modifiedCount === 1;
  }

  async deleteById(customerSessionId: CustomerSessionId): Promise<void> {
    await this.model().deleteOne({ customerSessionId }, sessionOption(getActiveSession()));
  }

  async deleteAllOfAccount(customerAccountId: CustomerAccountId): Promise<void> {
    await this.model().deleteMany({ customerAccountId }, sessionOption(getActiveSession()));
  }

  private async findOneBy(filter: object): Promise<CustomerSession | undefined> {
    const document = await this.model()
      .findOne(filter, null, sessionOption(getActiveSession()))
      .lean<CustomerSessionDocument>();
    return document === null ? undefined : toSession(document);
  }

  private model() {
    return models({}).get<CustomerSessionDocument>(CUSTOMER_SESSION_MODEL_NAME);
  }
}
