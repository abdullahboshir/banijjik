import type { UserId } from "@banijjik/ids";
import type { User } from "../../domain/user.entity.js";

export interface UserRepository {
  findById(userId: UserId): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findByPhone(phoneE164: string): Promise<User | undefined>;
  /** One `$in` read for a page of operators. An empty list reads nothing. */
  findByIds(userIds: readonly UserId[]): Promise<User[]>;
  /** Throws DuplicateIdentifierError when the email or phone number is taken. */
  insert(user: User): Promise<void>;
  /** Saves name and locale if `expectedVersion` is still current, else a 409 CONFLICT. */
  saveProfile(user: User, expectedVersion: number): Promise<User>;
  recordLogin(userId: UserId, at: Date): Promise<void>;
}
