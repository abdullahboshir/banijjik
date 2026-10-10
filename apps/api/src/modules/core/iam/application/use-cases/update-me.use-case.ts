import type { PreferredLocale } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { sessionNotValid } from "../../domain/errors.js";
import type { User } from "../../domain/user.entity.js";
import type { UserRepository } from "../ports/user-repository.js";

export interface UpdateMeInput {
  readonly userId: UserId;
  readonly name?: string | undefined;
  readonly preferredLocale?: PreferredLocale | undefined;
  /** The version the client last saw (optimistic concurrency). */
  readonly version: number;
}

export interface UpdateMeDependencies {
  readonly users: UserRepository;
}

/** Edits the person own profile. A stale version is a 409 from the repository. */
export class UpdateMeUseCase {
  constructor(private readonly dependencies: UpdateMeDependencies) {}

  async execute(input: UpdateMeInput): Promise<User> {
    const { users } = this.dependencies;
    const user = await users.findById(input.userId);
    if (user === undefined) throw sessionNotValid();
    const edited = user.withProfile({
      name: input.name,
      preferredLocale: input.preferredLocale,
    });
    return users.saveProfile(edited, input.version);
  }
}
