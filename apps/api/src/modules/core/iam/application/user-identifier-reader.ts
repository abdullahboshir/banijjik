import type { UserId } from "@banijjik/ids";
import type { UserRepository } from "./ports/user-repository.js";

export interface UserIdentifierView {
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
}

export type IdentifierQuery = { readonly email: string } | { readonly phoneE164: string };

export interface UserIdentifierReader {
  findIdentifiers(userId: UserId): Promise<UserIdentifierView | undefined>;
  findUserIdByIdentifier(query: IdentifierQuery): Promise<UserId | undefined>;
}

/**
 * The email and phone number of a user, for the one other module that must match them: invitation
 * acceptance compares them with the invited identifier. Nothing else of the user leaves iam.
 */
export class IamUserIdentifierReader implements UserIdentifierReader {
  constructor(
    private readonly users: Pick<UserRepository, "findById" | "findByEmail" | "findByPhone">,
  ) {}

  async findIdentifiers(userId: UserId): Promise<UserIdentifierView | undefined> {
    const user = await this.users.findById(userId);
    if (user === undefined) return undefined;
    return { email: user.email, phoneE164: user.phoneE164 };
  }

  async findUserIdByIdentifier(query: IdentifierQuery): Promise<UserId | undefined> {
    const user =
      "email" in query
        ? await this.users.findByEmail(query.email)
        : await this.users.findByPhone(query.phoneE164);
    return user?.userId;
  }
}
