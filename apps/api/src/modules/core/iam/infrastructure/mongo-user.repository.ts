import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { UserRepository } from "../application/ports/user-repository.js";
import type { User } from "../domain/user.entity.js";
import { toDuplicateIdentifierError } from "./duplicate-key.js";
import { toUser, toUserDocument } from "./user.mapper.js";
import { USER_MODEL_NAME, type UserDocument } from "./user.schema.js";

type UserFilter = { userId: string } | { email: string } | { phoneE164: string };

export class MongoUserRepository implements UserRepository {
  async findById(userId: UserId): Promise<User | undefined> {
    return this.findOne({ userId });
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.findOne({ email });
  }

  async findByPhone(phoneE164: string): Promise<User | undefined> {
    return this.findOne({ phoneE164 });
  }

  async findByIds(userIds: readonly UserId[]): Promise<User[]> {
    if (userIds.length === 0) return [];
    const documents = await this.model()
      .find(
        { userId: { $in: [...userIds] } },
        {
          userId: 1,
          name: 1,
          email: 1,
          phoneE164: 1,
          passwordHash: 1,
          status: 1,
          preferredLocale: 1,
          version: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        sessionOption(getActiveSession()),
      )
      .lean<UserDocument[]>();
    return documents.map(toUser);
  }

  async insert(user: User): Promise<void> {
    try {
      await this.model().create([toUserDocument(user)], sessionOption(getActiveSession()));
    } catch (error) {
      throw toDuplicateIdentifierError(error);
    }
  }

  async saveProfile(user: User, expectedVersion: number): Promise<User> {
    const saved = await updateVersioned<UserDocument>({
      model: this.model(),
      filter: { userId: user.userId },
      expectedVersion,
      update: { $set: { name: user.name, preferredLocale: user.preferredLocale } },
    });
    return toUser(saved);
  }

  /** Not a profile edit, so it does not bump `version`: a login must not make an open profile form stale. */
  async recordLogin(userId: UserId, at: Date): Promise<void> {
    await this.model().updateOne(
      { userId },
      { $set: { lastLoginAt: at } },
      sessionOption(getActiveSession()),
    );
  }

  private async findOne(filter: UserFilter): Promise<User | undefined> {
    const document = await this.model()
      .findOne(filter, null, sessionOption(getActiveSession()))
      .lean<UserDocument>();
    return document === null ? undefined : toUser(document);
  }

  private model() {
    return models({}).get<UserDocument>(USER_MODEL_NAME);
  }
}
