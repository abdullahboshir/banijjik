import type { UserId } from "@banijjik/ids";
import { sessionNotValid } from "../../domain/errors.js";
import type { User } from "../../domain/user.entity.js";
import type { UserRepository } from "../ports/user-repository.js";

export interface GetMeInput {
  readonly userId: UserId;
}

export interface GetMeDependencies {
  readonly users: UserRepository;
}

export class GetMeUseCase {
  constructor(private readonly dependencies: GetMeDependencies) {}

  async execute(input: GetMeInput): Promise<User> {
    const user = await this.dependencies.users.findById(input.userId);
    // A valid token for a user that no longer exists is not a session any more.
    if (user === undefined) throw sessionNotValid();
    return user;
  }
}
