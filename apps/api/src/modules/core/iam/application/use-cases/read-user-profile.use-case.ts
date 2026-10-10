import type { PreferredLocale } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { UserRepository } from "../ports/user-repository.js";

export interface UserProfile {
  readonly name: string;
  readonly preferredLocale: PreferredLocale;
}

export interface ReadUserProfileDependencies {
  readonly users: UserRepository;
}

/**
 * The two profile fields other modules may read: the display name and the language. Nothing else
 * of the user (email, phone, hash, status) leaves the iam module this way.
 */
export class ReadUserProfileUseCase {
  constructor(private readonly dependencies: ReadUserProfileDependencies) {}

  async execute(input: { readonly userId: UserId }): Promise<UserProfile | undefined> {
    const user = await this.dependencies.users.findById(input.userId);
    if (user === undefined) return undefined;
    return { name: user.name, preferredLocale: user.preferredLocale };
  }
}
